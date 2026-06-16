---
title: SQL 优化实战：从慢查询到高性能的完整路径
date: '2026-05-02'
tags:
  - 数据库
  - 性能优化
category: 后端工程
summary: >-
  从线上慢查询告警的实际痛点出发，系统梳理 SQL 优化的完整路径——慢查询定位、EXPLAIN 执行计划解读、索引优化策略、SQL
  写法优化、分页优化、JOIN 优化、子查询改写、批量操作优化，以及架构层面的读写分离与分库分表方案。给出不同场景下的优化策略选择与边界。
---

# SQL 优化实战：从慢查询到高性能的完整路径

## 一、问题来源

几乎所有后端系统上线后，最终都会面对数据库性能问题：

**业务层面的痛点：**

- 接口响应越来越慢，用户投诉增多，排查发现是几条 SQL 执行时间超过 5 秒
- 大促/高峰期数据库 CPU 飙升到 90%+，一条慢查询拖垮整个实例
- 分页查询越往后翻越慢，第 1000 页的响应时间是第 1 页的 100 倍
- 报表导出功能直接把数据库打挂，影响核心业务流程

**技术层面的痛点：**

- 知道要"加索引"，但加了之后查询还是慢，或者写入性能反而下降了
- `EXPLAIN` 执行计划看不懂，不知道 `Using filesort`、`Using temporary` 意味着什么
- 同样的业务逻辑，SQL 写法不同性能差 10 倍以上，但不知道坑在哪
- 网上优化方案太多太散，不确定哪个适用自己的场景

**核心问题：SQL 优化不是"加个索引"这么简单，它是一套从定位 → 分析 → 优化 → 验证的系统工程。**

本文将从慢查询定位、执行计划分析、索引策略、SQL 写法、分页与 JOIN 优化、架构级方案六个维度，给出可落地的 SQL 优化方法。

---

## 二、慢查询定位：找到问题 SQL

### 2.1 开启慢查询日志

```sql
-- 查看慢查询日志状态
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';

-- 开启慢查询日志（动态生效）
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;    -- 超过 1 秒记录
SET GLOBAL log_queries_not_using_indexes = ON;  -- 记录未使用索引的查询

-- 永久生效：my.cnf
-- slow_query_log = 1
-- long_query_time = 1
-- slow_query_log_file = /var/log/mysql/slow.log
-- log_queries_not_using_indexes = 1
```

### 2.2 使用 mysqldumpslow 分析

```bash
# 按查询时间排序，取前 10 条
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log

# 按查询次数排序，取前 10 条
mysqldumpslow -s c -t 10 /var/log/mysql/slow.log

# 参数说明
# -s t  按查询时间排序
# -s c  按查询次数排序
# -s l  按锁定时间排序
# -s r  按返回记录数排序
# -t 10 取前 10 条
```

### 2.3 performance_schema（MySQL 5.7+）

```sql
-- 查看当前正在执行的 SQL
SELECT * FROM information_schema.PROCESSLIST
WHERE command != 'Sleep' AND time > 2;

-- 查看语句事件历史（按执行时间排序）
SELECT DIGEST_TEXT,
       COUNT_STAR AS exec_count,
       ROUND(SUM_TIMER_WAIT / 1000000000000, 3) AS total_time_sec,
       ROUND(AVG_TIMER_WAIT / 1000000000, 3) AS avg_time_ms
FROM performance_schema.events_statements_summary_by_digest
ORDER BY SUM_TIMER_WAIT DESC
LIMIT 10;
```

**定位原则：先找到最慢的 SQL，再分析为什么慢。优先解决高频且耗时的查询。**

---

## 三、EXPLAIN 执行计划解读

### 3.1 基本用法

```sql
EXPLAIN SELECT * FROM order_main WHERE user_id = 10086 AND status = 'paid';
```

### 3.2 关键字段解读

| 字段 | 含义 | 关注点 |
|------|------|--------|
| `type` | 访问类型 | 从好到差：`system > const > eq_ref > ref > range > index > ALL` |
| `key` | 实际使用的索引 | `NULL` 表示未使用索引 |
| `rows` | 预估扫描行数 | 越小越好 |
| `Extra` | 额外信息 | 关注 `Using filesort`、`Using temporary` |
| `possible_keys` | 可能用到的索引 | 列出但没用 = 索引选择有问题 |
| `filtered` | 过滤比例 | 100% 最好，10% 以下说明大量无效扫描 |

