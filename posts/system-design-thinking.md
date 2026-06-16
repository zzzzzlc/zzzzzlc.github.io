---
title: 系统设计与架构思维：从需求分析到架构决策的方法论
date: '2026-04-27'
tags:
  - 设计原则
  - 架构
category: 架构
summary: >-
  从架构决策的实际困境出发，系统梳理架构思维的方法论——需求分析与约束识别、核心设计原则（SOLID/CAP/高内聚低耦合）、领域驱动设计、分布式系统关键问题（一致性/可用性/幂等/限流）、架构决策记录
  ADR，以及不同规模系统的设计演练。
---

# 系统设计与架构思维：从需求分析到架构决策的方法论

## 一、问题来源

很多人学了很多架构模式（微服务、CQRS、事件驱动……），但面对一个真实需求时，仍然不知道从哪里开始：

**初级开发者的困境：**

- 需求来了就开始写代码，写到一半发现表结构设计错了，推倒重来
- 不知道"为什么"要这样设计，只会照着别人的模板抄
- 系统出了问题才知道要加缓存、加队列、加限流，永远在补丁

**中级开发者的困境：**

- 学了 DDD、微服务、CQRS，但不知道什么时候该用、什么时候不该用
- 技术方案评审时，被问到"为什么这样设计"只能回答"业界都这么做"
- 明明一个单体就能搞定的项目，被拆成了 10 个微服务，运维成本爆炸

**高级开发/架构师的困境：**

- 多个方案都能满足需求，如何权衡取舍？缺乏系统化的决策框架
- 架构决策缺乏记录，半年后团队成员不知道当初为什么这么做
- 系统规模增长后，当初的设计假设已经不成立，但不知道何时调整

**核心问题：架构不是"选择一个模式"，而是一套分析问题、识别约束、权衡取舍的思维方法。模式是工具，思维才是核心。**

---

## 二、架构思维的起点：需求分析与约束识别

### 2.1 设计前的五个问题

在动手画架构图或写代码之前，先回答这五个问题：

```
问题 1：业务是什么？
├── 核心业务流程是什么？（用户 → 下单 → 支付 → 发货 → 确认收货）
├── 关键实体有哪些？（用户、商品、订单、支付、库存）
└── 核心不变量是什么？（库存不能超卖、金额不能算错、订单状态不能乱跳）

问题 2：规模预期？
├── 用户量级：100？10 万？1000 万？
├── 并发量级：10 QPS？1000 QPS？10 万 QPS？
├── 数据量级：1 万条？1 亿条？
└── 增长速度：月活翻倍？平稳？

问题 3：质量要求？
├── 可用性：允许偶尔不可用？还是 99.99%？
├── 一致性：强一致？最终一致？
├── 延迟：用户可接受的响应时间？
└── 安全性：涉及金融？隐私数据？

问题 4：团队约束？
├── 团队规模：3 人？30 人？
├── 技术栈：熟悉什么语言/框架？
├── 运维能力：有专职 DevOps？还是开发者自运维？
└── 时间压力：MVP 几周？还是长期项目？

问题 5：演进方向？
├── 3 个月后可能有哪些新需求？
├── 哪些地方是确定的，哪些是可能变化的？
└── 是否有已知的性能瓶颈？
```

### 2.2 约束分类

```
硬约束（不能违反）：
├── 金融场景：数据不能丢、金额不能错
├── 合规要求：GDPR、等级保护、数据留存年限
├── 已有系统：必须对接的遗留系统接口
└── 团队现实：不会 Go 就不要用 Go 重写

软约束（可以协商）：
├── 延迟要求：P99 < 200ms 还可以接受 P99 < 500ms？
├── 可用性：99.9% 还是 99.99%？差一个 9 成本差 10 倍
├── 开发效率 vs 性能：先快速上线再优化，还是一步到位？
└── 技术选型：用熟悉但不是最优的，还是学新的？
```

### 2.3 一个真实案例的分析过程

