---
title: 高可读性与高健壮性代码：从编码思维到工程实践
date: '2026-05-03'
tags:
  - 设计原则
category: 软件工程
summary: >-
  从代码维护成本飙升的实际痛点出发，系统梳理编写高可读性、高健壮性代码的完整方法——命名与抽象、函数设计、控制流优化、防御式编程、错误处理策略、边界条件防护、状态管理、类型安全、重构手法，以及可读性与性能的权衡边界。
---

# 高可读性与高健壮性代码：从编码思维到工程实践

## 一、问题来源

每个有经验的开发者都知道：**代码被阅读的次数远多于被编写的次数。** 但现实中：

**可读性层面的痛点：**

- 接手别人的代码，一个函数 300 行，变量名叫 `data`、`tmp`、`result2`，完全看不懂在做什么
- 半年前自己写的代码，回来看也需要 2 小时才能理解逻辑
- 一个简单的业务逻辑被层层抽象，看懂它要在 5 个文件之间跳转
- 代码注释写的是"在做什么"而不是"为什么这么做"，注释和代码一样难以理解

**健壮性层面的痛点：**

- 用户输入了一个特殊字符，整个接口 500 报错
- 第三方接口返回了 `null`，没有判空直接 `.toString()`，线上空指针异常
- 并发场景下数据不一致，两个请求同时修改了同一条记录
- 没有对数组越界、类型不匹配、超时等边界情况做防护，故障频发

**核心问题：写出能跑的代码不难，难的是写出人能看懂、异常能兜住、变更能适应的代码。这不是天赋，而是一套可学习的方法论。**

本文将从可读性设计、健壮性设计、防御式编程、错误处理、重构手法五个维度，给出编写高质量代码的系统性方法。

---

## 二、可读性的本质：降低认知负担

### 2.1 代码可读性的三层含义

```
第一层：能看懂在做什么（What）
  → 命名清晰、结构直观

第二层：能看懂为什么这样做（Why）
  → 注释解释意图、约束和折衷

第三层：能放心修改而不破坏（How）
  → 职责清晰、影响范围可控
```

### 2.2 可读性的敌人

```
1. 模糊的命名
   → 用心猜变量含义的时间 > 理解业务逻辑的时间

2. 过长的函数
   → 需要在脑中维持巨大的上下文才能理解

3. 嵌套的控制流
   → if-else 嵌套 4 层，脑子里要维护 4 个条件分支

4. 隐式的依赖
   → 函数的行为依赖外部状态，看调用处猜不出结果

5. 过度抽象
   → 简单逻辑被拆成 5 层继承/组合，追踪调用链像走迷宫
```

---

## 三、命名与抽象

### 3.1 命名的核心原则

```typescript
// ❌ 命名模糊，需要猜测
const d = new Date();           // d 是什么？日期？持续时间？
const flag = true;              // 什么标志？
const data = fetchUsers();      // 什么数据？
function process(item) {}       // 处理什么？怎么处理？

// ✅ 命名自解释
const currentDate = new Date();
const isEmailVerified = true;
const activeUsers = fetchActiveUsers();
function calculateOrderTotal(items: OrderItem[]) {}
```

**命名检查清单：**

```
□ 看到名字能知道它是什么（名词）或做什么（动词）
□ 不需要看类型签名就能推断用途
□ 不使用缩写（除了公认的如 id、url、http）
□ 布尔值用 is/has/can/should 开头
□ 函数名用动词开头（get/set/calculate/validate/is/has）
□ 集合用复数形式
□ 避免无意义的通用名（data、info、result、item、tmp）
```

### 3.2 命名对比示例

| 场景 | ❌ 差的命名 | ✅ 好的命名 |
|------|-----------|-----------|
| 用户状态 | `s` / `status` | `isAccountActive` |
| 数据列表 | `list` / `arr` | `pendingOrders` |
| 循环索引 | `i` / `j` / `k` | 简单循环可用 `i`，否则 `userIndex` |
| 回调函数 | `cb` / `fn` | `onPaymentSuccess` |
| 错误变量 | `e` / `err` | `error` / `validationError` |
| 配置对象 | `config` / `opt` | `dbConnectionConfig` |
| 工具函数 | `helper` / `util` | `formatCurrency` / `parseJwtToken` |

### 3.3 抽象的粒度

