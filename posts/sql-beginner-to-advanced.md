---
title: SQL 入门到进阶：从基础查询到高级特性的完整路径
date: '2026-05-03'
tags:
  - 数据库
category: 后端工程
summary: >-
  从 SQL 学习曲线陡峭的实际痛点出发，系统梳理 SQL 从入门到进阶的完整知识体系——基础 CRUD、多表 JOIN、聚合与分组、子查询与
  CTE、窗口函数、集合运算、事务与锁、高级特性（视图/存储过程/触发器/JSON），以及不同数据库方言的差异与 SQL 编写规范。
---

# SQL 入门到进阶：从基础查询到高级特性的完整路径

## 一、问题来源

SQL 是后端开发最基础也最重要的技能之一，但很多人对 SQL 的掌握停留在"能写 CRUD"的阶段：

**入门阶段的痛点：**

- 写 SQL 靠拼凑和试错，不理解 SELECT / FROM / WHERE / GROUP BY 的执行顺序
- 遇到多表关联就懵，分不清 INNER JOIN / LEFT JOIN / RIGHT JOIN 的区别
- 聚合函数和 GROUP BY 一起用就报错，不清楚 `ONLY_FULL_GROUP_BY` 规则

**进阶阶段的痛点：**

- 知道窗口函数很强，但看不懂 `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` 的含义
- 复杂报表需求用嵌套子查询写了五六十行，维护困难，不知道 CTE 可以简化
- 遇到并发更新数据就出问题，不理解事务隔离级别和锁机制
- 换一个数据库（MySQL → PostgreSQL）就发现语法不一样，不知道哪些是标准 SQL、哪些是方言

**核心问题：SQL 不是"记住语法"就够的，它是一套从声明式查询思维 → 关系代数基础 → 高级分析能力 → 工程实践规范的完整体系。**

本文将从基础查询、多表关联、聚合分析、高级特性、事务控制、SQL 方言差异六个维度，系统梳理 SQL 入门到进阶的完整路径。

---

## 二、基础查询：SQL 的执行顺序

### 2.1 SQL 书写顺序 vs 执行顺序

很多初学者困惑的根源：SQL 的书写顺序和数据库引擎的执行顺序是不同的。

```sql
-- 书写顺序（你写 SQL 的顺序）
SELECT   column1, column2, AGG(column3)
FROM     table_name
JOIN     other_table ON ...
WHERE    condition
GROUP BY column1, column2
HAVING   AGG(column3) > value
ORDER BY column1 ASC
LIMIT    10;

-- 执行顺序（数据库引擎实际处理的顺序）
-- 1. FROM        → 确定数据来源（包括 JOIN）
-- 2. WHERE       → 行级过滤（在分组之前）
-- 3. GROUP BY    → 分组
-- 4. HAVING      → 组级过滤（在分组之后）
-- 5. SELECT      → 选择列、计算表达式
-- 6. ORDER BY    → 排序
-- 7. LIMIT       → 限制行数
```

**理解执行顺序能解释很多问题：**

```
Q: 为什么 WHERE 里不能用别名？
A: 因为 WHERE 在 SELECT 之前执行，此时别名还不存在。

Q: 为什么 HAVING 能用聚合函数而 WHERE 不能？
A: 因为 HAVING 在 GROUP BY 之后执行，此时聚合结果已经计算出来了。

Q: 为什么 ORDER BY 可以用 SELECT 的别名？
A: 因为 ORDER BY 在 SELECT 之后执行，别名已经生效。
```

### 2.2 WHERE 条件过滤

```sql
-- 比较运算符
SELECT * FROM products WHERE price > 100;
SELECT * FROM products WHERE price >= 100 AND price <= 500;
SELECT * FROM products WHERE price BETWEEN 100 AND 500;   -- 等价写法

-- 逻辑运算符
SELECT * FROM orders
WHERE status = 'paid' AND total_amount > 1000;

SELECT * FROM orders
WHERE status IN ('paid', 'shipped', 'completed');   -- IN 列表

SELECT * FROM products
WHERE category NOT IN ('电子', '服装');

-- 模糊匹配
SELECT * FROM users WHERE name LIKE '张%';       -- 以"张"开头
SELECT * FROM users WHERE name LIKE '%伟';        -- 以"伟"结尾
SELECT * FROM users WHERE name LIKE '%小%';       -- 包含"小"
SELECT * FROM users WHERE email LIKE '_%@%.com';  -- _ 匹配单个字符

-- NULL 判断（重要：NULL 不能用 = 或 != 判断）
SELECT * FROM users WHERE phone IS NULL;          -- 为空
SELECT * FROM users WHERE phone IS NOT NULL;      -- 不为空
```

### 2.3 数据排序与分页

```sql
-- 单列排序
SELECT * FROM orders ORDER BY created_at DESC;   -- 降序

-- 多列排序（先按状态升序，再按金额降序）
SELECT * FROM orders ORDER BY status ASC, total_amount DESC;

-- 分页（MySQL / PostgreSQL）
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 0;    -- 第1页，每页20条
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 20;   -- 第2页
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 40;   -- 第3页

-- 分页公式
-- LIMIT pageSize OFFSET (pageNum - 1) * pageSize
```

---

## 三、多表关联：JOIN

### 3.1 JOIN 类型一览

