---
title: 库表设计规范：从命名到落地的工程标准
date: '2026-02-13'
tags:
  - 数据库
  - 工程化
category: 后端工程
summary: >-
  从团队协作的实际痛点出发，系统梳理库表设计的工程规范——命名规范、字段类型规范、索引规范、约束规范、业务场景设计原则（实体拆分、关系建模、状态机、树形结构、历史快照、并发控制、冷热分离、RBAC/审批流/消息等通用模式）、数字精度全链路解决方案、DDL
  变更流程与 Code Review 检查清单。
---

# 库表设计规范：从命名到落地的工程标准

## 一、问题来源

多人协作的后端项目中，数据库表设计往往是最容易产生技术债的地方：

**协作层面的痛点：**

- 同一个项目里，有人用 `user_name`，有人用 `userName`，有人用 `uname`，命名风格混乱
- 表结构没有注释或注释过期，新成员接手时完全看不懂字段含义
- 有人建表不加索引，上线后慢查询告警；有人给每个字段都加索引，写入性能骤降
- DDL 变更走口头沟通，改完发现生产环境和开发环境不一致

**技术层面的痛点：**

- 字段类型选择随意，该用 `DECIMAL` 的地方用了 `FLOAT`，金额计算出现精度丢失
- 日期字段有的用 `DATETIME`，有的用 `VARCHAR`，有的用时间戳，格式不统一
- 没有统一的软删除/硬删除策略，同一个项目里两种方式混用
- 表之间缺少外键或约束说明，数据完整性靠应用层"君子约定"

**核心问题：库表设计不是"写 SQL 建表"这么简单，它是一套工程标准。没有规范，每个开发者的"个人习惯"都会变成后来者的维护成本。**

本文将从命名、字段类型、索引、约束、DDL 变更流程、Review 检查清单六个维度，给出可落地的库表设计规范。

---

## 二、命名规范

### 2.1 总体原则

```
1. 使用小写字母 + 下划线（snake_case）
2. 名称使用有意义的英文单词，禁止拼音
3. 长度控制在 30 个字符以内
4. 禁止使用数据库保留字（order、group、user 等）
```

### 2.2 库名命名

```
格式：{业务域}_{环境}
示例：
  - shop_prod       # 电商生产库
  - shop_dev        # 电商开发库
  - shop_test       # 电商测试库
  - user_center_prod # 用户中心生产库

规则：
  - 全小写，下划线分隔
  - 必须带环境后缀，避免误操作
  - 库名与微服务/业务域一一对应
```

### 2.3 表名命名

```sql
-- ✅ 正确：业务域_实体，小写下划线
user_info
user_address
order_main
order_item
product_category
article_tag_map     -- 关联表用 _map 或 _rel 后缀

-- ❌ 错误
User                -- 大写
users               -- 禁止复数（或全员统一复数，但不要混用）
t_user              -- 不要加无意义前缀
userInfo            -- 驼峰
yonghu              -- 拼音
order               -- 保留字
```

**表名前缀约定：**

| 前缀 | 含义 | 示例 |
|------|------|------|
| 无前缀 | 业务主表 | `user_info`、`order_main` |
| `log_` | 日志表 | `log_login`、`log_operation` |
| `dict_` | 字典表 | `dict_region`、`dict_category` |
| `rel_` / `_map` | 关联表 | `rel_user_role`、`article_tag_map` |
| `tmp_` | 临时表 | `tmp_migration_data` |
| `bak_` | 备份表 | `bak_order_20260427` |

### 2.4 字段命名

```sql
-- ✅ 正确
user_id          -- 主键 / 外键用 _id 后缀
created_at       -- 时间用 _at 后缀
is_deleted       -- 布尔用 is_ 前缀
total_amount     -- 金额用 amount 后缀
status           -- 状态直接用 status
product_count    -- 数量用 _count 后缀
phone_number     -- 清晰有意义的名称

-- ❌ 错误
uid              -- 缩写不直观
time             -- 太模糊，是创建时间还是更新时间？
flag             -- 什么标志？
f1, f2, f3       -- 无意义命名
USER_ID          -- 大写
```

**常用字段命名约定：**

| 含义 | 推荐命名 | 类型 |
|------|---------|------|
| 主键 | `id` | `BIGINT` |
| 创建时间 | `created_at` | `DATETIME` |
| 更新时间 | `updated_at` | `DATETIME` |
| 逻辑删除 | `is_deleted` / `deleted_at` | `TINYINT` / `DATETIME` |
| 创建人 | `created_by` | `BIGINT` |
| 更新人 | `updated_by` | `BIGINT` |
| 排序号 | `sort_order` | `INT` |
| 备注 | `remark` | `VARCHAR(500)` |
| 状态 | `status` | `TINYINT` |
| 版本号（乐观锁） | `version` | `INT` |

### 2.5 索引命名

```sql
-- 主键索引：pk_{表名}
ALTER TABLE user_info ADD CONSTRAINT pk_user_info PRIMARY KEY (id);

-- 唯一索引：uk_{表名}_{字段名}
CREATE UNIQUE INDEX uk_user_email ON user_info(email);

-- 普通索引：idx_{表名}_{字段名}
CREATE INDEX idx_order_user_id ON order_main(user_id);

-- 联合索引：idx_{表名}_{字段1}_{字段2}
CREATE INDEX idx_order_status_created ON order_main(status, created_at);
```

---

## 三、字段类型规范

### 3.1 整数类型

```sql
-- ✅ 根据取值范围选择最小够用的类型
TINYINT          -- 0 ~ 255（无符号），状态、标志
SMALLINT         -- -32768 ~ 32767，排序号、计数
INT              -- -21 亿 ~ 21 亿，一般数量字段
BIGINT           -- 超大数量、主键（雪花 ID）

-- 所有整数字段必须明确 UNSIGNED（如果不需要负值）
TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '年龄'
```

**选择原则：**

| 场景 | 推荐类型 | 理由 |
|------|---------|------|
| 状态 / 标志 | `TINYINT` | 值域小，节省空间 |
| 排序号 | `INT` | 足够大 |
| 主键 | `BIGINT` | 雪花 ID 需要 64 位 |
| 数量 / 计数 | `INT` / `BIGINT` | 视业务量级 |

### 3.2 字符串类型

```sql
-- ✅ 固定或已知最大长度 → VARCHAR
phone VARCHAR(20) NOT NULL COMMENT '手机号'
email VARCHAR(200) NOT NULL COMMENT '邮箱'
name VARCHAR(50) NOT NULL COMMENT '用户名'

-- ✅ 长文本 → TEXT / MEDIUMTEXT / LONGTEXT
content MEDIUMTEXT COMMENT '文章内容'           -- 最大 16MB
description TEXT COMMENT '描述'                  -- 最大 64KB

-- ✅ 固定长度 → CHAR
country_code CHAR(2) COMMENT '国家代码 ISO 3166'
order_no CHAR(20) COMMENT '订单号'

-- ❌ 错误用法
content VARCHAR(10000)   -- 长文本不要用 VARCHAR
phone CHAR(20)           -- 手机号长度不固定，不要用 CHAR
name TEXT                -- 短字段不要用 TEXT
```

**VARCHAR 长度选择建议：**

| 字段 | 推荐长度 | 理由 |
|------|---------|------|
| 用户名 | `50` | 够用 |
| 手机号 | `20` | 兼容国际号码 |
| 邮箱 | `200` | RFC 5321 规定最长 254 |
| URL | `500` | 兼容长 URL |
| 地址 | `200` ~ `500` | 中文地址可能很长 |
| 密码 Hash | `200` | bcrypt 输出 60 字符，留余量 |
| JSON 扩展字段 | `1000` ~ `2000` | 视业务而定 |

### 3.3 金额类型

```sql
-- ✅ 金额必须用 DECIMAL，精确到分
price DECIMAL(10, 2) NOT NULL COMMENT '价格（元）'
total_amount DECIMAL(12, 2) NOT NULL COMMENT '总金额（元）'

-- ❌ 绝对禁止 FLOAT / DOUBLE 存金额
-- FLOAT 有精度丢失：0.1 + 0.2 ≠ 0.3
price FLOAT  -- 299.99 可能存为 299.989990234375
```

**DECIMAL 精度参考：**

| 场景 | 推荐 | 说明 |
|------|------|------|
| 商品价格 | `DECIMAL(10, 2)` | 最大 9999 万 |
| 订单总额 | `DECIMAL(12, 2)` | 最大 999 亿 |
| 平台流水 | `DECIMAL(16, 2)` | 最大 999 万亿 |

**备选方案：** 用分为单位存整数（`BIGINT`），应用层做换算。避免 `DECIMAL` 的计算开销。

### 3.4 时间类型

```sql
-- ✅ 推荐：DATETIME（可读性好，不随时区变化）
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'

-- ✅ 特定场景：TIMESTAMP（自动时区转换，但 2038 年问题）
expire_at TIMESTAMP NULL COMMENT '过期时间'

-- ✅ 仅存日期：DATE
birth_date DATE COMMENT '出生日期'

-- ❌ 禁止用字符串存时间
created_at VARCHAR(20)  -- '2026-04-27 10:00:00' → 无法用日期函数查询
```