### 3.3 type 字段详解（从优到差）

```
system    → 表中只有一行（const 的特例）
const     → 主键/唯一索引等值查询，最多匹配一行
eq_ref    → JOIN 中使用主键/唯一索引
ref       → 非唯一索引等值查询
range     → 索引范围扫描（BETWEEN、>、<、IN）
index     → 全索引扫描（比 ALL 好，但仍然扫描全部索引）
ALL       → 全表扫描（必须优化）
```

### 3.4 Extra 字段关键信息

```
Using index          → 覆盖索引，不回表（好）
Using where          → 在存储引擎检索后进行过滤（正常）
Using filesort       → 额外排序，未使用索引排序（需优化）
Using temporary      → 使用临时表（需优化）
Using index condition→ 索引下推（ICP，MySQL 5.6+，好）
```

**分析原则：目标是让 type 达到 ref 或以上，Extra 中不出现 Using filesort 和 Using temporary。**

---

## 四、索引优化策略

### 4.1 索引的基本原理

```
B+Tree 索引结构（InnoDB）：
- 非叶子节点只存 key，叶子节点存完整数据
- 叶子节点之间通过双向链表连接，支持范围查询
- 聚簇索引（主键）的叶子节点存完整行数据
- 二级索引的叶子节点存主键值，需要"回表"查聚簇索引
```

### 4.2 索引设计原则

```sql
-- ✅ 正确示例

-- 1. 在 WHERE、JOIN、ORDER BY、GROUP BY 的列上建索引
ALTER TABLE order_main ADD INDEX idx_user_status (user_id, status);

-- 2. 选择性高的列优先（区分度高的列放前面）
-- user_id 区分度高，status 区分度低
ALTER TABLE user_info ADD INDEX idx_phone (phone);    -- 手机号区分度高

-- 3. 联合索引遵循最左前缀原则
-- 索引 (a, b, c) 可以覆盖：
--   WHERE a = 1
--   WHERE a = 1 AND b = 2
--   WHERE a = 1 AND b = 2 AND c = 3
-- 不能覆盖：
--   WHERE b = 2           （跳过了 a）
--   WHERE c = 3           （跳过了 a, b）

-- 4. 覆盖索引：查询列都在索引中，无需回表
-- 索引 (user_id, status, created_at)
SELECT status, created_at FROM order_main WHERE user_id = 10086;
```

### 4.3 索引失效的常见场景

```sql
-- ❌ 索引失效的场景

-- 1. 对索引列使用函数
SELECT * FROM user_info WHERE YEAR(created_at) = 2026;
-- ✅ 改写为
SELECT * FROM user_info WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01';

-- 2. 隐式类型转换
-- phone 是 VARCHAR 类型
SELECT * FROM user_info WHERE phone = 13800138000;  -- ❌ 字符串列传数字
-- ✅ 改写为
SELECT * FROM user_info WHERE phone = '13800138000';

-- 3. LIKE 左模糊
SELECT * FROM user_info WHERE name LIKE '%张';    -- ❌ 左模糊
SELECT * FROM user_info WHERE name LIKE '张%';    -- ✅ 右模糊可以用索引

-- 4. OR 条件中有非索引列
-- status 没有索引
SELECT * FROM order_main WHERE user_id = 10086 OR status = 'paid';  -- ❌
-- ✅ 用 UNION ALL 替代
SELECT * FROM order_main WHERE user_id = 10086
UNION ALL
SELECT * FROM order_main WHERE status = 'paid' AND user_id != 10086;

-- 5. 不等于、NOT IN、IS NOT NULL（部分场景失效）
SELECT * FROM order_main WHERE status != 'cancelled';  -- ❌ 如果大部分数据都不是 cancelled
-- ✅ 如果业务允许，改写为 IN
SELECT * FROM order_main WHERE status IN ('pending', 'paid', 'shipped');

-- 6. 联合索引跳过左前列
-- 索引 (user_id, status, created_at)
SELECT * FROM order_main WHERE status = 'paid';  -- ❌ 跳过 user_id
-- ✅ 加上 user_id 条件，或单独为 status 建索引
```

### 4.4 索引不是越多越好

```
索引的代价：
1. 写入开销：INSERT/UPDATE/DELETE 需要维护所有索引
2. 存储空间：每个索引都是一棵 B+Tree
3. 优化器选择困难：索引过多导致执行计划选择可能不准确

建议：
- 单表索引数量控制在 5 个以内
- 联合索引优先，减少单列索引
- 定期清理不使用的索引
```