```
假设有两张表：

orders（订单表）                     users（用户表）
┌─────┬─────────┬────────┐         ┌─────────┬──────┐
│ id  │ user_id │ amount │         │ user_id │ name │
├─────┼─────────┼────────┤         ├─────────┼──────┤
│  1  │   1     │  100   │         │   1     │ 张三 │
│  2  │   2     │  200   │         │   2     │ 李四 │
│  3  │  NULL   │  300   │         │   4     │ 王五 │
└─────┴─────────┴────────┘         └─────────┴──────┘
```

```sql
-- INNER JOIN：只返回两表都能匹配的行
SELECT o.id, o.amount, u.name
FROM orders o
INNER JOIN users u ON o.user_id = u.user_id;
-- 结果：订单1(张三), 订单2(李四)  ← 订单3和王五被排除

-- LEFT JOIN：左表全部 + 右表匹配（右表无匹配则为 NULL）
SELECT o.id, o.amount, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.user_id;
-- 结果：订单1(张三), 订单2(李四), 订单3(NULL)  ← 左表全部保留

-- RIGHT JOIN：右表全部 + 左表匹配
SELECT o.id, o.amount, u.name
FROM orders o
RIGHT JOIN users u ON o.user_id = u.user_id;
-- 结果：订单1(张三), 订单2(李四), NULL(王五)  ← 右表全部保留

-- FULL OUTER JOIN：两表取并集（MySQL 不直接支持，用 UNION 模拟）
SELECT o.id, o.amount, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.user_id
UNION
SELECT o.id, o.amount, u.name
FROM orders o
RIGHT JOIN users u ON o.user_id = u.user_id;

-- CROSS JOIN：笛卡尔积（每行与每行组合）
SELECT u.name, p.product_name
FROM users u CROSS JOIN products p;
-- 结果：行数 = users 行数 × products 行数
```

### 3.2 JOIN 类型速查表

| 类型 | 含义 | 左表无匹配 | 右表无匹配 | 典型场景 |
|------|------|-----------|-----------|---------|
| INNER JOIN | 两表交集 | 排除 | 排除 | 关联查询（最常用） |
| LEFT JOIN | 左表全部 | 保留，右表填 NULL | 排除 | 主表 + 可选附表 |
| RIGHT JOIN | 右表全部 | 排除 | 保留，左表填 NULL | 少用，一般改用 LEFT JOIN |
| FULL JOIN | 两表并集 | 保留，右表填 NULL | 保留，左表填 NULL | 数据对账 |
| CROSS JOIN | 笛卡尔积 | — | — | 生成组合、日历 |

### 3.3 多表 JOIN

```sql
-- 三表关联：订单 → 订单明细 → 商品
SELECT
    o.id AS order_id,
    o.order_no,
    u.name AS user_name,
    p.name AS product_name,
    oi.quantity,
    oi.unit_price,
    oi.quantity * oi.unit_price AS subtotal
FROM orders o
INNER JOIN users u ON o.user_id = u.id
INNER JOIN order_items oi ON o.id = oi.order_id
INNER JOIN products p ON oi.product_id = p.id
WHERE o.status = 'paid'
ORDER BY o.id, oi.id;

-- 注意事项：
-- 1. JOIN 不超过 3~4 张表，超过考虑拆分查询
-- 2. JOIN 的列必须有索引
-- 3. 先过滤再 JOIN（用子查询或 WHERE 提前过滤）
```

### 3.4 JOIN 条件的 ON vs WHERE

```sql
-- LEFT JOIN 中 ON 和 WHERE 的区别（容易踩坑）

-- 情况1：条件写在 ON 中
SELECT o.id, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id AND u.status = 'active';
-- 结果：所有订单都保留，但只有 active 用户有名字，非 active 用户 name 为 NULL

-- 情况2：条件写在 WHERE 中
SELECT o.id, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE u.status = 'active' OR u.status IS NULL;
-- 结果：WHERE 过滤了右表为 NULL 的行（如果不用 OR），LEFT JOIN 退化为 INNER JOIN

-- 结论：
-- ON → JOIN 时匹配条件（不影响左表全部保留）
-- WHERE → JOIN 后的过滤（会影响左表的行）
```

---

## 四、聚合与分组

### 4.1 聚合函数

```sql
SELECT
    COUNT(*) AS total_orders,              -- 总行数（包括 NULL）
    COUNT(user_id) AS non_null_users,      -- user_id 非 NULL 的行数
    COUNT(DISTINCT user_id) AS unique_users, -- 去重计数
    SUM(total_amount) AS total_revenue,    -- 求和
    AVG(total_amount) AS avg_amount,       -- 平均值
    MIN(created_at) AS first_order,        -- 最小值
    MAX(created_at) AS last_order          -- 最大值
FROM orders
WHERE status = 'completed';
```

### 4.2 GROUP BY

```sql
-- 基本分组：统计每个用户的订单数和总金额
SELECT
    user_id,
    COUNT(*) AS order_count,
    SUM(total_amount) AS total_spent,
    AVG(total_amount) AS avg_spent
FROM orders
WHERE status = 'completed'
GROUP BY user_id
ORDER BY total_spent DESC;

-- 多列分组：统计每个用户每月的订单数
SELECT
    user_id,
    DATE_FORMAT(created_at, '%Y-%m') AS order_month,
    COUNT(*) AS order_count,
    SUM(total_amount) AS monthly_spent
FROM orders
GROUP BY user_id, DATE_FORMAT(created_at, '%Y-%m')
ORDER BY user_id, order_month;
```

