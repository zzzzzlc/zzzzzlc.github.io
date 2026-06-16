---
title: 浏览器与 Electron 内存管理：从 GC 原理到泄漏排查实战
date: '2026-05-05'
tags:
  - 性能优化
  - 前端
category: 前端基础
summary: >-
  从页面越用越卡的实际痛点出发，系统梳理浏览器与 Electron 内存管理机制——V8 堆内存结构、分代回收（新生代 Scavenge / 老生代
  Mark-Sweep & Mark-Compact）、增量与并发 GC，内存泄漏的六大常见模式、Chrome DevTools Memory
  三种排查工具详解（Heap Snapshot 四种视图/Allocation Timeline/Allocation
  Sampling）与实战案例，Electron 多进程内存模型、IPC 泄漏、Native Addon 泄漏、remote 模块泄漏、webContents
  生命周期管理、内存监控与优化配置，以及弱引用 API 和编码规范。
---

# 浏览器内存管理与内存泄漏防治：从 GC 原理到实战排查

## 一、问题来源

前端开发中，内存问题往往是"温水煮青蛙"——不会立即崩溃，但会持续恶化：

**业务层面的痛点：**

- 单页应用（SPA）切换几十个页面后，浏览器内存占用从 100MB 涨到 1GB+，页面开始卡顿
- 带有复杂列表/表格的管理后台，长时间使用后操作越来越慢，最终页面无响应
- 数据可视化大屏运行几小时后崩溃刷新，值班人员需要定时手动刷新页面
- 活动页在低端手机上直接白屏，高端手机也只能撑几十分钟

**技术层面的痛点：**

- 知道"要避免内存泄漏"，但不确定哪些写法会泄漏
- 看到内存占用持续增长，不知道是正常缓存还是泄漏
- Chrome DevTools 的 Memory 面板有 Heap Snapshot / Allocation Timeline / Allocation Sampling 三种工具，不清楚各自适用什么场景
- 不了解 V8 的垃圾回收机制，无法判断 GC 是否工作正常

**核心问题：内存管理不是"不要写全局变量"这么简单，它需要理解 GC 原理、掌握排查工具、建立编码习惯，三者缺一不可。**

---

## 二、V8 内存结构

### 2.1 堆内存分区

```
V8 的堆内存分为几个区域：

┌──────────────────────────────────────────────┐
│                  V8 Heap                      │
├───────────────────┬──────────────────────────┤
│                   │  ┌────────────────────┐  │
│    New Space      │  │   Old Space         │  │
│    (新生代)       │  │   (老生代)          │  │
│    1~8 MB         │  │   数百 MB ~ 数 GB   │  │
│                   │  │                     │  │
│  ┌─────┬─────┐   │  │  ┌───────────────┐  │  │
│  │From │ To  │   │  │  │ 老生代指针空间 │  │  │
│  │(活动)│(空闲)│   │  │  │ Old Pointer   │  │  │
│  └─────┴─────┘   │  │  │ Space         │  │  │
│                   │  │  ├───────────────┤  │  │
│  短生命周期对象   │  │  │ 老生代数据空间 │  │  │
│  新创建的对象     │  │  │ Old Data      │  │  │
│                   │  │  │ Space         │  │  │
├───────────────────┤  │  └───────────────┘  │  │
│  Large Object     │  │                     │  │
│  Space (大对象区)  │  │                     │  │
│  > 256KB 的对象   │  │                     │  │
├───────────────────┤  │                     │  │
│  Code Space       │  │                     │  │
│  (代码区)         │  │                     │  │
├───────────────────┤  │                     │  │
│  Map Space        │  │                     │  │
│  (隐藏类/元信息)  │  │                     │  │
└───────────────────┴──┴─────────────────────┘

关键点：
- 新生代容量小（1~8 MB），回收频繁但速度快
- 老生代容量大，回收频率低但耗时
- 大对象直接分配在大对象区，不经过新生代
```

### 2.2 对象的生命周期

```
对象从创建到回收的路径：

new Object()
    │
    ▼
┌──────────────┐
│   新生代      │  ← 新对象分配在新生代（From 半区）
│   From 半区   │
└──────┬───────┘
       │
       │ 经历一次 Scavenge GC 后仍然存活
       ▼
┌──────────────┐
│   新生代      │  ← 复制到 To 半区
│   To 半区     │
└──────┬───────┘
       │
       │ 经历两次 Scavenge GC 后仍然存活（或 To 半区使用超过 25%）
       ▼
┌──────────────┐
│   老生代      │  ← 晋升到老生代
│              │  ← 由 Mark-Sweep / Mark-Compact 回收
│   ...长期存活 │
│              │
│   不再被引用  │
└──────┬───────┘
       │
       ▼
   被标记为可回收
   下次 GC 时释放内存
```

---

## 三、垃圾回收算法

### 3.1 新生代：Scavenge（Cheney 算法）

```
新生代使用半空间复制算法：

From 半区（活动）          To 半区（空闲）
┌────────────────┐        ┌────────────────┐
│ A │ B │ C │ D │ E │        │               │
└────────────────┘        └────────────────┘
  ↑ 这些是可达的

步骤：
1. 从根对象（Root）开始，标记所有可达对象
2. 将可达对象 A、B、C、E 复制到 To 半区（D 不可达，不复制）
3. 交换 From 和 To 的角色
4. D 所在的内存被释放（因为没有被复制）

From 半区（空闲）          To 半区（活动）
┌────────────────┐        ┌────────────────┐
│               │        │ A │ B │ C │ E │
└────────────────┘        └────────────────┘
                            D 已经被回收

特点：
- 只复制存活对象，速度快
- 存活率低时效率高（大部分新生对象很快就不可达）
- 内存利用率只有 50%（一半空间始终空闲）
- 适合短生命周期对象（函数局部变量、临时字符串）
```

### 3.2 老生代：Mark-Sweep & Mark-Compact