```sql
-- 查看索引使用统计
SELECT OBJECT_SCHEMA, OBJECT_NAME, INDEX_NAME,
       ROWS_READ, ROWS_FETCHED
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE OBJECT_SCHEMA = 'your_db'
ORDER BY ROWS_READ DESC;
```

---

## 五、SQL 写法优化

### 5.1 避免 SELECT *

```sql
-- ❌ 不推荐
SELECT * FROM order_main WHERE user_id = 10086;

-- ✅ 明确列出需要的列
SELECT id, order_no, total_amount, status, created_at
FROM order_main
WHERE user_id = 10086;
```

**原因：**
- 减少网络传输量
- 有可能触发覆盖索引，避免回表
- 表结构变更时不会引入意外字段

### 5.2 小表驱动大表

```sql
-- ❌ 大表驱动小表
SELECT * FROM order_main o
JOIN order_item i ON o.id = i.order_id
WHERE o.user_id = 10086;

-- 如果 order_main 100万行，order_item 1000万行
-- 先过滤 order_main，再用结果驱动 order_item 查询

-- ✅ 优化思路：确保驱动表是数据量小的那个
-- 方法 1：用 EXISTS 替代 IN（子查询结果集小时用 IN，大时用 EXISTS）
-- 子查询结果集小 → IN
SELECT * FROM order_main
WHERE user_id IN (SELECT id FROM user_info WHERE level = 'vip');

-- 子查询结果集大 → EXISTS
SELECT * FROM order_main o
WHERE EXISTS (SELECT 1 FROM order_item i WHERE i.order_id = o.id);
```

### 5.3 批量操作代替循环单条

```sql
-- ❌ 循环执行 1000 次
INSERT INTO order_item (order_id, product_id, quantity) VALUES (1, 101, 1);
INSERT INTO order_item (order_id, product_id, quantity) VALUES (1, 102, 2);
-- ... 重复 1000 次

-- ✅ 批量插入
INSERT INTO order_item (order_id, product_id, quantity) VALUES
(1, 101, 1), (1, 102, 2), (1, 103, 3), ... (1, 1100, 5);

-- 批量更新
-- ❌ 循环 UPDATE
-- ✅ CASE WHEN 批量更新
UPDATE order_item
SET quantity = CASE product_id
    WHEN 101 THEN 5
    WHEN 102 THEN 3
    WHEN 103 THEN 10
    ELSE quantity
END
WHERE product_id IN (101, 102, 103) AND order_id = 1;
```

### 5.4 避免在索引列上计算

```sql
-- ❌ 索引列参与计算
SELECT * FROM order_main WHERE id + 1 = 10087;
SELECT * FROM order_main WHERE DATE(created_at) = '2026-05-01';

-- ✅ 改写条件
SELECT * FROM order_main WHERE id = 10086;
SELECT * FROM order_main
WHERE created_at >= '2026-05-01 00:00:00'
  AND created_at < '2026-05-02 00:00:00';
```

### 5.5 合理使用 LIMIT

```sql
-- ❌ 不知道有多少结果，让数据库返回全部
SELECT * FROM order_main WHERE user_id = 10086;

-- ✅ 如果只需要前 N 条，加上 LIMIT
SELECT * FROM order_main WHERE user_id = 10086 LIMIT 20;

-- ✅ 判断是否存在，用 LIMIT 1
SELECT 1 FROM order_main WHERE order_no = 'ORD20260502001' LIMIT 1;
```

---

## 六、分页查询优化

### 6.1 传统分页的问题

```sql
-- 传统 LIMIT OFFSET 分页
SELECT * FROM order_main ORDER BY id LIMIT 100000, 20;

-- 问题：MySQL 需要扫描 100020 行，然后丢弃前 100000 行
-- 越往后翻越慢，时间复杂度 O(offset + limit)
```

### 6.2 方案对比

#### 方案一：游标分页（推荐）

```sql
-- 第一页
SELECT id, order_no, status, created_at
FROM order_main
WHERE user_id = 10086
ORDER BY id DESC
LIMIT 20;

-- 下一页（记住上一页最后一条的 id）
SELECT id, order_no, status, created_at
FROM order_main
WHERE user_id = 10086 AND id < 上一页最后一条的id
ORDER BY id DESC
LIMIT 20;
```