```
抽象的原则：每一层抽象只做一件事，每层之间职责清晰

❌ 混合抽象层级
function handleOrder(order) {
  // 校验参数
  if (!order.items || order.items.length === 0) { ... }
  // 计算金额
  let total = 0;
  for (const item of order.items) {
    total += item.price * item.quantity;
  }
  // 调用支付
  const paymentResult = httpPost('/api/pay', { amount: total });
  // 发送通知
  sendEmail(order.userEmail, '订单已支付');
  // 记录日志
  logger.info(`Order ${order.id} paid: ${total}`);
}
// 校验、计算、支付、通知、日志混在一起
// 修改任何一部分都需要理解全部逻辑

✅ 分层抽象
function handleOrder(order: Order): OrderResult {
  validateOrder(order);
  const total = calculateTotal(order.items);
  const payment = processPayment(order, total);
  notifyUser(order, payment);
  return { orderId: order.id, status: 'paid', total };
}
// 主函数像一个目录，每一步的含义一目了然
// 修改某一步只需要进入对应的子函数
```

```
抽象的度：

欠抽象（所有逻辑平铺在一个函数里）
  → 难以理解、难以测试、难以复用

适度抽象（每个函数做一件事，函数名就是注释）
  → 可读、可测试、可复用

过度抽象（简单逻辑拆成 5 层接口 + 工厂 + 策略模式）
  → 追踪调用链困难，修改需要改多处

判断标准：
- 函数体 <= 30 行 → 通常不需要再拆
- 函数体 30~60 行 → 考虑是否需要拆
- 函数体 > 60 行 → 几乎一定需要拆
- 一个概念到处复制 → 提取公共函数（欠抽象）
- 为"将来可能的需求"设计接口 → 过度抽象
```

---

## 四、函数设计

### 4.1 单一职责

```typescript
// ❌ 做了两件事：查询 + 格式化
function getUserDisplay(userId: string): string {
  const raw = db.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (!raw) return '未知用户';
  return `${raw.last_name}${raw.first_name}（${raw.department}）`;
}

// ✅ 拆分职责：查询是查询，格式化是格式化
function getUserById(userId: string): User | null {
  return db.query('SELECT * FROM users WHERE id = ?', [userId]);
}

function formatUserName(user: User): string {
  return `${user.lastName}${user.firstName}（${user.department}）`;
}

// 使用
const user = getUserById(userId);
const displayName = user ? formatUserName(user) : '未知用户';
```

### 4.2 参数设计

```typescript
// ❌ 参数过多、顺序难记、布尔参数含义不清
function createOrder(userId: string, items: Item[], urgent: boolean, giftWrap: boolean, couponCode: string | null) {}

// 调用时完全不知道 true/false 是什么意思
createOrder('u1', items, true, false, 'SAVE10');

// ✅ 使用对象参数（Options 模式）
interface CreateOrderOptions {
  userId: string;
  items: OrderItem[];
  isUrgent?: boolean;
  needGiftWrap?: boolean;
  couponCode?: string;
}

function createOrder(options: CreateOrderOptions): Order {}

// 调用清晰自解释
createOrder({
  userId: 'u1',
  items,
  isUrgent: true,
  couponCode: 'SAVE10',
});
```

**参数设计原则：**

```
1. 参数 <= 3 个 → 直接传参
2. 参数 > 3 个 → 用 Options 对象
3. 布尔参数 → 改为枚举或 Options 字段（避免 mystery boolean）
4. 输出参数（通过参数返回结果）→ 尽量避免，用返回值
5. 可选参数放在最后，使用默认值
```

### 4.3 纯函数与副作用

```typescript
// 纯函数：输入相同 → 输出一定相同，不修改外部状态
function calculateDiscount(price: number, level: 'vip' | 'svip'): number {
  const rates = { vip: 0.9, svip: 0.8 };
  return price * (rates[level] ?? 1);
}
// ✅ 可以在任何地方调用，不影响其他代码，容易测试

// 有副作用的函数：修改了外部状态或依赖外部状态
let totalRevenue = 0;
function processOrder(order: Order) {
  totalRevenue += order.amount;  // 修改全局变量
  sendEmail(order.email);        // 发送网络请求
  saveToDatabase(order);         // 写数据库
}
// ❌ 调用两次结果不同，测试需要 mock 全局状态

// ✅ 分离纯逻辑和副作用
// 纯逻辑部分（可测试）
function calculateOrderResult(order: Order): OrderResult {
  return {
    orderId: order.id,
    total: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    discount: calculateDiscount(order.amount, order.userLevel),
  };
}

// 副作用部分（集中管理）
function processOrder(order: Order): void {
  const result = calculateOrderResult(order);
  sendEmail(order.email, buildEmailContent(result));
  saveOrderResult(result);
}

// 设计原则：
// 业务规则（纯函数）→ 容易测试和理解
// 副作用（IO、网络、DB）→ 集中在边界层，不混入核心逻辑
```

