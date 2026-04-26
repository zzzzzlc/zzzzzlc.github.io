---
title: "数据选型与表设计：从需求到落地的完整指南"
date: "2026-04-26"
tags:
  - 数据库
  - 表设计
  - MySQL
  - MongoDB
  - PostgreSQL
  - 架构
category: "后端工程"
summary: "从实际业务场景出发，系统梳理数据选型的决策路径（关系型、文档型、KV、搜索引擎、时序），以及表设计的核心原则与常见反模式。覆盖范式与反范式、索引策略、分库分表、软删除与硬删除等关键问题，给出明确的选型建议与边界。"
---

# 数据选型与表设计：从需求到落地的完整指南

## 一、问题来源

几乎所有后端系统的核心矛盾都指向一个点：**数据怎么存、怎么查、怎么变。**

**业务层面的痛点：**

- 项目初期随便选了个数据库，业务复杂度增长后发现查询性能急剧下降，但迁移成本已经很高
- 表结构设计时没有考虑扩展性，一个新需求就需要加字段甚至加表，改到怀疑人生
- 同一个业务的数据散落在多个表中，联表查询越来越慢，但拆分后又面临分布式事务问题
- 团队里有人用 MySQL 存 JSON，有人用 MongoDB 存关系数据，风格混乱，维护困难

**技术层面的痛点：**

- 关系型数据库（MySQL/PostgreSQL） vs 文档型数据库（MongoDB）的选择，网上观点相互矛盾
- 不知道什么时候该引入 Redis、Elasticsearch、ClickHouse，引入后又要维护多套数据一致性
- 表设计该遵循范式还是反范式？三级范式太严格查询慢，完全反范式又数据冗余

**核心问题：数据选型和表设计没有"标准答案"，只有"适合当前业务阶段的答案"。**

本文将系统梳理常见数据库类型的特点、表设计的核心原则、以及明确的选型决策路径。

---

## 二、数据选型：五大数据库类型对比

### 2.1 关系型数据库（MySQL / PostgreSQL）

**特点：** 结构化数据、强事务（ACID）、SQL 查询、成熟的生态

```sql
-- 典型使用场景：电商订单系统
CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status_created (status, created_at)
);

CREATE TABLE order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    INDEX idx_order_id (order_id)
);
```

**优点：**
- 事务保证数据一致性，金融场景不可或缺
- SQL 强大的查询能力，JOIN / GROUP BY / 子查询
- 生态成熟：ORM、迁移工具、监控、备份方案齐全
- 人才储备充足，团队学习成本低

**缺点：**
- 表结构固定（Schema Rigidity），加字段需要 DDL 操作，大表可能锁表
- 不擅长存储半结构化数据（JSON 列是补丁方案）
- 水平扩展困难（分库分表复杂）
- 复杂查询性能随数据量增长急剧下降

**适配场景：** 订单、支付、用户、权限等核心业务数据——需要事务和严格一致性的场景

**MySQL vs PostgreSQL：**

| 维度 | MySQL | PostgreSQL |
|------|-------|-----------|
| 性能 | 简单查询快，读写均衡 | 复杂查询、分析型场景更强 |
| JSON 支持 | JSON 列（有限） | JSONB（完整索引支持） |
| 扩展性 | 中等 | 强（插件体系、自定义类型） |
| 运维复杂度 | 低 | 中等 |
| 社区生态 | 更大（Web 领域） | 增长快（Geospatial、分析） |
| 选择建议 | 大多数 Web 项目 | 需要 GIS / 全文搜索 / 复杂查询 |

### 2.2 文档型数据库（MongoDB）

**特点：** 灵活 Schema、JSON 文档存储、水平扩展友好