**优点：** 性能与页码无关，始终是 O(limit)
**缺点：** 只能上一页/下一页，不能跳转到指定页

#### 方案二：延迟关联（深分页优化）

```sql
-- ❌ 原始写法：回表 100020 次
SELECT * FROM order_main
ORDER BY id LIMIT 100000, 20;

-- ✅ 延迟关联：先通过索引查出主键，再回表
SELECT o.* FROM order_main o
INNER JOIN (
    SELECT id FROM order_main ORDER BY id LIMIT 100000, 20
) tmp ON o.id = tmp.id;
```

**优点：** 子查询走覆盖索引不回表，外层只回表 20 次
**缺点：** 仍然是 O(offset)，但常数因子大幅降低

#### 方案三：覆盖索引 + 延迟关联

```sql
-- 如果有索引 (user_id, created_at)
SELECT o.* FROM order_main o
INNER JOIN (
    SELECT id FROM order_main
    WHERE user_id = 10086
    ORDER BY created_at DESC
    LIMIT 100000, 20
) tmp ON o.id = tmp.id
WHERE o.user_id = 10086;
```

### 6.3 方案选择

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 移动端信息流 | 游标分页 | 只需上/下滑动，不需要跳页 |
| 后台管理系统列表 | 延迟关联 | 需要跳页和总条数 |
| 搜索结果页 | 游标分页 + 限制最大页码 | 搜索引擎也是游标分页 |
| 数据导出 | 流式查询 | 避免 OOM，不分页 |

---

## 七、JOIN 优化

### 7.1 JOIN 类型与选择

```sql
-- INNER JOIN：两个表都匹配的行
SELECT o.id, o.order_no, u.name
FROM order_main o
INNER JOIN user_info u ON o.user_id = u.id
WHERE o.status = 'paid';

-- LEFT JOIN：左表全部 + 右表匹配的行
SELECT u.name, COUNT(o.id) AS order_count
FROM user_info u
LEFT JOIN order_main o ON u.id = o.user_id
GROUP BY u.id;
```

### 7.2 JOIN 优化原则

```sql
-- 1. 确保 JOIN 列上有索引
-- 被 JOIN 的列（通常是外键）必须建索引
ALTER TABLE order_main ADD INDEX idx_user_id (user_id);

-- 2. 小结果集驱动大结果集
-- ✅ 先过滤，再 JOIN
SELECT o.id, o.order_no, u.name
FROM (
    SELECT id, order_no, user_id FROM order_main
    WHERE created_at >= '2026-05-01' LIMIT 1000
) o
INNER JOIN user_info u ON o.user_id = u.id;

-- 3. 避免 JOIN 过多表
-- ❌ 四表 JOIN
SELECT ... FROM a JOIN b JOIN c JOIN d ...
-- ✅ 拆成多次查询，在应用层组装
-- 3 张表以内为佳，最多不超过 5 张
```

### 7.3 子查询改写为 JOIN

```sql
-- ❌ 低效子查询
SELECT * FROM order_main
WHERE user_id IN (
    SELECT id FROM user_info WHERE level = 'vip'
);

-- ✅ 改写为 JOIN
SELECT o.* FROM order_main o
INNER JOIN user_info u ON o.user_id = u.id
WHERE u.level = 'vip';

-- ❌ 相关子查询（每行都执行一次子查询）
SELECT * FROM order_main o
WHERE (SELECT COUNT(*) FROM order_item i WHERE i.order_id = o.id) > 5;

-- ✅ 改写为 JOIN + GROUP BY
SELECT o.* FROM order_main o
INNER JOIN order_item i ON o.id = i.order_id
GROUP BY o.id
HAVING COUNT(*) > 5;
```

---

## 八、ORDER BY 与 GROUP BY 优化

### 8.1 ORDER BY 优化

```sql
-- ❌ Using filesort（未利用索引排序）
-- 索引 (user_id, status)
SELECT * FROM order_main WHERE user_id = 10086 ORDER BY created_at DESC;

-- ✅ 利用索引排序（避免 filesort）
-- 新建索引 (user_id, created_at)
ALTER TABLE order_main ADD INDEX idx_user_created (user_id, created_at);
SELECT * FROM order_main WHERE user_id = 10086 ORDER BY created_at DESC;

-- 联合索引排序规则：
-- 索引 (a, b) → ORDER BY a, b  ✅
-- 索引 (a, b) → ORDER BY a DESC, b DESC  ✅（方向一致）
-- 索引 (a, b) → ORDER BY a ASC, b DESC  ❌（方向不一致）
-- 索引 (a, b) → ORDER BY b, a  ❌（顺序不一致）
```