---

## 五、控制流优化

### 5.1 减少嵌套：提前返回

```typescript
// ❌ 嵌套 4 层 if-else
function getDiscount(user: User, order: Order): number {
  if (user) {
    if (user.isActive) {
      if (order.total > 100) {
        if (user.level === 'vip') {
          return 0.2;
        } else {
          return 0.1;
        }
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  } else {
    return 0;
  }
}

// ✅ 提前返回（Guard Clauses），减少嵌套
function getDiscount(user: User | null, order: Order): number {
  if (!user) return 0;
  if (!user.isActive) return 0;
  if (order.total <= 100) return 0;
  return user.level === 'vip' ? 0.2 : 0.1;
}
```

### 5.2 用策略模式替代长 if-else / switch

```typescript
// ❌ 大量条件分支，每次新增都要改这里
function calculateShipping(method: string, weight: number): number {
  if (method === 'standard') {
    return weight * 5;
  } else if (method === 'express') {
    return weight * 10 + 15;
  } else if (method === 'same_day') {
    return weight * 20 + 30;
  } else if (method === 'international') {
    return weight * 30 + 50;
  }
  throw new Error(`Unknown method: ${method}`);
}

// ✅ 策略映射表（数据驱动，新增策略不需要改函数）
const shippingStrategies: Record<string, (weight: number) => number> = {
  standard:      (w) => w * 5,
  express:       (w) => w * 10 + 15,
  same_day:      (w) => w * 20 + 30,
  international: (w) => w * 30 + 50,
};

function calculateShipping(method: string, weight: number): number {
  const strategy = shippingStrategies[method];
  if (!strategy) throw new Error(`Unknown shipping method: ${method}`);
  return strategy(weight);
}
```

### 5.3 用多态替代类型判断

```typescript
// ❌ 到处根据类型做不同处理
function getArea(shape: Shape): number {
  if (shape.type === 'circle') return Math.PI * shape.radius ** 2;
  if (shape.type === 'rectangle') return shape.width * shape.height;
  if (shape.type === 'triangle') return 0.5 * shape.base * shape.height;
  throw new Error('Unknown shape');
}

function getPerimeter(shape: Shape): number {
  if (shape.type === 'circle') return 2 * Math.PI * shape.radius;
  if (shape.type === 'rectangle') return 2 * (shape.width + shape.height);
  // ... 又要写一遍 type 判断
}

// ✅ 多态：每种形状自己实现逻辑
interface Shape {
  getArea(): number;
  getPerimeter(): number;
}

class Circle implements Shape {
  constructor(public radius: number) {}
  getArea() { return Math.PI * this.radius ** 2; }
  getPerimeter() { return 2 * Math.PI * this.radius; }
}

class Rectangle implements Shape {
  constructor(public width: number, public height: number) {}
  getArea() { return this.width * this.height; }
  getPerimeter() { return 2 * (this.width + this.height); }
}

// 新增形状不需要改已有代码（开闭原则）
```

---

## 六、防御式编程

### 6.1 核心思想

```
防御式编程的假设：
- 外部输入是不可信的（用户、API、数据库、配置文件）
- 运行环境是不可控的（网络中断、磁盘满、内存不足）
- 协作者是会犯错的（包括自己）

防御的目标：
- 不让非法数据在系统中传播（Fail Fast）
- 出错时给出清晰的错误信息（可诊断）
- 在合理的成本下提供最大保护（不过度防御）
```

### 6.2 输入校验

