---
title: React 源码解读
date: '2025-08-29'
tags:
  - React
  - 前端
category: 技术
summary: >-
  从 React 的设计理念出发，梳理其发展历程与架构演进，深入解读 Fiber 架构、调和算法、Hooks 实现、并发模式等核心源码设计，并分析 React
  19 的重大变化。
---
# React 源码解读

React 不只是一个 UI 库，其背后的设计思想深刻影响了整个前端生态。本文将从源码层面解析 React 的核心架构。

## 一、React 发展历程

### 1. 版本演进


| 版本       | 年份 | 里程碑                                            |
| ---------- | ---- | ------------------------------------------------- |
| React 0.3  | 2013 | 首次开源，引入 JSX、Virtual DOM                   |
| React 0.14 | 2015 | 拆分 React 和 ReactDOM                            |
| React 15   | 2016 | 增加 PureComponent，错误边界                      |
| React 16   | 2017 | **Fiber 架构**重写，Error Boundaries，Portals     |
| React 16.8 | 2019 | **Hooks** 诞生，函数组件成为一等公民              |
| React 17   | 2020 | 事件委托改为根节点，渐进升级基础                  |
| React 18   | 2022 | **并发渲染**，Automatic Batching，Suspense 正式版 |
| React 19   | 2024 | Server Components，Actions，use() Hook            |

### 2. 架构演进

```
Stack Reconciler（React 15 及之前）
  → 同步递归渲染，主线程阻塞，无法中断

Fiber Reconciler（React 16 起）
  → 链表结构，可中断、可恢复、可优先级调度

并发模式（React 18 起）
  → 时间切片，优先级调度，Suspense 集成

Server Components（React 19）
  → 组件可在服务端执行，零客户端 JS 体积
```

## 二、核心设计理念

### 1. 三大原则

```
1. UI = f(state)
   界面是状态的函数映射。给定相同的状态，始终渲染相同的 UI。

2. 单向数据流
   数据从父组件流向子组件（props），状态变更通过回调向上传递。

3. 声明式编程
   描述"UI 应该是什么样子"，而非"如何一步步更新 DOM"。
```

### 2. 架构分层

```
┌──────────────────────────────────┐
│        应用层（开发者编写的组件）    │
├──────────────────────────────────┤
│  reconciler（调和器）             │  ← 决定哪些需要更新
│  - Diff 算法                     │
│  - 优先级调度                    │
│  - Fiber 树构建                  │
├──────────────────────────────────┤
│  renderer（渲染器）              │  ← 执行具体更新
│  - ReactDOM（浏览器 DOM）        │
│  - ReactNative（原生组件）       │
│  - ReactTestRenderer（测试）     │
│  - ReactThreeFiber（3D 渲染）   │
└──────────────────────────────────┘
```

**关键设计：reconciler 与 renderer 解耦**。React 只负责"计算差异"，不关心"如何渲染"。这让同一套核心逻辑可以渲染到 DOM、Native、Canvas 甚至终端。

## 三、Fiber 架构

### 1. 为什么需要 Fiber

React 15 的 Stack Reconciler 采用**递归遍历** Virtual DOM 树：

```javascript
// React 15 的递归渲染（简化）
function reconcile(parent, oldVNode, newVNode) {
    if (oldVNode == null) {
        parent.appendChild(createElement(newVNode));
    } else if (newVNode == null) {
        parent.removeChild(oldVNode.dom);
    } else if (!isSameType(oldVNode, newVNode)) {
        parent.replaceChild(createElement(newVNode), oldVNode.dom);
    } else {
        // 递归处理子节点
        const oldChildren = oldVNode.children;
        const newChildren = newVNode.children;
        for (let i = 0; i < newChildren.length; i++) {
            reconcile(oldVNode.dom, oldChildren[i], newChildren[i]);
        }
    }
}
```

**问题：** 递归一旦开始就无法中断。当组件树很大时，会长时间占用主线程，导致动画卡顿、输入延迟。

### 2. Fiber 的设计

Fiber 将递归改为**链表遍历**，每个 Fiber 节点包含子节点、兄弟节点、父节点的引用：