```javascript
// 典型使用场景：内容管理系统
// 文章 + 标签 + 作者 + 评论，一个文档搞定
{
    _id: ObjectId("..."),
    title: "Next.js 全指南",
    content: "文章正文...",
    author: {
        id: ObjectId("..."),
        name: "张三",
        avatar: "https://..."
    },
    tags: ["React", "Next.js", "SSR"],
    stats: {
        views: 12580,
        likes: 342,
        comments: 56
    },
    comments: [
        {
            userId: ObjectId("..."),
            content: "写得很好！",
            createdAt: ISODate("2026-04-26T10:00:00Z")
        }
    ],
    createdAt: ISODate("2026-04-26T08:00:00Z"),
    updatedAt: ISODate("2026-04-26T12:00:00Z")
}
```

**优点：**
- Schema 灵活，字段可随时增减，无需 DDL
- 文档模型天然契合嵌套数据（文章+评论、订单+明细）
- 水平扩展简单（内置 Sharding）
- 读写性能在文档级别非常快

**缺点：**
- 无多文档事务（4.0 后支持，但性能有损）
- JOIN 能力弱（$lookup 性能远不如 SQL JOIN）
- 内存消耗大（文档可能很大）
- 数据一致性靠应用层保证

**适配场景：** 内容管理、日志存储、IoT 设备数据、原型快速迭代

**局限性：** 需要多表关联的复杂业务（如 ERP、财务系统）不适合用 MongoDB

### 2.3 KV 缓存（Redis）

**特点：** 内存存储、超高性能、丰富数据结构

```bash
# 典型使用场景：缓存 + 计数器 + 排行榜 + 分布式锁

# 缓存用户信息（String）
SET user:10001 '{"name":"张三","role":"admin"}' EX 3600

# 文章点赞计数（Hash）
HINCRBY article:50021 stats:likes 1

# 实时排行榜（Sorted Set）
ZADD leaderboard:weekly 9500 "user:10001"
ZADD leaderboard:weekly 8800 "user:10002"
ZREVRANGE leaderboard:weekly 0 9 WITHSCORES

# 分布式锁（String + 过期时间）
SET lock:order:12345 "machine-001" NX EX 30

# 限流（滑动窗口）
INCR rate_limit:10001:2026042610
EXPIRE rate_limit:10001:2026042610 3600
```

**优点：**
- 单线程无锁设计，10w+ QPS
- 数据结构丰富，覆盖多种场景
- 支持持久化（RDB / AOF），不完全丢失数据

**缺点：**
- 内存成本高，不适合存大量冷数据
- 不是数据库，不能替代持久化存储
- 数据一致性需要应用层保障（缓存穿透、雪崩、击穿）

**适配场景：** 热数据缓存、排行榜、计数器、分布式锁、会话管理、限流

### 2.4 搜索引擎（Elasticsearch）

**特点：** 全文搜索、倒排索引、近实时查询、聚合分析

```json
// 典型使用场景：商品搜索 + 筛选
PUT /products
{
    "mappings": {
        "properties": {
            "name": { "type": "text", "analyzer": "ik_max_word" },
            "description": { "type": "text", "analyzer": "ik_max_word" },
            "category": { "type": "keyword" },
            "brand": { "type": "keyword" },
            "price": { "type": "scaled_float", "scaling_factor": 100 },
            "sales": { "type": "integer" },
            "createdAt": { "type": "date" },
            "tags": { "type": "keyword" }
        }
    }
}

// 搜索：关键词 + 分类筛选 + 价格范围 + 按销量排序
GET /products/_search
{
    "query": {
        "bool": {
            "must": [
                { "multi_match": { "query": "蓝牙耳机", "fields": ["name^3", "description"] } }
            ],
            "filter": [
                { "term": { "category": "数码产品" } },
                { "range": { "price": { "gte": 100, "lte": 500 } } }
            ]
        }
    },
    "sort": [
        { "sales": "desc" },
        "_score"
    ],
    "from": 0,
    "size": 20
}
```

**优点：**
- 全文搜索能力远超 SQL LIKE
- 复合条件筛选性能稳定（不随数据量线性增长）
- 聚合分析能力强（统计分析）
- 近实时索引（写入后约 1 秒可搜索）