```typescript
// ❌ 直接信任外部输入
function createUser(body: any) {
  const user = {
    name: body.name.trim(),          // body.name 可能是 undefined → 报错
    age: parseInt(body.age),         // body.age 可能是 "abc" → NaN
    email: body.email,               // 没有格式校验
    role: body.role ?? 'user',       // body.role 可能是 "admin" → 越权
  };
  return db.insert('users', user);
}

// ✅ 系统边界严格校验
function createUser(body: unknown): User {
  // 1. 结构校验（推荐用 Zod / Joi / class-validator）
  const schema = z.object({
    name: z.string().min(2).max(50),
    age: z.number().int().min(0).max(150),
    email: z.string().email(),
    role: z.enum(['user', 'editor']).default('user'),  // 不允许传 admin
  });
  const data = schema.parse(body);  // 校验失败直接抛出清晰的错误信息

  // 2. 业务规则校验
  if (await isEmailExists(data.email)) {
    throw new ConflictError('邮箱已被注册');
  }

  // 3. 安全处理
  return db.insert('users', {
    ...data,
    password: await hashPassword(body.password),  // 密码加密
  });
}

// 校验分层原则：
// 系统边界（Controller/API）→ 校验格式、类型、范围
// 业务层（Service）         → 校验业务规则（唯一性、状态合法性）
// 数据层（Repository）      → 数据库约束兜底（NOT NULL、UNIQUE、FK）
```

### 6.3 边界条件防护

```typescript
// ❌ 没有处理边界条件
function getFirstItem<T>(arr: T[]): T {
  return arr[0];  // 空数组返回 undefined，但返回类型声明了 T
}

function divide(a: number, b: number): number {
  return a / b;   // b=0 返回 Infinity
}

function getPage(items: any[], page: number, size: number) {
  return items.slice((page - 1) * size, page * size);
  // page=0 或 page=-1 会出错
}

// ✅ 处理边界条件
function getFirstItem<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[0] : undefined;
}

function divide(a: number, b: number): number {
  if (b === 0) throw new ArgumentError('除数不能为零');
  return a / b;
}

function getPage<T>(items: T[], page: number, size: number): T[] {
  if (page < 1) throw new ArgumentError('页码必须 >= 1');
  if (size < 1) throw new ArgumentError('每页条数必须 >= 1');
  const start = (page - 1) * size;
  if (start >= items.length) return [];
  return items.slice(start, start + size);
}

// 需要考虑的边界条件：
// - null / undefined
// - 空数组 / 空字符串
// - 0 / 负数 / Infinity / NaN
// - 超大值（溢出）
// - 特殊字符 / 超长字符串
// - 并发 / 竞态条件
```

### 6.4 不可变数据

```typescript
// ❌ 可变状态 → 隐式依赖，难以追踪变化
const config = { timeout: 5000, retry: 3 };
function updateConfig(key: string, value: any) {
  config[key] = value;  // 任何地方都可以修改，不知道谁改的
}

// ✅ 不可变数据 → 变更可追踪
const DEFAULT_CONFIG = Object.freeze({
  timeout: 5000,
  retry: 3,
});

function createConfig(overrides: Partial<Config> = {}): Config {
  return Object.freeze({ ...DEFAULT_CONFIG, ...overrides });
}

const prodConfig = createConfig({ timeout: 10000 });
// prodConfig.timeout = 3000;  // TypeError: Cannot assign to read only property

// 不可变的好处：
// 1. 不会有意外的副作用
// 2. 可以安全地共享引用
// 3. 变更必须创建新对象 → 变更可追踪
// 4. 线程安全（JS 单线程但 React 状态管理依赖不可变性）
```

---

## 七、错误处理策略

### 7.1 错误分类

```
┌─────────────────┬──────────────────────────────┬──────────────────┐
│     错误类型    │            示例              │     处理策略     │
├─────────────────┼──────────────────────────────┼──────────────────┤
│ 编程错误（Bug） │ 空指针、越界、类型错误       │ 让它崩 + 修复    │
│ （不可恢复）    │ 传了错误参数、逻辑错误       │ 不应该 try-catch │
├─────────────────┼──────────────────────────────┼──────────────────┤
│ 运行时异常      │ 网络超时、DB 连接断开        │ 重试 + 降级      │
│ （可恢复）      │ 磁盘满、内存不足             │ 通知 + 告警      │
├─────────────────┼──────────────────────────────┼──────────────────┤
│ 业务错误        │ 余额不足、库存为零           │ 返回错误提示     │
│ （预期内的）    │ 邮箱已注册、权限不足         │ 正常业务流程     │
├─────────────────┼──────────────────────────────┼──────────────────┤
│ 用户输入错误    │ 格式不对、必填项为空         │ 返回校验错误     │
│ （客户端问题）  │ 非法参数                     │ 400 Bad Request  │
└─────────────────┴──────────────────────────────┴──────────────────┘
```

### 7.2 自定义错误类型