**DATETIME vs TIMESTAMP：**

| 维度 | DATETIME | TIMESTAMP |
|------|----------|-----------|
| 范围 | `1000-01-01` ~ `9999-12-31` | `1970-01-01` ~ `2038-01-19` |
| 时区 | 不转换（存什么是什么） | 存 UTC，查询时转当前时区 |
| 存储 | 8 字节 | 4 字节 |
| 推荐 | **默认选择** | 需要时区感知的场景 |

### 3.5 布尔类型

```sql
-- ✅ 方案一：TINYINT(1)（MySQL 传统做法）
is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0-未删除 1-已删除'
is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0-非默认 1-默认'

-- ✅ 方案二：MySQL 8.0+ 可用 BOOLEAN（底层仍是 TINYINT）
is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用'

-- ❌ 禁止用 CHAR(1) 或 VARCHAR 存布尔值
is_deleted CHAR(1)  -- 'Y'/'N' → 不标准
```

### 3.6 枚举 / 状态字段

```sql
-- ✅ 推荐：TINYINT + COMMENT 注释状态值
status TINYINT NOT NULL DEFAULT 0 COMMENT '0-待支付 1-已支付 2-已发货 3-已完成 4-已取消'

-- ❌ 禁止 ENUM 类型
status ENUM('pending', 'paid', 'shipped')
-- 新增状态值需要 ALTER TABLE，大表可能锁表
-- ENUM 的索引是从 1 开始的，容易搞混

-- ❌ 禁止 VARCHAR 存状态
status VARCHAR(20)  -- 可能写入脏数据 'payd'
```

**状态码定义规范：**

```
1. 从 0 开始，连续分配（0 通常是初始状态）
2. 正向流转递增（0→1→2→3）
3. 异常/取消状态放在高位（如 9-已取消，99-异常）
4. 预留空位，方便未来扩展（0,1,2,3,4,5...9）
5. 状态码含义必须在 COMMENT 中写清楚
```

---

## 四、索引规范

### 4.1 索引创建原则

```
1. 单表索引数量不超过 5~7 个
2. 联合索引字段数不超过 5 个
3. 区分度低的列不单独建索引（如 gender 只有 2 个值）
4. 频繁作为 WHERE 条件的列优先建索引
5. ORDER BY / GROUP BY 涉及的列考虑联合索引
6. 通过慢查询日志验证索引效果，不盲目建索引
```

### 4.2 联合索引设计

```sql
-- 最左前缀原则：区分度高的列放左边

-- ✅ 正确：user_id 区分度高，status 区分度低
CREATE INDEX idx_order_user_status ON order_main(user_id, status);

-- ❌ 错误：status 放前面，大部分查询用不到
CREATE INDEX idx_order_status_user ON order_main(status, user_id);

-- ✅ 覆盖索引：查询列都在索引中，避免回表
-- SELECT user_id, total_amount FROM order_main WHERE status = 1
CREATE INDEX idx_order_status_cover ON order_main(status, user_id, total_amount);
```

### 4.3 索引禁忌

```sql
-- ❌ 禁忌 1：在区分度极低的列上建索引
CREATE INDEX idx_user_gender ON user_info(gender);  -- 只有 'M'/'F'，索引无效

-- ❌ 禁忌 2：对索引列使用函数或运算
SELECT * FROM order_main WHERE YEAR(created_at) = 2026;   -- 索引失效
SELECT * FROM order_main WHERE created_at >= '2026-01-01'; -- ✅ 索引有效

-- ❌ 禁忌 3：隐式类型转换
-- phone 是 VARCHAR(20)
SELECT * FROM user_info WHERE phone = 13800138000;      -- 索引失效
SELECT * FROM user_info WHERE phone = '13800138000';    -- ✅ 索引有效

-- ❌ 禁忌 4：LIKE 前置通配符
SELECT * FROM user_info WHERE name LIKE '%三';         -- 索引失效
SELECT * FROM user_info WHERE name LIKE '张%';         -- ✅ 索引有效

-- ❌ 禁忌 5：OR 条件中有一列无索引
SELECT * FROM order_main WHERE user_id = 1 OR remark = '紧急';
-- user_id 有索引但 remark 没有，整体索引失效

-- ❌ 禁忌 6：重复索引
CREATE INDEX idx_user_id ON order_main(user_id);
CREATE INDEX idx_user_id_status ON order_main(user_id, status);
-- idx_user_id 是冗余的，联合索引已覆盖
```

### 4.4 索引使用统计

```sql
-- 查看索引使用情况（MySQL）
SELECT
    index_name,
    rows_examined,
    rows_sent,
    idx_used
FROM sys.schema_index_statistics
ORDER BY rows_examined DESC;

-- 查看未使用的索引
SELECT * FROM sys.schema_unused_indexes
WHERE object_schema = 'shop_prod';

-- 定期清理未使用的索引（产出一份报告，Review 后再删）
```

---

## 五、约束规范

### 5.1 非空约束

```sql
-- ✅ 所有字段尽量 NOT NULL + DEFAULT
-- NULL 值会导致索引统计不准确，查询逻辑复杂化
CREATE TABLE user_info (
    id BIGINT PRIMARY KEY,
    name VARCHAR(50) NOT NULL COMMENT '用户名',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    email VARCHAR(200) DEFAULT '' COMMENT '邮箱（允许为空时给默认值）',
    age TINYINT UNSIGNED DEFAULT 0 COMMENT '年龄',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1-正常 2-禁用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ❌ 字段大量允许 NULL
CREATE TABLE user_info (
    name VARCHAR(50),      -- NULL
    phone VARCHAR(20),     -- NULL
    email VARCHAR(200)     -- NULL
    -- WHERE email != NULL 语法错误，需要 IS NULL / IS NOT NULL
);
```

**例外场景：** `deleted_at`、`expired_at` 等语义上"未设置"的字段，可以用 NULL 表示"无此状态"。

### 5.2 唯一约束

```sql
-- ✅ 业务唯一性必须用唯一索引保障
CREATE UNIQUE INDEX uk_user_phone ON user_info(phone);
CREATE UNIQUE INDEX uk_user_email ON user_info(email);

-- ✅ 联合唯一（如：用户 + 第三方平台的绑定关系）
CREATE UNIQUE INDEX uk_oauth_bind ON user_oauth(user_id, provider);

-- ✅ 软删除场景下的唯一约束（允许同名记录存在一条已删除的）
CREATE UNIQUE INDEX uk_user_name ON user_info(name, is_deleted);
```

### 5.3 外键约束

```sql
-- ❌ 生产环境一般不建议用物理外键
FOREIGN KEY (user_id) REFERENCES user_info(id)

-- 原因：
-- 1. 外键影响插入/删除性能（需要检查关联表）
-- 2. 分库分表后外键失效
-- 3. 数据导入导出困难
-- 4. 死锁风险增加

-- ✅ 推荐：应用层保证关联关系 + 文档约定
-- 表注释或数据字典中说明关联关系
CREATE TABLE order_main (
    user_id BIGINT NOT NULL COMMENT '关联 user_info.id',
    ...
);
```

### 5.4 默认值规范

```sql
-- ✅ 每个字段都应有合理默认值
CREATE TABLE order_main (
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0-待支付',
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    remark VARCHAR(500) DEFAULT '' COMMENT '备注',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '0-未删除',
    sort_order INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 默认值约定：
-- 字符串：DEFAULT ''
-- 数值：DEFAULT 0
-- 布尔：DEFAULT 0
-- 时间：DEFAULT CURRENT_TIMESTAMP
-- 禁止 DEFAULT NULL（除非语义明确需要 NULL）
```

---

## 六、每张表必须包含的基础字段

### 6.1 标准"七字段"模板

```sql
-- 所有业务表都应包含以下基础字段
CREATE TABLE {table_name} (
    id BIGINT PRIMARY KEY COMMENT '主键（雪花 ID）',

    -- ... 业务字段 ...

    -- ========== 基础字段（必须） ==========
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '0-未删除 1-已删除',
    created_by BIGINT DEFAULT NULL COMMENT '创建人 user_id',
    updated_by BIGINT DEFAULT NULL COMMENT '更新人 user_id',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',

    -- ========== 索引 ==========
    INDEX idx_{table}_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='{表用途描述}';
```

**各字段用途说明：**

| 字段 | 用途 | 必要性 |
|------|------|--------|
| `id` | 主键，雪花 ID | 必须 |
| `is_deleted` | 逻辑删除标志 | 必须 |
| `created_by` | 创建人，审计追溯 | 推荐 |
| `updated_by` | 更新人，审计追溯 | 推荐 |
| `created_at` | 创建时间 | 必须 |
| `updated_at` | 更新时间 | 必须 |
| `version` | 乐观锁，防并发覆盖 | 推荐（更新频繁的表） |

### 6.2 表选项规范