**缺点：**
- 资源消耗大（JVM、堆内存、磁盘）
- 不支持事务
- 与主数据库的数据同步需要额外方案（Canal / Logstash / CDC）
- 集群运维复杂

**适配场景：** 电商搜索、日志分析、内容检索、监控指标聚合

### 2.5 时序数据库（ClickHouse / InfluxDB / TDengine）

**特点：** 针对时间序列数据优化，写入速度极快，压缩率高

```sql
-- ClickHouse 典型使用场景：用户行为分析
CREATE TABLE user_events (
    event_date Date,
    event_time DateTime,
    user_id UInt64,
    event_type String,    -- 'page_view', 'click', 'purchase'
    page_url String,
    device_type String,
    browser String,
    duration_ms UInt32,
    extra_data String     -- JSON 格式扩展字段
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, user_id, event_time)
TTL event_date + INTERVAL 90 DAY;

-- 查询：最近 7 天每天的 PV / UV / 平均停留时长
SELECT
    event_date,
    count() AS pv,
    uniq(user_id) AS uv,
    avg(duration_ms) AS avg_duration
FROM user_events
WHERE event_date >= today() - 7
GROUP BY event_date
ORDER BY event_date;
```

**优点：**
- 写入性能极高（百万级/秒）
- 列式存储 + 高压缩比，存储成本远低于 MySQL
- 聚合查询性能优异

**缺点：**
- 不支持单行更新/删除（或性能极差）
- 不适合 OLTP 场景
- 学习曲线较陡

**适配场景：** 监控指标、日志分析、用户行为埋点、IoT 传感器数据、金融行情数据

### 2.6 选型速查表

| 数据库类型 | 写入性能 | 查询灵活性 | 事务 | 水平扩展 | 存储成本 | 适用场景 |
|-----------|---------|-----------|------|---------|---------|---------|
| MySQL / PG | 中 | 高（SQL） | 强 | 难 | 中 | 核心业务数据 |
| MongoDB | 高 | 中 | 弱 | 易 | 中 | 内容/文档/原型 |
| Redis | 极高 | 低 | 无 | 易（集群） | 高（内存） | 缓存/临时数据 |
| Elasticsearch | 高 | 高（搜索） | 无 | 易 | 高 | 搜索/日志分析 |
| ClickHouse | 极高 | 中（聚合） | 无 | 易 | 低 | 时序/分析 |

---

## 三、表设计核心原则

### 3.1 范式 vs 反范式

**三大范式简述：**

- **第一范式（1NF）**：每列都是原子值，不可再分
- **第二范式（2NF）**：在 1NF 基础上，非主键列完全依赖主键（消除部分依赖）
- **第三范式（3NF）**：在 2NF 基础上，非主键列不传递依赖（消除传递依赖）

**范式化示例：**

```sql
-- 范式化：用户、地址、订单分三张表
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL
);

CREATE TABLE addresses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    province VARCHAR(50),
    city VARCHAR(50),
    district VARCHAR(50),
    detail VARCHAR(500),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    address_id BIGINT NOT NULL,
    total_amount DECIMAL(10, 2),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (address_id) REFERENCES addresses(id)
);
```

**反范式化示例：**

```sql
-- 反范式化：订单中冗余用户名和收货地址，避免 JOIN
CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    user_name VARCHAR(100) NOT NULL,          -- 冗余
    shipping_address VARCHAR(500) NOT NULL,    -- 冗余（快照）
    total_amount DECIMAL(10, 2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**什么时候用范式：**
- 数据更新频繁（冗余字段的同步成本高）
- 数据一致性要求高（如财务系统）
- 写多读少

**什么时候用反范式：**
- 读多写少（如展示类页面）
- 查询性能优先（减少 JOIN）
- 历史快照需求（订单地址是下单时的快照，不需要同步更新）

**实际建议：核心业务表（用户、订单、支付）遵循范式，展示/查询层（报表、列表）适度反范式。**

### 3.2 主键设计

```sql
-- ❌ 方案一：自增 ID（MySQL 默认）
-- 优点：有序，B+ 树插入性能好
-- 缺点：可预测，分布式环境下有冲突风险
id BIGINT PRIMARY KEY AUTO_INCREMENT