```
老生代使用标记-清除（Mark-Sweep）+ 标记-整理（Mark-Compact）

Mark-Sweep（标记-清除）：
阶段1：标记（Mark）
  从根对象开始遍历，标记所有可达对象
  ┌──┬──┬──┬──┬──┬──┬──┬──┐
  │✓A│✗B│✓C│✓D│✗E│✓F│✗G│✓H│
  └──┴──┴──┴──┴──┴──┴──┴──┘
  ✓=可达  ✗=不可达

阶段2：清除（Sweep）
  清除未标记的对象，释放内存
  ┌──┬  ┬──┬──┬  ┬──┬  ┬──┐
  │A│  │C│D│  │F│  │H│
  └──┴  ┴──┴──┴  ┴──┴  ┴──┘
        ↑ 产生内存碎片

Mark-Compact（标记-整理）：
  在 Mark-Sweep 基础上，将存活对象移动到一端
  ┌──┬──┬──┬──┬──┬  ─ ─ ─ ─┐
  │A│C│D│F│H│            │
  └──┴──┴──┴──┴──┴ ─ ─ ─ ─┘
  ↑ 连续的空闲空间

何时用 Mark-Compact：
- 内存碎片过多时（有足够大的连续空间才能分配大对象）
- 比 Mark-Sweep 慢（需要移动对象并更新指针）
- V8 根据碎片情况选择使用哪种
```

### 3.3 增量标记与并发回收

```
问题：全量 GC 会暂停 JS 执行（Stop-The-World），导致页面卡顿
      老生代 GC 可能需要几十到几百毫秒

V8 的优化策略：

1. 增量标记（Incremental Marking）
   - 将标记阶段拆成多个小步骤
   - 每个步骤只执行几毫秒
   - 与 JS 执行交替进行
   - JS → 标记一小部分 → JS → 标记一小部分 → ...

2. 并发回收（Concurrent GC）
   - 标记/清除工作在辅助线程中执行
   - 不阻塞主线程
   - V8 的 Orinoco 回收器采用此策略

3. 并行回收（Parallel GC）
   - 多个辅助线程同时执行 GC
   - 减少总暂停时间

   主线程（JS执行）    辅助线程1（GC）  辅助线程2（GC）
   ████████████       ████             ████
   ████               ██████           ██████
   ████████████       ████             ████
```

---

## 四、内存泄漏的六大模式

### 4.1 模式一：意外全局变量

```javascript
// ❌ 未声明的变量 → 自动成为 window 的属性 → 永远不会被回收
function processData(data) {
  result = data.map(item => item.value);  // 忘了写 let/const/var
  cachedData = data;                       // 同上
}

// ❌ 函数内 this 指向 window（非严格模式下）
function cache() {
  this.data = new Array(1000000);  // this → window
}

// ✅ 修复
function processData(data) {
  const result = data.map(item => item.value);
  return result;
}

// ✅ 开启严格模式（防止意外全局变量）
'use strict';
```

### 4.2 模式二：未清理的定时器和回调

```javascript
// ❌ 组件销毁后定时器仍在运行
class PollingComponent {
  startPolling() {
    this.timer = setInterval(() => {
      this.fetchData();  // 组件销毁后 this 仍被闭包引用
    }, 1000);
  }
  // 忘了在销毁时 clearInterval
}

// ❌ 一次性事件监听未移除
window.addEventListener('resize', this.handleResize);
// 组件销毁后 handleResize 仍被引用

// ✅ 修复：在销毁钩子中清理
class PollingComponent {
  startPolling() {
    this.timer = setInterval(() => {
      this.fetchData();
    }, 1000);
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Vue 示例
export default {
  mounted() {
    this.timer = setInterval(this.fetchData, 1000);
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    clearInterval(this.timer);
    window.removeEventListener('resize', this.handleResize);
  },
};

// React 示例
useEffect(() => {
  const timer = setInterval(fetchData, 1000);
  const handleResize = () => { /* ... */ };
  window.addEventListener('resize', handleResize);

  return () => {
    clearInterval(timer);                // 清理定时器
    window.removeEventListener('resize', handleResize);  // 清理监听
  };
}, []);
```

### 4.3 模式三：闭包引用

```javascript
// ❌ 闭包持有大对象的引用
function createHandler() {
  const hugeData = new Array(1000000).fill('*');  // 100万元素的大数组

  return function handler() {
    // 即使只用了一个字段，整个 hugeData 都无法被回收
    console.log(hugeData.length);
  };
}

const handler = createHandler();
// hugeData 被闭包持有，永远无法回收

// ✅ 修复：只提取需要的值
function createHandler() {
  const hugeData = new Array(1000000).fill('*');
  const length = hugeData.length;  // 只保存需要的值

  return function handler() {
    console.log(length);  // hugeData 可以被回收
  };
}

// ❌ 闭包间接引用
function setup() {
  const element = document.getElementById('app');
  const data = { /* 大量数据 */ };

  element.addEventListener('click', () => {
    console.log(data);  // 闭包持有 data
  });
  // 即使 element 从 DOM 移除，事件监听仍持有 data 和 element
}

// ✅ 修复：使用 WeakRef 或确保移除监听
```

### 4.4 模式四：脱离 DOM 的引用

```javascript
// ❌ DOM 元素从文档移除，但 JS 仍持有引用
const elements = {
  button: document.getElementById('myButton'),
  panel: document.getElementById('panel'),
};

// 从 DOM 中移除
document.body.removeChild(elements.panel);
// elements.panel 仍然引用着这个 DOM 节点
// DOM 节点 + 它的子树都无法被回收

// ❌ 更隐蔽的情况：数组中存了 DOM 引用
const detachedNodes = [];
function removeNode(node) {
  node.parentNode.removeChild(node);
  detachedNodes.push(node);  // "以防万一"保留引用 → 泄漏
}

// ✅ 修复：移除 DOM 后释放引用
function removeNode(node) {
  node.parentNode.removeChild(node);
  node = null;  // 释放引用
}
// 或清空存储 DOM 引用的数据结构
detachedNodes.length = 0;
```

### 4.5 模式五：事件监听未移除

```javascript
// ❌ 反复添加事件监听但从不移除
class Modal {
  open() {
    this.overlay = document.createElement('div');
    this.overlay.addEventListener('click', this.onClick);
    document.body.appendChild(this.overlay);
    // 如果 open 被调用多次，每次都添加新的监听器
  }
  close() {
    this.overlay.remove();  // DOM 移除了
    // 但没有 removeEventListener → 监听器仍引用 this
  }
}

// ❌ 匿名函数监听无法移除
element.addEventListener('click', () => {
  handleAction();
});
// 无法移除（没有函数引用）

// ✅ 修复：保存引用，销毁时移除
class Modal {
  open() {
    this.overlay = document.createElement('div');
    this.boundOnClick = this.onClick.bind(this);
    this.overlay.addEventListener('click', this.boundOnClick);
    document.body.appendChild(this.overlay);
  }

  close() {
    this.overlay.removeEventListener('click', this.boundOnClick);
    this.overlay.remove();
    this.boundOnClick = null;
  }
}
```