```
需求：设计一个秒杀系统

第一步：识别核心约束
├── 高并发：10 万用户在 1 秒内抢购 100 件商品
├── 不能超卖：库存 = 100，卖出的绝不能超过 100
├── 公平性：先到先得
├── 用户体验：不能卡死，不能报错刷不出页面
└── 数据一致：最终库存、订单、支付数据必须一致

第二步：识别难点
├── 写压力：10 万请求瞬间打到数据库 → 数据库扛不住
├── 竞态条件：100 人同时读到库存 = 1，都认为可以买 → 超卖
├── 热点数据：所有人查的是同一个商品的库存 → 缓存热点
└── 雪崩风险：大量失败请求同时重试 → 系统过载

第三步：设计决策
├── 写压力 → 请求先入队（消息队列），异步处理
├── 竞态条件 → Redis 原子扣减（DECR），库存预加载到 Redis
├── 热点数据 → 本地缓存 + Redis 集群
├── 雪崩风险 → 前端限流 + 后端令牌桶
└── 数据一致 → Redis 扣减成功后异步写入数据库
```

---

## 三、核心设计原则

### 3.1 高内聚低耦合

**这是所有架构原则的基石。**

```
高内聚：一个模块只做一件事，所有相关的代码放在一起
低耦合：模块之间通过清晰的接口交互，不依赖对方的内部实现

                高内聚                        低内聚
          ┌──────────────┐            ┌──────────────┐
          │  订单模块     │            │  混合模块     │
          │ ┌──────────┐ │            │ ┌──────────┐ │
          │ │创建订单   │ │            │ │创建订单   │ │
          │ │计算价格   │ │            │ │发送邮件   │ │
          │ │校验库存   │ │            │ │导出报表   │ │
          │ │状态流转   │ │            │ │用户登录   │ │
          │ └──────────┘ │            │ │文件上传   │ │
          └──────────────┘            │ │...什么都做 │ │
                                      │ └──────────┘ │
                低耦合                        └──────────────┘
          ┌──────┐   ┌──────┐
          │ 订单  │──→│ 支付  │   接口调用，不直接访问对方数据
          └──────┘   └──────┘

                高耦合
          ┌────────────────────┐
          │ 订单直接写支付表     │   绕过接口，直接操作对方数据
          │ 支付直接改订单状态   │   改一个表要改两个模块的代码
          └────────────────────┘
```

**判断标准：**

| 维度 | 高内聚 | 低内聚 |
|------|--------|--------|
| 修改一个功能 | 只改一个模块 | 要改多个模块 |
| 新增一个功能 | 新增一个模块 | 在多个模块里加代码 |
| 模块可否独立部署 | 可以 | 不行，互相依赖 |
| 模块可否独立测试 | 可以 | 必须搭整套环境 |

### 3.2 SOLID 在系统设计中的映射

SOLID 不只是 OOP 的类设计原则，在系统层面同样适用：

| 原则 | 类级别 | 系统级别 |
|------|--------|---------|
| **S** 单一职责 | 一个类只做一件事 | 一个服务只负责一个业务域（用户服务、订单服务） |
| **O** 开闭原则 | 加功能不改老代码 | 新增业务能力通过扩展新服务，不修改已有服务 |
| **L** 里氏替换 | 子类能替代父类 | 新实现能替代旧实现（接口契约不变） |
| **I** 接口隔离 | 不要强迫实现不需要的方法 | 不同消费者看到不同的接口（BFF 按端裁剪） |
| **D** 依赖倒置 | 依赖抽象不依赖具体 | 服务间通过 API/事件交互，不直接依赖数据库 |

```typescript
// 系统级别的开闭原则示例

// ❌ 违反开闭：每新增通知渠道都要改 NotificationService
class NotificationService {
    send(channel: string, message: string) {
        if (channel === 'email') { /* 发邮件 */ }
        else if (channel === 'sms') { /* 发短信 */ }
        else if (channel === 'push') { /* 发推送 */ }
        // 新增微信通知？改这里 → 违反开闭
    }
}

// ✅ 符合开闭：新增渠道只需新增一个类
interface NotificationChannel {
    send(userId: string, message: string): Promise<void>;
}

class EmailChannel implements NotificationChannel {
    async send(userId: string, message: string) { /* ... */ }
}

class SmsChannel implements NotificationChannel {
    async send(userId: string, message: string) { /* ... */ }
}

class WechatChannel implements NotificationChannel {  // 新增渠道，不改老代码
    async send(userId: string, message: string) { /* ... */ }
}
```

### 3.3 CAP 定理

**分布式系统最基础的权衡：一致性（C）、可用性（A）、分区容错（P）三者不可兼得。**