```sql
-- ✅ 必须指定
ENGINE=InnoDB                        -- 支持事务、行锁、外键
DEFAULT CHARSET=utf8mb4              -- 支持 emoji 和特殊字符
COLLATE=utf8mb4_unicode_ci           -- 大小写不敏感排序
COMMENT='用户信息表'                  -- 表必须有注释

-- ❌ 不要用
ENGINE=MyISAM    -- 不支持事务、表锁
CHARSET=latin1   -- 不支持中文
CHARSET=utf8     -- utf8 是 utf8mb3，不支持 4 字节字符（emoji）
```

---

## 七、DDL 变更流程规范

### 7.1 变更流程

```
第一步：编写 DDL
  └── 使用可重复执行的迁移脚本（IF NOT EXISTS / 存量检查）
  └── 包含回滚语句

第二步：提交 Code Review
  └── SQL 脚本纳入版本管理（migration 目录）
  └── Reviewer 检查：命名、类型、索引、约束

第三步：测试环境验证
  └── 先在测试环境执行，验证数据兼容性
  └── 检查是否有慢查询

第四步：生产环境执行
  └── 使用 pt-online-schema-change / gh-ost（避免锁表）
  └── 在低峰期执行
  └── 执行前后做数据备份

第五步：验证
  └── 检查表结构是否正确
  └── 检查应用功能是否正常
  └── 监控慢查询日志
```

### 7.2 迁移脚本规范

```sql
-- 文件名格式：V{版本号}__{描述}.sql
-- 示例：V20260427_001__add_user_nickname_field.sql

-- ✅ 可重复执行的迁移脚本
ALTER TABLE user_info
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(50) DEFAULT '' COMMENT '昵称' AFTER name;

-- ✅ 包含回滚语句（在注释中）
-- [ROLLBACK] ALTER TABLE user_info DROP COLUMN nickname;

-- ❌ 不可重复执行的脚本
ALTER TABLE user_info ADD COLUMN nickname VARCHAR(50);
-- 执行两次会报错：Duplicate column name
```

### 7.3 线上 DDL 注意事项

```sql
-- ❌ 危险操作（大表可能导致锁表）
ALTER TABLE order_main ADD COLUMN remark VARCHAR(500);
-- MySQL 5.6 之前会锁整张表
-- MySQL 5.6+ Online DDL 也可能因 tmp_table_size 不够而锁表

-- ✅ 安全操作（使用工具）
-- pt-online-schema-change
pt-online-schema-change \
    --alter "ADD COLUMN remark VARCHAR(500) DEFAULT '' COMMENT '备注'" \
    --execute \
    D=shop_prod,t=order_main \
    --max-load=Threads_running=25 \
    --critical-load=Threads_running=50

-- gh-ost（GitHub 开源的在线表变更工具）
gh-ost \
    --host=127.0.0.1 \
    --database=shop_prod \
    --table=order_main \
    --alter="ADD COLUMN remark VARCHAR(500) DEFAULT '' COMMENT '备注'" \
    --execute
```

---

## 八、Code Review 检查清单

### 8.1 建表 Review 清单

```
□ 表名是否符合命名规范（小写下划线，无保留字）
□ 表是否有 COMMENT 注释
□ 表选项是否指定 ENGINE=InnoDB, CHARSET=utf8mb4
□ 是否包含基础字段（id, is_deleted, created_at, updated_at 等）
□ 字段名是否符合命名规范
□ 字段类型是否合理（金额 DECIMAL、时间 DATETIME、状态 TINYINT）
□ 每个字段是否都有 COMMENT 注释
□ 每个字段是否都有 NOT NULL + DEFAULT
□ 索引命名是否规范（uk_ / idx_ 前缀）
□ 索引数量是否合理（≤ 7 个）
□ 唯一约束是否覆盖业务唯一性
□ 是否有合理的联合索引
□ 外键关联是否通过注释说明
```

### 8.2 DDL 变更 Review 清单

```
□ 变更是否可重复执行
□ 是否包含回滚语句
□ 是否影响现有数据（新增 NOT NULL 列需要默认值）
□ 是否需要数据迁移（新增字段后旧数据如何填充）
□ 索引变更是否经过慢查询分析验证
□ 是否评估了执行时间（大表变更是否使用在线工具）
□ 是否在低峰期执行
□ 是否已备份数据
```

### 8.3 字段类型 Review 清单

```
□ 金额是否使用 DECIMAL（禁止 FLOAT/DOUBLE）
□ 时间是否使用 DATETIME（禁止 VARCHAR 存时间）
□ 状态是否使用 TINYINT（禁止 ENUM / VARCHAR）
□ 布尔是否使用 TINYINT(1)（禁止 CHAR(1)）
□ 字符串长度是否合理（不是一律 VARCHAR(255)）
□ 整数类型是否选择最小够用的（不是一律 BIGINT）
□ 文本字段是否使用 TEXT / MEDIUMTEXT（不是 VARCHAR(10000)）
□ 字符集是否 utf8mb4（不是 utf8/latin1）
```

---

## 九、常见反模式对照

### 9.1 命名反模式

```
❌ User, ORDER, GROUP               → ✅ user_info, order_main, group_info
❌ uname, upwd, uemail              → ✅ user_name, password_hash, email
❌ t1, t2, tmp1                     → ✅ 有意义的名称
❌ time, date, flag                 → ✅ created_at, birth_date, is_active
```

### 9.2 类型反模式

```sql
-- ❌ 金额用 FLOAT
price FLOAT DEFAULT 0
-- ✅ 金额用 DECIMAL
price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '价格（元）'

-- ❌ 时间用字符串
created_at VARCHAR(20)
-- ✅ 时间用 DATETIME
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'

-- ❌ 状态用 ENUM
status ENUM('active', 'inactive', 'banned')
-- ✅ 状态用 TINYINT
status TINYINT NOT NULL DEFAULT 0 COMMENT '0-正常 1-禁用 2-封禁'

-- ❌ 长文本用 VARCHAR
content VARCHAR(50000)
-- ✅ 长文本用 MEDIUMTEXT
content MEDIUMTEXT COMMENT '文章内容'

-- ❌ 布尔用 CHAR(1)
is_active CHAR(1) DEFAULT 'Y'
-- ✅ 布尔用 TINYINT
is_active TINYINT NOT NULL DEFAULT 1 COMMENT '0-禁用 1-启用'
```

### 9.3 设计反模式

```sql
-- ❌ 无注释、无默认值、无基础字段
CREATE TABLE product (
    id int primary key,
    name varchar(100),
    price float,
    status enum('on','off'),
    time datetime
);

-- ✅ 规范建表
CREATE TABLE product_info (
    id BIGINT PRIMARY KEY COMMENT '主键（雪花 ID）',
    name VARCHAR(100) NOT NULL COMMENT '商品名称',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '价格（元）',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1-上架 2-下架',
    category_id BIGINT DEFAULT NULL COMMENT '分类 ID，关联 product_category.id',
    stock INT NOT NULL DEFAULT 0 COMMENT '库存数量',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '0-未删除 1-已删除',
    created_by BIGINT DEFAULT NULL COMMENT '创建人',
    updated_by BIGINT DEFAULT NULL COMMENT '更新人',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
    INDEX idx_category (category_id),
    INDEX idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品信息表';
```

---

## 十、业务场景设计原则

前面讲的命名、类型、索引都是"怎么写 SQL"的规范。但真正决定系统好不好维护的，是"怎么拆表、怎么建模"的设计决策。这一节从实际业务场景出发，给出可落地的设计原则。

### 10.1 实体识别与表拆分原则

**核心判断：一个"概念"该拆成几张表？**

```
拆表信号（出现以下任意一条就该考虑拆分）：
├── 字段数超过 20 个 → 查询效率低，维护困难
├── 部分字段更新极频繁，部分几乎不更新 → 锁竞争浪费
├── 部分字段只在特定页面才需要 → 列表页查了不需要的大字段
├── 数据量增长速度差异大 → 热数据被冷数据拖慢
└── 访问权限不同 → 基础信息所有人可见，敏感信息需授权
```

**示例：商品表的垂直拆分**