```typescript
// 基础错误类型
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true,  // 是否为预期内的错误
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// 业务错误
class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields: Record<string, string>,
  ) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '未登录或登录已过期') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = '没有操作权限') {
    super(message, 'FORBIDDEN', 403);
  }
}

class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

// 统一错误处理中间件
function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    // 预期内的业务错误
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      ...(err instanceof ValidationError && { fields: err.fields }),
    });
    return;
  }

  // 未预期的系统错误
  logger.error('Unexpected error', { error: err.stack });
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误',
  });
}
```

### 7.3 错误处理的常见反模式

```typescript
// ❌ 反模式1：吞掉错误
try {
  await saveOrder(order);
} catch (e) {
  // 什么都不做 → 出了问题完全不知道
}

// ❌ 反模式2：捕获范围过大
try {
  const user = await getUser(userId);        // 可能失败
  const orders = await getOrders(userId);    // 可能失败
  const stats = calculateStats(orders);      // 可能失败
  await sendNotification(user.email, stats);  // 可能失败
} catch (e) {
  // 4 个操作任何一个失败都是同一种处理？
  res.status(500).json({ error: '操作失败' });
}

// ❌ 反模式3：用错误处理做流程控制
try {
  const user = await getUser(userId);
  // 用 user 做事
} catch (e) {
  // 假设这里是"用户不存在"的逻辑
  // 但如果 getUser 因为网络错误失败呢？
}

// ✅ 正确做法
const user = await getUser(userId);
if (!user) {
  throw new NotFoundError('用户', userId);
}

// ❌ 反模式4：错误信息不包含上下文
throw new Error('查询失败');
// 哪个查询？什么参数？为什么失败？

// ✅ 包含诊断上下文
throw new AppError(
  `Failed to query user orders: userId=${userId}, error=${cause.message}`,
  'QUERY_ERROR',
  500,
);
```

### 7.4 正确的错误处理模式

```typescript
// ✅ 模式1：具体错误具体处理
async function processPayment(order: Order): Promise<PaymentResult> {
  try {
    const result = await paymentGateway.charge(order);
    return { status: 'success', transactionId: result.id };
  } catch (error) {
    if (error instanceof NetworkError) {
      // 网络错误 → 可重试
      logger.warn('Payment network error', { orderId: order.id });
      return { status: 'retry', message: '网络异常，请重试' };
    }
    if (error instanceof PaymentDeclinedError) {
      // 余额不足 → 业务错误
      return { status: 'declined', message: error.message };
    }
    // 未知错误 → 向上抛出
    throw new AppError(
      `Payment processing failed: orderId=${order.id}`,
      'PAYMENT_ERROR',
      500,
    );
  }
}

// ✅ 模式2：资源清理用 try-finally
async function readFile(path: string): Promise<string> {
  const handle = await fs.open(path, 'r');
  try {
    return await handle.readFile({ encoding: 'utf-8' });
  } finally {
    await handle.close();  // 无论成功失败都关闭
  }
}

// ✅ 模式3：Result 模式（函数式错误处理，不依赖异常）
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number> {
  if (b === 0) return { ok: false, error: '除数不能为零' };
  return { ok: true, value: a / b };
}

const result = divide(10, 0);
if (result.ok) {
  console.log(result.value);
} else {
  console.log(result.error);
}

// Result 模式 vs 异常：
// 异常 → 适合不可预期的错误（调用方不需要显式处理）
// Result → 适合可预期的错误（强制调用方处理两种情况）
```

---

## 八、状态管理

### 8.1 状态是复杂度的来源

```
状态的敌人：
- 可变状态 → 函数调用结果不确定
- 隐式状态 → 依赖全局变量、单例，追踪困难
- 状态蔓延 → 一个状态变更影响多个不相关的组件

管理原则：
1. 状态越少越好（能用计算的就不要存储）
2. 状态越局部越好（能放在组件内的就不要放全局）
3. 变更越集中越好（状态修改通过统一的入口）
```

### 8.2 状态机