```
                    ┌─────────────────────────┐
                    │   网络分区（P）必然发生    │
                    │   所以只能在 C 和 A 之间选  │
                    └───────┬─────────┬───────┘
                            │         │
                   选择 C            选择 A
                   (一致性)          (可用性)
                      │                 │
              ┌───────┴──────┐  ┌──────┴───────┐
              │ 分区期间      │  │ 分区期间       │
              │ 拒绝写入      │  │ 允许写入       │
              │ 保证数据一致  │  │ 可能数据不一致  │
              │              │  │ 分区恢复后同步  │
              └──────────────┘  └──────────────┘
```

| 选择 | 牺牲什么 | 适用场景 | 典型系统 |
|------|---------|---------|---------|
| **CP** | 可用性（分区时拒绝服务） | 金融、库存、支付 | ZooKeeper、Etcd、Redis Cluster |
| **AP** | 强一致性（允许短暂不一致） | 社交、内容、搜索 | Cassandra、DynamoDB、Eureka |
| **CA** | 分区容错（不允许网络分区） | 单机数据库 | MySQL 单机、PostgreSQL 单机 |

**注意：CA 在分布式环境中不存在。网络分区是必然事件，必须选 CP 或 AP。**

**实际选型：**

```
同一个系统中，不同模块可以有不同的选择：

电商系统：
├── 库存扣减 → CP（绝对不能超卖）
├── 订单创建 → CP（不能丢订单）
├── 商品搜索 → AP（搜索结果短暂不一致可以接受）
├── 用户评价 → AP（延迟几秒显示评价无所谓）
└── 推荐系统 → AP（推荐内容本身就是模糊的）
```

### 3.4 其他核心原则速查

| 原则 | 含义 | 一句话 |
|------|------|--------|
| **DRY** | Don't Repeat Yourself | 同一逻辑只写一次 |
| **KISS** | Keep It Simple, Stupid | 能用简单方案就不用复杂方案 |
| **YAGNI** | You Aren't Gonna Need It | 不要为假设的未来需求写代码 |
| **关注点分离** | 不同关注点分开处理 | UI、业务逻辑、数据访问各管各的 |
| **最少知识（迪米特法则）** | 不要和陌生人说话 | A 用 B，B 用 C，但 A 不直接用 C |
| **康威定律** | 系统架构反映组织沟通结构 | 团队边界决定服务边界 |

---

## 四、领域驱动设计（DDD）

### 4.1 DDD 的核心价值

**DDD 不是技术框架，是一套"用业务语言驱动设计"的方法论。**

```
传统方式：围绕数据库表设计
├── 先建表（users, orders, products）
├── 再写 CRUD 接口
├── 业务逻辑散落在 Service 中
└── 结果：代码和业务语言脱节，新需求不知道改哪里

DDD 方式：围绕业务领域设计
├── 先理解业务语言（用户下单、扣减库存、生成物流单）
├── 识别领域模型（聚合根、实体、值对象）
├── 定义限界上下文（订单上下文、库存上下文、物流上下文）
└── 结果：代码结构映射业务结构，需求变更可以精确定位
```

### 4.2 核心概念

```
统一语言（Ubiquitous Language）
├── 开发和业务用同一套术语
├── 代码中的类名、方法名 = 业务人员说的话
├── 例：不说 "修改 status 字段"，说 "确认收货"
└── 避免翻译损耗

限界上下文（Bounded Context）
├── 一个业务边界内的模型是一致的
├── 不同上下文中，同一个词可能含义不同
│   ├── 订单上下文的"商品"：订单行（价格快照、数量）
│   ├── 商品上下文的"商品"：SPU/SKU（库存、分类、参数）
│   └── 搜索上下文的"商品"：索引文档（标题、关键词、评分）
└── 每个限界上下文对应一个独立的服务/模块

聚合根（Aggregate Root）
├── 一组相关对象的"入口"
├── 外部只能通过聚合根操作内部对象
├── 保证内部一致性
└── 例：Order（聚合根）→ OrderItem（内部实体）

实体（Entity）vs 值对象（Value Object）
├── 实体：有唯一标识，生命周期跨越多次操作
│   └── 例：User（有 ID）、Order（有订单号）
├── 值对象：无唯一标识，只看值是否相等
│   └── 例：Money（100 元）、Address（省市区详情）
└── 区分意义：值对象不可变，天然线程安全
```

