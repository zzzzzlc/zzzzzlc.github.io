---
title: React 进阶
date: '2025-08-29'
tags:
  - React
  - 前端
  - 性能优化
  - Hooks
  - 组件设计
category: 技术
summary: >-
  从 React 的设计理念出发，深入解读 Fiber 架构、调和算法、Hooks 实现、并发模式等核心源码设计，并延伸到工程实践进阶——性能优化（重渲染治理、虚拟列表、并发降级）、高阶组件（HOC 与 Hooks/Render
  Props 对比）、组件封装（受控模式、复合组件、Headless UI）、自定义 Hooks 设计，覆盖问题来源、多方案对比、优缺点、适配场景与局限性。
---
# React 进阶

React 不只是一个 UI 库，其背后的设计思想深刻影响了整个前端生态。本文既从源码层面解析 React 的核心架构（Fiber、调和算法、Hooks、并发模式、React 19），也延伸到日常工程的进阶实践——性能优化、高阶组件、组件封装、自定义 Hooks，把底层原理与上层用法打通。

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

## 十、React 性能优化

### 1. 问题来源

随着应用规模增长，最常遇到的性能问题几乎都指向一个字——**重渲染**。输入框打字卡顿、切 tab 闪屏、长列表滚动掉帧，根因往往是"渲染了不该渲染的组件"或"一次渲染做了太多事"。所以性能优化的第一步永远是**度量**，而不是凭感觉加 memo。

```
React DevTools Profiler → 录制一次交互 → 看哪条 commit 耗时长、哪些组件本不该渲染
why-did-you-render      → 开发期打印"本不该重渲染却重渲染了"的组件
Chrome Performance      → 看主线程 long task、火焰图定位瓶颈
```

**铁律：** 没有数据支撑的 memo / useCallback 都是玄学。先 Profiler 定位，再针对性优化。

### 2. 减少不必要的重渲染（核心）

父组件重渲染时，所有子组件默认都会重渲染——即使它的 props 没变。治理方式主要有三种，按场景选用：

```jsx
// 方案 A：React.memo —— 包裹整个组件，对 props 做浅比较
const ExpensiveList = React.memo(function List({ items, onClick }) {
    return items.map(item => (
        <div key={item.id} onClick={() => onClick(item)}>{item.name}</div>
    ));
});
// 仅当 props 浅比较发生变化时才重渲染

// 方案 B：useMemo / useCallback —— 稳定传给子组件的对象/函数引用
function Parent() {
    const items = useMemo(() => heavyCompute(), [deps]);        // 稳定数组引用
    const handleClick = useCallback((item) => { /* ... */ }, []); // 稳定函数引用
    return <ExpensiveList items={items} onClick={handleClick} />;
}

// 方案 C：PureComponent / shouldComponentUpdate —— 类组件时代的方案
class List extends React.PureComponent { /* 浅比较 props + state */ }
```

| 方案 | 适用 | 原理 | 局限 |
|------|------|------|------|
| `React.memo` | 函数组件整体跳过 | 浅比较 props | 内联对象/函数会使其失效 |
| `useMemo/useCallback` | 稳定引用传给子组件 | 缓存值/函数 | 依赖数组写错 → 闭包陷阱 |
| `PureComponent` | 类组件 | 浅比较 props+state | 函数组件用不了 |

**关键陷阱：** memo 失效几乎都是引用相等问题——`style={{ color: 'red' }}`、`onClick={() => ...}` 每次 render 都是新引用，浅比较必不相等（见 5.2 fiber 的 `memoizedProps`）。要么把 memo 组件当"昂贵资源"对待（每个 prop 都稳定），要么干脆别 memo。

### 3. 状态下移与就近放置（state collocation）

```jsx
// ❌ 父组件持有输入框文本，每次按键整棵树重渲染
function Page() {
    const [keyword, setKeyword] = useState('');
    return (
        <>
            <SearchInput value={keyword} onChange={setKeyword} />
            <ExpensiveChart />   {/* 跟着输入一起重渲染，毫无必要 */}
        </>
    );
}

// ✅ 把状态下沉到真正需要它的组件内部
function Page() {
    return (
        <>
            <SearchInput />      {/* 文本状态自己管 */}
            <ExpensiveChart />   {/* 不再受输入影响 */}
        </>
    );
}
```

**这是性价比最高的优化**——一行 memo 都不用写，只靠"状态该放哪放哪"就能消除大半无谓的重渲染。

### 4. 长列表：虚拟化