### 4.3 HAVING：组级过滤

```sql
-- 查询消费总额超过 10000 的 VIP 用户
SELECT
    user_id,
    COUNT(*) AS order_count,
    SUM(total_amount) AS total_spent
FROM orders
WHERE status = 'completed'
GROUP BY user_id
HAVING SUM(total_amount) > 10000       -- HAVING 过滤分组后的结果
ORDER BY total_spent DESC;

-- WHERE vs HAVING 的区别：
-- WHERE → 过滤行（分组之前，不能用聚合函数）
-- HAVING → 过滤组（分组之后，能用聚合函数）

-- 执行流程：
-- FROM → WHERE（行过滤）→ GROUP BY（分组）→ HAVING（组过滤）→ SELECT → ORDER BY
```

### 4.4 GROUP BY 的常见错误

```sql
-- ❌ 错误：SELECT 中的非聚合列没有出现在 GROUP BY 中
SELECT user_id, status, COUNT(*)
FROM orders
GROUP BY user_id;
-- 报错：status 不在 GROUP BY 中，也不是聚合函数
-- MySQL 的 ONLY_FULL_GROUP_BY 模式会阻止这种查询

-- ✅ 修正方案1：把所有非聚合列加入 GROUP BY
SELECT user_id, status, COUNT(*)
FROM orders
GROUP BY user_id, status;

-- ✅ 修正方案2：对非聚合列使用聚合函数
SELECT user_id, MAX(status) AS latest_status, COUNT(*)
FROM orders
GROUP BY user_id;

-- ✅ 修正方案3：如果只需要任意一个 status 值
SELECT user_id, ANY_VALUE(status) AS any_status, COUNT(*)
FROM orders
GROUP BY user_id;
```

---

## 五、子查询与 CTE

### 5.1 子查询类型

```sql
-- 1. 标量子查询（返回单个值）
SELECT * FROM orders
WHERE total_amount > (
    SELECT AVG(total_amount) FROM orders
);

-- 2. 列子查询（返回一列，配合 IN / ANY / ALL 使用）
SELECT * FROM users
WHERE id IN (
    SELECT DISTINCT user_id FROM orders WHERE status = 'paid'
);

-- ANY / ALL
SELECT * FROM products
WHERE price > ANY (SELECT price FROM products WHERE category = '电子');
-- ANY：大于子查询中任意一个值即可（等价于 > MIN(...)）

SELECT * FROM products
WHERE price > ALL (SELECT price FROM products WHERE category = '电子');
-- ALL：大于子查询中的所有值（等价于 > MAX(...)）

-- 3. 表子查询（返回一个表，用在 FROM 中）
SELECT user_id, order_count
FROM (
    SELECT user_id, COUNT(*) AS order_count
    FROM orders
    GROUP BY user_id
) AS user_orders
WHERE order_count > 5;

-- 4. EXISTS 子查询（判断是否存在，性能优于 IN）
SELECT u.name
FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.status = 'paid'
);
```

### 5.2 IN vs EXISTS 选择

```
选择原则：小结果集驱动大结果集

子查询结果集小 → IN
  SELECT * FROM orders
  WHERE user_id IN (SELECT id FROM users WHERE level = 'vip');
  -- VIP 用户少，先得到小结果集，再在 orders 中查找

子查询结果集大 / 关联外表 → EXISTS
  SELECT * FROM orders o
  WHERE EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id);
  -- 订单明细多，EXISTS 找到匹配就停（短路优化）

实际场景：大部分情况下优化器会自动优化，写可读性好的即可。
```

### 5.3 CTE（Common Table Expression）

```sql
-- CTE：用 WITH 子句定义临时结果集，替代嵌套子查询

-- 基本语法
WITH user_stats AS (
    SELECT
        user_id,
        COUNT(*) AS order_count,
        SUM(total_amount) AS total_spent
    FROM orders
    WHERE status = 'completed'
    GROUP BY user_id
)
SELECT
    u.name,
    us.order_count,
    us.total_spent
FROM users u
INNER JOIN user_stats us ON u.id = us.user_id
WHERE us.total_spent > 10000
ORDER BY us.total_spent DESC;

-- 多个 CTE
WITH
monthly_orders AS (
    SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS order_count,
        SUM(total_amount) AS revenue
    FROM orders
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
),
monthly_avg AS (
    SELECT AVG(order_count) AS avg_orders FROM monthly_orders
)
SELECT
    mo.month,
    mo.order_count,
    mo.revenue,
    ma.avg_orders,
    mo.order_count - ma.avg_orders AS diff_from_avg
FROM monthly_orders mo
CROSS JOIN monthly_avg ma
ORDER BY mo.month;
```

### 5.4 子查询 vs CTE 对比

| 维度 | 嵌套子查询 | CTE |
|------|-----------|-----|
| 可读性 | 差（层层嵌套） | 好（平铺直叙） |
| 复用性 | 不可复用 | 同一 CTE 可多次引用 |
| 调试 | 困难（不能单独执行内层） | 容易（每个 CTE 可单独测试） |
| 性能 | 优化器可能重复执行 | 大部分数据库自动优化为 CTE |
| 推荐 | 简单单次使用 | 复杂查询优先用 CTE |