### 4.3 限界上下文映射

```
                    ┌──────────────┐
                    │   用户上下文   │
                    │ UserContext   │
                    └──────┬───────┘
                           │ 用户身份信息
                    ┌──────┴───────┐
                    │   订单上下文   │ ←── 下单时需要用户信息
                    │ OrderContext  │
                    └──────┬───────┘
                           │ 订单创建事件
              ┌────────────┼────────────┐
              │            │            │
       ┌──────┴──────┐ ┌──┴────────┐ ┌─┴───────────┐
       │  库存上下文   │ │ 支付上下文 │ │  物流上下文   │
       │InventoryCtx │ │PaymentCtx │ │ShippingCtx  │
       └─────────────┘ └───────────┘ └──────────────┘

上下文之间的通信方式：
├── 同步：REST / gRPC（需要实时响应，如支付结果查询）
├── 异步：消息队列 / 事件总线（不需要实时，如订单创建后扣减库存）
└── 共享内核（Shared Kernel）：两个上下文共同依赖的极小模型
```

### 4.4 战术设计：分层架构

```typescript
// DDD 分层架构在代码中的落地

// ============ 1. 领域层（Domain Layer）============
// 纯业务逻辑，不依赖任何框架和基础设施

// 值对象
class Money {
    private constructor(private readonly amount: number,
                        private readonly currency: string) {}
    static yuan(amount: number): Money {
        return new Money(amount, 'CNY');
    }
    add(other: Money): Money {
        return new Money(this.amount + other.amount, this.currency);
    }
    multiply(factor: number): Money {
        return new Money(Math.round(this.amount * factor * 100) / 100, this.currency);
    }
    get value(): number { return this.amount; }
}

// 实体
class OrderItem {
    constructor(
        readonly productId: string,
        readonly productName: string,
        readonly price: Money,
        readonly quantity: number
    ) {}
    get subtotal(): Money {
        return this.price.multiply(this.quantity);
    }
}

// 聚合根
class Order {
    private _status: OrderStatus = OrderStatus.PENDING;
    private _items: OrderItem[] = [];

    constructor(readonly id: string, readonly userId: string) {}

    get status(): OrderStatus { return this._status; }
    get totalAmount(): Money {
        return this._items.reduce((sum, item) => sum.add(item.subtotal), Money.yuan(0));
    }

    addItem(item: OrderItem): void {
        // 业务规则：已支付的订单不能加商品
        if (this._status !== OrderStatus.PENDING) {
            throw new Error('Cannot modify a paid order');
        }
        // 业务规则：同一商品不能重复添加
        if (this._items.some(i => i.productId === item.productId)) {
            throw new Error('Product already in order');
        }
        this._items.push(item);
    }

    pay(): void {
        if (this._status !== OrderStatus.PENDING) {
            throw new Error('Only pending orders can be paid');
        }
        if (this._items.length === 0) {
            throw new Error('Cannot pay an empty order');
        }
        this._status = OrderStatus.PAID;
    }

    cancel(): void {
        if (this._status === OrderStatus.COMPLETED) {
            throw new Error('Completed orders cannot be cancelled');
        }
        this._status = OrderStatus.CANCELLED;
    }
}

enum OrderStatus {
    PENDING = 0, PAID = 1, SHIPPED = 2, COMPLETED = 3, CANCELLED = 4
}

// ============ 2. 应用层（Application Layer）============
// 编排领域对象，不包含业务逻辑

class OrderApplicationService {
    constructor(
        private orderRepo: OrderRepository,      // 接口，不依赖具体实现
        private inventoryService: InventoryService,
        private eventBus: DomainEventBus
    ) {}

    async createOrder(cmd: CreateOrderCommand): Promise<string> {
        const orderId = generateId();
        const order = new Order(orderId, cmd.userId);
        for (const item of cmd.items) {
            order.addItem(new OrderItem(item.productId, item.name,
                          Money.yuan(item.price), item.quantity));
        }
        await this.orderRepo.save(order);
        await this.eventBus.publish(new OrderCreatedEvent(orderId, cmd.items));
        return orderId;
    }

    async payOrder(orderId: string): Promise<void> {
        const order = await this.orderRepo.findById(orderId);
        if (!order) throw new Error('Order not found');
        order.pay();
        await this.orderRepo.save(order);
    }
}

// ============ 3. 基础设施层（Infrastructure Layer）============
// 技术实现细节：数据库、消息队列、外部 API

class MySQLOrderRepository implements OrderRepository {
    async save(order: Order): Promise<void> {
        // MySQL 实现
    }
    async findById(id: string): Promise<Order | null> {
        // MySQL 实现
        return null;
    }
}

class RedisInventoryService implements InventoryService {
    async deduct(productId: string, quantity: number): Promise<boolean> {
        // Redis 原子扣减
        return true;
    }
}

// ============ 4. 接口层（Interface Layer）============
// 对外的入口：HTTP Controller、消息消费者

class OrderController {
    constructor(private orderService: OrderApplicationService) {}

    async create(req: Request, res: Response) {
        const orderId = await this.orderService.createOrder(req.body);
        res.json({ orderId });
    }

    async pay(req: Request, res: Response) {
        await this.orderService.payOrder(req.params.id);
        res.json({ success: true });
    }
}
```