DOM 节点超过几百个，浏览器的布局/绘制成本骤增。无论怎么 memo 都救不了"节点数本身太多"。

```jsx
// react-window：只渲染视口内的几行
import { FixedSizeList as List } from 'react-window';

<List height={600} itemCount={100000} itemSize={40} width="100%">
    {({ index, style }) => <div style={style}>{rows[index]}</div>}
</List>
// 10 万行也只渲染约 20 个真实 DOM 节点
```

| 库 | 体积 | 适用 | 备注 |
|----|------|------|------|
| `react-window` | 小 | 等高/等宽列表 | 首选，够轻 |
| `react-virtualized` | 大 | 不定高、表格、网格 | 功能全但偏重 |
| `@tanstack/react-virtual` | 中 | 通用、不定高、现代 | headless，最灵活 |

### 5. 并发模式：startTransition / useDeferredValue

把"可以慢一下"的重计算降级，让高优先级交互（输入、点击）不被阻塞（对应 fiber 的 `lanes`，见 5.6）：

```jsx
// 方案 A：startTransition —— 主动把某次 setState 降级
function onChange(e) {
    setKeyword(e.target.value);                             // 高优先级：输入框立即响应
    startTransition(() => setSearchResults(search(e.target.value))); // 低优先级
}

// 方案 B：useDeferredValue —— 声明式延迟一个值
const deferredKeyword = useDeferredValue(keyword);
<List query={deferredKeyword} />   // List 用延迟值渲染，输入框用即时值
```

两者等价不同形态：`startTransition` 作用于"触发更新的地方"，`useDeferredValue` 作用于"消费值的地方"。

### 6. 代码分割与懒加载

```jsx
const Chart = React.lazy(() => import('./Chart'));

<Suspense fallback={<Skeleton />}>
    <Chart />   {/* 首屏不加载，用到时才请求对应 chunk */}
</Suspense>
```

把首屏用不到的重组件拆成独立 chunk，直接降低 TTI（首屏可交互时间）。

### 7. React 19：让编译器替你 memo

```jsx
// React 19 + React Compiler：自动插入 useMemo/useCallback
function Search({ items, query }) {
    const filtered = items.filter(i => i.includes(query));   // 编译器自动记忆化
    return <List items={filtered} />;
}
```

**局限：** Compiler 仍是可选 opt-in，对副作用与外部可变状态有假设；它消除的是"手动 memo 的样板代码"，不是"所有性能问题"。

### 8. 性能优化的边界

- **过早优化是万恶之源**：memo/useCallback 本身有比较与缓存成本，对廉价组件加 memo 可能反而更慢。
- **Profiler 才是裁判**：体感卡 ≠ 真卡，务必量化后再下手。
- **架构 > 微优化**：状态下移、组件拆分、虚拟列表的收益，远大于盲目堆 memo。

## 十一、高阶组件（HOC）

### 1. 问题来源

多个组件需要复用同一段逻辑（权限校验、数据拉取、埋点、主题注入）。class 时代没有 Hooks，复用逻辑只能靠 HOC。理解 HOC 不仅是读懂老代码，更是理解"逻辑复用"的演进——为什么 Hooks 出现后 HOC 会逐渐退场。

### 2. HOC 是什么

**高阶组件是一个函数：接收一个组件，返回一个新组件。**

```jsx
// withAuth：给任意组件包一层"已登录才渲染"
function withAuth(WrappedComponent) {
    return function AuthWrapper(props) {
        const { user } = useContext(AuthContext);
        if (!user) return <Redirect to="/login" />;
        return <WrappedComponent {...props} user={user} />;
    };
}

const Dashboard = withAuth(DashboardInner);   // 使用：像普通组件一样渲染 <Dashboard />
```

### 3. 两种经典模式

```jsx
// 模式 A：Props Proxy（属性代理）—— 最常见
function withLogging(Wrapped) {
    return function (props) {
        useEffect(() => { console.log('mounted', Wrapped.name); }, []);
        return <Wrapped {...props} extra="注入的新 prop" />;
    };
}
// HOC 控制 props，可增 / 删 / 改传给被包裹组件的属性

// 模式 B：Inheritance Inversion（反向继承）—— 少用
function withEnhance(Wrapped) {
    return class extends Wrapped {
        render() {
            const tree = super.render();    // 拿到被包裹组件的渲染输出
            return injectProps(tree);       // 直接改渲染树
        }
    };
}
// 可拦截 / 替换渲染结果，但破坏封装、易出 bug，慎用
```