### 4.6 模式六：控制台引用

```javascript
// ❌ console.log 会持有对象的引用（在 DevTools 打开时）
function processUser(user) {
  console.log(user);  // DevTools 打开时，user 对象无法被回收
  return user.name;
}

// 在生产环境中，大量 console.log 会导致内存持续增长
// 尤其是打印大对象、DOM 元素、Error 对象

// ✅ 修复方案

// 方案1：生产环境移除 console.log
// 构建工具配置（如 Vite / Webpack 的 Terser 插件）
// drop_console: true

// 方案2：只打印必要信息
console.log(user.name, user.id);  // 而不是 console.log(user)

// 方案3：条件日志
const isDev = import.meta.env.DEV;
if (isDev) console.log(user);
```

### 4.7 泄漏模式速查表

```
┌──────────────────┬──────────────────────┬──────────────────────┐
│     泄漏模式     │      特征            │     检查方式         │
├──────────────────┼──────────────────────┼──────────────────────┤
│ 意外全局变量     │ window 上挂载了属性  │ Heap Snapshot 搜索   │
│                  │                      │ global / window      │
├──────────────────┼──────────────────────┼──────────────────────┤
│ 未清理定时器     │ 内存阶梯式增长       │ 检查 setInterval /   │
│                  │                      │ setTimeout 是否清理  │
├──────────────────┼──────────────────────┼──────────────────────┤
│ 闭包引用        │ 函数作用域外仍可访问  │ 检查闭包内是否引用   │
│                  │ 大对象               │ 不必要的外部变量     │
├──────────────────┼──────────────────────┼──────────────────────┤
│ 脱离 DOM 引用   │ Detached DOM 节点    │ Heap Snapshot 搜索   │
│                  │                      │ "detached"           │
├──────────────────┼──────────────────────┼──────────────────────┤
│ 事件监听残留    │ 反复操作后内存增长   │ 检查 addEventListener│
│                  │                      │ 是否有对应 remove    │
├──────────────────┼──────────────────────┼──────────────────────┤
│ console 引用    │ DevTools 打开时才泄漏│ 生产环境移除         │
│                  │                      │ console.log          │
└──────────────────┴──────────────────────┴──────────────────────┘
```

---

## 五、Chrome DevTools 排查实战

### 5.1 Performance Monitor：快速发现内存问题

```
步骤：
1. 打开 DevTools → More tools → Performance Monitor
2. 关注指标：
   - JS Heap Size：JS 堆内存使用量
   - DOM Nodes：DOM 节点数
   - JS Event Listeners：事件监听器数量
   - Layouts / Style Recalcs：布局/样式重算次数

3. 判断标准：
   - JS Heap Size 持续上升不回落 → 可能泄漏
   - DOM Nodes 持续增长 → DOM 泄漏
   - 事件监听器持续增长 → 监听器未移除

4. 正常模式（锯齿形）：
   ╱╲╱╲╱╲╱╲  ← 内存上升 → GC 回收 → 上升 → 回收
   稳定在一定范围内

5. 泄漏模式（阶梯上升）：
   ╱╱╱╱╱╱╱╱  ← 内存持续上升，GC 无法回收
```

### 5.2 手动触发 GC

```
排查内存泄漏前，先手动触发一次 GC，排除"还未回收"的干扰：

方法 1：DevTools 内置按钮
  Memory 面板 → 左上角的垃圾桶图标（Collect garbage）
  点击后 V8 立即执行一次全量 GC

方法 2：命令行
  在 Console 中输入：
  > %DebugCollectGarbage()      // 仅在 Chrome DevTools Protocol 调试模式下可用
  或点击 Performance Monitor 中的 JS Heap Size 旁边的小垃圾桶图标

最佳实践：
  每次 Take Snapshot 之前都手动 GC 一次
  → 确保快照中的对象都是"GC 无法回收的"（真泄漏）
  → 而不是"GC 还没来得及回收的"（假泄漏）
```

### 5.3 Heap Snapshot（堆快照）

```
排查步骤：

1. 打开 DevTools → Memory → Heap snapshot
2. 操作流程：
   a. 点击垃圾桶图标（Collect garbage）→ 手动 GC
   b. Take Snapshot（快照1：基准）
   c. 执行可能泄漏的操作（如打开/关闭弹窗、切换路由）
   d. 点击垃圾桶图标 → 手动 GC
   e. Take Snapshot（快照2）
   f. 重复操作 + 手动 GC
   g. Take Snapshot（快照3）
   h. 选择快照3，视图切换为 "Comparison"（对比快照2→3）
   i. 按 Delta（增量）排序，关注 # New（新增）和 # Deleted（删除）
```

**四种视图模式：**

```
Summary（摘要视图）：
  - 按构造函数分组（如 Object、Array、HTMLDivElement）
  - 看哪些类型的对象最多
  - 关注 Retained Size（ retained = 对象 + 它独占引用的所有子对象的总大小）
  - 适合：第一步概览，找到内存大户

Comparison（对比视图）：
  - 对比两个快照之间的差异
  - 关注 # New（新增数量）和 # Deleted（删除数量）
  - Delta > 0 且反复操作后持续增长 → 泄漏
  - 适合：定位泄漏的对象类型（最常用）

Containment（包含视图）：
  - 从 GC Root 开始展示引用链
  - 可以看到 window 对象上挂了哪些属性
  - 适合：检查全局变量泄漏

Statistics（统计视图）：
  - 饼图展示各类型内存占比
  - 快速了解内存分布（代码 / 字符串 / 数组 / 类型数组 / 系统）
  - 适合：宏观概览
```

**常见构造函数含义解读：**

```
(conjection)            → 对应的实际对象
──────────────────────────────────────────────
Object                  → {} 字面量、new Object()
Array                   → [] 字面量、new Array()
(closure)               → 闭包函数及其捕获的作用域
(compiled code)         → V8 编译的 JS 代码
HTMLDivElement          → <div> DOM 元素
HTMLParagraphElement    → <p> DOM 元素
HTMLUnknownElement      → 非标准标签（可能是拼写错误）
Detached HTMLDivElement → 已从 DOM 移除但仍被 JS 引用的 <div>
system / Context        → V8 内部上下文
concatenated string     → 拼接产生的中间字符串
sliced string           → substr/substring 产生的字符串视图
WeakRef                 → WeakRef 包装的对象
Promise                 → Promise 实例

排查重点：
1. 搜索 "Detached" → 找到脱离 DOM 的元素（泄漏的强信号）
2. 搜索 "(closure)" → 闭包引用（检查是否持有大对象）
3. 搜索 "HTML" → DOM 元素数量（是否异常增长）
4. 按 Retained Size 降序 → 找到内存占用最大的对象
```