```javascript
// Fiber 节点结构（简化）—— 每个属性都对应一个你日常开发中的现象
const fiber = {
    // === 静态身份：决定"这是谁、能不能复用" ===
    tag: FunctionComponent,     // 组件类型（函数/类/原生DOM/Portal）
    type: App,                  // 组件函数 / 类 / 标签名（'div'）
    key: null,                  // 列表复用标识（为什么 key 不能用 index，见 5.1）

    // === 树结构：链表，让遍历可中断恢复 ===
    return: parentFiber,        // 父节点
    child: firstChildFiber,     // 第一个子节点（不是数组，是链表头）
    sibling: nextFiber,         // 第一个兄弟节点
    index: 0,                   // 在兄弟中的位置

    // === 工作单元：本次渲染的输入与输出 ===
    pendingProps: {},           // 本次待处理的 props
    memoizedProps: {},          // 上次渲染用的 props（React.memo 浅比较的对象，见 5.2）
    memoizedState: null,        // 上次渲染的 state（函数组件是 Hooks 链表头，见 5.3）
    updateQueue: null,          // 待处理的更新队列

    // === 实例与引用：连接外部世界 ===
    stateNode: null,            // 真实 DOM / 类组件实例（ref.current 指向它，见 5.4）
    ref: null,                  // 通过 ref 传入的引用

    // === 副作用：commit 阶段要执行什么 ===
    flags: 0,                   // 本节点操作标记（Placement/Update/Deletion，见 5.5）
    subtreeFlags: 0,            // 子树副作用汇总（React 17+ 优化，避免再遍历子树）
    deletions: null,            // 需要删除的子节点数组

    // === 调度优先级：并发模式的核心 ===
    lanes: NoLanes,             // 本节点待处理优先级（startTransition 打低位，见 5.6）
    childLanes: NoLanes,        // 子树的待处理优先级

    // === 双缓冲：current 与 workInProgress 互相指向 ===
    alternate: currentFiber,    // 另一棵树的对应节点（render 必须纯净的原因，见 5.7）
};
```

上面这些属性不是用来背的——**每一个都直接对应你在组件开发里遇到的现象**（列表 key 报警、memo 失效、hooks 报错、ref 拿不到组件……）。5 节会逐个拆解。

### 3. 链表遍历算法

```javascript
// Fiber 树的深度优先遍历（可中断）
function workLoop() {
    while (currentFiber && !shouldYield()) {
        currentFiber = performUnitOfWork(currentFiber);
    }
    if (currentFiber) {
        // 还有工作未完成，让出主线程，下一帧继续
        requestIdleCallback(workLoop);
    } else {
        // 全部完成，提交更新
        commitRoot();
    }
}

function performUnitOfWork(fiber) {
    // 1. 处理当前 Fiber（调用组件函数，生成子 Fiber）
    const child = reconcileChildren(fiber);

    // 2. 返回下一个要处理的 Fiber
    if (child) return child;         // 有子节点 → 进入子节点
    if (fiber.sibling) return fiber.sibling;  // 有兄弟 → 进入兄弟

    // 无子无兄弟 → 回到父节点继续找兄弟
    let parent = fiber.return;
    while (parent) {
        if (parent.sibling) return parent.sibling;
        parent = parent.return;
    }
    return null;  // 遍历完毕
}
```

### 4. 双缓冲机制

React 同时维护两棵 Fiber 树：

```
current 树（当前屏幕显示的）    ←→    workInProgress 树（正在构建的）

首次渲染：current = null → 构建 workInProgress → 提交后互换
更新渲染：从 current 克隆 → 构建 workInProgress → 提交后互换

            Fiber Root
           /         \
     current ↔ workInProgress
      (显示)     (构建中)
```

```javascript
// 双缓冲切换（在 commitRoot 中）
function commitRoot() {
    // 将 workInProgress 树变为 current 树
    root.current = finishedWork;
    // 旧的 current 变为下一次的 workInProgress（通过 alternate 复用）
}
```

### 5. Fiber 属性在组件开发中的体现