-- ❌ 方案二：UUID
-- 优点：全局唯一，无需协调
-- 缺点：无序，索引碎片严重，36 字节过长
id CHAR(36) PRIMARY KEY

-- ✅ 方案三：雪花算法（Snowflake）— 推荐
-- 优点：有序 + 全局唯一 + 趋势递增，8 字节
-- 缺点：依赖时钟（时钟回拨会冲突）
id BIGINT PRIMARY KEY  -- 应用层生成雪花 ID

-- ✅ 方案四：ULID（UUID + 时间排序）
-- 优点：时间有序 + 随机性，26 字符字符串
-- 缺点：比纯数字 ID 占空间
id CHAR(26) PRIMARY KEY
```

**主键选择建议：**

| 方案 | 有序性 | 全局唯一 | 存储 | 分布式 | 推荐场景 |
|------|--------|---------|------|--------|---------|
| 自增 ID | 强 | 单库唯一 | 8B | 否 | 单库单体应用 |
| UUID | 无 | 全局唯一 | 36B | 是 | 很少推荐 |
| Snowflake | 趋势递增 | 全局唯一 | 8B | 是 | 分布式系统首选 |
| ULID | 时间有序 | 全局唯一 | 26B | 是 | 需要可读 ID |

### 3.3 索引设计

```sql
-- 单列索引
CREATE INDEX idx_user_id ON orders(user_id);

-- 联合索引 — 遵循最左前缀原则
-- 查询条件: WHERE status = 'paid' AND created_at > '2026-01-01'
CREATE INDEX idx_status_created ON orders(status, created_at);

-- 覆盖索引 — 查询的所有列都在索引中，无需回表
-- 查询: SELECT user_id, total_amount FROM orders WHERE status = 'paid'
CREATE INDEX idx_status_cover ON orders(status, user_id, total_amount);

-- 唯一索引 — 保证数据唯一性
CREATE UNIQUE INDEX idx_email ON users(email);
```

**索引设计的常见陷阱：**

```
陷阱 1：索引过多
- 每个索引都会增加写入开销和存储空间
- 经验值：单表索引不超过 5-7 个
- 通过慢查询日志分析，只为实际查询创建索引

陷阱 2：联合索引顺序错误
-- 查询: WHERE user_id = ? AND status = ?
-- ✅ 正确：区分度高的列在前
CREATE INDEX idx_user_status ON orders(user_id, status);
-- ❌ 错误：status 区分度低（只有几个枚举值）
CREATE INDEX idx_status_user ON orders(status, user_id);

陷阱 3：对索引列使用函数
-- ❌ 索引失效
WHERE YEAR(created_at) = 2026
-- ✅ 索引有效
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'