**引用链分析：**

```
找到泄漏对象 → 查看 Retainers → 沿引用链回溯到 GC Root

Retainers 面板中的符号含义：
→  distance: 从 GC Root 到该对象的最短路径长度
→  ↗  表示引用关系（从下方的对象引用了上方的对象）

GC Root 类型：
- 全局对象（window / globalThis）   → 意外全局变量
- 当前调用栈上的局部变量            → 还在执行中的函数
- 事件监听器回调                    → 未移除的监听
- 闭包                             → 闭包持有的引用
- 引用计数（V8 内部）               → 循环引用等

引用链阅读示例：
  [GC Root] → window → appCache → __data__ → hugeArray
  ↓ 含义：hugeArray 被 appCache.__data__ 持有，appCache 是 window 上的全局变量
  ↓ 修复方向：清理 appCache.__data__ 或将 appCache 从 window 上移除
```

### 5.4 Allocation Timeline（分配时间线）

```
适合排查：频繁的内存泄漏（每次操作都泄漏一点）

步骤：
1. Memory → Allocation instrumentation on timeline
2. 点击 Start
3. 执行操作（如反复切换路由）
4. 点击 Stop
5. 时间线上蓝色柱状图 = 内存分配
   - 蓝色柱子只增不减 = 持续分配未释放 → 泄漏
   - 灰色柱子 = 已被 GC 回收的分配

6. 选中蓝色柱子区域 → 查看该时间段内分配的对象
   → 找到分配最多的构造函数（如 Object、Array、HTMLDivElement）
   → 查看调用栈
```

### 5.5 Allocation Sampling（分配采样）

```
适合排查：长时间运行的应用（不需要暂停）

与 Allocation Timeline 的区别：
- Timeline：记录每次分配，开销大（可能导致应用变慢）
- Sampling：每隔 N 次分配记录一次，开销小，适合长时间运行

步骤：
1. Memory → Allocation sampling
2. 点击 Start
3. 正常使用应用一段时间（几分钟到几小时）
4. 点击 Stop
5. 查看结果：
   - 按调用栈分组展示内存分配热点
   - Heavy（Top Down）：从入口函数往下展开，看哪个分支分配最多
   - Tree（Call Tree）：完整调用树
   - 可以直接看到哪个文件、哪个函数分配了最多内存

适用场景：
- 生产环境内存分析（Sampling 开销极小）
- 长时间运行的 SPA 找到内存热点
- 不需要精确定位某个对象，只需要找到"哪里分配最多"
```

### 5.6 三种工具选择

```
┌──────────────────┬──────────────┬──────────┬──────────────────────┐
│      工具        │   开销       │  精确度  │     适用场景          │
├──────────────────┼──────────────┼──────────┼──────────────────────┤
│ Heap Snapshot    │ 中（拍快照时 │ 高       │ 已知泄漏 → 定位对象  │
│                  │ 暂停一下）   │          │ 和引用链              │
├──────────────────┼──────────────┼──────────┼──────────────────────┤
│ Allocation       │ 高（记录每次 │ 中高     │ 每次操作泄漏一点 →   │
│ Timeline         │ 分配）       │          │ 追踪分配时机          │
├──────────────────┼──────────────┼──────────┼──────────────────────┤
│ Allocation       │ 低（采样）   │ 中       │ 长时间运行 → 找内存  │
│ Sampling         │              │          │ 分配热点              │
└──────────────────┴──────────────┴──────────┴──────────────────────┘

推荐排查路径：
  第一步：Performance Monitor 确认泄漏
  第二步：Heap Snapshot 三次快照对比 → 定位泄漏对象
  第三步：Allocation Timeline → 找到分配的调用栈
  第四步（可选）：Allocation Sampling → 长时间运行的性能分析
```

### 5.7 实战排查案例

```
场景：管理后台的路由切换导致内存持续增长

步骤：
1. 打开 Performance Monitor → 观察 JS Heap Size 基线

2. 操作：从"用户列表"切换到"订单列表"再切回"用户列表"
   → 重复 5 次

3. 观察：
   - JS Heap Size 从 50MB 逐步涨到 80MB，GC 后仍不回落
   - DOM Nodes 从 800 涨到 3200，GC 后仍不回落
   → 确认泄漏

4. Heap Snapshot 排查：
   a. 手动 GC → 拍快照1（基准：50MB）
   b. 切换路由 5 次 → 手动 GC → 拍快照2（72MB）
   c. 再切换 5 次 → 手动 GC → 拍快照3（95MB）
   d. 快照3 切换到 Comparison 视图（对比 2→3）

5. 对比分析：
   - Array 类型的 Delta = +1200 个对象
   - HTMLDivElement 的 Delta = +480 个对象
   - (closure) 的 Delta = +60 个对象

6. 深入分析 HTMLDivElement：
   - 点击展开 → 看到 "Detached HTMLDivElement"
   - 点击单个对象 → 查看 Retainers：
     → detached div → component.__refs__ → router cache → window.__router__
   → 根因：路由切换时组件被缓存（keep-alive），但没有限制缓存数量

7. 修复：限制路由缓存数量
   Vue：  <keep-alive :max="10">
   React：自定义缓存策略，超过 10 个时释放最早的

8. 验证：重复操作后 JS Heap Size 稳定在 55MB 左右 → 修复成功
```

### 5.8 排查流程总结

```
发现内存持续增长
       │
       ▼
Performance Monitor 确认
  JS Heap Size 是否持续上升？
       │ 是
       ▼
Heap Snapshot（3 次快照对比）
  找到增长最多的对象类型
       │
       ▼
查看 Retainers 引用链
  回溯到 GC Root
       │
       ▼
定位代码位置
  在哪个函数/组件中创建了这个对象
       │
       ▼
确认泄漏原因
  未清理定时器？闭包引用？DOM 残留？
       │
       ▼
修复并验证
  修复后重复操作，内存是否稳定
```