```typescript
// ❌ 用散落的标志位管理状态
class Order {
  isPaid = false;
  isShipped = false;
  isCancelled = false;

  ship() {
    if (!this.isPaid) throw new Error('未支付');
    if (this.isCancelled) throw new Error('已取消');
    if (this.isShipped) throw new Error('已发货');
    this.isShipped = true;
  }
  // 每个方法都要检查所有标志位的组合 → 容易遗漏
}

// ✅ 用状态机管理状态
type OrderState = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

const ORDER_TRANSITIONS: Record<OrderState, OrderState[]> = {
  pending:   ['paid', 'cancelled'],
  paid:      ['shipped', 'cancelled'],
  shipped:   ['completed'],
  completed: [],           // 终态
  cancelled: [],           // 终态
};

class Order {
  constructor(
    public state: OrderState = 'pending',
  ) {}

  transitionTo(newState: OrderState): void {
    const allowed = ORDER_TRANSITIONS[this.state];
    if (!allowed.includes(newState)) {
      throw new Error(`不允许从 ${this.state} 转换到 ${newState}`);
    }
    this.state = newState;
  }

  pay()     { this.transitionTo('paid'); }
  ship()    { this.transitionTo('shipped'); }
  complete(){ this.transitionTo('completed'); }
  cancel()  { this.transitionTo('cancelled'); }
}

// 状态机的优势：
// 1. 合法转换集中定义，不会遗漏
// 2. 不合法转换直接报错
// 3. 新增状态只需修改转换表
// 4. 可以可视化状态流转图
```

### 8.3 用计算代替存储

```typescript
// ❌ 存储了冗余的派生状态
interface User {
  name: string;
  age: number;
  // 冗余字段
  ageGroup: 'young' | 'middle' | 'senior';  // 可以从 age 计算
  displayName: string;                        // 可以从 name 计算
  isAdult: boolean;                           // 可以从 age 计算
}
// 问题：age 变了，ageGroup/isAdult 可能忘记更新 → 数据不一致

// ✅ 用计算属性/函数
interface User {
  name: string;
  age: number;
}

function getAgeGroup(age: number): 'young' | 'middle' | 'senior' {
  if (age < 30) return 'young';
  if (age < 55) return 'middle';
  return 'senior';
}

function isAdult(age: number): boolean {
  return age >= 18;
}

// 派生数据永远从源数据实时计算 → 天然一致
// 如果计算开销大 → 用 memoize 缓存

// React 中的例子
// ❌ 存储 derived state
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);   // 冗余！
// 需要手动同步：setItems(newItems); setCount(newItems.length);

// ✅ 从源数据计算
const [items, setItems] = useState([]);
const count = items.length;  // 直接计算，永远一致
```

---

## 九、类型安全

### 9.1 用类型系统防止错误

```typescript
// ❌ 无类型约束 → 运行时才发现错误
function formatPrice(price) {
  return '¥' + price.toFixed(2);  // price 如果是 string → 运行时报错
}

// ✅ 类型约束 → 编译时发现问题
function formatPrice(price: number): string {
  return `¥${price.toFixed(2)}`;
}

// ❌ 魔法字符串
function updateStatus(status: string) {
  // status 可以是任何字符串，传入 'pendign'（拼写错误）不会报错
}

// ✅ 用枚举/联合类型约束合法值
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

function updateStatus(status: OrderStatus) {
  // 传入 'pendign' → 编译报错
}
```

### 9.2 让非法状态不可表示

```typescript
// ❌ 用可空字段表示互斥状态 → 可能出现非法组合
interface Payment {
  method: 'credit_card' | 'bank_transfer' | 'cash';
  cardNumber?: string;      // method=cash 时这个字段不应该存在
  bankAccount?: string;     // method=credit_card 时这个字段不应该存在
}
// 问题：可能出现 { method: 'cash', cardNumber: '4111...' } → 非法但类型允许

// ✅ 用联合类型让非法状态不可表示
type Payment =
  | { method: 'credit_card'; cardNumber: string; expiry: string }
  | { method: 'bank_transfer'; bankAccount: string; bankName: string }
  | { method: 'cash' };

function processPayment(payment: Payment) {
  switch (payment.method) {
    case 'credit_card':
      // TypeScript 知道这里有 cardNumber 和 expiry
      console.log(payment.cardNumber);
      break;
    case 'bank_transfer':
      // TypeScript 知道这里有 bankAccount 和 bankName
      console.log(payment.bankAccount);
      break;
    case 'cash':
      // TypeScript 知道这里没有额外字段
      break;
  }
}
```

### 9.3 Brand Type（名义类型）

```typescript
// ❌ 不同 ID 类型混用
function getUser(userId: number) { ... }
function getOrder(orderId: number) { ... }

const userId = 1001;
getOrder(userId);  // 编译通过！把 userId 传给了 orderId → Bug

// ✅ Brand Type 区分相同底层类型的不同概念
type UserId = number & { readonly __brand: 'UserId' };
type OrderId = number & { readonly __brand: 'OrderId' };

function asUserId(id: number): UserId {
  return id as UserId;
}

function getUser(userId: UserId) { ... }
function getOrder(orderId: OrderId) { ... }

const uid = asUserId(1001);
getOrder(uid);     // 编译报错！OrderId 和 UserId 不兼容
getUser(uid);      // ✅
```