### 4. 三个经典坑

```jsx
// 坑 1：静态方法丢失 —— HOC 返回的是新组件，原组件的静态方法没了
WrappedComponent.staticMethod = () => {};
// ❌ withAuth(Component).staticMethod === undefined
// 解决：手动拷贝，或用 hoist-non-react-statics 库

// 坑 2：ref 传不到被包裹组件 —— ref 不是普通 prop
const ref = useRef();
const Enhanced = withAuth(Inner);
<Enhanced ref={ref} />;   // ❌ ref 指向 HOC 的 wrapper，不是 Inner
// 解决：用 forwardRef 透传；React 19 起 ref 可作普通 prop 直接传

// 坑 3：displayName 缺失 —— DevTools 里会显示一堆 <Anonymous>
AuthWrapper.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
```

### 5. 逻辑复用三方案对比（重点）

同一个"鼠标位置"逻辑，三种写法并存了多年：

```jsx
// HOC
const WithMouse = withMouse(Component);
// Render Props
<Mouse render={pos => <Component {...pos} />} />;
// Hook（推荐）
function Comp() {
    const { x, y } = useMouse();
    return <Component x={x} y={y} />;
}
```

| 维度 | HOC | Render Props | 自定义 Hook |
|------|-----|--------------|-------------|
| 写法 | `withX(Component)` | `<X render={x => ...} />` | `const x = useX()` |
| 嵌套 | 层层包裹（wrapper hell） | 回调嵌套 | 扁平 |
| 数据流向 | 隐式注入 props | 显式传参 | 显式返回值 |
| props 冲突 | 易冲突（HOC 注入的 props 名） | 无 | 无（不碰 props） |
| TypeScript | 类型推导困难 | 一般 | 友好 |
| 适用时代 | class 时代主流 | class/hooks 早期 | **现代主流** |

### 6. 适配场景与现状

- **仍用 HOC 的场景**：维护老代码、第三方库（Redux 的 `connect`、React Router 的 `withRouter`）、需要"装饰器式"统一包裹。
- **新代码**：优先用自定义 Hook。HOC 的"隐式 props 注入"在大型项目里是类型与可追溯性的灾难。
- **局限**：HOC 把"逻辑"和"组件实例"绑死，无法在组件内按需调用、无法灵活组合——这正是 Hooks 取代它的根本原因。

## 十二、组件封装的进阶

### 1. 问题来源

组件写得越多，越会撞上同一组问题：props 膨胀到二三十个、想加个功能就得改一堆地方、同一个组件在 A 场景能用 B 场景不能用、逻辑与样式耦合死。**封装的进阶，本质是设计"可复用、可组合、可扩展"的组件 API**。

### 2. 受控 vs 非受控

```jsx
// 受控：值由父组件完全控制
<Input value={value} onChange={setValue} />

// 非受控：值由组件内部自管，通过 ref 读取
<Input defaultValue="" ref={inputRef} />
```

**进阶：一个组件同时支持两种模式**（antd / Radix 都这么做）：

```jsx
function Input({ value, defaultValue, onChange }) {
    const [internal, setInternal] = useState(defaultValue);
    const isControlled = value !== undefined;              // 是否受控的判断依据
    const realValue = isControlled ? value : internal;
    const handleChange = (e) => {
        if (!isControlled) setInternal(e.target.value);    // 非受控才自更新
        onChange?.(e.target.value);
    };
    return <input value={realValue} onChange={handleChange} />;
}
// 父组件传 value → 受控；不传 → 非受控。灵活且符合直觉。
```

### 3. 复合组件（Compound Components）

像 `<select><option/></select>`、`<Tabs><Tabs.Tab/></Tabs>` 这种**一套组件协作完成一个功能**的模式：

```jsx
// 用法：调用方只负责组装，不关心状态怎么流转
<Tabs defaultActive="1">
    <Tabs.List>
        <Tabs.Tab id="1">详情</Tabs.Tab>
        <Tabs.Tab id="2">评论</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panels>
        <Tabs.Panel id="1">详情内容</Tabs.Panel>
        <Tabs.Panel id="2">评论内容</Tabs.Panel>
    </Tabs.Panels>
</Tabs>
```

实现靠 **Context 共享状态 + 子组件隐式订阅**：