---

## 六、弱引用 API

### 6.1 WeakMap

```javascript
// WeakMap：键必须是对象，键被 GC 时值也自动消失

// ❌ 用普通 Map 缓存 → DOM 元素无法被回收
const cache = new Map();
document.querySelectorAll('.card').forEach(el => {
  cache.set(el, { computedData: heavyCompute(el) });
});
// 即使 .card 从 DOM 移除，Map 仍持有引用 → 泄漏

// ✅ 用 WeakMap → DOM 元素移除后自动清理
const cache = new WeakMap();
document.querySelectorAll('.card').forEach(el => {
  cache.set(el, { computedData: heavyCompute(el) });
});
// .card 从 DOM 移除 → 没有其他引用 → GC 自动回收 cache 中对应的条目

// 适用场景：
// 1. 给 DOM 元素关联额外数据
// 2. 给对象存储私有数据（不污染对象本身）
// 3. 缓存计算结果（对象销毁时自动失效）
```

### 6.2 WeakSet

```javascript
// WeakSet：只存对象引用，不阻止 GC

// 标记已处理的元素
const processed = new WeakSet();

function processOnce(element) {
  if (processed.has(element)) return;  // 已处理过
  doProcess(element);
  processed.add(element);
}

// element 从 DOM 移除后 → WeakSet 中的引用自动消失
// 不会阻止 GC
```

### 6.3 WeakRef（ES2021）

```javascript
// WeakRef：创建对对象的弱引用，不阻止 GC

class Cache {
  #map = new Map();

  get(key) {
    const ref = this.#map.get(key);
    if (!ref) return undefined;

    const value = ref.deref();  // 获取引用的对象
    if (value === undefined) {
      this.#map.delete(key);    // 对象已被 GC 回收
      return undefined;
    }
    return value;
  }

  set(key, value) {
    this.#map.set(key, new WeakRef(value));
  }
}

// 使用
const cache = new Cache();
let data = { items: new Array(1000000) };
cache.set('bigData', data);

data = null;  // 释放强引用
// 某次 GC 后，cache.get('bigData') 返回 undefined

// 注意：
// 1. WeakRef.deref() 可能随时返回 undefined
// 2. 不建议用于核心逻辑，只用于可丢失的缓存
// 3. 不要这样写：
//    if (cache.get('key')) { use(cache.get('key')); }
//    第二次 get 时可能已被 GC → 不安全
```

### 6.4 FinalizationRegistry

```javascript
// FinalizationRegistry：对象被 GC 回收时执行回调

const registry = new FinalizationRegistry((heldValue) => {
  console.log(`对象被回收了: ${heldValue}`);
  // 可以在这里做清理工作（如关闭连接、清除关联数据）
});

let obj = { name: 'test' };
registry.register(obj, 'test-object');  // 注册监听

obj = null;  // 释放引用
// 某次 GC 后 → 输出 "对象被回收了: test-object"

// 实际应用：跟踪缓存是否被清理
const cacheRegistry = new FinalizationRegistry((key) => {
  console.log(`缓存项已清理: ${key}`);
});

function cacheData(key, data) {
  const ref = new WeakRef(data);
  cache.set(key, ref);
  cacheRegistry.register(data, key);
}
```

### 6.5 弱引用 API 对比

| API | 键/值类型 | 阻止 GC | 适用场景 |
|-----|----------|---------|---------|
| Map | 任意 | 是（强引用） | 需要确保持有引用 |
| WeakMap | 键必须为对象 | 否（键弱引用） | 关联数据到对象 |
| WeakSet | 只能存对象 | 否 | 标记/去重 |
| WeakRef | 任意对象 | 否 | 可丢失的缓存 |
| FinalizationRegistry | 任意对象 | — | GC 回收通知 |

---

## 七、框架中的内存管理

### 7.1 React

```jsx
// ❌ 常见泄漏：useEffect 不清理
function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/dashboard').then(res => res.json()).then(setData);
    // 组件卸载后请求完成 → setData 对已卸载组件调用
  }, []);

  // ❌ 订阅未清理
  useEffect(() => {
    ws.addEventListener('message', (msg) => {
      setData(JSON.parse(msg.data));
    });
  }, []);
}

// ✅ 修复
function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;                          // 取消标志

    fetch('/api/dashboard')
      .then(res => res.json())
      .then(result => {
        if (!cancelled) setData(result);            // 只在未取消时更新
      });

    return () => { cancelled = true; };             // 清理时标记取消
  }, []);

  useEffect(() => {
    const handler = (msg) => setData(JSON.parse(msg.data));
    ws.addEventListener('message', handler);

    return () => ws.removeEventListener('message', handler);  // 清理监听
  }, []);
}
```

### 7.2 Vue

```vue
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const data = ref(null)
let timer = null
let resizeHandler = null

onMounted(() => {
  // 定时器
  timer = setInterval(() => {
    data.value = fetchLatest()
  }, 5000)

  // 事件监听
  resizeHandler = () => {
    recalculateLayout()
  }
  window.addEventListener('resize', resizeHandler)

  // 第三方库实例
  chartInstance = echarts.init(chartEl.value)
})

onBeforeUnmount(() => {
  // 清理定时器
  if (timer) clearInterval(timer)

  // 清理事件监听
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)

  // 清理第三方库
  if (chartInstance) chartInstance.dispose()
})
</script>
```

### 7.3 大列表/虚拟滚动