**四层依赖规则：**

```
接口层 → 应用层 → 领域层 ← 基础设施层

关键：领域层不依赖任何外层（依赖倒置）
  领域层定义接口（OrderRepository）
  基础设施层实现接口（MySQLOrderRepository）
  应用层通过接口使用，不知道具体实现
```

### 4.5 DDD 的适用边界

```
✅ 适合 DDD 的场景：
├── 业务逻辑复杂、规则多（金融、ERP、供应链）
├── 需要和业务专家密切沟通（领域语言统一）
├── 团队 > 5 人，需要清晰的模块边界
└── 长期维护的核心系统

❌ 不适合 DDD 的场景：
├── 纯 CRUD，没有复杂业务规则
├── 数据驱动（报表、分析）而非业务驱动
├── 团队 < 3 人，DDD 的概念成本大于收益
└── 原型 / MVP 阶段，业务还在探索
```

---

## 五、分布式系统关键设计问题

### 5.1 数据一致性

```
一致性问题的本质：多个节点/服务之间的数据如何保持同步？

三种一致性模型：
├── 强一致：写入后立即对所有读取者可见
│   └── 代价：性能低，需要锁或共识协议
│   └── 场景：库存扣减、转账
│
├── 最终一致：写入后短暂不一致，但最终会一致
│   └── 代价：中间态可能读到旧数据
│   └── 场景：点赞数、粉丝数、搜索索引
│
└── 因果一致：保证因果关系的操作顺序一致
    └── 代价：比最终一致稍强，实现稍复杂
    └── 场景：评论区、聊天消息
```

**分布式事务方案：**

| 方案 | 一致性 | 性能 | 复杂度 | 适用场景 |
|------|--------|------|--------|---------|
| **2PC（两阶段提交）** | 强一致 | 低 | 中 | 数据库内部事务 |
| **TCC（Try-Confirm-Cancel）** | 最终一致 | 中 | 高 | 金融、交易 |
| **Saga（编排/协调）** | 最终一致 | 高 | 中 | 长流程业务（下单→扣库存→支付→物流） |
| **本地消息表** | 最终一致 | 高 | 低 | 简单的跨服务数据同步 |
| **事务消息（RocketMQ）** | 最终一致 | 高 | 低 | 下单后异步扣库存 |

```typescript
// Saga 模式示例：电商下单流程

// 编排式 Saga：一个协调器按顺序调用各服务
class OrderSaga {
    async execute(orderId: string, items: OrderItem[]): Promise<void> {
        try {
            // 第一步：创建订单
            await this.orderService.create(orderId, items);
            // 第二步：扣减库存
            await this.inventoryService.deduct(items);
            // 第三步：处理支付
            await this.paymentService.charge(orderId);
            // 第四步：创建物流单
            await this.shippingService.create(orderId);
        } catch (error) {
            // 任意步骤失败 → 执行补偿操作（反向流程）
            await this.compensate(orderId, items, error.step);
        }
    }

    async compensate(orderId: string, items: OrderItem[], failedStep: number) {
        if (failedStep > 3) await this.shippingService.cancel(orderId);
        if (failedStep > 2) await this.paymentService.refund(orderId);
        if (failedStep > 1) await this.inventoryService.restore(items);
        if (failedStep > 0) await this.orderService.cancel(orderId);
    }
}
```