```sql
-- ❌ 全塞一张表（50+ 字段）
CREATE TABLE product (
    id BIGINT PRIMARY KEY,
    name VARCHAR(200),
    price DECIMAL(10,2),
    stock INT,
    description TEXT,              -- 大字段，列表页不需要
    specs JSON,                    -- 规格参数，只详情页用
    images JSON,                   -- 图片列表，只详情页用
    seo_title VARCHAR(200),        -- SEO 字段，只前台用
    seo_keywords VARCHAR(500),
    seo_description VARCHAR(500),
    -- 还有 30+ 个字段...
);

-- ✅ 按访问模式拆分：主表（列表查询）+ 详情表（详情页）+ SEO 表（前台渲染）
-- 主表：列表页需要的字段，查询高频
CREATE TABLE product_info (
    id BIGINT PRIMARY KEY COMMENT '商品 ID',
    name VARCHAR(200) NOT NULL COMMENT '商品名称',
    category_id BIGINT COMMENT '分类 ID',
    brand VARCHAR(100) COMMENT '品牌',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '售价（元）',
    original_price DECIMAL(10, 2) DEFAULT 0.00 COMMENT '原价（元）',
    cover_image VARCHAR(500) COMMENT '封面图 URL',
    stock INT NOT NULL DEFAULT 0 COMMENT '库存',
    sales_count INT NOT NULL DEFAULT 0 COMMENT '销量',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1-上架 2-下架 3-草稿',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序权重',
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category_id),
    INDEX idx_status_sort (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品主表（列表查询）';

-- 详情表：详情页才需要的大字段
CREATE TABLE product_detail (
    product_id BIGINT PRIMARY KEY COMMENT '关联 product_info.id',
    description MEDIUMTEXT COMMENT '商品描述（富文本）',
    specs JSON COMMENT '规格参数 {"颜色":"黑","内存":"8GB"}',
    images JSON COMMENT '图片列表 ["url1","url2"]',
    attributes JSON COMMENT '扩展属性',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品详情（大字段独立）';

-- SEO 表：只有前台页面渲染时需要
CREATE TABLE product_seo (
    product_id BIGINT PRIMARY KEY COMMENT '关联 product_info.id',
    seo_title VARCHAR(200) COMMENT 'SEO 标题',
    seo_keywords VARCHAR(500) COMMENT 'SEO 关键词',
    seo_description VARCHAR(500) COMMENT 'SEO 描述',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品 SEO 信息';
```

**拆分原则总结：**

| 原则 | 说明 |
|------|------|
| 列表字段与详情字段分离 | 列表页只查主表，避免加载 TEXT/JSON |
| 高频更新与低频更新分离 | stock 频繁变化，description 几乎不变 |
| 热数据与冷数据分离 | 最新数据在主表，历史数据在归档表 |
| 公开信息与敏感信息分离 | 基础信息所有人可见，价格策略仅内部 |

### 10.2 关系建模实战模式

#### 10.2.1 一对一（1:1）

```sql
-- 场景：用户基础信息 ↔ 用户扩展信息
-- 原因：基础信息高频查询，扩展信息低频且字段多

CREATE TABLE user_info (
    id BIGINT PRIMARY KEY COMMENT '用户 ID',
    nickname VARCHAR(50) NOT NULL COMMENT '昵称',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    avatar VARCHAR(500) COMMENT '头像 URL',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1-正常 2-禁用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户基础信息';

CREATE TABLE user_profile (
    user_id BIGINT PRIMARY KEY COMMENT '关联 user_info.id',
    real_name VARCHAR(50) COMMENT '真实姓名',
    id_card VARCHAR(20) COMMENT '身份证号（加密存储）',
    birthday DATE COMMENT '出生日期',
    gender TINYINT DEFAULT 0 COMMENT '0-未知 1-男 2-女',
    bio VARCHAR(500) COMMENT '个人简介',
    province VARCHAR(50) COMMENT '省份',
    city VARCHAR(50) COMMENT '城市',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户扩展信息（低频访问）';
```

#### 10.2.2 一对多（1:N）

```sql
-- 场景：用户 ↔ 收货地址（一个用户多个地址）

CREATE TABLE user_address (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '关联 user_info.id',
    receiver_name VARCHAR(50) NOT NULL COMMENT '收件人',
    receiver_phone VARCHAR(20) NOT NULL COMMENT '收件电话',
    province VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    detail VARCHAR(200) NOT NULL COMMENT '详细地址',
    is_default TINYINT NOT NULL DEFAULT 0 COMMENT '1-默认地址',
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户收货地址';
```

#### 10.2.3 多对多（N:N）

```sql
-- 场景：文章 ↔ 标签
-- 中间表不需要 id，用联合主键即可

CREATE TABLE article_tag_map (
    article_id BIGINT NOT NULL COMMENT '关联 article_info.id',
    tag_id INT NOT NULL COMMENT '关联 tag_info.id',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (article_id, tag_id),
    INDEX idx_tag (tag_id)  -- 反向查询：某标签下的文章
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章-标签关联表';

-- ✅ 中间表设计要点：
-- 1. 联合主键，不需要单独的 id 字段
-- 2. 两个方向都要建索引（正查和反查）
-- 3. 不需要 updated_at（关联记录不修改，只增删）
-- 4. 不需要软删除（直接物理删除关联即可）
```

#### 10.2.4 自引用（树形关系）

```sql
-- 场景：评论楼中楼
CREATE TABLE comment (
    id BIGINT PRIMARY KEY,
    target_id BIGINT NOT NULL COMMENT '被评论对象 ID（文章/视频等）',
    target_type VARCHAR(20) NOT NULL COMMENT '对象类型：article/video',
    parent_id BIGINT DEFAULT NULL COMMENT '父评论 ID，NULL 表示顶级评论',
    reply_to_user_id BIGINT DEFAULT NULL COMMENT '回复的目标用户 ID',
    user_id BIGINT NOT NULL COMMENT '评论者 ID',
    content VARCHAR(1000) NOT NULL COMMENT '评论内容',
    like_count INT NOT NULL DEFAULT 0 COMMENT '点赞数',
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_target (target_type, target_id),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表（支持楼中楼）';
```

#### 10.2.5 多态关联

```sql
-- 场景：一条评论可能属于文章、视频、帖子
-- 方案一：target_type + target_id（上面的 comment 表已演示）

-- 方案二：独立关联表（更严格，但表多）
CREATE TABLE article_comment_map (
    article_id BIGINT NOT NULL,
    comment_id BIGINT NOT NULL,
    PRIMARY KEY (article_id, comment_id)
);

-- 方案三：评论表中加 target_type（推荐，简单直接）
-- 见上方 comment 表设计
-- 查询时：WHERE target_type = 'article' AND target_id = 123
-- 注意：多态关联无法建物理外键，需应用层保证数据完整性
```

### 10.3 状态机设计

**核心问题：订单状态不是随便跳的。待支付 → 已发货 是非法跳转，必须约束。**

```sql
-- ✅ 方案一：应用层状态机 + 数据库存储当前状态
-- 适合状态流转固定的场景

CREATE TABLE order_main (
    id BIGINT PRIMARY KEY COMMENT '订单号',
    user_id BIGINT NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0-待支付 1-已支付 2-已发货 3-已完成 4-已取消 5-已退款',
    -- 状态流转：0→1→2→3, 0→4, 1→5
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单主表';

-- ✅ 方案二：状态机规则表（适合状态多、流转复杂、需要动态配置的场景）

CREATE TABLE workflow_state_rule (
    id BIGINT PRIMARY KEY,
    biz_type VARCHAR(30) NOT NULL COMMENT '业务类型：order/refund/ticket',
    from_state TINYINT NOT NULL COMMENT '源状态',
    to_state TINYINT NOT NULL COMMENT '目标状态',
    action VARCHAR(30) NOT NULL COMMENT '触发动作：pay/ship/cancel/refund',
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE INDEX uk_biz_transition (biz_type, from_state, to_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='状态流转规则表';

-- 插入订单状态流转规则
INSERT INTO workflow_state_rule (id, biz_type, from_state, to_state, action) VALUES
(1, 'order', 0, 1, 'pay'),       -- 待支付 → 已支付
(2, 'order', 0, 4, 'cancel'),    -- 待支付 → 已取消
(3, 'order', 1, 2, 'ship'),      -- 已支付 → 已发货
(4, 'order', 1, 5, 'refund'),    -- 已支付 → 已退款
(5, 'order', 2, 3, 'confirm'),   -- 已发货 → 已完成
(6, 'order', 2, 5, 'refund');    -- 已发货 → 已退款

-- 应用层校验：状态跳转前查规则表
-- SELECT COUNT(*) FROM workflow_state_rule
-- WHERE biz_type = 'order' AND from_state = 0 AND to_state = 2;
-- 结果 0 → 非法跳转，拒绝

-- ✅ 方案三：状态变更日志（追溯每次状态变化）

CREATE TABLE order_status_log (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL COMMENT '订单 ID',
    from_state TINYINT NOT NULL COMMENT '变更前状态',
    to_state TINYINT NOT NULL COMMENT '变更后状态',
    action VARCHAR(30) NOT NULL COMMENT '触发动作',
    operator_id BIGINT COMMENT '操作人 ID（系统操作为 NULL）',
    remark VARCHAR(500) COMMENT '备注',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单状态变更日志';
```

**状态机设计原则：**

```
1. 状态码用 TINYINT，COMMENT 中写清每个值的含义
2. 状态流转必须在应用层校验（不能让前端直接传 status 值）
3. 状态变更记录日志（from_state + to_state + action + operator）
4. 复杂流程用规则表管理，简单流程用代码 if/switch 即可
5. 状态是只增不减的，永远不要复用或删除已有状态码
```

### 10.4 树形结构设计

**四种方案对比：**

