---
title: 面向对象 vs 面向过程：编程范式的本质对比与选型
date: '2025-07-26'
tags:
  - 设计原则
  - 架构
category: 编程基础
summary: >-
  从实际开发的痛点出发，深入对比面向对象与面向过程两种编程范式的核心思想、代码组织方式、优缺点与适用场景。覆盖封装继承多态的本质、常见 OOP
  误区、函数式编程的交叉影响，以及不同业务场景下的选型建议。
---

# 面向对象 vs 面向过程：编程范式的本质对比与选型

## 一、问题来源

很多开发者在写代码时，会遇到这些困惑：

**初学者的困惑：**

- 学了 Java/C#，写了 class，但感觉就是在"面向过程套了个 class 的壳"
- 类和对象的概念背得很熟，但落地时不知道什么时候该建类、什么时候该用函数
- 继承用了几层，改一个父类方法，一堆子类跟着出 bug

**中级开发者的困惑：**

- 项目里有个"上帝类"（God Object），3000 行代码，所有逻辑都塞在里面
- 为了复用代码搞了层层继承，结果基类的修改牵一发动全身
- 写了一堆 Service 类，里面全是 static 方法，本质上还是面向过程

**架构层面的困惑：**

- Go 语言"没有类"，但写出来的代码也很清晰，OOP 真的必要吗？
- 函数式编程越来越火，它和 OOP 是什么关系？
- 一个项目里，哪些模块适合 OOP，哪些适合面向过程？

**核心问题：面向对象和面向过程不是"谁好谁坏"的对立关系，而是两种组织代码的思维方式。理解它们的本质差异，才能在正确的场景选择正确的方式。**

---

## 二、核心概念

### 2.1 面向过程（Procedural Programming）

**核心思想：** 程序是一系列步骤的有序集合。数据和对数据的操作是分离的。

```
思维模式：做什么 → 按什么顺序做

                    ┌──────────────┐
    数据 ──────→    │   函数处理    │ ──────→   结果
    （被动）        │  （主动主角）  │          （输出）
                    └──────────────┘

    关注点：算法和流程控制（顺序、分支、循环）
```

**典型代码：**

```typescript
// 面向过程：电商订单处理
// 数据和逻辑分离，流程是主角

// 数据结构（DTO）
interface Order {
    id: string;
    items: OrderItem[];
    status: string;
    totalAmount: number;
}

interface OrderItem {
    productId: string;
    quantity: number;
    price: number;
}

// 一系列函数，按流程调用
function calculateTotal(order: Order): number {
    let total = 0;
    for (const item of order.items) {
        total += item.price * item.quantity;
    }
    return total;
}

function applyDiscount(total: number, couponRate: number): number {
    return total * couponRate;
}

function validateOrder(order: Order): boolean {
    if (order.items.length === 0) return false;
    if (order.totalAmount <= 0) return false;
    return true;
}

function processOrder(order: Order, couponRate: number): Order {
    // 第一步：校验
    if (!validateOrder(order)) {
        throw new Error('Invalid order');
    }
    // 第二步：计算总价
    const total = calculateTotal(order);
    // 第三步：应用折扣
    order.totalAmount = applyDiscount(total, couponRate);
    // 第四步：更新状态
    order.status = 'paid';
    return order;
}

// 使用：线性调用
const order: Order = { id: '1', items: [...], status: 'pending', totalAmount: 0 };
processOrder(order, 0.8);
```

**代表语言：** C、Pascal、早期 Fortran、Bash Shell

### 2.2 面向对象（Object-Oriented Programming）

**核心思想：** 程序是一组对象的协作。对象将数据和对数据的操作封装在一起，通过消息传递进行交互。

```
思维模式：谁负责做什么

    ┌─────────────────┐     消息     ┌─────────────────┐
    │    Order 对象    │ ──────────→  │  Coupon 对象    │
    │  ┌───────────┐  │              │  ┌───────────┐  │
    │  │ 数据      │  │              │  │ 数据      │  │
    │  │ - items   │  │              │  │ - rate    │  │
    │  │ - total   │  │              │  │ - type    │  │
    │  ├───────────┤  │              │  ├───────────┤  │
    │  │ 行为      │  │              │  │ 行为      │  │
    │  │ + calc()  │  │              │  │ + apply() │  │
    │  │ + pay()   │  │              │  └───────────┘  │
    │  └───────────┘  │              └─────────────────┘
    └─────────────────┘

    关注点：对象的职责和协作关系
```