陷阱 4：隐式类型转换
-- phone 是 VARCHAR，传入整数导致索引失效
-- ❌ WHERE phone = 13800138000
-- ✅ WHERE phone = '13800138000'
```

### 3.4 软删除 vs 硬删除

```sql
-- 方案一：软删除（deleted_at 字段）
CREATE TABLE articles (
    id BIGINT PRIMARY KEY,
    title VARCHAR(200),
    content TEXT,
    deleted_at DATETIME DEFAULT NULL,  -- NULL 表示未删除
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 查询时需要加条件
SELECT * FROM articles WHERE deleted_at IS NULL;

-- 方案二：硬删除 + 归档表
-- 主表：只存活跃数据
CREATE TABLE articles ( ... );

-- 归档表：存删除的数据
CREATE TABLE articles_archive (
    id BIGINT PRIMARY KEY,
    title VARCHAR(200),
    content TEXT,
    original_created_at DATETIME,
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 删除时先归档再删除
INSERT INTO articles_archive SELECT *, NOW() FROM articles WHERE id = ?;
DELETE FROM articles WHERE id = ?;
```

**软删除 vs 硬删除对比：**

| 维度 | 软删除 | 硬删除 + 归档 |
|------|--------|-------------|
| 恢复难度 | 简单（清空 deleted_at） | 中等（从归档表恢复） |
| 查询性能 | 所有查询都要加 WHERE 条件，索引变大 | 主表数据量小，查询快 |
| 唯一约束 | 需要联合唯一索引（name, deleted_at） | 主表直接唯一约束 |
| 数据合规 | 数据仍在主表，GDPR 合规风险 | 敏感数据可从归档表彻底删除 |

**建议：** 核心业务数据（订单、支付）用软删除，大体积数据（日志、文件记录）用硬删除 + 归档。

### 3.5 枚举字段设计

```sql
-- ❌ 方案一：ENUM 类型
-- 修改枚举值需要 DDL（ALTER TABLE），大表可能锁表
status ENUM('pending', 'paid', 'shipped')

-- ❌ 方案二：VARCHAR 存字符串
-- 无约束，可能写入脏数据 'payd'
status VARCHAR(20)

-- ✅ 方案三：TINYINT + 映射表（推荐）
-- 修改状态只需改应用层代码，不需要 DDL
status TINYINT NOT NULL DEFAULT 0 COMMENT '0-待支付 1-已支付 2-已发货 3-已完成 4-已取消'

-- ✅ 方案四：字典表（适合状态多、需要动态管理的场景）
CREATE TABLE order_status_dict (
    code TINYINT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(200)
);
INSERT INTO order_status_dict VALUES
(0, '待支付', '订单已创建，等待支付'),
(1, '已支付', '支付成功，等待发货'),
(2, '已发货', '已发货，等待确认收货');
```

---

## 四、常见业务的表设计实战

### 4.1 用户系统

```sql
-- 用户表
CREATE TABLE users (
    id BIGINT PRIMARY KEY COMMENT '雪花 ID',
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE,
    nickname VARCHAR(50) NOT NULL,
    avatar VARCHAR(500),
    password_hash VARCHAR(200) NOT NULL COMMENT 'bcrypt hash',
    status TINYINT DEFAULT 1 COMMENT '1-正常 2-禁用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 第三方登录绑定
CREATE TABLE user_oauth (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL COMMENT 'wechat/github/google',
    provider_uid VARCHAR(100) NOT NULL COMMENT '第三方用户 ID',
    union_id VARCHAR(100) COMMENT '微信 UnionID',
    nickname VARCHAR(100),
    avatar VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_provider_uid (provider, provider_uid),
    INDEX idx_user_id (user_id)
);

-- 用户收货地址
CREATE TABLE user_addresses (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    receiver_name VARCHAR(50) NOT NULL,
    receiver_phone VARCHAR(20) NOT NULL,
    province VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    detail VARCHAR(200) NOT NULL,
    is_default TINYINT DEFAULT 0 COMMENT '1-默认地址',
    INDEX idx_user_id (user_id)
);
```

**设计要点：**
- 手机号和邮箱唯一索引，支持两种登录方式
- 密码存 hash 不存明文，用 bcrypt
- 第三方登录单独建表，一个用户可绑定多个第三方账号
- 地址表与用户表一对多

### 4.2 电商订单

```sql
-- 商品表
CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id BIGINT,
    brand VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    status TINYINT DEFAULT 1 COMMENT '1-上架 2-下架',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category_id),
    INDEX idx_status (status)
);

-- 订单主表
CREATE TABLE orders (
    id BIGINT PRIMARY KEY COMMENT '订单号（雪花 ID）',
    user_id BIGINT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    pay_amount DECIMAL(10, 2) COMMENT '实付金额',
    discount_amount DECIMAL(10, 2) DEFAULT 0 COMMENT '优惠金额',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0-待支付 1-已支付 2-已发货 3-已完成 4-已取消',
    payment_method VARCHAR(20) COMMENT 'alipay/wechat/card',
    payment_time DATETIME,
    shipping_address VARCHAR(500) NOT NULL COMMENT '快照，不下拉关联',
    receiver_name VARCHAR(50) NOT NULL,
    receiver_phone VARCHAR(20) NOT NULL,
    remark VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_status_created (status, created_at)
);

-- 订单明细表
CREATE TABLE order_items (
    id BIGINT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_name VARCHAR(200) NOT NULL COMMENT '商品名快照',
    product_price DECIMAL(10, 2) NOT NULL COMMENT '下单时价格快照',
    quantity INT NOT NULL,
    INDEX idx_order_id (order_id)
);
```

**设计要点：**
- 订单号用雪花 ID，兼顾有序性和唯一性
- 收货地址、商品名称、价格全部做**快照**（反范式），下单后不随原数据变化
- 订单主表和明细表分离（1:N），避免单行数据过大
- 金额用 `DECIMAL(10, 2)` 而非 `FLOAT`，避免精度丢失

### 4.3 内容管理（CMS）

```sql
-- 文章表
CREATE TABLE articles (
    id BIGINT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL COMMENT 'URL 友好标识',
    content MEDIUMTEXT NOT NULL,
    summary VARCHAR(500) COMMENT '摘要',
    cover_image VARCHAR(500),
    author_id BIGINT NOT NULL,
    status TINYINT DEFAULT 0 COMMENT '0-草稿 1-已发布 2-已下架',
    is_top TINYINT DEFAULT 0 COMMENT '1-置顶',
    published_at DATETIME COMMENT '发布时间',
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_author (author_id),
    INDEX idx_status_published (status, published_at),
    INDEX idx_slug (slug),
    -- 全文索引（MySQL 8.0+）
    FULLTEXT INDEX ft_title_content (title, content) WITH PARSER ngram
);

-- 标签表（多对多）
CREATE TABLE tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE article_tags (
    article_id BIGINT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (article_id, tag_id),
    INDEX idx_tag (tag_id)
);

-- 分类表（支持树形结构）
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    parent_id INT DEFAULT NULL COMMENT '父分类 ID，NULL 为顶级',
    sort_order INT DEFAULT 0,
    INDEX idx_parent (parent_id)
);
```

**设计要点：**
- slug 字段用于 URL（如 `/blog/nextjs-guide`），比 ID 更友好且利于 SEO
- 统计字段（view_count 等）用冗余字段而非 COUNT 查询，避免热点查询
- 标签用多对多中间表，分类用自引用实现树形结构
- 全文索引用 `ngram` 分词器支持中文

---

## 五、数据选型决策路径

### 5.1 决策流程

```
第一步：明确数据特征
├── 数据结构是否固定？
│   ├── 固定 → 关系型数据库
│   └── 灵活/嵌套 → MongoDB
├── 查询模式是什么？
│   ├── 精确查找 + 范围查询 → MySQL / PostgreSQL
│   ├── 全文搜索 + 复合筛选 → Elasticsearch
│   ├── 聚合统计 → ClickHouse
│   └── KV 读写 → Redis
├── 数据量级？
│   ├── < 1000 万 → 单库 MySQL 足够
│   ├── 1000 万 ~ 1 亿 → 读写分离 + 分库分表
│   └── > 1 亿 → 考虑专用数据库（ClickHouse / ES）
└── 一致性要求？
    ├── 强一致（金融）→ MySQL / PostgreSQL
    └── 最终一致（内容）→ MongoDB / ES