---

## 六、窗口函数

窗口函数是 SQL 进阶的分水岭——掌握它，复杂报表和分析查询的效率提升一个量级。

### 6.1 窗口函数基础语法

```sql
function_name() OVER (
    [PARTITION BY 列名]        -- 分组（类似 GROUP BY，但不聚合行）
    [ORDER BY 列名 [ASC|DESC]] -- 排序
    [frame_clause]             -- 窗口范围
)

-- 核心概念：
-- PARTITION BY → 把数据分成多个"窗口"，在每个窗口内独立计算
-- ORDER BY     → 窗口内的排序规则
-- frame_clause → 窗口内的计算范围（行范围）
```

### 6.2 排序函数

```sql
-- ROW_NUMBER：连续编号，不并列
SELECT
    name,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) AS row_num
FROM students;
-- 张三 95 → 1
-- 李四 90 → 2
-- 王五 90 → 3   ← 同分也排不同名次
-- 赵六 85 → 4

-- RANK：并列排名，跳号
SELECT
    name,
    score,
    RANK() OVER (ORDER BY score DESC) AS rank_val
FROM students;
-- 张三 95 → 1
-- 李四 90 → 2
-- 王五 90 → 2   ← 并列第2
-- 赵六 85 → 4   ← 跳过第3

-- DENSE_RANK：并列排名，不跳号
SELECT
    name,
    score,
    DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rank_val
FROM students;
-- 张三 95 → 1
-- 李四 90 → 2
-- 王五 90 → 2   ← 并列第2
-- 赵六 85 → 3   ← 不跳号

-- 三种排序函数选择：
-- 需要唯一行号 → ROW_NUMBER
-- 需要标准排名（有跳号） → RANK
-- 需要连续排名 → DENSE_RANK
```

### 6.3 分组内排名（Top N 问题）

```sql
-- 每个部门薪资前三名
WITH ranked AS (
    SELECT
        dept_name,
        name,
        salary,
        ROW_NUMBER() OVER (PARTITION BY dept_name ORDER BY salary DESC) AS rn
    FROM employees
)
SELECT * FROM ranked WHERE rn <= 3;

-- PARTITION BY dept_name → 按部门分组
-- ORDER BY salary DESC   → 组内按薪资降序
-- rn <= 3                → 每组取前三
```

### 6.4 聚合窗口函数

```sql
-- 累计求和（running total）
SELECT
    order_date,
    daily_amount,
    SUM(daily_amount) OVER (ORDER BY order_date) AS running_total
FROM (
    SELECT DATE(created_at) AS order_date, SUM(total_amount) AS daily_amount
    FROM orders
    GROUP BY DATE(created_at)
) daily;

-- 结果示例：
-- 2026-05-01 | 1000 | 1000
-- 2026-05-02 | 1500 | 2500
-- 2026-05-03 | 800  | 3300

-- 移动平均（最近7天）
SELECT
    order_date,
    daily_amount,
    AVG(daily_amount) OVER (
        ORDER BY order_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS avg_7d
FROM daily_orders;

-- 分组内的百分比
SELECT
    category,
    product_name,
    sales,
    SUM(sales) OVER (PARTITION BY category) AS category_total,
    ROUND(sales * 100.0 / SUM(sales) OVER (PARTITION BY category), 2) AS pct
FROM products;

-- 同比/环比
WITH monthly AS (
    SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        SUM(total_amount) AS revenue
    FROM orders
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
)
SELECT
    month,
    revenue,
    LAG(revenue, 1) OVER (ORDER BY month) AS prev_month,        -- 上月
    LAG(revenue, 12) OVER (ORDER BY month) AS prev_year_month,   -- 去年同月
    ROUND((revenue - LAG(revenue, 1) OVER (ORDER BY month))
          / LAG(revenue, 1) OVER (ORDER BY month) * 100, 2) AS mom_pct  -- 环比
FROM monthly;
```

### 6.5 偏移函数

```sql
-- LAG：向前偏移（取前 N 行的值）
-- LEAD：向后偏移（取后 N 行的值）

SELECT
    order_date,
    daily_amount,
    LAG(daily_amount, 1) OVER (ORDER BY order_date) AS prev_day,     -- 前一天
    LEAD(daily_amount, 1) OVER (ORDER BY order_date) AS next_day,    -- 后一天
    daily_amount - LAG(daily_amount, 1) OVER (ORDER BY order_date) AS diff
FROM daily_orders;

-- FIRST_VALUE / LAST_VALUE：窗口内第一个/最后一个值
SELECT
    dept_name,
    name,
    salary,
    FIRST_VALUE(name) OVER (PARTITION BY dept_name ORDER BY salary DESC) AS highest_paid,
    LAST_VALUE(name) OVER (
        PARTITION BY dept_name ORDER BY salary DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS lowest_paid
FROM employees;
```

### 6.6 窗口范围（Frame Clause）

```sql
-- 窗口范围语法：
-- ROWS BETWEEN start AND end

-- start / end 可选值：
-- UNBOUNDED PRECEDING  → 窗口起点（第一行）
-- N PRECEDING          → 当前行往前 N 行
-- CURRENT ROW          → 当前行
-- N FOLLOWING          → 当前行往后 N 行
-- UNBOUNDED FOLLOWING  → 窗口终点（最后一行）

-- 示例1：从分组第一行到当前行的累计
SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at
                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)

-- 示例2：当前行前后各2行的移动平均
AVG(amount) OVER (ORDER BY created_at
                  ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING)

-- 示例3：当前行到分组最后一行的汇总
SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at
                  ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING)
```