---

## 十、重构手法

### 10.1 何时重构

```
重构信号：

1. 需要添加新功能，但不知道该改哪里
2. 修改一个 bug 需要改 5 个文件
3. 看代码时经常说"这段代码在干什么？"
4. 不敢改某段代码，怕牵一发动全身
5. 写单元测试时需要大量 mock（说明耦合严重）

重构原则：
- 小步重构，每步可验证（改一点测一点）
- 先加测试再重构（没有测试的重构是赌博）
- 不要"顺便重构"（和功能变更分开提交）
```

### 10.2 常用重构手法

```typescript
// 1. 提取函数
// Before
function printReport(data: ReportData) {
  console.log('=== Report ===');
  console.log(`Total: ${data.items.reduce((s, i) => s + i.amount, 0)}`);
  console.log(`Count: ${data.items.length}`);
  console.log(`Max: ${Math.max(...data.items.map(i => i.amount))}`);
}

// After
function printReport(data: ReportData) {
  const total = calculateTotal(data.items);
  const count = data.items.length;
  const max = findMaxAmount(data.items);
  console.log('=== Report ===');
  console.log(`Total: ${total}`);
  console.log(`Count: ${count}`);
  console.log(`Max: ${max}`);
}

// 2. 以查询替换临时变量
// Before
const basePrice = order.quantity * order.itemPrice;
if (basePrice > 1000) {
  return basePrice * 0.95;
}
return basePrice;

// After
function getBasePrice(order: Order): number {
  return order.quantity * order.itemPrice;
}
if (getBasePrice(order) > 1000) {
  return getBasePrice(order) * 0.95;
}
return getBasePrice(order);

// 3. 分解条件表达式
// Before
if (date.before(SUMMER_START) || date.after(SUMMER_END)) {
  charge = quantity * winterRate + winterServiceCharge;
} else {
  charge = quantity * summerRate;
}

// After
if (isSummer(date)) {
  charge = summerCharge(quantity);
} else {
  charge = winterCharge(quantity);
}

// 4. 合并条件表达式
// Before
if (isExpired) return 0;
if (isCancelled) return 0;
if (isPending && daysSinceCreation > 30) return 0;

// After
if (isInactiveOrder(order)) return 0;

function isInactiveOrder(order: Order): boolean {
  return order.isExpired
    || order.isCancelled
    || (order.isPending && daysSince(order.createdAt) > 30);
}

// 5. 以多态替换条件
// 见 5.3 小节
```

### 10.3 代码坏味道清单

```
必须重构的信号：

┌────────────────┬──────────────────────────────────┐
│    坏味道      │            处理手法              │
├────────────────┼──────────────────────────────────┤
│ 过长函数       │ 提取函数，一个函数做一件事        │
│ 过长参数列表   │ 用 Options 对象替代多个参数       │
│ 重复代码       │ 提取公共函数 / 模板方法          │
│ 嵌套过深       │ 提前返回 / Guard Clauses         │
│ 魔法数字       │ 提取为命名常量                    │
│ 可变全局状态   │ 限制作用域 / 依赖注入             │
│ 注释过度       │ 用代码本身解释（重命名、提取函数）│
│ 发散式变化     │ 一个类因不同原因被修改 → 拆分类  │
│ 霰弹式修改     │ 一个变更要改多个类 → 合并        │
│ 依恋情节       │ 函数总是访问另一个类的数据 → 移动│
│ 拒绝馈赠      │ 子类不使用父类方法 → 重新继承关系 │
└────────────────┴──────────────────────────────────┘
```

---

## 十一、注释的写法

### 11.1 什么注释值得写