**典型代码：**

```typescript
// 面向对象：电商订单处理
// 数据和行为封装在一起，对象是主角

class OrderItem {
    constructor(
        readonly productId: string,
        readonly quantity: number,
        readonly price: number
    ) {}

    get subtotal(): number {
        return this.price * this.quantity;
    }
}

class Order {
    private _status: string = 'pending';
    private _totalAmount: number = 0;

    constructor(
        readonly id: string,
        private items: OrderItem[]
    ) {
        this.recalculate();
    }

    get status(): string { return this._status; }
    get totalAmount(): number { return this._totalAmount; }

    private recalculate(): void {
        this._totalAmount = this.items.reduce(
            (sum, item) => sum + item.subtotal, 0
        );
    }

    isValid(): boolean {
        return this.items.length > 0 && this._totalAmount > 0;
    }

    applyCoupon(coupon: Coupon): void {
        if (!this.isValid()) throw new Error('Invalid order');
        this._totalAmount = coupon.applyTo(this._totalAmount);
    }

    pay(): void {
        if (!this.isValid()) throw new Error('Invalid order');
        this._status = 'paid';
    }
}

class Coupon {
    constructor(private rate: number) {}

    applyTo(amount: number): number {
        return amount * this.rate;
    }
}

// 使用：对象协作
const order = new Order('1', [
    new OrderItem('p1', 2, 29.9),
    new OrderItem('p2', 1, 49.9)
]);
const coupon = new Coupon(0.8);
order.applyCoupon(coupon);
order.pay();
```

**代表语言：** Java、C#、C++、Python、Ruby、Swift、Kotlin

### 2.3 一图对比

```
          面向过程                      面向对象
    ┌──────────────────┐        ┌──────────────────┐
    │ 数据 ← 函数处理   │        │ 对象.行为()       │
    │                  │        │                  │
    │ 流程：            │        │ 职责：            │
    │ 1. 取数据         │        │ 谁拥有数据，谁负责 │
    │ 2. 处理数据       │        │ 处理这些数据       │
    │ 3. 存数据         │        │                  │
    │                  │        │ 协作：            │
    │ 代码组织：         │        │ 对象之间通过消息   │
    │ 按流程/功能分函数   │        │ 传递完成业务       │
    └──────────────────┘        └──────────────────┘
```

---

## 三、OOP 三大特性的本质

### 3.1 封装（Encapsulation）

**本质：** 隐藏内部实现，暴露最小接口。

```typescript
// ❌ 没有封装：外部直接操作内部数据
class BankAccount {
    balance: number = 0;  // 公开的，外部可以随意改
}

const account = new BankAccount();
account.balance = -100;  // 谁都能改成负数，数据不安全

// ✅ 封装：通过方法控制访问
class BankAccount {
    private _balance: number = 0;

    get balance(): number {
        return this._balance;
    }

    deposit(amount: number): void {
        if (amount <= 0) throw new Error('Amount must be positive');
        this._balance += amount;
    }

    withdraw(amount: number): void {
        if (amount <= 0) throw new Error('Amount must be positive');
        if (amount > this._balance) throw new Error('Insufficient balance');
        this._balance -= amount;
    }
}

const account = new BankAccount();
account.deposit(100);
account.withdraw(30);
// account.balance = -100;  // 编译报错，_balance 是 private
```

**封装的意义：**
- 数据完整性由对象自己保障，不依赖调用者的"自觉"
- 内部实现可以随时改，不影响外部调用者
- 状态变更经过统一入口，便于加日志、校验、权限控制

### 3.2 继承（Inheritance）

**本质：** 子类复用父类的代码，建立"is-a"关系。

```typescript
// ✅ 合理的继承：真的是 is-a 关系
abstract class Shape {
    abstract get area(): number;
    abstract get perimeter(): number;

    describe(): string {
        return `Area: ${this.area}, Perimeter: ${this.perimeter}`;
    }
}

class Circle extends Shape {
    constructor(private radius: number) { super(); }

    get area(): number { return Math.PI * this.radius ** 2; }
    get perimeter(): number { return 2 * Math.PI * this.radius; }
}

class Rectangle extends Shape {
    constructor(private width: number, private height: number) { super(); }

    get area(): number { return this.width * this.height; }
    get perimeter(): number { return 2 * (this.width + this.height); }
}

// 多态：同一个接口，不同实现
const shapes: Shape[] = [new Circle(5), new Rectangle(3, 4)];
shapes.forEach(s => console.log(s.describe()));
```