第二步：组合方案
├── 大多数项目：MySQL（核心）+ Redis（缓存）
├── 内容/搜索：MySQL + Redis + Elasticsearch
├── 数据分析：MySQL + ClickHouse
├── 快速迭代：MongoDB + Redis
└── 不推荐：上来就 MySQL + MongoDB + Redis + ES + ClickHouse
    （过早引入多数据库会增加运维复杂度和数据一致性成本）
```

### 5.2 不同阶段的选型建议

**初创期（0 → 1）：**
- 单个 MySQL / PostgreSQL 足够
- 不需要 Redis（用户量小，QPS 低）
- 不需要分库分表
- 专注业务逻辑，而非架构

**成长期（1 → 10）：**
- MySQL + Redis（缓存热数据、Session、限流）
- 引入读写分离（主从复制）
- 考虑 Elasticsearch（如果搜索是核心功能）

**成熟期（10 → 100）：**
- MySQL 分库分表（按用户 ID / 时间分片）
- Elasticsearch 承担搜索和筛选
- ClickHouse 承担数据分析
- Redis 集群化
- 数据同步：Canal（MySQL → ES）、Flink（实时计算）

---

## 六、常见反模式

### 6.1 用 MySQL 存 JSON

```sql
-- ❌ 把所有数据塞进 JSON
CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    data JSON NOT NULL  -- {"name":"耳机","price":299,"specs":{"bluetooth":"5.0","battery":"30h"}}
);