```typescript
// ❌ 重复代码的注释（没有增量信息）
// 设置用户名
user.name = name;

// ❌ 日志式注释（版本控制系统做了这件事）
// 2026-05-01 张三：修复了订单计算bug
// 2026-05-02 李四：增加了折扣逻辑

// ❌ 废话注释
// 返回 true 表示成功
return true;

// ✅ 解释 Why（为什么这么做，代码本身只表达了 What）
// 使用 Bcrypt 而不是 MD5，因为 MD5 已被证明不安全
// 参考：https://security advisory/CVE-XXXX
const hashed = await bcrypt.hash(password, 12);

// ✅ 解释约束和限制
// 最多重试 3 次，因为第三方接口有频率限制
// 超过 3 次会触发 429 Too Many Requests
const MAX_RETRY = 3;

// ✅ 解释反直觉的行为
// 这里故意不 await，因为是 fire-and-forget 的异步通知
// 不需要等通知完成再返回响应
sendNotification(user.email, content);

// ✅ TODO / FIXME 标记
// TODO: 当用户量超过 100 万后，需要改用分页查询
// FIXME: 这里的时区处理有 bug，跨天时会多算一天
```

### 11.2 用代码代替注释

```typescript
// ❌ 需要注释才能理解的代码
// 检查用户是否是 VIP 且订单金额超过 1000 且未被删除
if (u.lvl === 3 && o.amt > 1000 && o.del !== 1) { ... }

// ✅ 代码本身就是注释
if (isVipUser(user) && isHighValueOrder(order) && !order.isDeleted) { ... }
```

---

## 十二、权衡与边界

### 12.1 可读性 vs 性能

```
大部分场景：可读性优先
- 先写可读的代码
- 用性能测试找到真正的瓶颈
- 只对瓶颈做性能优化，并加注释说明

需要性能优先的场景：
- 热路径（每秒执行百万次的代码）
- 算法核心（排序、搜索、压缩）
- 实时系统（游戏、音视频）

原则：让 95% 的代码保持可读，只牺牲 5% 的热路径代码可读性来换取性能
```

### 12.2 健壮性 vs 简洁性

```
过度防御的问题：
- 每个函数都 try-catch → 隐藏了真实问题
- 每个参数都判空 → 代码膨胀，可读性下降
- 过多的中间检查 → 正常流程被淹没

正确做法：
- 系统边界严格防御（Controller / API 入口）
- 内部代码信任类型和约定（不重复检查）
- 只在可能失败的地方做防护（IO / 网络 / 外部依赖）
```

### 12.3 DRY vs 过度抽象

```
DRY（Don't Repeat Yourself）不是绝对的：

重复一次 → 不用管（可能只是巧合相似）
重复两次 → 开始留意（看看是否会继续出现）
重复三次 → 提取公共逻辑（Rule of Three）

过早抽象的问题：
- 两段代码看起来相似但业务含义不同
- 强行合并后，需求变了，又要拆开
- 比重复代码更难维护

判断标准：
- 相同的业务概念重复 → 抽象
- 只是代码结构碰巧相似 → 允许重复
```

### 12.4 局限性

```
本方法的局限：

1. 不能替代领域知识
   - 再好的命名也替代不了对业务的理解
   - 不懂业务的人写不出好的抽象

2. 团队一致性比个人技巧更重要
   - 一个人写出完美代码，其他人不遵守规范 = 白搭
   - 代码风格统一 > 代码风格完美

3. 有学习曲线
   - 类型系统、函数式思维、设计模式都需要时间积累
   - 不建议一次引入所有实践，渐进式采用

4. 没有银弹
   - 没有一套规则适用于所有项目
   - MVP 阶段追求速度，生产阶段追求质量
   - 根据项目阶段和团队规模调整标准

5. Code Review 是关键环节
   - 所有原则都需要通过 Review 落地
   - 机器检查（Linter / 类型检查） + 人工 Review 缺一不可
```

---

## 十三、Code Review 检查清单

```
可读性：
□ 命名是否清晰自解释？（不需要猜含义）
□ 函数长度是否 <= 30 行？（超过考虑拆分）
□ 嵌套是否 <= 3 层？（超过用提前返回）
□ 抽象层级是否一致？（不混合高层和低层逻辑）
□ 注释是否解释了 Why 而不是 What？

健壮性：
□ 系统边界是否有输入校验？
□ 是否处理了 null / undefined / 空数组？
□ 是否处理了边界条件（0、负数、超长字符串）？
□ 错误处理是否具体（不是 catch-all）？
□ 错误信息是否包含诊断上下文？
□ 并发场景是否有数据竞争风险？

设计：
□ 函数是否单一职责？
□ 是否有可变全局状态？
□ 类型是否精确（没有 any / 魔法字符串）？
□ 状态管理是否用状态机？
□ 是否有可以计算的派生数据被冗余存储？
□ 是否有重复代码需要提取？
```