光看属性清单记不住，关键是把它们和你天天写的组件代码对应起来。下面挑 7 个高频场景，说明每个 fiber 属性在开发里到底起什么作用。

**5.1 key 与 type：决定组件能否复用**

fiber 的 `key` + `type` 是 React 判断"是不是同一个节点"的唯一依据。Diff 时，同一位置若 key 和 type 都匹配 → 复用旧 fiber（保留 state）；不匹配 → 卸载旧的、挂载新的（state 重置）。

```jsx
// ❌ 用 index 做 key —— 列表输入串位的经典 bug
items.map((item, i) => <Item key={i} value={item} />)

// 删除 items[0] 后：React 发现 key=0,1,2 还在，判定"复用"
// 但 key=0 原本对应 items[0]，现在对应原来的 items[1]
// Item 内部不受控的本地状态（输入框光标、未提交草稿）跟着错位
// 这就是"删掉第一行后，下面输入框内容串了"的根因

// ✅ 用稳定的业务 id 做 key
items.map(item => <Item key={item.id} value={item} />)
```

`type` 在同一位置变化会触发重建：

```jsx
{showEdit ? <EditForm /> : <Detail />}
// 同一位置，type 在 EditForm / Detail 间切换 → React 认为是不同组件
// 卸载 EditForm（执行其 useEffect 清理）+ 挂载 Detail（全新 state）
// 想保留状态：用 CSS display 切换显隐，而不是切换组件
```

**实践启示：** 想保留状态就别让 key/type 变；反过来，想强制重置组件内部状态，故意改 key 是常用技巧——`<Comp key={id} />`，id 一变组件整个重建。

**5.2 memoizedProps：React.memo 浅比较的对象**

`memoizedProps` 存上次渲染用的 props，`pendingProps` 存本次的。`React.memo` 的本质就是浅比较这两个字段：

```jsx
const MemoChild = React.memo(Child);
// 父组件重渲染时，React 对比 Child fiber 的 pendingProps vs memoizedProps
// 浅比较相等 → 直接跳过 Child 的 render

// 陷阱：内联对象/函数每次都是新引用，浅比较必不相等，memo 形同虚设
<MemoChild
    style={{ color: 'red' }}      // ❌ 每次 render 新对象
    onClick={() => doSomething()} // ❌ 每次 render 新函数
/>
// → memoizedProps.style !== pendingProps.style，memo 永远失效

// ✅ 用 useMemo / useCallback 稳定引用
const style = useMemo(() => ({ color: 'red' }), []);
const handleClick = useCallback(() => doSomething(), []);
```

**实践启示：** memo 失效几乎都是引用相等问题——传给 memo 组件的每个 prop 都得是稳定引用，否则 memo 白包。

**5.3 memoizedState：Hooks 链表与"不能放条件里"**

函数组件的 `memoizedState` 不是单一值，而是 **Hooks 链表的头指针**。每个 hook（useState/useEffect/...）是链表上的一个节点，按调用顺序串联：

```jsx
function Comp() {
    const [a, setA] = useState(0); // 链表节点 1
    const [b, setB] = useState(0); // 链表节点 2
    useEffect(() => {}, []);        // 链表节点 3
}
// fiber.memoizedState → {a} → {b} → {effect} → null
```

React 完全靠"调用顺序"匹配 hook 与链表节点。一旦 hook 放进条件语句，顺序就会错乱：

```jsx
function Comp({ cond }) {
    const [a] = useState(0);       // 节点1
    if (cond) {
        const [b] = useState(0);   // ❌ cond 变化时节点2 时有时无
    }
    const [c] = useState(0);       // cond=true 时是节点3，cond=false 时变成节点2
    // React 把 c 的更新写到了 b 的链表节点上 → state 错乱、报错
}
```

**实践启示：** "Hooks 必须在顶层调用"不是语法规定，是 `fiber.memoizedState` 链表结构的硬约束——顺序一乱，状态匹配就崩。

**5.4 stateNode：ref 拿到 DOM 的本质**

`stateNode` 指向 fiber 对应的"实例"：原生标签（HostComponent）是真实 DOM 节点，类组件是类实例，**函数组件没有 stateNode**。