| 方案 | 查询子树 | 查询祖先路径 | 插入 | 移动子树 | 适用场景 |
|------|---------|-------------|------|---------|---------|
| 邻接表（parent_id） | 需递归 | 需递归 | O(1) | O(1) | 层级少（≤ 3 层） |
| 路径枚举（path） | LIKE 前缀 | 直接取 path | O(1) | O(N) 子树 | 层级固定、读多写少 |
| 闭包表（closure_table） | 单表 JOIN | 单表 JOIN | O(N²) | O(N²) | 频繁查子树、层级深 |
| 嵌套集（lft/rgt） | 范围查询 | 范围查询 | O(N) | O(N) | 几乎不更新，频繁查询 |

#### 方案一：邻接表（最常用）

```sql
-- 场景：商品分类（层级一般不超过 3 层）
CREATE TABLE category (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '分类名称',
    parent_id INT DEFAULT NULL COMMENT '父分类 ID，NULL 为顶级',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
    level TINYINT NOT NULL DEFAULT 1 COMMENT '层级：1-一级 2-二级 3-三级',
    icon VARCHAR(200) COMMENT '图标 URL',
    is_deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类（邻接表）';

-- 查询某分类的所有子分类（一层）
SELECT * FROM category WHERE parent_id = 1 AND is_deleted = 0;

-- 查整棵子树需要递归（MySQL 8.0+ CTE）
WITH RECURSIVE sub_tree AS (
    SELECT * FROM category WHERE id = 1
    UNION ALL
    SELECT c.* FROM category c JOIN sub_tree st ON c.parent_id = st.id
)
SELECT * FROM sub_tree WHERE is_deleted = 0;
```

#### 方案二：路径枚举

```sql
-- 场景：组织架构（读多写少，层级可能较深）
CREATE TABLE department (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '部门名称',
    path VARCHAR(200) NOT NULL COMMENT '路径：如 1/3/7 表示 id=7，父是 3，根是 1',
    level TINYINT NOT NULL COMMENT '层级',
    parent_id INT NOT NULL COMMENT '父部门 ID',
    manager_id BIGINT COMMENT '部门负责人',
    INDEX idx_path (path),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门（路径枚举）';

-- 查询 id=7 的所有祖先
SELECT * FROM department WHERE FIND_IN_SET(id, REPLACE('1/3/7', '/', ','));

-- 查询 id=3 的所有后代
SELECT * FROM department WHERE path LIKE '1/3/%';

-- 插入：path = 父节点 path + '/' + 自己的 id
-- 移动子树：需要更新所有后代的 path（代价高）
```

#### 方案三：闭包表

```sql
-- 场景：评论系统（层级深、频繁查子树、需要分页）
-- 主表：评论内容
CREATE TABLE comment (
    id BIGINT PRIMARY KEY,
    article_id BIGINT NOT NULL COMMENT '文章 ID',
    user_id BIGINT NOT NULL,
    parent_id BIGINT DEFAULT NULL,
    content VARCHAR(1000) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_article (article_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- 闭包表：记录所有祖先-后代关系（包含自己到自己）
CREATE TABLE comment_closure (
    ancestor_id BIGINT NOT NULL COMMENT '祖先评论 ID',
    descendant_id BIGINT NOT NULL COMMENT '后代评论 ID',
    depth INT NOT NULL COMMENT '距离：0 表示自己，1 表示直接子评论',
    PRIMARY KEY (ancestor_id, descendant_id),
    INDEX idx_descendant (descendant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论闭包表';

-- 查询 id=1 的所有后代评论（含层级）
SELECT c.*, cl.depth
FROM comment c
JOIN comment_closure cl ON c.id = cl.descendant_id
WHERE cl.ancestor_id = 1
ORDER BY cl.depth, c.created_at;

-- 插入评论 id=10（父评论 id=5）：
-- 1. 插入 comment 记录
-- 2. 插入自己到自己：ancestor=10, descendant=10, depth=0
-- 3. 复制父评论的所有祖先关系 + 自己：
--    INSERT INTO comment_closure
--    SELECT ancestor_id, 10, depth+1 FROM comment_closure WHERE descendant_id = 5
--    UNION ALL SELECT 10, 10, 0;
```

**选择建议：**

```
层级 ≤ 3，写多读少 → 邻接表（简单可靠）
层级固定，读多写少 → 路径枚举（查询方便）
层级深，频繁查子树 → 闭包表（查询性能最好）
几乎不更新 → 嵌套集（实际项目中很少使用）
```

### 10.5 历史快照与版本控制

#### 场景一：价格快照

```sql
-- 订单中锁定下单时的商品价格，不随后续调价变化
-- 见 10.1 中 order_items 表的 product_price 字段

-- 另一种方案：价格历史表（供运营查看价格变化）
CREATE TABLE product_price_history (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL COMMENT '商品 ID',
    price DECIMAL(10, 2) NOT NULL COMMENT '当时价格',
    changed_by BIGINT COMMENT '操作人',
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品价格变更历史';
```

#### 场景二：数据变更审计

```sql
-- 通用审计日志表：记录任意表的字段级变更
CREATE TABLE data_audit_log (
    id BIGINT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL COMMENT '表名',
    record_id BIGINT NOT NULL COMMENT '记录 ID',
    action VARCHAR(10) NOT NULL COMMENT 'INSERT/UPDATE/DELETE',
    field_name VARCHAR(50) COMMENT '变更字段名',
    old_value VARCHAR(500) COMMENT '变更前值',
    new_value VARCHAR(500) COMMENT '变更后值',
    operator_id BIGINT COMMENT '操作人',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据变更审计日志';
```

#### 场景三：时间区间版本化

```sql
-- 场景：商品价格策略，同一商品不同时间段不同价格
CREATE TABLE product_price_policy (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL COMMENT '商品 ID',
    price DECIMAL(10, 2) NOT NULL COMMENT '价格',
    effective_from DATETIME NOT NULL COMMENT '生效时间',
    effective_to DATETIME NOT NULL COMMENT '失效时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product_time (product_id, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品价格策略（时间区间版本）';

-- 查询某商品当前有效价格
SELECT price FROM product_price_policy
WHERE product_id = 1001
  AND effective_from <= NOW()
  AND effective_to > NOW()
LIMIT 1;
```

### 10.6 并发控制

#### 方案一：乐观锁（推荐，适合低冲突场景）

```sql
-- 利用 version 字段实现 CAS（Compare And Swap）
-- 订单表已有 version 字段（见第六章模板）

-- 更新时带版本号
UPDATE order_main
SET status = 1, version = version + 1, updated_at = NOW()
WHERE id = 1001 AND version = 3;
-- affected rows = 1 → 成功
-- affected rows = 0 → 版本已变化，需要重新查询再更新

-- 代码示例（Java）
@Update("UPDATE order_main SET status = #{status}, version = version + 1 " +
        "WHERE id = #{id} AND version = #{version}")
int updateWithVersion(@Param("id") long id,
                      @Param("status") int status,
                      @Param("version") int version);

// 使用
int rows = mapper.updateWithVersion(orderId, newStatus, currentVersion);
if (rows == 0) {
    throw new ConcurrentModificationException("数据已被其他人修改，请刷新后重试");
}
```

#### 方案二：悲观锁（适合高冲突场景）

```sql
-- SELECT FOR UPDATE：读取时加行锁，事务结束前其他人不能修改

-- 场景：库存扣减
BEGIN;
-- 先锁住这条商品记录
SELECT stock FROM product_info WHERE id = 1001 FOR UPDATE;
-- stock = 10

-- 判断库存是否充足
-- if stock >= quantity then ...

-- 扣减库存
UPDATE product_info SET stock = stock - 2 WHERE id = 1001;
COMMIT;
-- 其他事务在这个事务 COMMIT 之前会被阻塞
```

#### 方案三：原子操作（最简单，适合简单扣减）

```sql
-- 利用 WHERE 条件做原子判断，不需要显式加锁

-- 库存扣减：利用 stock >= #{quantity} 做原子判断
UPDATE product_info
SET stock = stock - 2
WHERE id = 1001 AND stock >= 2;
-- affected rows = 1 → 扣减成功
-- affected rows = 0 → 库存不足

-- 加销量（永远不可能为负，不需要判断）
UPDATE product_info
SET sales_count = sales_count + 1
WHERE id = 1001;
```

**三种方案对比：**

| 方案 | 性能 | 冲突处理 | 复杂度 | 适用场景 |
|------|------|---------|--------|---------|
| 乐观锁 | 高（无锁等待） | 失败重试 | 低 | 低冲突：状态更新、配置修改 |
| 悲观锁 | 中（有锁等待） | 阻塞等待 | 中 | 高冲突：库存、秒杀 |
| 原子操作 | 最高 | 直接失败 | 最低 | 简单扣减：库存 ≥ 0 判断 |

### 10.7 冷热分离与大字段

#### 冷热数据分离