```jsx
const TabsContext = createContext(null);

function Tabs({ defaultActive, children }) {
    const [active, setActive] = useState(defaultActive);
    return (
        <TabsContext.Provider value={{ active, setActive }}>
            {children}
        </TabsContext.Provider>
    );
}

Tabs.Tab = function Tab({ id, children }) {
    const { active, setActive } = useContext(TabsContext);
    return (
        <button onClick={() => setActive(id)} aria-selected={active === id}>
            {children}
        </button>
    );
};
```

**优点：** API 声明式、结构清晰、子组件的顺序与数量由调用方决定；**局限：** 子组件必须在 Provider 内、Context 变化会让所有订阅的子组件重渲染。

### 4. Headless UI / 逻辑与 UI 分离

把"行为逻辑"和"视觉样式"彻底拆开：组件暴露状态与方法，UI 由调用方自行绘制。这是当前最受推崇的模式（TanStack Table、Radix、Headless UI、dnd-kit 都走这条路）。

```jsx
// useTabs：只管逻辑，一个 JSX 都不返回
function useTabs({ defaultActive }) {
    const [active, setActive] = useState(defaultActive);
    const getTabProps = (id) => ({
        onClick: () => setActive(id),
        'aria-selected': active === id,
    });
    const getPanelProps = (id) => ({ hidden: active !== id });
    return { active, setActive, getTabProps, getPanelProps };
}

// 调用方：逻辑来自 hook，样式完全自定义
function MyTabs() {
    const { getTabProps, getPanelProps } = useTabs({ defaultActive: '1' });
    return (
        <>
            <button {...getTabProps('1')} className="my-btn">详情</button>
            <button {...getTabProps('2')} className="my-btn">评论</button>
            <div {...getPanelProps('1')}>详情内容</div>
            <div {...getPanelProps('2')}>评论内容</div>
        </>
    );
}
```

**对比复合组件：** Headless 比 Compound 更解耦——同一套逻辑能套上完全不同的 UI（A 团队用 antd 风格、B 团队用自定义风格），逻辑零改动。

### 5. 范式选型对比

| 范式 | 灵活性 | 学习成本 | 典型代表 | 适合场景 |
|------|--------|----------|----------|----------|
| 单大组件 + 一堆 props | 低 | 低 | 早期组件 | 简单、固定场景 |
| 受控 / 非受控双模式 | 中 | 中 | antd Form | 表单、需被外部调度 |
| 复合组件 | 中高 | 中 | antd Tabs/Select | 一套协作组件 |
| Render Props | 高 | 中高 | 早期 downshift | 动态渲染 |
| **Headless Hook** | **最高** | 高 | TanStack / Radix | **逻辑复用 + UI 定制** |

### 6. 封装的原则与局限

- **稳定 API、内部可变**：对外 props 一旦发布尽量不破坏，内部实现随便重构。
- **合理默认 + 可覆盖**：80% 场景开箱即用，20% 场景能通过 props / classNames 覆盖。
- **组合优于配置**：与其一个组件 50 个 props，不如拆成几个可组合的小组件 / hook。
- **局限**：过度抽象比不抽象更糟——只为"将来可能"的复用做 Headless，会让简单组件变得难用。

## 十三、自定义 Hooks

### 1. 问题来源

组件里反复出现的逻辑（防抖、请求、监听、持久化）、散落在各处的副作用、难以单测的副作用——自定义 Hook 是 React 官方推荐的逻辑复用单元，也是前面 HOC / Render Props 的现代替代品。

### 2. 定义与规则

自定义 Hook 是**以 `use` 开头、内部可调用其他 Hook 的普通函数**。它必须遵守 Hooks 规则（顶层调用、不能放条件里）——因为本质就是在组件里执行，借用的是 React 的 Hooks 链表（见第五章）。

### 3. 经典实现