```javascript
// ❌ 渲染 10000 条数据 → DOM 节点爆炸 → 内存溢出
function renderList(items) {
  items.forEach(item => {
    const el = document.createElement('div');
    el.textContent = item.name;
    // ... 复杂的 DOM 结构
    container.appendChild(el);  // 10000 个 DOM 节点
  });
}

// ✅ 虚拟滚动：只渲染可视区域
// 使用 react-virtualized / vue-virtual-scroller / @tanstack/virtual

// 原理：
// 1. 计算可视区域能显示多少条
// 2. 只渲染可视区域的 DOM（如 20 条）
// 3. 滚动时替换 DOM 内容，而不是新增
// 4. DOM 节点数始终保持在 ~30 个（可视 + 缓冲）

import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: items.length,         // 总数据量（只存 JS 中，不渲染 DOM）
    getScrollElement: () => parentRef.value,
    estimateSize: () => 50,      // 每项高度
    overscan: 5,                 // 缓冲区域
  });

  return (
    <div ref={parentRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(vItem => (
          <div key={vItem.key} style={{
            position: 'absolute',
            top: vItem.start,
            height: vItem.size,
          }}>
            {items[vItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 八、Electron 内存管理

Electron 应用 = Chromium（多进程）+ Node.js，内存问题比纯浏览器更复杂：多进程各自独立 GC、IPC 传输可能复制数据、Native Addon 不受 V8 GC 管理。

### 8.1 Electron 多进程内存模型

```
┌──────────────────────────────────────────────────┐
│                  Electron 应用                    │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐    ┌─────────────────────────┐ │
│  │  主进程       │    │   渲染进程（可多个）      │ │
│  │  (Main)      │    │   (Renderer)             │ │
│  │              │    │                          │ │
│  │  Node.js 运行│    │  Chromium 渲染引擎       │ │
│  │  单例        │    │  + Node.js API（可选）   │ │
│  │  管理窗口    │    │  每个 BrowserWindow 独立 │ │
│  │  系统 API    │    │  独立 V8 堆 + 独立 GC    │ │
│  └──────┬───────┘    └──────────┬───────────────┘ │
│         │                       │                │
│         │      IPC 通信         │                │
│         │◄────────────────────►│                 │
│         │  (ipcMain/ipcRenderer)│                │
│         │                       │                │
│  ┌──────┴───────────────────────────────────────┐ │
│  │  GPU 进程         │  Utility 进程             │ │
│  │  GPU 合成渲染     │  网络服务 / 音频等        │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘

内存特点：
- 每个进程有独立的 V8 堆和 GC
- 主进程泄漏 → 整个应用异常
- 渲染进程泄漏 → 对应窗口卡顿，不影响其他窗口
- IPC 传输大量数据 → 序列化/反序列化 → 内存翻倍（发送方 + 接收方各一份）
```

### 8.2 Electron 特有的泄漏模式

#### 8.2.1 webContents 未销毁

```javascript
// ❌ 关闭窗口后 webContents 仍在后台运行
let win = new BrowserWindow({ /* ... */ });
win.loadURL('https://example.com');

win.on('closed', () => {
  win = null;  // 只置空了引用
  // webContents 可能还在缓存中，没有被销毁
});

// ✅ 正确处理：确保销毁 webContents
win.on('closed', () => {
  if (win && !win.isDestroyed()) {
    win.webContents.close();  // 显式关闭 webContents
  }
  win = null;
});

// ✅ 使用 webContents 的 did-navigate 等事件后清理
win.webContents.on('did-navigate', () => {
  // 清理与该页面关联的缓存和状态
});
```

#### 8.2.2 remote 模块泄漏（已废弃但老项目仍在用）

```javascript
// ❌ remote 模块会在主进程和渲染进程之间建立隐式引用
// 渲染进程中通过 remote 获取主进程对象
const { remote } = require('electron');
const mainWindow = remote.getCurrentWindow();  // 跨进程引用

// 问题：
// 1. remote 返回的对象被渲染进程持有 → 主进程对应对象无法被 GC
// 2. 即使渲染进程关闭，主进程的对象仍然被 remote 框架持有
// 3. 反复调用 remote → 泄漏累积

// ✅ 修复方案
// 方案 1：使用 @electron/remote 的 release 方法
const { ipcRenderer } = require('electron');
// 完全不用 remote，改用 IPC

// 方案 2：明确释放
import { release } from '@electron/remote';
release(mainWindow);  // 手动释放跨进程引用

// 方案 3（推荐）：迁移到 contextBridge + IPC
// preload.ts
contextBridge.exposeInMainWorld('api', {
  getWindowId: () => ipcRenderer.sendSync('get-window-id'),
});

// renderer
const windowId = window.api.getWindowId();  // 返回基本类型，不持有引用
```

#### 8.2.3 IPC 大数据传输

```javascript
// ❌ 通过 IPC 传输大对象 → 序列化 + 反序列化 → 内存翻倍
// 主进程
ipcMain.on('get-data', (event) => {
  const hugeData = readLargeFile();  // 100MB
  event.reply('data-response', hugeData);
  // hugeData 被序列化为 JSON → 传输到渲染进程 → 反序列化
  // 同一时刻内存中存在 3 份：原始数据 + 序列化字符串 + 反序列化对象
});

// ✅ 方案 1：共享内存（SharedArrayBuffer）
// preload.ts
contextBridge.exposeInMainWorld('sharedBuffer', {
  getBuffer: (size) => ipcRenderer.sendSync('get-shared-buffer', size),
});

// 主进程
ipcMain.on('get-shared-buffer', (event, size) => {
  const buffer = new SharedArrayBuffer(size);
  event.returnValue = buffer;  // 零拷贝传输
});