---

## 七、集合运算

### 7.1 UNION / UNION ALL / INTERSECT / EXCEPT

```sql
-- UNION ALL：合并结果集，保留重复行（性能好）
SELECT name, 'customer' AS type FROM customers
UNION ALL
SELECT name, 'supplier' AS type FROM suppliers;

-- UNION：合并结果集，去除重复行（有去重开销）
SELECT city FROM customers
UNION
SELECT city FROM suppliers;
-- 去重 → 等价于对 UNION ALL 结果做 DISTINCT

-- INTERSECT：交集（两个查询都有的行）
-- MySQL 不直接支持，用 INNER JOIN 替代
SELECT DISTINCT a.city
FROM customers a
INNER JOIN suppliers b ON a.city = b.city;

-- EXCEPT / MINUS：差集（在 A 中但不在 B 中）
-- MySQL 不直接支持，用 LEFT JOIN 或 NOT IN 替代
SELECT city FROM customers
WHERE city NOT IN (SELECT city FROM suppliers);
```

### 7.2 集合运算对比

| 运算 | 含义 | MySQL 支持 | 去重 | 注意 |
|------|------|-----------|------|------|
| UNION ALL | 合并 | 支持 | 否 | 优先使用，性能好 |
| UNION | 合并去重 | 支持 | 是 | 有排序去重开销 |
| INTERSECT | 交集 | 8.0+ | 是 | 可用 INNER JOIN 替代 |
| EXCEPT | 差集 | 8.0+ | 是 | 可用 NOT IN / LEFT JOIN 替代 |

---

## 八、CASE 表达式

### 8.1 两种形式

```sql
-- 简单 CASE（等值匹配）
SELECT
    status,
    CASE status
        WHEN 'pending'   THEN '待支付'
        WHEN 'paid'      THEN '已支付'
        WHEN 'shipped'   THEN '已发货'
        WHEN 'completed' THEN '已完成'
        WHEN 'cancelled' THEN '已取消'
        ELSE '未知状态'
    END AS status_text
FROM orders;

-- 搜索 CASE（条件匹配，更灵活）
SELECT
    name,
    score,
    CASE
        WHEN score >= 90 THEN '优秀'
        WHEN score >= 80 THEN '良好'
        WHEN score >= 60 THEN '及格'
        ELSE '不及格'
    END AS grade
FROM students;
```

### 8.2 CASE 的实用场景

```sql
-- 1. 行转列（透视表）
SELECT
    user_id,
    SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) AS paid_amount,
    SUM(CASE WHEN status = 'cancelled' THEN total_amount ELSE 0 END) AS cancelled_amount,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_count
FROM orders
GROUP BY user_id;

-- 2. 自定义排序
SELECT * FROM orders
ORDER BY
    CASE status
        WHEN 'pending' THEN 1
        WHEN 'paid' THEN 2
        WHEN 'shipped' THEN 3
        WHEN 'completed' THEN 4
        ELSE 5
    END,
    created_at DESC;

-- 3. 条件聚合
SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN total_amount > 1000 THEN 1 ELSE 0 END) AS high_value_count,
    ROUND(SUM(CASE WHEN total_amount > 1000 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS high_value_pct
FROM orders;
```

---

## 九、数据操作（DML）

### 9.1 INSERT

```sql
-- 单行插入
INSERT INTO users (username, phone, email)
VALUES ('zhangsan', '13800138000', 'zhangsan@example.com');

-- 多行插入（推荐，减少网络往返）
INSERT INTO users (username, phone, email) VALUES
('zhangsan', '13800138000', 'zhangsan@example.com'),
('lisi', '13900139000', 'lisi@example.com'),
('wangwu', '13700137000', 'wangwu@example.com');

-- 插入查询结果
INSERT INTO user_archive (user_id, username, archived_at)
SELECT id, username, NOW() FROM users WHERE is_deleted = 1;

-- 冲突处理（MySQL：ON DUPLICATE KEY UPDATE）
INSERT INTO user_stats (user_id, login_count, last_login)
VALUES (1, 1, NOW())
ON DUPLICATE KEY UPDATE
    login_count = login_count + 1,
    last_login = NOW();
```

### 9.2 UPDATE

```sql
-- 基本更新
UPDATE products SET price = 99.9, updated_at = NOW() WHERE id = 100;

-- 条件更新
UPDATE orders
SET status = 'expired'
WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- 关联更新（用 JOIN）
UPDATE orders o
INNER JOIN users u ON o.user_id = u.id
SET o.user_level = u.level
WHERE u.level IN ('vip', 'svip');

-- ⚠️ 更新必带 WHERE，否则更新全表
```

### 9.3 DELETE

```sql
-- 基本删除
DELETE FROM temp_data WHERE created_at < '2026-01-01';

-- 关联删除
DELETE o FROM orders o
INNER JOIN users u ON o.user_id = u.id
WHERE u.is_deleted = 1;

-- 清空整表（DDL，比 DELETE 快，不可回滚）
TRUNCATE TABLE temp_import;

-- 软删除（推荐，生产环境优先用软删除）
UPDATE users SET is_deleted = 1, deleted_at = NOW() WHERE id = 10086;
```