### 8.2 GROUP BY 优化

```sql
-- ❌ Using temporary + Using filesort
SELECT status, COUNT(*) FROM order_main GROUP BY status;

-- ✅ 利用索引分组（索引本身有序，无需临时表）
-- 如果有索引 (status)
SELECT status, COUNT(*) FROM order_main GROUP BY status;

-- WHERE + GROUP BY 的联合优化
-- 索引 (user_id, status)
SELECT status, COUNT(*) FROM order_main
WHERE user_id = 10086
GROUP BY status;  -- ✅ 走索引 idx_user_status
```

---

## 九、COUNT 优化

### 9.1 COUNT 的几种写法

```sql
-- COUNT(*)          → 统计总行数（包括 NULL），InnoDB 专门优化过
-- COUNT(1)          → 等价于 COUNT(*)
-- COUNT(列名)       → 统计该列非 NULL 的行数
-- COUNT(DISTINCT 列) → 统计该列不同值的数量

-- ❌ 不推荐：全表扫描
SELECT COUNT(*) FROM order_main;

-- ✅ 如果只需要判断是否存在数据
SELECT COUNT(*) FROM order_main WHERE user_id = 10086 LIMIT 1;
-- 或者
SELECT 1 FROM order_main WHERE user_id = 10086 LIMIT 1;
```

### 9.2 总数统计的优化方案

```sql
-- ❌ 实时 COUNT，表越大越慢
SELECT COUNT(*) FROM order_main WHERE status = 'paid';

-- ✅ 方案 1：维护统计表
CREATE TABLE table_stats (
    table_name VARCHAR(64) PRIMARY KEY,
    stat_key VARCHAR(128),
    stat_value BIGINT,
    updated_at DATETIME
);

-- ✅ 方案 2：Redis 缓存计数器
-- INCR order:status:paid:count

-- ✅ 方案 3：估算（不需要精确值时）
-- EXPLAIN SELECT COUNT(*) FROM order_main;
-- 取 rows 字段的预估值，适用于大数据量展示
```

---

## 十、架构层面的优化方案

### 10.1 读写分离

```
主库（Master）→ 处理写操作
从库（Slave）  → 处理读操作

适用场景：
- 读多写少（大部分 Web 应用的特征）
- 读操作可以容忍短暂的数据不一致

方案对比：
┌──────────────┬──────────────────┬─────────────────────┐
│     方案     │       优点       │       缺点          │
├──────────────┼──────────────────┼─────────────────────┤
│ 代码层路由   │ 灵活可控         │ 侵入业务代码        │
│ 中间件代理   │ 对应用透明       │ 多一层转发，增加延迟│
│ MySQL Router │ 官方方案         │ 功能相对简单        │
│ ShardingSphere│ 功能全面        │ 运维复杂度高        │
└──────────────┴──────────────────┴─────────────────────┘
```

### 10.2 缓存层

```
热点数据缓存策略：

1. 先查缓存 → 命中直接返回
2. 未命中 → 查数据库 → 写入缓存
3. 数据变更时 → 更新/删除缓存

注意事项：
- 缓存穿透：查询不存在的数据 → 布隆过滤器 / 缓存空值
- 缓存雪崩：大量缓存同时过期 → 过期时间加随机值
- 缓存击穿：热点 key 过期 → 互斥锁 / 永不过期
```

### 10.3 分库分表

```
什么时候考虑分库分表？
- 单表数据量 > 5000 万行
- 单表数据文件 > 20GB
- 单库 QPS > 5000

分片策略：
┌──────────────┬──────────────────────┬─────────────────────┐
│     策略     │         说明         │       适用场景       │
├──────────────┼──────────────────────┼─────────────────────┤
│ Range 分片   │ 按时间/ID 范围       │ 日志、流水类数据     │
│ Hash 分片    │ 按某个字段取模       │ 用户、订单类数据     │
│ 一致性 Hash  │ 减少数据迁移量       │ 节点可能动态增减     │
│ 枚举分片     │ 按地区/租户分        │ 多租户 SaaS          │
└──────────────┴──────────────────────┴─────────────────────┘

分库分表带来的问题：
- 分布式事务（跨库 JOIN）
- 全局唯一 ID（雪花算法）
- 非分片键查询（需要广播或建立映射表）
- 数据迁移（全量 + 增量同步）
```