**继承的陷阱：**

```typescript
// ❌ 继承陷阱 1：不是 is-a 关系
class Bird {
    fly(): void { console.log('flying'); }
}

class Penguin extends Bird {
    fly(): void {
        throw new Error("Penguins can't fly!");  // 违反里氏替换原则
    }
}

// 调用者期望 Bird 都能飞，Penguin 却不能 → 设计错误

// ✅ 正确设计
abstract class Bird {
    abstract move(): void;
}

class FlyingBird extends Bird {
    move(): void { console.log('flying'); }
}

class SwimmingBird extends Bird {
    move(): void { console.log('swimming'); }
}

// ❌ 继承陷阱 2：继承层级过深
class Animal {}
class Mammal extends Animal {}
class Dog extends Mammal {}
class GuideDog extends Dog {}
class SmartGuideDog extends GuideDog {}  // 5 层继承，改一个影响一片

// ❌ 继承陷阱 3：为了复用代码而继承
class ArrayList {
    add(item: any): void { /* ... */ }
}

class UniqueList extends ArrayList {
    // 只是想复用 add，但要处理"不能重复"的逻辑
    // 结果父类的所有方法都被继承了，有些不需要
    add(item: any): void {
        // 重写父类逻辑，实际上是在"覆盖"而非"扩展"
    }
}
```

**继承原则：**
- 继承深度不超过 3 层
- 严格遵循 is-a 关系（子类必须是父类的一种）
- 优先用组合（composition）而非继承

### 3.3 多态（Polymorphism）

**本质：** 同一个接口，不同实现。调用者不需要知道具体类型。

```typescript
// 多态的核心价值：新增类型时，不需要修改已有代码

// 支付策略
interface PaymentStrategy {
    pay(amount: number): Promise<PaymentResult>;
}

class AlipayStrategy implements PaymentStrategy {
    async pay(amount: number): Promise<PaymentResult> {
        console.log(`Alipay: ${amount}`);
        return { success: true, transactionId: 'alipay_123' };
    }
}

class WechatPayStrategy implements PaymentStrategy {
    async pay(amount: number): Promise<PaymentResult> {
        console.log(`Wechat Pay: ${amount}`);
        return { success: true, transactionId: 'wechat_456' };
    }
}

class CreditCardStrategy implements PaymentStrategy {
    async pay(amount: number): Promise<PaymentResult> {
        console.log(`Credit Card: ${amount}`);
        return { success: true, transactionId: 'card_789' };
    }
}

// 调用者只依赖接口，不依赖具体实现
class PaymentService {
    constructor(private strategy: PaymentStrategy) {}

    async pay(amount: number): Promise<PaymentResult> {
        return this.strategy.pay(amount);
    }
}

// 新增支付方式时，PaymentService 完全不用改
const service = new PaymentService(new AlipayStrategy());
await service.pay(99.9);
```

**多态的三种形式：**

| 形式 | 说明 | 示例 |
|------|------|------|
| 子类型多态 | 父类引用指向子类对象 | `Shape s = new Circle()` |
| 参数多态 | 泛型，同一逻辑适配不同类型 | `List<T>` |
| 特设多态 | 函数重载，同名不同参数 | `toString()`、`valueOf()` |

---

## 四、深度对比

### 4.1 维度对比

| 维度 | 面向过程 | 面向对象 |
|------|---------|---------|
| **核心单位** | 函数/过程 | 对象/类 |
| **数据归属** | 数据独立存在，函数操作数据 | 数据和行为封装在对象内 |
| **代码复用** | 函数调用、模块化 | 继承、组合、多态 |
| **状态管理** | 全局变量或参数传递 | 对象内部状态，通过方法修改 |
| **扩展方式** | 加函数、加参数 | 加子类、加接口实现 |
| **思维起点** | "要做哪些事" | "谁来负责做什么" |
| **适合规模** | 小型脚本、算法逻辑 | 中大型系统、业务建模 |
| **学习曲线** | 低（直觉） | 中高（设计原则需要经验） |
| **性能** | 通常更高（直接调用） | 有运行时开销（虚函数表、动态分发） |

### 4.2 同一需求的双重实现

**需求：文件解析器，支持 JSON / YAML / XML 三种格式**