```jsx
const inputRef = useRef(null);
return <input ref={inputRef} />;
// HostComponent（input）的 fiber.stateNode = 真实 <input> DOM
// commit 阶段 React 把这个 DOM 赋给 ref.current → inputRef.current 就是那个 DOM
```

这解释了两个日常现象：
- **函数组件不能直接 `ref={ref}`**（拿到的是 null），因为它的 fiber 没有 stateNode——必须用 `forwardRef` 把 ref 透传到内部的原生标签。
- **`useRef` 的值能跨渲染保持且修改不触发重渲染**：它本质是挂在 fiber 上的一个 hook 节点，`.current` 是个普通可变属性，不参与渲染输出，所以改它 React 感知不到。

**5.5 flags：副作用标记与执行时机**

`flags` 标记本节点在 commit 阶段要执行的操作（插入/更新/删除）。`useEffect` 和 `useLayoutEffect` 的差异就来自不同的副作用标记：

```jsx
useEffect(() => { fetchData(); }, []);
// fiber 打上 Passive flag
// commit 阶段全部完成后【异步】执行（不阻塞浏览器绘制）→ useEffect 是异步的根源

useLayoutEffect(() => { measureDOM(); }, []);
// 打上 Layout（同步）flag
// DOM 变更后【同步】执行，执行完才允许浏览器绘制 → 适合读布局、避免闪烁
```

列表删除时，被删节点的 `flags = Deletion`，commit 阶段触发卸载 → 该节点所有 effect 的 cleanup 函数依次执行。这就是"组件卸载时清理定时器、解绑事件、取消订阅"的底层机制——不写 cleanup 就会内存泄漏。

**5.6 lanes：startTransition 的优先级**

`lanes` 是并发模式的核心：每个更新都带一个优先级，高优先级可以打断低优先级的工作。`fiber.lanes` 是本节点待处理优先级，`childLanes` 是子树的：

```jsx
// 切 tab 要渲染大量列表（慢），同时用户还在搜索框输入
function switchTab(tab) {
    startTransition(() => {
        setActiveTab(tab); // 这次更新被打成"低优先级 lane"
    });
}
// 搜索框输入是高优先级更新
// React 会暂停 tab 的渲染（workInProgress 保留进度），优先处理输入
// 输入处理完，再接着渲染 tab
// 这就是 startTransition 让"切 tab 不卡打字"的原理
```

调度器从根节点读 `childLanes`，决定"这棵树有没有紧急工作要做"。**实践启示：** 把"可以慢一下"的状态更新（搜索结果、大列表、tab 切换）包进 `startTransition`，把"必须立即响应"的（输入框文本、按钮点击）留在普通优先级。

**5.7 alternate：为什么 render 阶段必须纯净**

`alternate` 让 current（屏幕显示）和 workInProgress（正在构建）两棵树互相指向。workInProgress 树构建到一半可能被打断（见 5.6 的优先级抢占），甚至**整个丢弃重来**：

```
正在构建 workInProgress（render 函数执行了一半）
    ↓  高优先级更新进来，调度器决定优先处理它
当前 workInProgress 被丢弃，从 current 重新克隆构建
    ↓
你的 render 函数可能被调用多次，上一次的执行结果被废弃
```

所以 render 函数必须**纯净**——不能在里面发请求、改全局变量、操作 DOM、写数据库。这些副作用要么放事件处理函数，要么放 `useEffect`（commit 阶段才执行，不会重复或丢弃）。

**fiber 属性 → 开发现象 → 实践启示对照表**

| fiber 属性 | 对应的日常开发现象 | 实践启示 |
|-----------|------------------|---------|
| `key` | 列表用 index 导致输入串位 | 用稳定业务 id；想重置就改 key |
| `type` | 切换组件导致 state 丢失 | 同位置别换 type；想重置就换 |
| `memoizedProps` | `React.memo` 失效 | 传稳定引用（useMemo/useCallback） |
| `memoizedState` | hooks 放条件语句报错 | hooks 必须在顶层按顺序调用 |
| `stateNode` | ref.current 是 DOM；函数组件不能直接 ref | 函数组件用 forwardRef |
| `flags` | useEffect 异步、卸载执行 cleanup | render 保持纯净，副作用放 effect |
| `lanes` | startTransition 不卡输入 | 可慢的更新包进 transition |
| `alternate` | render 执行多次结果不一致 | render 必须是纯函数 |