```sql
-- 场景：订单表，最近 3 个月是热数据，更早的是冷数据

-- 热数据表：最近 3 个月的订单，频繁查询
CREATE TABLE order_main (
    -- ... 同之前的定义 ...
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单主表（热数据）';

-- 冷数据表：历史订单，偶尔查询
CREATE TABLE order_main_archive (
    -- 结构与 order_main 完全一致
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单归档表（冷数据）';

-- 归档策略：定时任务将 3 个月前的数据迁移到归档表
-- 1. INSERT INTO order_main_archive SELECT * FROM order_main WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
-- 2. DELETE FROM order_main WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH);
-- 两步需要在事务中执行，或者用批量分页迁移降低锁持有时间
```

#### 大字段独立

```sql
-- ❌ 大字段和查询字段混在一起
CREATE TABLE article (
    id BIGINT PRIMARY KEY,
    title VARCHAR(200),
    author_id BIGINT,
    status TINYINT,
    content MEDIUMTEXT,     -- 10KB~1MB，列表页完全不需要
    created_at DATETIME
);
-- 列表查询 SELECT title, author_id, status FROM article 也要把 content 加载到内存

-- ✅ 大字段独立建表
CREATE TABLE article_info (
    id BIGINT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    author_id BIGINT NOT NULL,
    status TINYINT NOT NULL DEFAULT 0,
    summary VARCHAR(500) COMMENT '摘要（列表页展示用，从 content 中提取）',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章信息（列表查询）';

CREATE TABLE article_content (
    article_id BIGINT PRIMARY KEY COMMENT '关联 article_info.id',
    content MEDIUMTEXT NOT NULL COMMENT '文章正文（富文本）',
    content_md MEDIUMTEXT COMMENT 'Markdown 原文',
    word_count INT DEFAULT 0 COMMENT '字数',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文章正文（大字段独立）';

-- 列表查询只走 article_info，不加载大字段
-- 详情页通过 article_id 关联查 article_content
```

### 10.8 通用业务模式

#### 权限模型（RBAC）

```sql
-- 用户表
-- 见 10.2.1 user_info

-- 角色表
CREATE TABLE sys_role (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL COMMENT '角色名称：admin/editor/viewer',
    display_name VARCHAR(100) NOT NULL COMMENT '显示名称',
    description VARCHAR(200) COMMENT '描述',
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统角色';

-- 权限表
CREATE TABLE sys_permission (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(100) NOT NULL COMMENT '权限编码：article:create/article:delete',
    name VARCHAR(100) NOT NULL COMMENT '权限名称',
    module VARCHAR(30) NOT NULL COMMENT '所属模块：article/user/system',
    UNIQUE INDEX uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统权限';

-- 用户-角色关联
CREATE TABLE sys_user_role_map (
    user_id BIGINT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户-角色关联';

-- 角色-权限关联
CREATE TABLE sys_role_permission_map (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色-权限关联';

-- 查询某用户的所有权限
SELECT DISTINCT p.code
FROM sys_permission p
JOIN sys_role_permission_map rpm ON p.id = rpm.permission_id
JOIN sys_user_role_map urm ON rpm.role_id = urm.role_id
WHERE urm.user_id = 10001;
```

#### 系统配置

```sql
-- 方案一：KV 表（适合配置项少、需要后台管理的场景）
CREATE TABLE sys_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL COMMENT '配置键',
    config_value VARCHAR(500) NOT NULL COMMENT '配置值',
    value_type VARCHAR(20) NOT NULL DEFAULT 'string' COMMENT '值类型：string/number/boolean/json',
    description VARCHAR(200) COMMENT '说明',
    updated_by BIGINT COMMENT '最后修改人',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置';

INSERT INTO sys_config (config_key, config_value, value_type, description) VALUES
('site_name', '我的商城', 'string', '站点名称'),
('max_upload_size', '10485760', 'number', '最大上传大小（字节）'),
('maintenance_mode', 'false', 'boolean', '维护模式开关'),
('allowed_file_types', '["jpg","png","pdf"]', 'json', '允许上传的文件类型');

-- 方案二：JSON 字段（适合配置项多、结构复杂的场景）
CREATE TABLE sys_settings (
    id INT PRIMARY KEY DEFAULT 1,
    settings JSON NOT NULL COMMENT '配置 JSON',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置（JSON）';
-- 只存一行，所有配置打包成一个 JSON
```

#### 审批流

```sql
-- 审批实例
CREATE TABLE approval_instance (
    id BIGINT PRIMARY KEY,
    biz_type VARCHAR(30) NOT NULL COMMENT '业务类型：leave/expense/purchase',
    biz_id BIGINT NOT NULL COMMENT '业务单据 ID',
    title VARCHAR(200) NOT NULL COMMENT '审批标题',
    applicant_id BIGINT NOT NULL COMMENT '申请人',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0-审批中 1-已通过 2-已驳回 3-已撤回',
    current_node INT NOT NULL DEFAULT 1 COMMENT '当前审批节点序号',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_biz (biz_type, biz_id),
    INDEX idx_applicant (applicant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批实例';

-- 审批节点（审批流定义）
CREATE TABLE approval_node (
    id BIGINT PRIMARY KEY,
    approval_id BIGINT NOT NULL COMMENT '关联 approval_instance.id',
    node_order INT NOT NULL COMMENT '节点顺序',
    node_name VARCHAR(50) NOT NULL COMMENT '节点名称：直属主管/部门经理/HR',
    approver_id BIGINT NOT NULL COMMENT '审批人 ID',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0-待审批 1-已通过 2-已驳回',
    comment VARCHAR(500) COMMENT '审批意见',
    approved_at DATETIME COMMENT '审批时间',
    INDEX idx_approval (approval_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批节点';
```

#### 通知消息

```sql
-- 消息模板
CREATE TABLE notify_template (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL COMMENT '模板编码：order_paid/welcome/system',
    title VARCHAR(200) NOT NULL COMMENT '模板标题，支持变量：${userName}，您的订单已支付',
    content VARCHAR(1000) NOT NULL COMMENT '模板内容，支持变量：${orderNo}',
    channel VARCHAR(20) NOT NULL COMMENT '推送渠道：site/sms/email/push',
    UNIQUE INDEX uk_code_channel (code, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息模板';

-- 消息实例（发送记录）
CREATE TABLE notify_message (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL COMMENT '接收用户 ID',
    template_id INT COMMENT '关联模板 ID',
    title VARCHAR(200) NOT NULL COMMENT '消息标题',
    content VARCHAR(1000) NOT NULL COMMENT '消息内容',
    channel VARCHAR(20) NOT NULL COMMENT '渠道',
    is_read TINYINT NOT NULL DEFAULT 0 COMMENT '0-未读 1-已读',
    read_at DATETIME COMMENT '阅读时间',
    biz_type VARCHAR(30) COMMENT '关联业务类型',
    biz_id BIGINT COMMENT '关联业务 ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息实例';
```

---

## 十一、数字精度：从存储到计算到展示的全链路解决方案

前面说了"金额用 DECIMAL"，但精度问题远不止数据库这一层。一个金额从数据库存入，经过后端计算、JSON 传输、前端展示，每一步都可能丢精度。这一节从根因出发，系统梳理全链路方案。

### 10.1 问题根因：IEEE 754 浮点数

```
计算机用二进制表示小数，但大部分十进制小数无法精确表示为二进制：

十进制 0.1 = 二进制 0.000110011001100110011...（无限循环）
十进制 0.2 = 二进制 0.0011001100110011001100...（无限循环）

所以：
  0.1 + 0.2 ≠ 0.3
  0.1 + 0.2 = 0.30000000000000004（JavaScript）
  0.1 + 0.2 = 0.30000000000000004（Python float）
  0.1 + 0.2 = 0.300000000000000044408920985006...（Java double）

这是 IEEE 754 双精度浮点数的固有缺陷，所有语言都存在。
```

### 10.2 金融场景常见计算问题

#### 10.2.1 基础运算精度丢失

```typescript
// ❌ JavaScript / TypeScript 直接运算
0.1 + 0.2                  // 0.30000000000000004
0.3 - 0.1                  // 0.19999999999999998
0.1 * 0.2                  // 0.020000000000000004
0.3 / 0.1                  // 2.9999999999999996
19.9 * 100                 // 1989.9999999999998
0.7 + 0.1                  // 0.7999999999999999
```

```java
// ❌ Java 直接运算
double a = 0.1;
double b = 0.2;
System.out.println(a + b);  // 0.30000000000000004

double price = 19.9;
System.out.println(price * 100);  // 1989.9999999999998
```

```python
# ❌ Python 直接运算
0.1 + 0.2    # 0.30000000000000004
0.3 - 0.1    # 0.19999999999999998
round(2.675, 2)  # 2.67（不是期望的 2.68）
```

#### 10.2.2 累加误差放大

```typescript
// ❌ 批量累加：误差逐次放大
const items = [0.1, 0.2, 0.3, 0.4, 0.5];
let total = 0;
items.forEach(item => { total += item; });
console.log(total);
// 期望 1.5，实际 1.5000000000000002

// ❌ 批量价格求和
const prices = [19.9, 29.9, 39.9, 49.9];
let sum = 0;
prices.forEach(p => { sum += p; });
console.log(sum);
// 期望 139.6，实际 139.60000000000002
```