```typescript
// ========== 方案 A：面向过程 ==========
// 思路：判断文件类型 → 调用对应的解析函数

function parseFile(filePath: string): Record<string, unknown> {
    const content = readFile(filePath);
    const ext = getExtension(filePath);

    if (ext === '.json') {
        return JSON.parse(content);
    } else if (ext === '.yaml') {
        return parseYaml(content);
    } else if (ext === '.xml') {
        return parseXml(content);
    } else {
        throw new Error(`Unsupported format: ${ext}`);
    }
}

// 新增格式：修改 parseFile 函数，加一个 else if
// 问题：违反开闭原则（对修改开放）
```

```typescript
// ========== 方案 B：面向对象 ==========
// 思路：定义接口，每种格式一个实现类

interface FileParser {
    supportedExtensions(): string[];
    parse(content: string): Record<string, unknown>;
}

class JsonParser implements FileParser {
    supportedExtensions() { return ['.json']; }
    parse(content: string) { return JSON.parse(content); }
}

class YamlParser implements FileParser {
    supportedExtensions() { return ['.yaml', '.yml']; }
    parse(content: string) { return parseYaml(content); }
}

class XmlParser implements FileParser {
    supportedExtensions() { return ['.xml']; }
    parse(content: string) { return parseXml(content); }
}

class ParserRegistry {
    private parsers = new Map<string, FileParser>();

    register(parser: FileParser): void {
        for (const ext of parser.supportedExtensions()) {
            this.parsers.set(ext, parser);
        }
    }

    parse(filePath: string): Record<string, unknown> {
        const ext = getExtension(filePath);
        const parser = this.parsers.get(ext);
        if (!parser) throw new Error(`Unsupported: ${ext}`);
        return parser.parse(readFile(filePath));
    }
}

// 新增格式：新增一个类，注册到 Registry，不修改已有代码
const registry = new ParserRegistry();
registry.register(new JsonParser());
registry.register(new YamlParser());
registry.register(new XmlParser());

// 未来新增 TomlParser → 只需加一个类 + 一行 register
```

**对比分析：**

```
面向过程版本：
  + 简单直接，5 分钟写完
  + 代码量少
  - 每次新增格式都要改 parseFile
  - if-else 会越来越长
  - 多人协作容易产生合并冲突

面向对象版本：
  + 新增格式不需要改已有代码（开闭原则）
  + 每种格式独立文件，协作无冲突
  + 方便单元测试（mock 某个 Parser）
  - 代码量是面向过程的 3 倍
  - 只有 2~3 种格式时显得过度设计
```

---

## 五、常见 OOP 误区

### 5.1 误区："用了 class 就是面向对象"

```java
// ❌ 面向过程的代码套了个 class 的壳（贫血模型）
public class UserService {
    private UserDAO userDAO;

    // 所有逻辑都在 Service 中，User 只是一个数据容器
    public boolean login(String phone, String password) {
        User user = userDAO.findByPhone(phone);
        if (user == null) return false;
        String hashed = HashUtils.md5(password);
        return hashed.equals(user.getPassword());
    }

    public void changePassword(Long userId, String newPassword) {
        User user = userDAO.findById(userId);
        user.setPassword(HashUtils.md5(newPassword));
        userDAO.save(user);
    }
}

// User 是纯数据容器，没有任何行为
public class User {
    private Long id;
    private String phone;
    private String password;
    // 只有 getter/setter，没有业务方法
}
```

```typescript
// ✅ 真正的面向对象（充血模型）
class User {
    constructor(
        readonly id: number,
        private phone: string,
        private passwordHash: string
    ) {}

    verifyPassword(rawPassword: string): boolean {
        return HashUtils.verify(rawPassword, this.passwordHash);
    }

    changePassword(oldPassword: string, newPassword: string): void {
        if (!this.verifyPassword(oldPassword)) {
            throw new Error('Old password incorrect');
        }
        this.passwordHash = HashUtils.hash(newPassword);
    }
}

// Service 只编排流程，不包含业务逻辑
class UserService {
    constructor(private userRepo: UserRepository) {}

    async login(phone: string, password: string): Promise<User> {
        const user = await this.userRepo.findByPhone(phone);
        if (!user) throw new Error('User not found');
        if (!user.verifyPassword(password)) throw new Error('Wrong password');
        return user;
    }
}
```

**判断标准：** 如果你的对象只有数据（getter/setter），行为全在 Service 里 → 本质是面向过程。

### 5.2 误区："继承越多越 OOP"