---

## 十、事务与锁

### 10.1 事务基础

```sql
-- 事务：一组操作要么全部成功，要么全部回滚

-- ACID 特性：
-- A（原子性）：事务内的操作不可分割
-- C（一致性）：事务前后数据保持一致
-- I（隔离性）：并发事务互不干扰
-- D（持久性）：事务提交后永久保存

-- 基本用法
START TRANSACTION;    -- 或 BEGIN

UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
UPDATE accounts SET balance = balance + 100 WHERE user_id = 2;

COMMIT;   -- 提交事务
-- 或 ROLLBACK;  -- 回滚事务
```

### 10.2 事务隔离级别

```
四种隔离级别（从低到高）：

┌──────────────┬──────────┬──────────┬──────────┐
│   隔离级别   │ 脏读     │ 不可重复读│ 幻读     │
├──────────────┼──────────┼──────────┼──────────┤
│ READ UNCOMMITTED │ 可能  │ 可能     │ 可能     │
│ READ COMMITTED   │ 不会  │ 可能     │ 可能     │
│ REPEATABLE READ  │ 不会  │ 不会     │ 可能     │  ← MySQL 默认
│ SERIALIZABLE     │ 不会  │ 不会     │ 不会     │
└──────────────┴──────────┴──────────┴──────────┘

脏读：读到了其他事务未提交的数据
不可重复读：同一事务内两次读同一行数据结果不同（被其他事务 UPDATE/DELETE）
幻读：同一事务内两次查询结果集行数不同（被其他事务 INSERT）

MySQL InnoDB 默认：REPEATABLE READ
PostgreSQL 默认：READ COMMITTED
```

```sql
-- 查看当前隔离级别
SELECT @@transaction_isolation;

-- 设置隔离级别
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 实际建议：
-- 大部分场景用默认的 REPEATABLE READ 即可
-- 需要看到最新数据时用 READ COMMITTED
-- 极少用 SERIALIZABLE（性能差）
```

### 10.3 锁

```
InnoDB 锁类型：

1. 共享锁（S 锁 / 读锁）
   SELECT ... LOCK IN SHARE MODE;
   -- 其他事务可以读，但不能写

2. 排他锁（X 锁 / 写锁）
   SELECT ... FOR UPDATE;
   -- 其他事务不能读也不能写

3. 意向锁（IS / IX）
   -- 表级锁，InnoDB 自动加，不需要手动操作

4. 行锁 vs 表锁
   -- InnoDB 默认行锁（锁定索引项）
   -- 如果 SQL 没有用索引 → 锁退化为表锁（⚠️ 性能杀手）

5. 间隙锁（Gap Lock）
   -- REPEATABLE READ 级别下，锁定索引之间的间隙
   -- 防止幻读：阻止其他事务在间隙中 INSERT
   -- 可能在并发插入时造成死锁
```

```sql
-- 常见锁场景

-- 场景1：悲观锁（先锁再改）
SELECT balance FROM accounts WHERE user_id = 1 FOR UPDATE;
-- 应用层判断余额是否足够
UPDATE accounts SET balance = balance - 100 WHERE user_id = 1;
COMMIT;

-- 场景2：乐观锁（用版本号，适合低冲突场景）
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = 100 AND stock > 0 AND version = 5;
-- affected rows = 1 → 成功
-- affected rows = 0 → 版本冲突或库存不足，重试

-- 场景3：分布式锁（用 Redis / 数据库模拟）
-- MySQL 方案：
INSERT INTO distributed_lock (lock_key, locked_by, locked_at)
VALUES ('order_10086', 'server_1', NOW())
ON DUPLICATE KEY UPDATE locked_by = VALUES(locked_by);
```

### 10.4 死锁

```
死锁：两个事务互相等待对方持有的锁

事务A                        事务B
┌──────────────────────┐    ┌──────────────────────┐
│ UPDATE row1 → 锁row1 │    │                      │
│                      │    │ UPDATE row2 → 锁row2 │
│ UPDATE row2 → 等待... │    │                      │
│                      │    │ UPDATE row1 → 等待... │
└──────────────────────┘    └──────────────────────┘
→ 互相等待 → 死锁

预防死锁：
1. 按固定顺序访问资源（如按 ID 升序）
2. 保持事务简短，减少锁持有时间
3. 合理使用索引，避免锁升级为表锁
4. 设置锁等待超时：innodb_lock_wait_timeout = 5（秒）

InnoDB 自动检测死锁，回滚代价最小的事务。
```

---

## 十一、高级特性

### 11.1 视图（VIEW）

```sql
-- 视图：保存的查询语句，不存储数据（虚拟表）

-- 创建视图
CREATE VIEW v_user_order_stats AS
SELECT
    u.id AS user_id,
    u.name,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(o.total_amount), 0) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id AND o.status = 'completed'
GROUP BY u.id, u.name;

-- 使用视图（像普通表一样查询）
SELECT * FROM v_user_order_stats WHERE total_spent > 10000;

-- 修改视图
CREATE OR REPLACE VIEW v_user_order_stats AS ...;

-- 删除视图
DROP VIEW v_user_order_stats;

-- 适用场景：
-- 1. 简化复杂查询（报表视图）
-- 2. 权限控制（只暴露部分列给某些用户）
-- 3. 兼容旧接口（表结构变了但视图不变）

-- 局限：
-- 1. 性能不一定好（本质是执行子查询）
-- 2. 可更新的视图有限制（不能有聚合、DISTINCT、UNION 等）
-- 3. 调试困难（视图嵌套视图时）
```