## 四、调和算法（Diff）

### 1. Diff 前提假设

React 基于三个假设将 Diff 复杂度从 O(n³) 降到 O(n)：

1. **跨层级移动极少** — 只比较同一层级的节点
2. **不同类型的元素产生不同的树** — 类型变了直接替换
3. **Key 标识节点身份** — 通过 key 判断是移动还是新建

### 2. 单节点 Diff

```javascript
function reconcileSingleElement(returnFiber, currentFirstChild, element) {
    const key = element.key;
    let child = currentFirstChild;

    while (child) {
        if (child.key === key) {
            if (child.type === element.type) {
                // key 相同，type 相同 → 复用
                const existing = useFiber(child, element.props);
                existing.return = returnFiber;
                return existing;
            }
            // key 相同，type 不同 → 删除旧的，创建新的
            deleteChild(returnFiber, child);
            break;
        } else {
            // key 不同 → 删除
            deleteChild(returnFiber, child);
        }
        child = child.sibling;
    }

    // 创建新 Fiber
    const created = createFiberFromElement(element);
    created.return = returnFiber;
    return created;
}
```

### 3. 列表 Diff（多节点）

```javascript
// React 对列表的处理分为两轮遍历

// 第一轮：逐个对比，遇到不匹配就停止
for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const oldFiber = currentFirstChild;

    if (oldFiber && isSameType(oldFiber, newChild)) {
        // 复用
    } else {
        // 不匹配，第一轮结束
        break;
    }
}

// 第二轮：处理剩余节点
// - 旧节点多 → 删除
// - 新节点多 → 新增
// - 都有剩余 → 基于key匹配（使用Map加速查找）
const existingChildren = mapRemainingChildren(oldFiber);
for (let i = 0; i < remainingNewChildren.length; i++) {
    const newChild = remainingNewChildren[i];
    const matchedFiber = existingChildren.get(newChild.key) ||
                         existingChildren.get(null);
    if (matchedFiber) {
        // 复用并移动
    } else {
        // 创建新节点
    }
}
```

**Key 的作用：** 没有 key 时，React 按 index 顺序对比，可能导致不必要的更新。有 key 时，React 能精确识别节点移动。

```jsx
// 没有 key：A→B→C 变为 B→C→D
// React 认为 A→B（更新），B→C（更新），C→D（更新）— 3 次更新

// 有 key：key:B, key:C 复用，删除 key:A，新增 key:D — 1 删 1 增
```

## 五、Hooks 源码实现

### 1. Hooks 链表

每个 Fiber 节点的 `memoizedState` 指向一个**单向链表**，存储该组件所有 Hook 的状态：

```javascript
// Hook 结构
const hook = {
    memoizedState: initialState,  // 当前状态值
    queue: {                      // 更新队列
        pending: null,            // 待处理的更新
        dispatch: null,           // setState 函数
    },
    next: nextHook,               // 下一个 Hook
};

// 组件中按顺序调用 Hooks
function MyComponent() {
    const [count, setCount] = useState(0);     // hook1
    const [name, setName] = useState("Tom");   // hook2
    useEffect(() => { /* ... */ }, []);         // hook3
    // fiber.memoizedState → hook1 → hook2 → hook3 → null
}
```

**这就是为什么 Hooks 不能在条件语句中调用** — 链表顺序必须稳定。

### 2. useState 实现