```typescript
// ❌ 继承滥用
class User {}
class AdminUser extends User {}
class SuperAdminUser extends AdminUser {}
class SystemAdminUser extends SuperAdminUser {}
// 改 User 的一个方法，所有子类都可能受影响

// ✅ 用组合代替继承
class User {
    constructor(private roles: Role[]) {}
    hasPermission(perm: string): boolean {
        return this.roles.some(r => r.hasPermission(perm));
    }
}

class Role {
    constructor(readonly name: string, private permissions: Set<string>) {}
    hasPermission(perm: string): boolean {
        return this.permissions.has(perm);
    }
}

const admin = new User([
    new Role('admin', new Set(['read', 'write', 'delete'])),
    new Role('auditor', new Set(['read', 'audit']))
]);
```

### 5.3 误区："OOP 总是比面向过程好"

```
场景一：写一个脚本，批量重命名文件
  面向过程：20 行搞定 ✓
  面向对象：建 FileRenamer 类、RenameStrategy 接口... 100 行，过度设计 ✗

场景二：实现快速排序算法
  面向过程：清晰表达算法步骤 ✓
  面向对象：非要建 Sorter 类、Comparator 接口... 增加了理解成本 ✗

场景三：电商订单系统
  面向过程：函数散落各处，状态管理混乱 ✗
  面向对象：Order、Payment、Inventory 各司其职 ✓

场景四：操作系统内核
  面向过程：C 语言，直接控制硬件，性能优先 ✓
  面向对象：抽象层太多，性能损耗不可接受 ✗
```

---

## 六、OOP 设计原则速查（SOLID）

| 原则 | 含义 | 一句话 |
|------|------|--------|
| **S** - 单一职责 | 一个类只有一个变更的原因 | 不要上帝类 |
| **O** - 开闭原则 | 对扩展开放，对修改关闭 | 加功能不改老代码 |
| **L** - 里氏替换 | 子类可以替换父类 | 子类不要破坏父类约定 |
| **I** - 接口隔离 | 接口要小而专 | 不要强迫实现不需要的方法 |
| **D** - 依赖倒置 | 依赖抽象而非具体 | 面向接口编程 |

```typescript
// S - 单一职责：一个类只做一件事
// ❌ User 类既管用户信息又管发送邮件
class User {
    save() { /* 存数据库 */ }
    sendWelcomeEmail() { /* 发邮件 */ }
}

// ✅ 拆成两个类
class UserRepository {
    save(user: User) { /* 存数据库 */ }
}
class EmailService {
    sendWelcome(user: User) { /* 发邮件 */ }
}

// D - 依赖倒置：高层不依赖低层
// ❌ Service 直接依赖具体的 MySQL 实现
class OrderService {
    private repo = new MySQLOrderRepository();  // 耦合
}

// ✅ 依赖抽象
class OrderService {
    constructor(private repo: OrderRepository) {}  // 注入接口
}
```

---

## 七、与函数式编程的关系

OOP 和 FP 不是对立的，很多现代语言同时支持两者。

### 7.1 核心差异

```
OOP 的核心：封装 + 状态变化（对象持有状态，方法改变状态）
FP 的核心：纯函数 + 不可变数据（输入 → 输出，没有副作用）

OOP 思维：谁能负责管理这个状态？
FP  思维：数据如何流转和变换？
```

### 7.2 实际项目中的融合

```typescript
// 现代前端开发：OOP + FP 融合的典型案例

// OOP 部分：React 组件用 class 或 hooks 管理状态
class ShoppingCart {
    private items: CartItem[] = [];

    addItem(item: CartItem): void {
        this.items = [...this.items, item];  // 不可变更新（FP 思想）
    }

    getTotal(): number {
        return this.items.reduce((sum, item) => sum + item.price, 0);  // reduce（FP）
    }
}

// FP 部分：工具函数用纯函数
function filterByCategory(items: CartItem[], category: string): CartItem[] {
    return items.filter(item => item.category === category);
}

function formatPrice(amount: number): string {
    return `¥${amount.toFixed(2)}`;
}

// 使用
const cart = new ShoppingCart();
cart.addItem({ name: 'Book', price: 29.9, category: 'education' });
cart.addItem({ name: 'Phone', price: 2999, category: 'electronics' });

const educationItems = filterByCategory(cart.items, 'education');  // FP
console.log(formatPrice(cart.getTotal()));  // FP
```

### 7.3 选择指南

