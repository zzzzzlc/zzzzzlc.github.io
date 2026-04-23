---
title: "React 源码解读：核心设计、发展历程与新特性演进"
date: "2026-04-23"
tags: ["React", "源码", "框架原理", "前端"]
category: "技术"
summary: "从 React 的设计理念出发，梳理其发展历程与架构演进，深入解读 Fiber 架构、调和算法、Hooks 实现、并发模式等核心源码设计，并分析 React 19 的重大变化。"
---

# React 源码解读：核心设计、发展历程与新特性演进

React 不只是一个 UI 库，其背后的设计思想深刻影响了整个前端生态。本文将从源码层面解析 React 的核心架构。

## 一、React 发展历程

### 1. 版本演进

| 版本 | 年份 | 里程碑 |
|------|------|--------|
| React 0.3 | 2013 | 首次开源，引入 JSX、Virtual DOM |
| React 0.14 | 2015 | 拆分 React 和 ReactDOM |
| React 15 | 2016 | 增加 PureComponent，错误边界 |
| React 16 | 2017 | **Fiber 架构**重写，Error Boundaries，Portals |
| React 16.8 | 2019 | **Hooks** 诞生，函数组件成为一等公民 |
| React 17 | 2020 | 事件委托改为根节点，渐进升级基础 |
| React 18 | 2022 | **并发渲染**，Automatic Batching，Suspense 正式版 |
| React 19 | 2024 | Server Components，Actions，use() Hook |

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
// Fiber 节点结构（简化）
const fiber = {
    // 静态结构
    tag: FunctionComponent,     // 组件类型
    type: App,                   // 组件函数/类
    key: null,

    // 树结构（链表）
    return: parentFiber,         // 父节点
    child: firstChildFiber,      // 第一个子节点
    sibling: nextFiber,          // 下一个兄弟节点
    index: 0,                    // 在兄弟中的索引

    // 工作单元
    pendingProps: {},            // 待处理 props
    memoizedProps: {},           // 上次渲染的 props
    memoizedState: {},           // 上次渲染的 state（Hooks 链表）
    updateQueue: null,           // 更新队列

    // 副作用
    flags: Placement,            // 需要执行的操作（插入/更新/删除）
    deletions: [],               // 需要删除的子节点

    // 双缓冲
    alternate: currentFiber,     // 指向另一棵树的对应节点
};
```

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