#### 10.2.3 折扣与分摊

```typescript
// ❌ 折扣计算
// 订单总额 100 元，打 8 折
const total = 100;
const discount = 0.8;
const payAmount = total * discount;  // 80（这个没问题）

// ❌ 优惠券分摊：100 元优惠券分摊到 3 个商品
// 每个商品应该分摊 33.33... 元，但只有 2 位小数
const couponAmount = 100;
const ratios = [0.3, 0.3, 0.4];
let allocated = 0;
const details = ratios.map(ratio => {
    const amount = Math.round(couponAmount * ratio * 100) / 100;
    allocated += amount;
    return amount;
});
console.log(details);  // [30, 30, 40]
// 这个例子凑巧没出问题，但换一组比例就可能出问题

// ❌ 真正的分摊问题
// 10 元优惠券，分摊到 3 个商品
const coupon = 10;
const itemPrices = [3.33, 3.33, 3.34];
// 每个分摊 3.33? → 总分摊 9.99，差 0.01
// 每个分摊 3.34? → 总分摊 10.02，多 0.02
// 必须有一个商品"兜底"吸收尾差
```

#### 10.2.4 利率与复利

```typescript
// ❌ 复利计算
// 年利率 4.25%，按月复利，12 个月后
const principal = 10000;
const annualRate = 0.0425;
const monthlyRate = annualRate / 12;  // 0.0035416666666666667（精度丢失开始）
let balance = principal;
for (let i = 0; i < 12; i++) {
    balance = balance * (1 + monthlyRate);  // 误差逐步累积
}
console.log(balance);
// 期望 10433.05，实际可能偏差 0.01~0.03

// ❌ 日利率计算
// 年化 18%，日利率 = 18% / 365 = 0.04931506849315068...%
// 每天利息都在截断，一年累积误差可能到分级别
```

### 10.3 全链路精度丢失场景

```
精度丢失不只发生在代码计算，而是贯穿整个数据链路：

┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   数据库     │ →  │   后端       │ →  │   JSON 传输  │ →  │   前端       │ →  │   展示       │
│   存储       │    │   计算       │    │   序列化     │    │   解析       │    │   格式化     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     ①                  ②                  ③                  ④                  ⑤

① 数据库层：DECIMAL(10,2) → 精确
② 后端层：Java double / JS number → 可能丢失
③ 传输层：JSON number → 大数丢失精度（JS 安全整数范围 ±2^53）
④ 前端层：JSON.parse → 大数精度丢失
⑤ 展示层：toFixed / 浮点运算 → 显示异常
```

### 10.4 计算机解析与展示问题

#### 10.4.1 JSON 大数精度丢失

```typescript
// ❌ 超出 JS 安全整数范围的 ID 丢失精度
// 后端返回的 JSON
const json = '{"orderId": 123456789012345678}';
const data = JSON.parse(json);
console.log(data.orderId);  // 123456789012345680（末尾变成 80！）

// ❌ 雪花 ID（18~19 位数字）必然超出安全范围
const snowflakeId = 1890123456789012345;
// JS number 最大安全整数：2^53 - 1 = 9007199254740991（16 位）
// 雪花 ID 是 18~19 位，必然丢精度

// ✅ 解决方案 1：后端 ID 序列化为字符串
// Java: @JsonSerialize(using = ToStringSerializer.class)
// Spring Boot 配置全局：
@Configuration
public class JacksonConfig {
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        // 所有 long/bigint 序列化为字符串
        SimpleModule module = new SimpleModule();
        module.addSerializer(Long.class, ToStringSerializer.instance);
        module.addSerializer(Long.TYPE, ToStringSerializer.instance);
        module.addSerializer(BigInteger.class, ToStringSerializer.instance);
        mapper.registerModule(module);
        return mapper;
    }
}

// ✅ 解决方案 2：前端自定义 JSON 解析器
import { JSONbig } from 'json-bigint';
const data = JSONbig.parse(json);
console.log(data.orderId.toString());  // "123456789012345678"（精确）
```

#### 10.4.2 前端展示异常

```typescript
// ❌ 常见展示问题
const price = 0.1 + 0.2;
console.log(price);                    // 0.30000000000000004
console.log(price.toFixed(2));         // "0.30"（toFixed 有时会四舍五入错误）

// ❌ toFixed 的坑
(1.005).toFixed(2);   // "1.00"（期望 "1.01"）
// 原因：1.005 在浮点数中实际是 1.0049999999999999...
// toFixed 是向下取整的，所以得到 "1.00"

// ❌ Number.prototype 的精度问题
(0.07 * 100).toFixed(0);  // "7"（表面没问题）
(0.07 * 100);             // 7.000000000000001
(0.07 * 100).toFixed(2);  // "7.00"

// ❌ 百分比展示
const ratio = 1 / 3;
console.log((ratio * 100).toFixed(2) + '%');  // "33.33%"（丢了 0.01%）
```

#### 10.4.3 跨语言类型映射陷阱

```
数据库          后端 (Java)        JSON 传输        前端 (JS)
─────────      ────────────      ──────────      ────────────
DECIMAL(10,2)  → BigDecimal      → number/string → number/string
BIGINT         → Long            → number         → number（⚠️ 超安全范围丢精度）
DOUBLE         → Double          → number         → number（⚠️ 精度丢失）
VARCHAR        → String          → string         → string
DATETIME       → LocalDateTime   → string (ISO)   → Date/string

关键映射风险：
1. DECIMAL → 如果 Java 用 Double 接收，精度直接丢失
2. BIGINT → JSON number → JS parse 丢精度（雪花 ID）
3. DATETIME → 时区不一致导致展示错误
```

### 10.5 解决方案：分层治理

#### 10.5.1 数据库层

```sql
-- ✅ 金额字段必须用 DECIMAL
price DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT '价格（元）'
amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT '金额（元）'
rate DECIMAL(8, 6) NOT NULL DEFAULT 0.000000 COMMENT '利率（精确到百万分之一）'

-- ✅ 大 ID 用 BIGINT（数据库层不会丢精度）
id BIGINT PRIMARY KEY COMMENT '雪花 ID'

-- ✅ 百分比/比率用 DECIMAL 存小数，不用整数
discount_rate DECIMAL(5, 4) DEFAULT 0.0000 COMMENT '折扣率（如 0.8500 = 85 折）'

-- ✅ 备选方案：金额以"分"为单位存整数（避免 DECIMAL 的存储和计算开销）
price_cent INT NOT NULL DEFAULT 0 COMMENT '价格（分）'
```

#### 10.5.2 后端层

```java
// ✅ Java：用 BigDecimal 做所有金额运算
import java.math.BigDecimal;
import java.math.RoundingMode;

// 创建（必须用字符串构造，不要用 double）
BigDecimal price = new BigDecimal("19.90");          // ✅
BigDecimal price2 = BigDecimal.valueOf(19.90);       // ✅ valueOf 内部先转字符串
BigDecimal wrong = new BigDecimal(19.90);            // ❌ 19.8999999999999985789145284798...

// 加减乘除
BigDecimal a = new BigDecimal("100.00");
BigDecimal b = new BigDecimal("0.80");
BigDecimal result = a.multiply(b)                           // 80.0000
    .setScale(2, RoundingMode.HALF_UP);                    // 80.00

// 除法必须指定精度和舍入模式
BigDecimal c = new BigDecimal("10");
BigDecimal d = new BigDecimal("3");
c.divide(d, 2, RoundingMode.HALF_UP);                      // 3.33
// ❌ c.divide(d) → ArithmeticException: Non-terminating decimal expansion

// 比较（用 compareTo，不要用 equals）
new BigDecimal("1.0").compareTo(new BigDecimal("1.00"));   // 0（相等）
new BigDecimal("1.0").equals(new BigDecimal("1.00"));      // false（精度不同）

// 优惠券分摊（最后一个兜底）
public static List<BigDecimal> allocate(
    BigDecimal total, List<BigDecimal> ratios, int scale
) {
    List<BigDecimal> results = new ArrayList<>();
    BigDecimal allocated = BigDecimal.ZERO;
    for (int i = 0; i < ratios.size(); i++) {
        if (i == ratios.size() - 1) {
            // 最后一个 = 总额 - 已分摊
            results.add(total.subtract(allocated));
        } else {
            BigDecimal amount = total.multiply(ratios.get(i))
                .setScale(scale, RoundingMode.HALF_UP);
            results.add(amount);
            allocated = allocated.add(amount);
        }
    }
    return results;
}
```