### 5.2 幂等性

**幂等性：同一操作执行一次和执行多次的效果相同。**

```
为什么需要幂等？
├── 网络超时 → 调用方重试 → 服务端可能执行了多次
├── 消息队列重复消费 → 同一消息被处理多次
├── 前端双击 → 同一请求发两次
└── 分布式事务重试 → 补偿操作可能重复执行
```

```typescript
// 幂等性实现方案

// 方案一：唯一请求 ID（Token 机制）
class PaymentService {
    async pay(requestId: string, orderId: string, amount: number) {
        // 用 requestId 做幂等键
        const exists = await this.idempotencyRepo.exists(requestId);
        if (exists) {
            return this.idempotencyRepo.getResult(requestId); // 返回上次的结果
        }
        const result = await this.doPay(orderId, amount);
        await this.idempotencyRepo.save(requestId, result);
        return result;
    }
}

// 方案二：数据库唯一约束
// 利用 order_id 的唯一索引防止重复支付
// INSERT INTO payment (id, order_id, amount) VALUES (?, ?, ?)
// 如果 order_id 已存在 → 唯一索引冲突 → 说明已支付

// 方案三：乐观锁 / 版本号
// UPDATE orders SET status = 'paid', version = version + 1
// WHERE id = ? AND version = ?
// 版本号不匹配 → 说明已被处理

// 方案四：状态机
// UPDATE orders SET status = 'paid'
// WHERE id = ? AND status = 'pending'
// status 不是 pending → 说明已处理
```

### 5.3 限流与降级

```typescript
// 限流：控制请求速率，防止系统过载

// 方案一：令牌桶（Token Bucket）— 允许突发流量
class TokenBucket {
    private tokens: number;
    private lastRefill: number;

    constructor(
        private capacity: number,    // 桶容量（最大突发量）
        private refillRate: number   // 每秒补充的令牌数
    ) {
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    allow(): boolean {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }

    private refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
}

// 方案二：滑动窗口 — 精确控制时间窗口内的请求数
// Redis 实现：ZSET + 时间戳作为 score
// ZADD rate_limit:{userId} {timestamp} {requestId}
// ZREMRANGEBYSCORE rate_limit:{userId} 0 {now - window}
// ZCARD rate_limit:{userId}  → 当前窗口请求数
// EXPIRE rate_limit:{userId} {window}
```

```
降级：系统压力过大时，主动牺牲部分功能保核心

降级策略：
├── 读降级：读不到数据就返回缓存/默认值，不报错
│   └── 例：推荐列表挂了 → 返回热门商品列表
├── 写降级：写操作改为异步，先返回成功，后台慢慢写
│   └── 例：评论写入挂了 → 先存消息队列，异步写入
├── 功能降级：关闭非核心功能
│   └── 例：大促时关闭商品评价、关闭修改地址
└── 限流降级：超过阈值直接拒绝
    └── 例：秒杀入口限流，超出的直接返回"活动太火爆"
```

### 5.4 缓存策略

```
缓存使用的三个核心问题：

问题 1：缓存穿透（查不存在的数据，请求全部打到数据库）
├── 方案 A：布隆过滤器（Bloom Filter）拦截不存在的 key
├── 方案 B：缓存空值（查不到就缓存 NULL，设短过期时间）
└── 推荐：布隆过滤器 + 空值缓存

问题 2：缓存雪崩（大量 key 同时过期，请求全部打到数据库）
├── 方案 A：过期时间加随机偏移（30min ± 5min）
├── 方案 B：热点数据永不过期，后台异步更新
└── 方案 C：多级缓存（L1 本地缓存 + L2 Redis）

问题 3：缓存击穿（一个热点 key 过期，大量请求瞬间打到数据库）
├── 方案 A：互斥锁（只让一个请求查数据库，其他等）
├── 方案 B：热点数据永不过期，逻辑过期
└── 推荐：热点数据用互斥锁 + 逻辑过期
```