| 场景 | 推荐范式 | 原因 |
|------|---------|------|
| UI 组件 / 状态管理 | OOP + 状态管理库 | 状态变化是核心 |
| 数据转换 / 管道处理 | FP | 纯函数，易于测试和组合 |
| 业务领域建模 | OOP（充血模型） | 实体有状态和行为 |
| 工具函数 / 格式化 | FP | 无状态，输入→输出 |
| 并发 / 并行 | FP（不可变数据） | 无共享状态，天然线程安全 |
| 系统编程 / 算法 | 面向过程 | 性能优先，直接控制 |

---

## 八、不同语言的范式倾向

```
纯面向过程：          C、Pascal、Bash
面向对象为主：        Java、C#、Ruby、Smalltalk
多范式（OOP + FP）：  Python、JavaScript、TypeScript、Rust、Swift、Kotlin
函数式为主：          Haskell、Erlang、Clojure、Elixir
面向过程 + 有限 OOP： Go（结构体 + 接口，无继承）
```

**Go 语言的启示：**

```go
// Go 没有 class，但有结构体和接口
// 用组合代替继承，用接口实现多态

type Shape interface {
    Area() float64
    Perimeter() float64
}

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return math.Pi * c.Radius * c.Radius
}

func (c Circle) Perimeter() float64 {
    return 2 * math.Pi * c.Radius
}

// 隐式实现接口（不需要 implements 关键字）
var s Shape = Circle{Radius: 5}
fmt.Println(s.Area())
```

Go 的设计说明：**OOP 的核心价值不在于 class/继承，而在于封装和多态。接口 + 组合可以达到同样的目的，且更灵活。**

---

## 九、选型建议

### 9.1 按项目规模

| 项目规模 | 推荐范式 | 原因 |
|---------|---------|------|
| 脚本/工具（< 1000 行） | 面向过程 | 简单直接，快速完成 |
| 小型应用（1000~1 万行） | 轻度 OOP / 面向过程 | 用 class 组织核心模块，其余用函数 |
| 中型应用（1~10 万行） | OOP + 设计模式 | 需要良好的模块化和扩展性 |
| 大型系统（> 10 万行） | OOP + FP + 领域驱动 | 分层架构，不同层用不同范式 |

### 9.2 按业务场景

```
适合面向过程的场景：
├── 算法实现（排序、搜索、图算法）
├── 数据处理脚本（ETL、批量导入导出）
├── 配置/构建工具（Webpack config、CI 脚本）
├── 系统编程（驱动、内核模块）
└── 简单 CRUD（只有增删改查，没有复杂业务逻辑）

适合面向对象的场景：
├── 业务领域建模（电商、金融、ERP）
├── UI 框架/组件库
├── 插件/扩展系统（需要多态和动态加载）
├── 游戏开发（实体、行为、状态变化复杂）
└── 框架设计（需要良好的抽象和扩展点）

适合函数式的场景：
├── 数据转换/管道（map/filter/reduce 链）
├── 状态管理（Redux、immutable.js）
├── 并发/异步处理
└── 纯计算（格式化、校验、解析）
```

### 9.3 实际项目中的混合策略

```
典型 Web 后端项目的分层策略：

Controller 层 → 面向过程（接收请求、调用 Service、返回响应）
Service 层   → OOP（编排业务对象，事务管理）
Domain 层   → OOP 充血模型（实体持有状态和行为）
Repository层 → OOP 接口 + 面向过程实现（数据库操作）
Utils 层    → 函数式（纯函数，无副作用）
```

---

## 十、总结

### 核心观点

- **面向过程关注"做什么"**，以函数和流程为核心，适合简单、线性、性能敏感的场景
- **面向对象关注"谁来做"**，以对象和协作为核心，适合复杂业务建模和大型系统
- **两者不是对立的**，现代项目通常是多种范式混合——Domain 用 OOP，工具用 FP，脚本用面向过程
- **用了 class ≠ 面向对象**，关键是数据和行为是否封装在一起（充血 vs 贫血）
- **继承不是越多越好**，优先用组合 + 接口实现多态

### 选型速查

| 你在做什么 | 推荐方式 |
|-----------|---------|
| 写脚本/工具 | 面向过程 |
| 写算法 | 面向过程 |
| 写业务系统 | OOP（充血模型） |
| 写框架/库 | OOP（接口 + 组合） |
| 写数据处理管道 | FP |
| 写 UI 组件 | OOP + FP |
| 不确定 | 先用最简单的方式，复杂了再重构 |

### 一句话建议

**不要为了 OOP 而 OOP，也不要因为"面向过程更简单"就拒绝合理的抽象。选择范式之前先想清楚问题的本质——你是在组织流程，还是在建模实体关系。**