### 11.2 存储过程与函数

```sql
-- 存储过程：一组预编译的 SQL 语句

DELIMITER //
CREATE PROCEDURE transfer_money(
    IN from_user BIGINT,
    IN to_user BIGINT,
    IN amount DECIMAL(10, 2),
    OUT result VARCHAR(20)
)
BEGIN
    DECLARE from_balance DECIMAL(10, 2);

    START TRANSACTION;

    SELECT balance INTO from_balance FROM accounts WHERE user_id = from_user FOR UPDATE;

    IF from_balance < amount THEN
        SET result = 'INSUFFICIENT_BALANCE';
        ROLLBACK;
    ELSE
        UPDATE accounts SET balance = balance - amount WHERE user_id = from_user;
        UPDATE accounts SET balance = balance + amount WHERE user_id = to_user;
        SET result = 'SUCCESS';
        COMMIT;
    END IF;
END //
DELIMITER ;

-- 调用
CALL transfer_money(1, 2, 100.00, @result);
SELECT @result;

-- 自定义函数
DELIMITER //
CREATE FUNCTION get_user_level(user_id_param BIGINT)
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE total DECIMAL(10, 2);
    DECLARE level_name VARCHAR(20);

    SELECT COALESCE(SUM(total_amount), 0) INTO total
    FROM orders WHERE user_id = user_id_param AND status = 'completed';

    IF total >= 100000 THEN SET level_name = 'diamond';
    ELSEIF total >= 10000 THEN SET level_name = 'gold';
    ELSEIF total >= 1000 THEN SET level_name = 'silver';
    ELSE SET level_name = 'bronze';
    END IF;

    RETURN level_name;
END //
DELIMITER ;

-- 使用函数
SELECT name, get_user_level(id) AS level FROM users;
```

```
存储过程的争议：

┌──────────┬──────────────────────────────────────┐
│   优点   │            缺点                       │
├──────────┼──────────────────────────────────────┤
│ 减少网络 │ 调试困难，IDE 支持差                   │
│ 往返     │                                      │
│ 封装业务 │ 业务逻辑散落在应用代码和数据库中        │
│ 逻辑     │                                      │
│ 安全控制 │ 版本管理困难                          │
│          │                                      │
│ 性能好   │ 可移植性差（不同数据库语法不同）        │
└──────────┴──────────────────────────────────────┘

建议：
- 简单的数据搬运/批量操作 → 可以用存储过程
- 复杂的业务逻辑 → 放在应用代码中
- 大部分现代项目倾向"瘦数据库"，用应用代码替代存储过程
```

### 11.3 触发器

```sql
-- 触发器：在 INSERT/UPDATE/DELETE 时自动执行的逻辑

-- 示例：订单创建后自动扣减库存
DELIMITER //
CREATE TRIGGER after_order_item_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id;
END //
DELIMITER ;

-- NEW：新插入/更新后的行数据
-- OLD：删除/更新前的行数据

-- 触发时机：BEFORE / AFTER
-- 触发事件：INSERT / UPDATE / DELETE

-- 局限：
-- 1. 隐式执行，不容易发现和调试
-- 2. 增加数据库负担
-- 3. 可能引起级联触发（A 触发 B，B 触发 C）
-- 4. 大部分场景建议用应用代码替代触发器
```

### 11.4 JSON 操作（MySQL 5.7+）

```sql
-- 创建带 JSON 列的表
CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200),
    attrs JSON COMMENT '商品属性（JSON 格式）'
);

-- 插入 JSON 数据
INSERT INTO products (name, attrs) VALUES
('iPhone', '{"color": "黑色", "storage": 256, "specs": {"cpu": "A17", "ram": 8}}');

-- 查询 JSON 字段
SELECT name, attrs->>'$.color' AS color FROM products;
SELECT name, attrs->'$.storage' AS storage FROM products;

-- JSON 路径表达式：
-- $     → 根元素
-- $.key → 对象的某个键
-- $[0]  → 数组的第一个元素
-- $.a.b → 嵌套访问
-- ->    → 返回 JSON 类型
-- ->>   → 返回字符串类型（去掉引号）

-- JSON 条件查询
SELECT * FROM products WHERE attrs->>'$.color' = '黑色';
SELECT * FROM products WHERE JSON_EXTRACT(attrs, '$.storage') > 128;

-- JSON 修改
UPDATE products SET attrs = JSON_SET(attrs, '$.color', '白色') WHERE id = 1;
UPDATE products SET attrs = JSON_INSERT(attrs, '$.weight', '200g') WHERE id = 1;
UPDATE products SET attrs = JSON_REMOVE(attrs, '$.specs.cpu') WHERE id = 1;

-- 适用场景：
-- 1. 动态属性（不同商品有不同属性字段）
-- 2. 配置信息（不常变更的配置）
-- 3. 日志/事件数据（结构不固定）

-- 不适用场景：
-- 1. 需要频繁条件查询的字段 → 用独立列
-- 2. 需要关联查询的字段 → 用独立表
-- 3. 大 JSON（超过几 KB）→ 性能差
```