```javascript
function useState(initialState) {
    // 获取当前 Hook
    const hook = updateWorkInProgressHook();

    if (currentHook !== null) {
        // 更新阶段：处理更新队列
        const queue = hook.queue;
        let newState = hook.memoizedState;

        // 遍历更新队列，计算最终状态
        let update = queue.pending;
        if (update) {
            do {
                const action = update.action;
                newState = typeof action === 'function'
                    ? action(newState)    // 函数式更新：setCount(c => c + 1)
                    : action;              // 直接赋值：setCount(5)
                update = update.next;
            } while (update !== queue.pending);
            queue.pending = null;
        }

        hook.memoizedState = newState;
        return [newState, queue.dispatch];
    }

    // 首次渲染：初始化状态
    hook.memoizedState = typeof initialState === 'function'
        ? initialState()
        : initialState;

    const dispatch = dispatchAction.bind(null, hook.queue);
    hook.queue.dispatch = dispatch;
    return [hook.memoizedState, dispatch];
}
```

### 3. dispatchAction（setState 的本质）

```javascript
function dispatchAction(queue, action) {
    // 创建更新对象
    const update = {
        action,           // 新值或更新函数
        next: null,
        lane: requestLane(),  // 优先级
    };

    // 将更新加入环形链表
    const pending = queue.pending;
    if (pending === null) {
        update.next = update;  // 指向自己
    } else {
        update.next = pending.next;
        pending.next = update;
    }
    queue.pending = update;

    // 调度更新
    scheduleUpdateOnFiber(fiber, lane);
}
```

### 4. useEffect 实现

```javascript
function useEffect(create, deps) {
    const hook = updateWorkInProgressHook();

    const nextDeps = deps === undefined ? null : deps;
    let destroy = null;

    if (currentHook !== null) {
        const prevEffect = currentHook.memoizedState;
        destroy = prevEffect.destroy;

        if (nextDeps !== null) {
            const prevDeps = prevEffect.deps;
            // 浅比较依赖
            if (areHookInputsEqual(nextDeps, prevDeps)) {
                // 依赖没变，跳过
                return;
            }
        }
    }

    // 创建 effect 对象
    hook.memoizedState = {
        tag: HookEffectTag.HasEffect,
        create,           // useEffect 的回调函数
        destroy,          // 上次的清理函数
        deps: nextDeps,
        next: null,
    };

    // 将 effect 加入 Fiber 的 updateQueue
    // 在 commit 阶段异步执行
    pushEffect(fiber.flags, create, destroy, nextDeps);
}
```

## 六、调度与并发

### 1. 优先级系统

React 18 引入了**车道模型（Lane Model）**替代之前的 expirationTime：

```javascript
// Lane 是一个 31 位二进制数，每一位代表一种优先级
const SyncLane         = 0b0000000000000000000000000000001;  // 同步（最高）
const InputContinuousLane = 0b0000000000000000000000000000100; // 连续输入
const DefaultLane      = 0b0000000000000000000000000010000;  // 默认
const TransitionLane   = 0b0000000000000000000000100000000;  // 过渡
const IdleLane         = 0b1000000000000000000000000000000;  // 空闲（最低）

// 批量处理同优先级的更新
// 不同优先级的更新可以中断低优先级的渲染
```

### 2. 时间切片

```javascript
// React 通过 MessageChannel 实现时间切片
const channel = new MessageChannel();
const port = channel.port2;
channel.port1.onmessage = performWorkUntilDeadline;

let startTime;
function performWorkUntilDeadline() {
    startTime = performance.now();
    // 每帧预留 5ms 给浏览器，剩余时间执行 React 工作
    while (currentTask && !shouldYield()) {
        currentTask = performUnitOfWork(currentTask);
    }
    if (currentTask) {
        // 还有工作，下一帧继续
        port.postMessage(null);
    }
}

function shouldYield() {
    // 超过 5ms 时间片或更高优先级任务到来
    return performance.now() - startTime > 5 || hasHigherPriorityTask();
}
```

### 3. Automatic Batching

React 18 中所有状态更新自动批处理：

```javascript
// React 17：setTimeout 中的更新不会批处理
setTimeout(() => {
    setCount(c => c + 1);    // 渲染 1 次
    setFlag(f => !f);        // 渲染 2 次（两次独立渲染）
}, 0);

// React 18：所有场景自动批处理
setTimeout(() => {
    setCount(c => c + 1);    // 两次更新合并
    setFlag(f => !f);        // 只渲染 1 次
}, 0);
```