```typescript
// ✅ Node.js / 前端：方案一 —— 整数运算（分单位）
// 所有金额以分为单位存储和运算，展示时再转成元
function yuanToCent(yuan: string): number {
    return Math.round(Number(yuan) * 100);
}
function centToYuan(cent: number): string {
    return (cent / 100).toFixed(2);
}

const total = yuanToCent("100.00");  // 10000
const discount = 0.8;
const payAmount = Math.round(total * discount);  // 8000
console.log(centToYuan(payAmount));  // "80.00"

// ✅ 方案二 —— 第三方库
// bignumber.js
import BigNumber from 'bignumber.js';
const a = new BigNumber('0.1');
const b = new BigNumber('0.2');
a.plus(b).toString();           // "0.3"
a.plus(b).toFixed(2);           // "0.30"

// decimal.js
import Decimal from 'decimal.js';
new Decimal('0.1').plus('0.2').toString();  // "0.3"
new Decimal('19.9').times(100).toString();  // "1990"

// ✅ 方案三 —— 原生 BigInt（整数场景，如分为单位的金额）
const price = BigInt(1990);  // 19.90 元 = 1990 分
const quantity = BigInt(3);
const total = price * quantity;  // 5970 分
```

```python
# ✅ Python：用 decimal 模块
from decimal import Decimal, ROUND_HALF_UP

a = Decimal('0.1')
b = Decimal('0.2')
print(a + b)                           # 0.3

price = Decimal('19.90')
print(price * 100)                     # 1990.0

# 除法指定精度
c = Decimal('10') / Decimal('3')
# ❌ 不要这样做，可能无限小数

# ✅ 正确除法
c = Decimal('10').divide(Decimal('3'), 2, rounding=ROUND_HALF_UP)  # 3.33

# 优惠券分摊
def allocate(total, ratios, scale=2):
    results = []
    allocated = Decimal('0')
    for i, ratio in enumerate(ratios):
        if i == len(ratios) - 1:
            results.append(total - allocated)
        else:
            amount = (total * ratio).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            results.append(amount)
            allocated += amount
    return results

total = Decimal('100.00')
ratios = [Decimal('0.3'), Decimal('0.3'), Decimal('0.4')]
print(allocate(total, ratios))  # [Decimal('30.00'), Decimal('30.00'), Decimal('40.00')]
```

#### 10.5.3 JSON 传输层

```typescript
// ✅ 方案一：金额和 ID 序列化为字符串（推荐）
// 后端统一配置
// Java: @JsonSerialize(using = ToStringSerializer.class)
// 或全局配置 Jackson

// 前端收到后直接当字符串用，不做数值运算
interface OrderDTO {
    id: string;            // "1890123456789012345"
    totalAmount: string;   // "99.90"
    items: OrderItemDTO[];
}

// ✅ 方案二：前端用 json-bigint 等库解析
import JSONbig from 'json-bigint';
const data = JSONbig.parse(responseText);
data.id.toString();  // "1890123456789012345"

// ✅ 方案三：金额以整数（分）传输，避免小数
interface OrderDTO {
    id: string;
    totalAmountCent: number;  // 9990（分），整数运算无精度问题
}
```

#### 10.5.4 前端展示层

```typescript
// ✅ 格式化工具函数
function formatAmount(value: string | number, decimals = 2): string {
    // 输入是字符串（后端序列化）或数字（分为单位）
    if (typeof value === 'string') {
        const num = new BigNumber(value);
        return num.toFixed(decimals);
    }
    // 分 → 元
    return (value / 100).toFixed(decimals);
}

// ✅ 千分位分隔
function formatMoney(value: string): string {
    const [integer, decimal] = value.split('.');
    const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimal ? `${formatted}.${decimal}` : formatted;
}

formatMoney("1234567.89");  // "1,234,567.89"
formatAmount("99.9");       // "99.90"

// ✅ 安全的 toFixed（解决 1.005 → "1.00" 的 bug）
function safeToFixed(num: number, decimals: number): string {
    return new BigNumber(num).toFixed(decimals);
}
safeToFixed(1.005, 2);  // "1.01"

// ✅ React 组件中的使用
function PriceDisplay({ amount }: { amount: string }) {
    // amount 从后端传来，是字符串，避免 JS 浮点运算
    const formatted = formatMoney(formatAmount(amount));
    return <span className="price">¥{formatted}</span>;
}

// ✅ Vue 过滤器 / 管道
const vMoney = (value: string) => {
    return '¥' + formatMoney(formatAmount(value));
};
// <span>{{ order.totalAmount }}</span> → ¥1,234.56
```

### 10.6 各语言精度方案速查

| 语言 | 数据库类型 | 后端类型 | 计算库 | 传输格式 |
|------|-----------|---------|--------|---------|
| Java | `DECIMAL` | `BigDecimal` | `BigDecimal` 内置 | String（`@JsonSerialize`） |
| TypeScript/JS | `DECIMAL` | `string` / `number`（分） | `bignumber.js` / `decimal.js` | String |
| Python | `DECIMAL` | `Decimal` | `decimal` 标准库 | String |
| Go | `DECIMAL` | `decimal.Decimal` | `shopspring/decimal` | String |
| PHP | `DECIMAL` | `string` / `bcmath` | `bcmath` 扩展 | String |

### 10.7 精度规范检查清单

```
□ 数据库金额字段是否使用 DECIMAL（禁止 FLOAT/DOUBLE）
□ 后端是否用高精度类型接收（Java BigDecimal，不用 double/float）
□ 后端除法是否指定了精度和舍入模式
□ 后端比较金额是否用 compareTo（Java）而非 equals
□ JSON 传输中大数（ID、金额）是否序列化为字符串
□ 前端是否用字符串或 BigNumber 处理金额，而非直接 number 运算
□ 前端展示是否用安全的格式化函数（非原生 toFixed）
□ 分摊/分润场景是否用"最后一个兜底"策略保证总额一致
□ 利率/费率字段精度是否足够（DECIMAL(8,6) 而非 DECIMAL(5,2)）
```

---

## 十二、完整建表模板

### 12.1 业务主表模板

```sql
CREATE TABLE {table_name} (
    -- ==================== 主键 ====================
    id BIGINT PRIMARY KEY COMMENT '主键（雪花 ID）',

    -- ==================== 业务字段 ====================
    -- TODO: 在此添加业务字段

    -- ==================== 基础字段 ====================
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '0-未删除 1-已删除',
    created_by BIGINT DEFAULT NULL COMMENT '创建人 user_id',
    updated_by BIGINT DEFAULT NULL COMMENT '更新人 user_id',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    version INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',

    -- ==================== 索引 ====================
    INDEX idx_{table}_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='{表用途描述}';
```

### 12.2 关联表模板

```sql
CREATE TABLE {entity_a}_{entity_b}_map (
    id BIGINT PRIMARY KEY COMMENT '主键（雪花 ID）',
    {entity_a}_id BIGINT NOT NULL COMMENT '{实体A} ID，关联 {table_a}.id',
    {entity_b}_id BIGINT NOT NULL COMMENT '{实体B} ID，关联 {table_b}.id',
    is_deleted TINYINT NOT NULL DEFAULT 0 COMMENT '0-未删除 1-已删除',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE INDEX uk_{entity_a}_{entity_b} ({entity_a}_id, {entity_b}_id),
    INDEX idx_{entity_b} ({entity_b}_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='{实体A}与{实体B}的关联表';
```

### 12.3 日志表模板

```sql
CREATE TABLE log_{business} (
    id BIGINT PRIMARY KEY COMMENT '主键（雪花 ID）',
    user_id BIGINT DEFAULT NULL COMMENT '操作人 user_id',
    action VARCHAR(50) NOT NULL COMMENT '操作类型',
    target_type VARCHAR(50) DEFAULT NULL COMMENT '目标类型',
    target_id BIGINT DEFAULT NULL COMMENT '目标 ID',
    detail JSON DEFAULT NULL COMMENT '操作详情（JSON）',
    ip VARCHAR(50) DEFAULT NULL COMMENT 'IP 地址',
    user_agent VARCHAR(500) DEFAULT NULL COMMENT '用户代理',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_action_created (action, created_at),
    INDEX idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='{业务}操作日志表';
```

---

## 十三、总结

### 核心原则

- **命名一致性**比"命名好不好听"重要——团队统一比个人偏好重要
- **字段类型选对**比"性能优化"更重要——FLOAT 存金额是技术债，再多的 SQL 优化也补不回来
- **精度问题是全链路的**——数据库 DECIMAL 精确了，后端用 double 一样丢，前端 toFixed 一样乱
- **NOT NULL + DEFAULT** 应该是默认选项——NULL 带来的问题远多于它的便利
- **索引是双刃剑**——建索引要看慢查询日志，删索引也要看慢查询日志
- **DDL 变更是高风险操作**——必须走 Review、走迁移工具、走低峰期

### 规范落地建议

```
1. 规范文档化 → 放在团队 Wiki / Notion / 飞书文档中
2. 建表模板化 → 提供模板 SQL，新表基于模板创建
3. 检查自动化 → 编写 Lint 脚本，CI 中自动检查命名和类型
4. Review 流程化 → DDL 变更必须过 Review，检查清单对照
5. 定期审计 → 每月检查一次索引使用率、表大小、慢查询 Top N
```

### 一句话建议

**规范不是限制创造力，而是减少低级错误。把时间花在业务设计上，而不是花在排查"为什么这张表的金额算不对"这种问题上。**