// ✅ 方案 2：文件传输（适合超大文件）
// 主进程写临时文件 → 传路径 → 渲染进程读取
ipcMain.on('get-large-data', (event) => {
  const tmpPath = path.join(app.getPath('temp'), `data-${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(hugeData));
  event.reply('data-path', tmpPath);
});

// ✅ 方案 3：流式传输（分块 IPC）
// 将大数据分成多个 chunk，逐块发送
function sendInChunks(channel, data, chunkSize = 1024 * 1024) {
  const total = data.length;
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    event.reply(`${channel}-chunk`, { index: i, data: chunk, total });
  }
  event.reply(`${channel}-end`);
}
```

#### 8.2.4 Native Addon 泄漏

```javascript
// Native Addon（C++ 扩展）的内存不受 V8 GC 管理
// 如果 C++ 代码有泄漏，V8 无法回收

// 常见泄漏场景：
// 1. C++ 中 new 了对象但忘记 delete
// 2. C++ 中创建了线程但忘记 join
// 3. C++ 中打开了文件/连接但忘记关闭

// 排查方法：
// 1. 观察 process.memoryUsage().rss（驻留集大小）
//    如果 rss 持续增长但 heapUsed 稳定 → 可能是 Native 泄漏
// 2. 使用 process.memoryUsage() 对比
const mem = process.memoryUsage();
console.log({
  rss: mem.rss,           // 进程总物理内存（包含 Native）
  heapTotal: mem.heapTotal, // V8 堆总大小
  heapUsed: mem.heapUsed,   // V8 堆已使用
  external: mem.external,   // C++ 对象绑定的内存
  arrayBuffers: mem.arrayBuffers,
});
// 如果 rss 增长 >> heapUsed 增长 → Native 层泄漏

// 预防：
// 1. 确保每个 Native Addon 都有 destroy/close 方法
// 2. 在 app.on('before-quit') 中调用
// 3. 选择维护活跃的 Native 库（如 better-sqlite3 而不是已停更的）
```

#### 8.2.5 隐藏窗口和后台页面

```javascript
// ❌ 隐藏的 BrowserWindow 仍在消耗内存
const windows = new Set();

function createWindow(url) {
  const win = new BrowserWindow({ show: false });
  win.loadURL(url);
  windows.add(win);
  // 如果只加不移除 → Set 中累积大量已关闭的窗口引用
}

// ❌ BrowserView / webview 标签未销毁
// <webview> 标签会创建一个独立的渲染进程
// 即使从 DOM 移除，底层进程可能仍在运行

// ✅ 修复：显式管理窗口生命周期
function createWindow(url) {
  const win = new BrowserWindow({ show: false });
  win.loadURL(url);

  win.on('closed', () => {
    windows.delete(win);  // 从集合中移除
  });

  windows.add(win);
  return win;
}

// ✅ 对于不需要的窗口，及时销毁
function destroyAllWindows() {
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.destroy();  // 强制销毁（比 close 更彻底）
    }
  }
  windows.clear();
}
```

### 8.3 Electron 内存监控

```javascript
// 主进程：监控所有进程的内存使用
const memoryMonitor = {
  start(intervalMs = 30000) {
    this.timer = setInterval(() => {
      // 主进程内存
      const mainMem = process.memoryUsage();
      console.log('[Main]', formatMemory(mainMem));

      // 所有渲染进程内存
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.executeJavaScript(
            'JSON.stringify({ url: location.href, memory: process.memoryUsage() })'
          ).then((result) => {
            const data = JSON.parse(result);
            console.log(`[Renderer ${data.url}]`, formatMemory(data.memory));
          }).catch(() => {
            // 页面可能已导航或销毁
          });
        }
      }

      // 总内存告警
      const totalMB = mainMem.rss / 1024 / 1024;
      if (totalMB > 1024) {
        console.warn(`⚠️ 主进程内存超过 1GB: ${totalMB.toFixed(0)}MB`);
      }
    }, intervalMs);
  },

  stop() {
    if (this.timer) clearInterval(this.timer);
  },
};

function formatMemory(mem) {
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + 'MB';
  return `rss=${mb(mem.rss)} heap=${mb(mem.heapUsed)}/${mb(mem.heapTotal)} external=${mb(mem.external)}`;
}

// 启动监控
app.whenReady().then(() => {
  memoryMonitor.start();
});

app.on('before-quit', () => {
  memoryMonitor.stop();
});
```

```javascript
// 渲染进程：上报内存到主进程
// preload.ts
contextBridge.exposeInMainWorld('electronMemory', {
  report() {
    const mem = process.memoryUsage();
    ipcRenderer.send('renderer-memory-report', {
      url: location.href,
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
    });
  },
});

// 主进程接收
ipcMain.on('renderer-memory-report', (event, data) => {
  if (data.memory.heapUsed > 500 * 1024 * 1024) {  // 渲染进程堆超过 500MB
    console.warn(`⚠️ 渲染进程内存过高: ${data.url}`, formatMemory(data.memory));
    // 可选：自动重载该页面
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.reload();
  }
});
```

### 8.4 Electron 内存优化配置

```javascript
// BrowserWindow 内存相关配置
const win = new BrowserWindow({
  webPreferences: {
    // Node.js 集成（按需开启）
    nodeIntegration: false,        // 推荐 false，减少攻击面 + 避免渲染进程滥用 Node API
    contextIsolation: true,        // 推荐 true，隔离渲染进程上下文

    // 渲染进程可用内存限制
    // Electron 默认不对渲染进程设内存上限
    // 可通过 Chromium 命令行开关限制
  },
});

// app.commandLine.appendSwitch 限制渲染进程内存
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
// 限制 V8 老生代最大 512MB（超过会 OOM 崩溃而不是无限膨胀）

// 关闭不必要的功能
app.commandLine.appendSwitch('disable-features', 'TranslateUI');
app.commandLine.appendSwitch('disable-background-timer-throttling');
// 按需关闭不需要的 Chromium 特性

// 渲染进程沙箱
const win = new BrowserWindow({
  webPreferences: {
    sandbox: true,  // 沙箱模式，限制渲染进程的系统能力
    // 沙箱模式下渲染进程不能直接使用 Node.js API
    // 更安全，也更节省内存（不需要加载 Node.js 运行时）
  },
});
```

### 8.5 Electron 内存排查工具

```javascript
// 方法 1：Chrome DevTools 远程调试
// 启动时添加参数
app.commandLine.appendSwitch('remote-debugging-port', 9222);
// 然后在 Chrome 中打开 chrome://inspect → Configure → localhost:9222
// 可以调试主进程和所有渲染进程的 Memory 面板

// 方法 2：electron-devtools-installer
const installExtension = require('electron-devtools-installer');
app.whenReady().then(async () => {
  await installExtension(installExtension.REDUX_DEVTOOLS);
  // DevTools 扩展可以帮助分析 React/Vue 组件的内存引用
});

// 方法 3：v8 堆快照（编程方式）
// 在渲染进程中生成堆快照
const v8 = require('v8');
const fs = require('fs');

function takeHeapSnapshot(label) {
  const stream = v8.getHeapSnapshot();
  const filePath = `./heap-${label}-${Date.now()}.heapsnapshot`;
  const writeStream = fs.createWriteStream(filePath);
  stream.pipe(writeStream);
  console.log(`Heap snapshot saved: ${filePath}`);
  // 可用 Chrome DevTools 直接打开 .heapsnapshot 文件分析
}

// 在关键节点拍快照
ipcMain.on('take-heap-snapshot', (event, label) => {
  takeHeapSnapshot(label);
});

// 方法 4：process.cpuUsage() + process.memoryUsage() 持续记录
const history = [];
setInterval(() => {
  history.push({
    timestamp: Date.now(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  });
  // 只保留最近 1 小时
  if (history.length > 120) history.shift();
}, 30000);
```

### 8.6 Electron 内存泄漏排查流程

```
Electron 内存排查比浏览器多了几个维度：

1. 确定泄漏的进程
   → 主进程？渲染进程？GPU 进程？
   → 任务管理器 / Activity Monitor 按 PID 排序

2. 渲染进程泄漏 → 与浏览器相同的排查方法
   → 开启 remote-debugging-port → Chrome DevTools Memory 面板
   → Heap Snapshot / Allocation Timeline

3. 主进程泄漏
   → Node.js 特有的泄漏（Buffer、Stream、EventEmitter 监听器）
   → v8.getHeapSnapshot() 导出快照分析
   → 检查 ipcMain.on 是否有未清理的监听器

4. Native 泄漏
   → rss 增长但 heapUsed 稳定
   → 需要排查 C++ Addon
   → 使用 valgrind / ASan（Address Sanitizer）编译 Debug 版本

5. IPC 泄漏
   → 检查传输的数据量
   → 检查是否有大量 pending 的 IPC 消息
   → 用 SharedArrayBuffer 替代大数据传输

Electron 特有排查清单：
□ BrowserWindow 是否在 closed 事件中置空引用？
□ webContents 是否正确销毁？
□ ipcMain/ipcRenderer 的监听器是否清理？
□ 是否使用了已废弃的 remote 模块？
□ Native Addon 是否调用了 destroy/close？
□ 渲染进程是否开启了 sandbox？
□ V8 堆大小是否设置了上限（--max-old-space-size）？
□ 多窗口场景是否有大量隐藏窗口？
```

---

## 十、编码规范与预防措施

### 10.1 组件销毁清单

```
每个组件/模块创建时，必须明确：

□ 定时器（setTimeout / setInterval）→ 在哪里清理？
□ 事件监听（addEventListener）→ 在哪里移除？
□ 订阅（Observable / EventEmitter）→ 在哪里 unsubscribe？
□ 网络请求（fetch / axios）→ 如何取消（AbortController）？
□ 第三方实例（echarts / map / video）→ 在哪里 dispose？
□ DOM 引用（缓存的 DOM 节点）→ 在哪里释放？

React → useEffect 的 cleanup 函数
Vue   → onBeforeUnmount / onUnmounted
原生   → 自定义 destroy / cleanup 方法
```

### 10.2 AbortController 取消请求

```javascript
// ❌ 组件卸载后请求仍然执行
function SearchComponent() {
  const [results, setResults] = useState([]);

  const handleSearch = async (query) => {
    const res = await fetch(`/api/search?q=${query}`);
    const data = await res.json();
    setResults(data);  // 组件可能已卸载
  };
}

// ✅ 使用 AbortController
function SearchComponent() {
  const [results, setResults] = useState([]);
  const controllerRef = useRef(null);

  const handleSearch = async (query) => {
    // 取消上一次请求
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res = await fetch(`/api/search?q=${query}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      if (err.name === 'AbortError') return;  // 正常取消，忽略
      throw err;
    }
  };
}
```

### 10.3 对象池模式

```javascript
// 适用于频繁创建和销毁相同类型对象的场景
// 如游戏中的子弹、动画中的粒子