```typescript
// 互斥锁防击穿
async function getWithLock<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached);

    // 获取锁（只允许一个请求去查数据库）
    const lockKey = `lock:${key}`;
    const acquired = await redis.set(lockKey, '1', 'NX', 'EX', 10);
    if (acquired) {
        try {
            const data = await fetcher();
            await redis.set(key, JSON.stringify(data), 'EX', ttl);
            return data;
        } finally {
            await redis.del(lockKey);
        }
    } else {
        // 其他请求等待并重试
        await sleep(100);
        return getWithLock(key, fetcher, ttl);
    }
}
```

---

## 六、架构决策记录（ADR）

### 6.1 什么是 ADR

**Architecture Decision Record：记录每个重要架构决策的背景、选项、结果。**

```
为什么需要 ADR？
├── 半年后没人记得当初为什么这么选
├── 新成员入职可以快速理解决策上下文
├── 避免同一问题反复讨论
└── 架构评审有据可查
```

### 6.2 ADR 模板

```markdown
# ADR-001: 使用消息队列实现订单与库存的异步解耦

## 状态
已采纳（2026-04-27）

## 背景
当前下单流程是同步调用：订单服务 → 库存服务 → 支付服务。
秒杀场景下，10 万 QPS 全部打到库存服务的数据库，导致超时。
库存扣减失败后订单回滚，但用户已经等待了 3 秒+，体验差。

## 决策
引入消息队列（RocketMQ），订单创建后发送消息，库存服务异步消费扣减。

## 备选方案

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. 保持同步 | 简单，强一致 | 性能差，级联故障 |
| B. 消息队列异步 | 高性能，解耦 | 最终一致，需要补偿机制 |
| C. Redis 预扣 + 异步落库 | 最高性能 | 实现复杂，数据一致性风险 |

## 理由
选择方案 B：
1. 性能提升 10 倍（异步处理，不阻塞用户请求）
2. 解耦后库存服务可以独立扩缩容
3. 最终一致对秒杀场景可接受（用户不要求立即看到库存变化）
4. 使用 RocketMQ 的事务消息保证订单创建和消息发送的原子性

## 后果
- 需要引入消息队列基础设施（运维成本增加）
- 需要实现补偿机制（库存扣减失败时回滚订单）
- 监控需要覆盖消息积压、消费延迟等指标

## 相关决策
- ADR-002: 使用 Redis 实现库存预扣（配合方案 B）
- ADR-003: 引入 Saga 模式处理分布式事务补偿
```

### 6.3 ADR 的使用原则

```
1. 只记录重要的、有争议的、不可逆的决策（不要记录"用 Vue 还是 React"这种如果团队已定就不需要记录的决策）
2. 写在项目代码仓库中（docs/adr/ 目录），和代码一起版本管理
3. 编号递增，状态明确（提议/已采纳/已废弃/已替代）
4. 每个 ADR 聚焦一个决策，不要写成长篇大论
5. 废弃的 ADR 不要删除，保留历史（标注"被 ADR-XXX 替代"）
```

---

## 七、设计演练

### 7.1 短链接系统

```
需求：将长 URL 转为短 URL，访问短 URL 时 302 跳转到长 URL
预期规模：日活 100 万，总 URL 量 10 亿

第一步：核心流程
├── 写：长 URL → 生成短码 → 存储映射关系
├── 读：短码 → 查映射 → 302 跳转
└── 读写比：读远大于写（100:1 以上）

第二步：短码生成方案
├── 方案 A：自增 ID + Base62 编码
│   └── 1 → "1"，10000 → "2Bi"，短、有序、可预测
├── 方案 B：MurmurHash + 冲突重试
│   └── 长度固定、无序、可能冲突需要处理
└── 方案 C：预生成短码池
    └── 提前生成一批存起来，用的时候取一个

第三步：存储方案
├── 10 亿条映射，每条约 200 字节 → 约 200GB
├── 方案 A：MySQL 分库分表（按短码 hash 分片）
├── 方案 B：Redis 缓存热点 + MySQL 持久化
└── 方案 C：LSM-Tree 存储（LevelDB/RocksDB）

第四步：架构图
                    ┌────────┐
                    │  用户   │
                    └───┬────┘
                        │
                ┌───────┴───────┐
                │   Nginx/CDN   │  静态资源 + 限流
                └───────┬───────┘
                        │
                ┌───────┴───────┐
                │   应用服务     │  短码生成 + 302 跳转
                └──┬─────────┬──┘
                   │         │
            ┌──────┴──┐  ┌──┴──────┐
            │  Redis   │  │  MySQL  │
            │ 热点缓存  │  │ 分片存储 │
            └─────────┘  └─────────┘
```