原理：所有 `dispatchAction` 调用后只触发一次 `ensureRootIsScheduled`，合并同优先级更新。

### 4. startTransition

```javascript
import { startTransition } from 'react';

// 紧急更新：输入框响应
setInputValue(input);

// 非紧急更新：搜索结果渲染
startTransition(() => {
    setSearchQuery(input);
});
```

```javascript
// 源码实现（简化）
function startTransition(scope) {
    const prevPriority = getCurrentUpdatePriority();
    // 设置为 Transition 优先级（低于默认）
    setCurrentUpdatePriority(TransitionLane);
    try {
        scope();  // 内部的 setState 会被标记为低优先级
    } finally {
        setCurrentUpdatePriority(prevPriority);
    }
}
```

当用户连续输入时，高优先级的输入更新会中断低优先级的搜索渲染，保证输入不卡顿。

## 七、React 19 新特性

### 1. React Server Components（RSC）

```tsx
// Server Component — 默认在服务端执行
// 文件顶部无需声明，默认就是 Server Component
async function BlogPost({ slug }) {
    // 可以直接访问数据库
    const post = await db.posts.findOne({ slug });

    return (
        <article>
            <h1>{post.title}</h1>
            <PostBody content={post.content} />
            {/* Client Component 需要标记 */}
            <LikeButton postId={post.id} />
        </article>
    );
}
```

```tsx
// Client Component — 显式标记 'use client'
'use client';

import { useState } from 'react';

export function LikeButton({ postId }) {
    const [liked, setLiked] = useState(false);
    return <button onClick={() => setLiked(!liked)}>{liked ? '❤️' : '🤍'}</button>;
}
```

**核心思想：** 组件可以在服务端执行，减少发送到客户端的 JavaScript 体积。Server Component 的代码永远不会出现在浏览器 bundle 中。

### 2. Actions

```tsx
// React 19：form 的 action 直接绑定为异步函数
function CreatePost() {
    async function handleSubmit(formData) {
        'use server';  // 标记为服务端执行
        const title = formData.get('title');
        await db.posts.create({ title });
    }

    return (
        <form action={handleSubmit}>
            <input name="title" />
            <button type="submit">发布</button>
        </form>
    );
}

// 配合 useActionState 管理状态
function CreatePost() {
    const [state, submitAction, isPending] = useActionState(
        async (prevState, formData) => {
            const title = formData.get('title');
            await db.posts.create({ title });
            return { success: true };
        },
        { success: false }
    );

    return (
        <form action={submitAction}>
            <input name="title" required />
            <button type="submit" disabled={isPending}>
                {isPending ? '发布中...' : '发布'}
            </button>
        </form>
    );
}
```

### 3. use() Hook

```tsx
import { use } from 'react';

// 读取 Promise（类似 await）
function UserProfile({ userPromise }) {
    const user = use(userPromise);
    return <div>{user.name}</div>;
}

// 读取 Context（替代 useContext）
function ThemedButton() {
    const theme = use(ThemeContext);
    return <button style={{ background: theme.primary }}>Click</button>;
}
```

### 4. useOptimistic

```tsx
function LikeButton({ postId, initialLiked }) {
    const [liked, setLiked] = useState(initialLiked);
    const [optimisticLiked, addOptimistic] = useOptimistic(liked);

    async function toggleLike() {
        addOptimistic(!liked);  // 立即更新 UI（乐观更新）
        await api.toggleLike(postId);  // 异步请求
        setLiked(!liked);  // 确认后更新真实状态
    }

    return (
        <button onClick={toggleLike}>
            {optimisticLiked ? '❤️' : '🤍'}
        </button>
    );
}
```

### 5. React Compiler（React 编译器）

```tsx
// React 19 之前：手动 useMemo / useCallback
function SearchResults({ query, data }) {
    const filtered = useMemo(() => {
        return data.filter(item => item.name.includes(query));
    }, [query, data]);

    const handleClick = useCallback((id) => {
        console.log(id);
    }, []);

    return <List items={filtered} onClick={handleClick} />;
}

// React 19 + Compiler：自动记忆化，无需手动优化
function SearchResults({ query, data }) {
    // Compiler 自动分析依赖，自动插入 memoization
    const filtered = data.filter(item => item.name.includes(query));
    return <List items={filtered} />;
}
```