-- 查询困难，无法建有效索引，失去了关系型数据库的优势
SELECT * FROM products WHERE JSON_EXTRACT(data, '$.price') > 200;
```

**正确做法：** 如果字段是固定的，用列存储；如果字段是动态的（不同商品不同规格），用 `JSON` 列存扩展字段，但核心字段（名称、价格、状态）仍用独立列。

### 6.2 用 MongoDB 存关系数据

```javascript
// ❌ 用户和订单是强关联的，但存在 MongoDB 中
// 查询"某用户的所有已支付订单"需要在应用层做多次查询
db.orders.find({ userId: ObjectId("..."), status: "paid" });
// 如果需要关联用户信息，要么冗余，要么 $lookup（慢）
```

**正确做法：** 订单系统用 MySQL（事务 + JOIN），用户画像/行为日志用 MongoDB。

### 6.3 一张表解决所有问题

```sql
-- ❌ 超级大宽表
CREATE TABLE everything (
    id BIGINT PRIMARY KEY,
    -- 用户字段
    user_name VARCHAR(100),
    user_email VARCHAR(200),
    -- 订单字段
    order_amount DECIMAL(10, 2),
    order_status TINYINT,
    -- 商品字段
    product_name VARCHAR(200),
    product_price DECIMAL(10, 2),
    -- 评论字段
    comment_content TEXT,
    comment_rating TINYINT,
    -- 50+ 个字段...
);
```

**正确做法：** 按业务域拆表，通过外键或应用层关联。单表字段控制在 20 个以内。

### 6.4 过早优化

```
项目刚上线，日活 100：
- 就开始搞分库分表 → 过早优化
- 就引入 Kafka 偊步 → 过度设计
- 就搞微服务 → 不必要

正确做法：先跑起来，有性能瓶颈了再优化。
优化顺序：索引优化 → SQL 优化 → 缓存 → 读写分离 → 分库分表
```

---

## 七、总结

### 核心原则

- **选型先看数据特征和查询模式**，不要被"技术流行度"带节奏
- **表设计遵循范式，查询层适度反范式**，在一致性和性能间找平衡
- **索引不是越多越好**，只为实际查询创建，定期清理无用索引
- **一个项目初期能用一个数据库解决的问题，不要用两个**

### 选型速查

| 你要做什么 | 推荐方案 |
|-----------|---------|
| 用户/订单/支付等核心业务 | MySQL / PostgreSQL |
| 文章/内容/配置等灵活数据 | MongoDB（或 PostgreSQL JSONB） |
| 缓存/排行榜/限流/锁 | Redis |
| 搜索/日志检索/复合筛选 | Elasticsearch |
| 行为分析/监控/时序数据 | ClickHouse / TDengine |
| 单项目起步 | 一个 MySQL 足够 |

### 一句话建议

**数据选型没有银弹，理解业务场景和数据特征，选择最简单够用的方案，在瓶颈出现时再演进——过早优化和多数据库并存是最大的技术债。**