```jsx
// useDebounce：值变化后延迟 N ms 才生效
function useDebounce(value, delay = 300) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);    // 每次重新计时，cleanup 是关键
    }, [value, delay]);
    return debounced;
}

// useLocalStorage：带持久化的状态
function useLocalStorage(key, initial) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : initial;
        } catch {
            return initial;
        }
    });
    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);
    return [value, setValue];
}

// useEventListener：自动绑定 + 卸载清理（防内存泄漏）
function useEventListener(type, handler, el = window) {
    const saved = useRef(handler);
    useEffect(() => { saved.current = handler; });      // 始终持有最新 handler
    useEffect(() => {
        const listener = (e) => saved.current(e);
        el.addEventListener(type, listener);
        return () => el.removeEventListener(type, listener);
    }, [type, el]);
}

// useFetch：数据请求的 loading / error / data 三态
function useFetch(url) {
    const [state, setState] = useState({ data: null, loading: true, error: null });
    useEffect(() => {
        let cancelled = false;                          // 防竞态：卸载 / URL 变了就别再 setState
        setState((s) => ({ ...s, loading: true, error: null }));
        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (!cancelled) setState({ data, loading: false, error: null });
            })
            .catch((error) => {
                if (!cancelled) setState((s) => ({ ...s, loading: false, error }));
            });
        return () => { cancelled = true; };
    }, [url]);
    return state;
}

// usePrevious：拿到上一次 render 的值
function usePrevious(value) {
    const ref = useRef();
    useEffect(() => { ref.current = value; });          // render 后才更新 → 下次返回的是"上一次"
    return ref.current;
}
```

### 4. 设计原则

- **单一职责**：一个 hook 只解决一类问题，`useFetch` 别顺带管表单。
- **返回值形态**：值少用数组（`const [v, setV] = useState`）、值多用对象（`const { data, loading, error } = useFetch`），便于解构扩展。
- **依赖要诚实**：`useEffect` 依赖数组必须写全，否则闭包陷阱；不确定就上 `eslint-plugin-react-hooks`。
- **SSR 兼容**：涉及 `window` / `document` / `localStorage` 的，首次渲染在服务端会报错，需判 `typeof window !== 'undefined'` 或把副作用放进 effect。

### 5. 复用方案对比（呼应第十一章）

自定义 Hook 相对 HOC 的根本优势：**逻辑可在组件内任意位置、按任意顺序、任意次组合调用**，而 HOC 是组件级包裹、只能整提整包。

```jsx
// 多个逻辑能自然组合 —— HOC 做不到这么干净
function Page() {
    const { user } = useAuth();
    const debouncedKey = useDebounce(keyword);
    const { data } = useFetch(`/api?q=${debouncedKey}`);
    useEventListener('keydown', onKey);
    // ...
}
```

### 6. 局限与反模式

- **过度抽象**：只在一处用到的逻辑提成 hook 反而增加跳转成本，"规则三"（出现三次再抽象）同样适用。
- **闭包陷阱**：依赖数组漏写，handler 捕获的是旧 state（上面 `useEventListener` 用 `useRef` 规避）。
- **不是万能**：纯 UI 展示逻辑、与 React 状态无关的工具函数，放 `utils` 普通函数即可，不必强行 `use`。

### 7. 成熟生态

- **ahooks**（阿里）：300+ 常用 hook，中文友好，业务覆盖最全。
- **react-use**：社区老牌，覆盖广。
- **@tanstack/react-query / swr**：服务端状态（请求、缓存、重试）的工业级方案——这种场景别自己写 `useFetch`，直接用它们。

## 总结

React 进阶可以分两层来理解——**底层原理**决定它为什么这么设计，**工程实践**决定你怎么把它用好。

```
【底层原理】 调度（Scheduler）→ 协调（Reconciler）→ 渲染（Renderer）
  · Fiber 让渲染可中断、可恢复，是并发的基石
  · Diff 三假设把复杂度压到 O(n)
  · Hooks 链表决定了"必须在顶层按顺序调用"
  · Lane 模型 + 时间切片实现了优先级调度

【工程实践】 把原理落到日常
  · 性能优化：先 Profiler 度量，再做重渲染治理（memo / 状态下移）、长列表虚拟化、并发降级
  · 高阶组件：理解其历史价值与三方案对比，新代码优先 Hook
  · 组件封装：受控 / 非受控、复合组件、Headless，按可复用性选型
  · 自定义 Hooks：现代逻辑复用的标准答案，注意闭包与依赖
```

**版本里程碑：** React 16 — Fiber 解决渲染可中断；React 16.8 — Hooks 让函数组件拥有完整能力；React 18 — 并发模式实现优先级调度；React 19 — Server Components 与 React Compiler 将组件执行延伸到服务端、把记忆化交给编译器。

理解 React 的关键入口：

1. `ReactFiberWorkLoop.js` — 调度核心，理解 workLoop
2. `ReactFiberBeginWork.js` — render 阶段，理解组件处理
3. `ReactFiberHooks.js` — Hooks 实现，理解链表与闭包
4. `ReactFiberCommitWork.js` — commit 阶段，理解副作用执行
5. 业务实践入口 — React DevTools Profiler（性能）、ahooks / Radix（组件与 Hook 范式）