### 7.2 即时通讯系统

```
需求：类似微信的单聊 + 群聊，日活 1000 万
核心指标：消息延迟 < 500ms，离线消息不丢失

第一步：核心流程
├── 发送：用户A 发消息 → 服务端 → 推送给用户B
├── 接收：用户B 在线 → 实时推送；不在线 → 存离线消息
├── 历史消息：拉取和对方的聊天记录
└── 特殊场景：群聊（一条消息推给 N 个人）

第二步：连接方案
├── 方案 A：WebSocket（全双工，实时推送）
├── 方案 B：长轮询（兼容性好，但效率低）
└── 选 WebSocket

第三步：消息投递模型
├── 写扩散（发消息时给每个接收者写一份）
│   └── 优点：读快（只需查自己的信箱）
│   └── 缺点：群聊时写放大（500 人群 = 写 500 份）
├── 读扩散（只写一份，读时合并）
│   └── 优点：写快
│   └── 缺点：读慢（要合并多个来源）
└── 混合：单聊写扩散，群聊读扩散

第四步：架构图
┌──────┐  WebSocket  ┌──────────┐
│用户A  │◄──────────►│ 接入层    │ (Gateway, 管理连接)
└──────┘             └────┬─────┘
                          │
┌──────┐  WebSocket  ┌────┴─────┐
│用户B  │◄──────────►│ 消息服务  │ (消息路由、离线存储)
└──────┘             └────┬─────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
        ┌─────┴────┐ ┌───┴────┐ ┌───┴──────┐
        │  Redis    │ │  MQ    │ │  MySQL   │
        │ 在线状态   │ │ 消息队列│ │ 消息存储  │
        │ 会话缓存   │ │        │ │ 离线消息  │
        └──────────┘ └────────┘ └──────────┘
```

### 7.3 设计思维总结

```
从上面两个案例可以看出系统设计的通用流程：

1. 澄清需求
   ├── 核心功能是什么？
   ├── 非功能指标（QPS、延迟、可用性、数据量）？
   └── 哪些是硬约束，哪些可以协商？

2. 估算规模
   ├── 读写比例
   ├── 数据量级（存储、带宽）
   └── 峰值 vs 平均

3. 识别核心问题
   ├── 瓶颈在哪？（CPU / IO / 网络 / 存储）
   ├── 最大风险是什么？（数据丢失？超卖？雪崩？）
   └── 哪些地方可能成为热点？

4. 方案设计
   ├── 先画核心流程（数据流向）
   ├── 再解决每个环节的具体问题
   ├── 给出 2~3 个备选方案并说明取舍理由
   └── 标注方案的假设前提和已知局限

5. 深入细节（面试/评审时的追问方向）
   ├── 失败怎么办？（重试、补偿、降级）
   ├── 极端情况怎么办？（峰值 10 倍、某节点挂了）
   └── 如何监控？（关键指标、告警阈值）
```

---

## 八、总结

### 核心思维模型

```
需求分析：先问五个问题，搞清约束再动手
设计原则：高内聚低耦合是基石，SOLID/CAP 是工具
领域建模：用业务语言驱动设计，DDD 是方法论不是框架
分布式问题：一致性、幂等、限流、缓存各有方案，按场景选择
决策记录：重要的架构决策必须写 ADR，保留上下文
```

### 架构演进节奏

| 阶段 | 关注点 | 不要做 |
|------|--------|--------|
| MVP（0→1） | 快速验证，核心功能跑通 | 不要做分布式、不要做微服务 |
| 成长期（1→10） | 模块化、分层、缓存、队列 | 不要过早分库分表 |
| 成熟期（10→100） | 领域建模、限界上下文、可观测性 | 不要一次性重构 |
| 规模期（100+） | 高可用、异地多活、弹性伸缩 | 不要过度设计，留足演进空间 |

### 一句话建议

**好的架构不是设计出来的，而是在理解业务、识别约束、权衡取舍的过程中一步步演进出来的。先让系统跑起来，再在瓶颈处优化——但每一步都要记录"为什么这样做"。**