class ObjectPool {
  #pool = [];
  #factory;

  constructor(factory, initialSize = 10) {
    this.#factory = factory;
    for (let i = 0; i < initialSize; i++) {
      this.#pool.push(factory());
    }
  }

  acquire() {
    return this.#pool.length > 0
      ? this.#pool.pop()
      : this.#factory();
  }

  release(obj) {
    this.#pool.push(obj);  // 复用而不是 GC
  }
}

// 使用
const bulletPool = new ObjectPool(() => ({ x: 0, y: 0, active: false }), 50);

function fireBullet() {
  const bullet = bulletPool.acquire();
  bullet.active = true;
  // ... 使用
}

function removeBullet(bullet) {
  bullet.active = false;
  bulletPool.release(bullet);  // 归还池子
}
```

---

## 十一、局限性与边界

```
内存管理的局限：

1. 无法完全控制 GC 时机
   - JS 没有手动 GC 的 API
   - 只能通过消除引用来"建议"GC 回收
   - GC 的实际执行时机由引擎决定

2. 浏览器差异
   - Chrome (V8) 和 Firefox (SpiderMonkey) 的 GC 策略不同
   - 同一页面在不同浏览器上的内存表现可能不同
   - 排查工具和方法主要是 Chrome DevTools

3. WeakRef 不保证及时回收
   - WeakRef.deref() 返回值可能在 GC 后仍不为 undefined
   - FinalizationRegistry 的回调时机不确定
   - 不应用于核心业务逻辑

4. 第三方库的内存问题难以控制
   - 引入的库内部可能有泄漏
   - 只能通过 Dispose API 清理
   - 必要时需要阅读源码定位问题

5. 性能与内存的取舍
   - 缓存提升性能但增加内存
   - 对象池减少 GC 但代码复杂
   - 需要根据实际场景权衡

6. 移动端内存更紧张
   - iOS WebView 内存警告后可能直接杀掉页面
   - 低端 Android 设备可用内存更少
   - 桌面端测试通过不代表移动端没问题
```

---

## 十二、Code Review 检查清单

```
内存安全 Review 要点：

通用：
□ useEffect / onMounted 中的定时器是否在 cleanup 中清理？
□ addEventListener 是否有对应的 removeEventListener？
□ 订阅（Observable / EventEmitter）是否 unsubscribe？
□ fetch / axios 请求是否使用 AbortController 取消？
□ 第三方库实例（echarts / map）是否调用了 dispose？
□ 是否有意外的全局变量（未用 let/const 声明）？
□ 闭包中是否引用了不必要的大对象？
□ 缓存是否有大小限制或过期策略？
□ DOM 节点移除后是否释放了 JS 中的引用？
□ 大列表是否使用了虚拟滚动？
□ 生产环境是否移除了 console.log？
□ 长时间运行的页面是否有内存监控？

Electron 专项：
□ BrowserWindow 在 closed 事件中是否置空引用？
□ webContents 是否正确销毁？
□ ipcMain/ipcRenderer 的监听器是否在不需要时移除？
□ 是否使用了已废弃的 remote 模块？是否迁移到 contextBridge + IPC？
□ IPC 是否传输了大数据？是否改用 SharedArrayBuffer / 文件 / 流式传输？
□ Native Addon 是否调用了 destroy/close？
□ 渲染进程是否开启了 sandbox 和 contextIsolation？
□ V8 堆是否设置了上限（--max-old-space-size）？
□ 多窗口场景中隐藏窗口是否及时销毁？
□ 主进程是否有 process.memoryUsage() 监控？
```