---

## 十二、SQL 方言差异

### 12.1 常用语法差异对比

| 功能 | MySQL | PostgreSQL | SQL Server |
|------|-------|-----------|-----------|
| 字符串拼接 | `CONCAT(a, b)` | `a \|\| b` | `a + b` |
| 分页 | `LIMIT n OFFSET m` | `LIMIT n OFFSET m` | `OFFSET m ROWS FETCH NEXT n ROWS ONLY` |
| 自增主键 | `AUTO_INCREMENT` | `SERIAL` / `GENERATED ALWAYS AS IDENTITY` | `IDENTITY(1,1)` |
| 当前时间 | `NOW()` | `NOW()` / `CURRENT_TIMESTAMP` | `GETDATE()` |
| 日期格式化 | `DATE_FORMAT(d, '%Y-%m')` | `TO_CHAR(d, 'YYYY-MM')` | `FORMAT(d, 'yyyy-MM')` |
| 类型转换 | `CAST(x AS CHAR)` | `x::VARCHAR` | `CAST(x AS VARCHAR)` |
| IF 函数 | `IF(cond, a, b)` | `CASE WHEN ... END` | `IIF(cond, a, b)` |
| 布尔类型 | `TINYINT(1)` | `BOOLEAN` | `BIT` |
| JSON 查询 | `attrs->>'$.key'` | `attrs->>'key'` | `JSON_VALUE(attrs, '$.key')` |
| 全文索引 | `FULLTEXT INDEX` | `GIN 索引 + tsvector` | `FULLTEXT INDEX` |
| CTE 递归 | `WITH RECURSIVE` | `WITH RECURSIVE` | `WITH RECURSIVE`（相同） |
| 窗口函数 | 8.0+ 支持 | 全面支持 | 全面支持 |

### 12.2 标准 SQL vs 方言

```
尽量写标准 SQL，减少迁移成本：

标准 SQL（跨数据库通用）：
✅ CASE WHEN ... END
✅ COALESCE(a, b)
✅ CAST(x AS type)
✅ WITH ... AS (...)
✅ ROW_NUMBER() OVER (...)
✅ LIMIT ... OFFSET ...

方言（尽量少用或封装）：
⚠️ MySQL 的 IF()、GROUP_CONCAT()
⚠️ PostgreSQL 的 ARRAY、JSONB 操作符
⚠️ SQL Server 的 TOP、ISNULL()

建议：在应用层封装数据库差异（ORM / Query Builder）
```

---

## 十三、SQL 编写规范

### 13.1 格式规范

```sql
-- ✅ 推荐的格式
SELECT
    o.id,
    o.order_no,
    u.name AS user_name,
    SUM(oi.quantity * oi.unit_price) AS total_amount
FROM orders o
INNER JOIN users u ON o.user_id = u.id
INNER JOIN order_items oi ON o.id = oi.order_id
WHERE o.status = 'completed'
    AND o.created_at >= '2026-05-01'
GROUP BY
    o.id,
    o.order_no,
    u.name
HAVING SUM(oi.quantity * oi.unit_price) > 1000
ORDER BY total_amount DESC
LIMIT 20;

-- 规范要点：
-- 1. 关键字大写（SELECT, FROM, WHERE, JOIN, GROUP BY ...）
-- 2. 每个主要子句独占一行
-- 3. 逗号放在行首或行尾（团队统一即可）
-- 4. 缩进对齐
-- 5. 表使用简短有意义的别名（orders → o, users → u）
```

### 13.2 编写原则

```
1. 先写框架，再填细节
   SELECT ... FROM ... WHERE ... GROUP BY ... ORDER BY ...
   先确定查询结构，再填入列名和条件

2. 复杂查询用 CTE 拆分
   不要一个查询嵌套五层子查询

3. 起有意义的别名
   ❌ SELECT a.col1, b.col2 FROM table1 a JOIN table2 b
   ✅ SELECT o.order_no, u.name FROM orders o JOIN users u

4. 避免 SELECT *
   明确列出需要的列

5. 先过滤再关联
   在 WHERE 或子查询中尽早过滤数据，减少 JOIN 的数据量

6. 用 EXPLAIN 验证
   写完 SQL 后看执行计划，确认走了索引

7. 添加注释
   复杂的查询逻辑必须有注释说明
```

---

## 十四、学习路径与进阶方向

```
SQL 能力层级：

Level 1（入门）- 能写 CRUD
  □ SELECT / INSERT / UPDATE / DELETE
  □ WHERE / ORDER BY / LIMIT
  □ 基本的 JOIN

Level 2（熟练）- 能写业务查询
  □ 多表 JOIN（LEFT/RIGHT/INNER）
  □ GROUP BY + HAVING + 聚合函数
  □ 子查询（IN / EXISTS）
  □ CASE WHEN
  □ UNION ALL

Level 3（进阶）- 能写分析查询
  □ CTE（WITH 子句）
  □ 窗口函数（ROW_NUMBER / RANK / LAG / SUM OVER）
  □ 复杂报表 SQL
  □ SQL 性能优化

Level 4（精通）- 能设计数据方案
  □ 事务隔离级别与锁
  □ 存储过程 / 触发器 / 视图
  □ 数据建模（范式 / 反范式）
  □ 分库分表 SQL 改造
  □ 跨数据库 SQL 迁移
```