### 10.4 异步处理

```sql
-- ❌ 同步写入多张表
BEGIN;
INSERT INTO order_main (...) VALUES (...);
INSERT INTO order_item (...) VALUES (...);
INSERT INTO user_points_log (...) VALUES (...);
INSERT INTO notification (...) VALUES (...);
COMMIT;

-- ✅ 核心操作同步，非核心操作异步
-- 同步：订单主表 + 明细表（事务保证）
-- 异步：积分变更、消息通知（通过消息队列）

-- 消息队列方案：
-- 1. 订单写入后发送消息到 MQ
-- 2. 消费者监听 MQ，处理积分、通知等
-- 3. 失败重试 + 死信队列保证最终一致性
```

---

## 十一、优化策略总结

### 11.1 优化优先级

```
SQL 优化决策路径：

第 1 步：定位慢查询（慢查询日志 / performance_schema）
         ↓
第 2 步：EXPLAIN 分析执行计划
         ↓
第 3 步：是否有索引？ → 无索引 → 加索引 → 验证
         ↓ 有索引
第 4 步：索引是否生效？ → 未生效 → 改写 SQL → 验证
         ↓ 已生效
第 5 步：SQL 写法是否最优？ → 改写优化 → 验证
         ↓
第 6 步：单表优化到极限 → 考虑架构方案（读写分离 / 缓存 / 分库分表）
```

### 11.2 场景与方案速查表

| 场景 | 优化手段 | 预期效果 |
|------|---------|---------|
| 全表扫描 | 添加合适的索引 | 查询速度提升 10~100 倍 |
| 索引失效 | 改写 SQL 避免函数/隐式转换 | 恢复索引使用 |
| 深分页 | 游标分页 / 延迟关联 | 翻页性能稳定 |
| 大量 JOIN | 拆分查询 / 应用层组装 | 降低 SQL 复杂度 |
| COUNT 慢 | 维护统计表 / Redis 计数 | 毫秒级返回 |
| 排序慢 | 利用索引排序避免 filesort | 消除额外排序 |
| 写入慢 | 减少索引数量 / 批量写入 | 写入吞吐提升 |
| 热点查询 | 引入缓存层 | 降低数据库压力 |

### 11.3 局限性与边界

```
SQL 优化的局限：

1. 单机优化有天花板
   - 硬件资源（CPU、内存、磁盘 IO）是物理限制
   - 单表数据量超过亿级，再怎么优化 SQL 也解决不了根本问题

2. 索引不是万能的
   - 写密集型场景，索引过多反而降低性能
   - 数据区分度低的列（如性别），索引效果极差

3. 优化有成本
   - 改写 SQL 可能影响代码可读性
   - 联合索引需要维护最左前缀规则
   - 分库分表带来运维和开发复杂度

4. 需要持续维护
   - 数据量增长后，曾经有效的索引可能不再适用
   - 业务变更可能导致 SQL 执行计划变化
   - 定期 review 慢查询日志是必要的

5. 优化器不是完美的
   - 统计信息不准确可能导致执行计划选择错误
   - 必要时使用 FORCE INDEX 强制走指定索引
   - ANALYZE TABLE 更新统计信息
```

```sql
-- 强制使用指定索引
SELECT * FROM order_main FORCE INDEX (idx_user_created)
WHERE user_id = 10086 ORDER BY created_at DESC;

-- 更新表统计信息
ANALYZE TABLE order_main;

-- 查看表状态
SHOW TABLE STATUS LIKE 'order_main';
```

---

## 十二、Code Review 检查清单

```
SQL Review 要点：

□ 是否有慢查询风险？（全表扫描、深分页、大量 JOIN）
□ EXPLAIN 执行计划的 type 是否在 ref 以上？
□ WHERE 条件的列是否有索引？
□ 联合索引是否遵循最左前缀原则？
□ 是否存在索引失效的写法？（函数、隐式转换、左模糊）
□ 是否只查需要的列？（避免 SELECT *）
□ ORDER BY / GROUP BY 是否可以利用索引？
□ 批量操作是否使用了批量语法？
□ 分页查询是否做了深分页优化？
□ 子查询是否可以改写为 JOIN？
□ 是否有 N+1 查询问题？
□ 事务范围是否最小化？（不在事务中做耗时操作）
```