## 八、源码目录结构

```
react/packages/
├── react/                    # React 核心包
│   ├── src/
│   │   ├── React.js          # 导出 createElement、Component 等
│   │   ├── ReactHooks.js     # Hooks 实现（代理到 reconciler）
│   │   └── ReactChildren.js  # Children API
│
├── react-reconciler/         # 调和器（核心）
│   ├── src/
│   │   ├── ReactFiber.js             # Fiber 节点创建
│   │   ├── ReactFiberWorkLoop.js     # 工作循环（调度核心）
│   │   ├── ReactFiberBeginWork.js    # render 阶段：处理组件
│   │   ├── ReactFiberCompleteWork.js # render 阶段：完成处理
│   │   ├── ReactFiberCommitWork.js   # commit 阶段：执行副作用
│   │   ├── ReactFiberHooks.js        # Hooks 实现
│   │   ├── ReactFiberLane.js         # 优先级系统
│   │   └── ReactFiberReconciler.js   # 入口：scheduleUpdateOnFiber
│
├── react-dom/                # DOM 渲染器
│   ├── src/
│   │   ├── client/ReactDOM.js        # 客户端 API（createRoot）
│   │   ├── ReactDOMHostConfig.js     # 宿主配置（DOM 操作）
│   │   └── events/                   # 事件系统（合成事件）
│
└── scheduler/                # 调度器
    └── src/
        ├── Scheduler.js              # 调度核心（优先级队列）
        └── SchedulerMinHeap.js       # 最小堆
```

## 九、渲染两阶段

```
┌─────────────────────────────────────────────────┐
│  Render 阶段（可中断）                           │
│  - 构建 Fiber 树                                │
│  - 执行组件函数                                  │
│  - Diff 算法计算差异                             │
│  - 收集副作用 flags                             │
│  - 可被高优先级任务中断                           │
│  - 纯计算，无 DOM 操作                           │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Commit 阶段（不可中断）                         │
│  - 遍历 Fiber 树执行副作用                       │
│  - 操作真实 DOM（插入/更新/删除）                 │
│  - 执行 useEffect / useLayoutEffect             │
│  - 调用 ref 回调                                 │
│  - 同步执行，不可中断                             │
└─────────────────────────────────────────────────┘
```

```javascript
// commitWork 的三个子阶段
function commitRoot(root) {
    // 阶段 1：Before Mutation
    // - 读取 getSnapshotBeforeUpdate
    // - 调度 useEffect（异步）
    commitBeforeMutationEffects(root);

    // 阶段 2：Mutation（DOM 操作）
    // - 插入/更新/删除节点
    // - 执行 ref cleanup
    commitMutationEffects(root);

    // 切换 current 树（双缓冲）
    root.current = finishedWork;

    // 阶段 3：Layout
    // - 执行 useLayoutEffect
    // - 调用 ref 回调
    // - 触发 useEffect（异步通过 MessageChannel）
    commitLayoutEffects(root);
}
```

## 总结

React 的核心架构可以概括为：

```
调度（Scheduler）→ 协调（Reconciler）→ 渲染（Renderer）
  优先级管理        Fiber 树构建         具体平台更新
  时间切片          Diff 算法           DOM / Native
```

**React 16 — Fiber** 解决了渲染可中断的问题；**React 16.8 — Hooks** 让函数组件拥有完整能力；**React 18 — 并发模式** 实现了优先级调度；**React 19 — Server Components** 将组件执行延伸到服务端。

理解 React 源码的关键入口：

1. `ReactFiberWorkLoop.js` — 调度核心，理解 workLoop
2. `ReactFiberBeginWork.js` — render 阶段，理解组件处理
3. `ReactFiberHooks.js` — Hooks 实现，理解链表与闭包
4. `ReactFiberCommitWork.js` — commit 阶段，理解副作用执行
