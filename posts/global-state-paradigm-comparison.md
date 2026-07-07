---
title: 前端全局状态库方案对比——从范式到选型
date: '2026-06-18'
tags:
  - 状态管理
  - 前端架构
  - React
  - Vue
category: 前端工程
summary: >-
  以"架构范式"为主线，对比 Flux（Redux/Pinia）、Atomic（Jotai/Recoil）、Proxy（Valtio/MobX）、Signal（Solid/Vue/MobX）、状态机（XState）、外部派生（Legend-State）六大流派，剖析各自心智模型、优缺点、适配场景与局限性，给出选型决策框架。
---

# 前端全局状态库方案对比——从范式到选型

## 一、问题来源：为什么要再写一篇对比

社区的状态库文章多按"库名"罗列（Redux、Zustand、Jotai、Valtio、MobX），但**真正的选型决策不在于"用哪个库"，而在于"用哪种范式"**：

**当前痛点：**

- **范式混用风险**：Redux 的"中心 Store"思维、Jotai 的"原子图"思维、MobX 的"响应式 Proxy"思维——三者根本不能在一个项目里随意混搭
- **新库不断涌现**：Pinia 接管 Vuex、Signal 进 React（use() / External Store）、Legend-State 主打"性能优先"，旧的选型文章已经覆盖不全
- **框架耦合**：Vue 用 Pinia 是默认选择，React 用 Redux Toolkit 是惯例，跨框架团队无法共用一套心智
- **"全局状态"边界模糊**：UI 状态、服务端状态、URL 状态、派生状态——很多人把所有东西塞进状态库，反而越用越乱

**核心问题：脱离范式谈选型是耍流氓。本文按"架构范式"组织，让你理解每种方案的"思维模型"，再决定具体库。**

> 上一篇《前端状态库对比与源码解析》聚焦五大主流库的源码；本文聚焦"范式 + 全景"，二者互补阅读。

---

## 二、范式全景——六大流派

| 范式 | 心智模型 | 代表库 | 框架 |
|---|---|---|---|
| **Flux / 单向流** | 中心 Store + Action + Reducer | Redux Toolkit, Pinia, Zustand | React/Vue |
| **Atomic / 原子化** | 状态拆成原子 + 依赖图 | Jotai, Recoil | React |
| **Proxy / 代理响应式** | 直接修改对象 + 自动追踪 | Valtio, MobX, Vue Reactivity | React/Vue |
| **Signal / 信号** | 细粒度响应式 + 无 VDOM diff | Solid, Vue 3, MobX, Preact Signals | 跨框架 |
| **状态机 / FSM** | 显式状态 + 转换图 | XState, Robot | 跨框架 |
| **派生优先 / 性能优先** | 派生是核心 + 不可变 + 结构共享 | Legend-State, Immer 配合方案 | React |

下面逐个剖析。

---

## 三、Flux / 单向流——Redux、Pinia、Zustand

### 3.1 心智模型

```
View  --dispatch-->  Action  -->  Reducer  -->  Store  -->  View
```

三个原则：**单一 Store、状态只读、纯函数修改**。

### 3.2 三库差异

| 维度 | Redux Toolkit | Pinia | Zustand |
|---|---|---|---|
| 框架 | React | Vue（官方推荐） | React（无依赖） |
| Store | 全局单 Store | 多 Store（按模块拆） | 多 Store |
| 异步 | `createAsyncThunk` | 直接在 action 中 `await` | 直接在 set 中 `async` |
| 不可变 | Immer 内置 | Vue 响应式（可变） | 手动或 Immer |
| DevTools | 最强（时间旅行） | Vue DevTools 集成 | 简易 |
| 体积（gz） | ~12KB | ~3KB | ~1KB |

### 3.3 代码对比

```typescript
// Redux Toolkit
const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action) => { state.info = action.payload; },
    },
});

// Pinia（Vue 官方）
export const useUserStore = defineStore('user', {
    state: () => ({ info: null }),
    actions: {
        setUser(info) { this.info = info; },
    },
});

// Zustand
const useUser = create((set) => ({
    info: null,
    setUser: (info) => set({ info }),
}));
```

### 3.4 优缺点

**优点**：心智统一、可调试性强、生态成熟、SSR 友好。

**缺点**：boilerplate（RTK 改善但仍存在）、对小项目重、不可变更新的写法有时别扭。

---

## 四、Atomic / 原子化——Jotai、Recoil

### 4.1 心智模型

把状态拆成最小粒度（atom），用图表达原子之间的依赖，**组件只订阅用到的原子**，自然精确更新。

```
atom A --> atom B (derived) --> Component
atom A --> atom C (derived) --> Component
```

B 变了，订阅 C 的组件不重新渲染。

### 4.2 代码示例

```typescript
// Jotai
const nameAtom = atom('Alice');
const upperAtom = atom((get) => get(nameAtom).toUpperCase());

function Comp() {
    const [name, setName] = useAtom(nameAtom);
    const upper = useAtomValue(upperAtom);
    return <input value={name} onChange={e => setName(e.target.value)} />{upper};
}
```

### 4.3 Jotai vs Recoil

| 维度 | Jotai | Recoil |
|---|---|---|
| 维护 | 活跃 | Meta 内部维护，外部更新慢 |
| API | 简洁，hook 友好 | selector 模型 |
| 生态 | 与 React Suspense 深度整合 | 实验性 |
| 现状 | **主流选择** | 渐淡出 |

### 4.4 优缺点

**优点**：天然精确订阅、代码组织灵活、不需要"模块"概念、适合组件库。

**缺点**：状态分散难调试、依赖图复杂时性能不可控、跨原子事务弱、心智"反 OOP"。

---

## 五、Proxy / 代理响应式——Valtio、MobX、Vue Reactivity

### 5.1 心智模型

直接 `state.user.name = 'X'`，Proxy 自动追踪依赖、触发更新。**"像写普通对象一样管理状态"**。

### 5.2 代码示例

```typescript
// Valtio
const state = proxy({ user: { name: 'Alice' }, list: [] });
state.user.name = 'Bob'; // 触发更新

// MobX（装饰器风格）
class Store {
    @observable name = 'Alice';
    @action setName(n) { this.name = n; }
}

// Vue Composition API
const count = ref(0);
count.value++; // 响应式
```

### 5.3 三者差异

| 维度 | Valtio | MobX | Vue Reactivity |
|---|---|---|---|
| 框架 | React | React/Vue | Vue 内置 |
| API | 极简 | 装饰器 + class | ref / reactive |
| 心智 | 透明 Proxy | OOP 风格 | 内建于框架 |
| 适合 | React 中的可变写法 | 复杂业务建模 | Vue 项目 |

### 5.4 优缺点

**优点**：写法直观、高频更新性能好（无不可变开销）、OOP 友好（MobX）。

**缺点**：可变性带来心智负担（异步修改顺序）、调试工具不如 Redux 强、与 React 不可变思维冲突（Valtio）、容易"魔法太多"。

---

## 六、Signal / 信号——细粒度响应式

### 6.1 心智模型

Signal 是"细粒度响应式 + 绕过 VDOM diff"。状态变化直接定位到 DOM 节点更新，无需组件重渲染。

```
state 变化  -->  Signal 通知  -->  精确 DOM 更新（不经过组件）
```

### 6.2 各框架现状

| 框架 | Signal 状态 |
|---|---|
| **SolidJS** | 原生 Signal，无 VDOM，性能极强 |
| **Vue 3** | ref / computed 即 Signal，但仍在 VDOM 内 |
| **MobX** | React 用 `observer` 包裹模拟 Signal 效果 |
| **Preact / Angular** | 都有官方 Signal 实现 |
| **React** | 不原生支持；`useSyncExternalStore` + 第三方（@preact/signals-react）|

### 6.3 代码示例（Solid）

```typescript
function Counter() {
    const [count, setCount] = createSignal(0);
    return <button onClick={() => setCount(c => c + 1)}>{count()}</button>;
}
// 点击时，只有 button 文本节点更新，组件函数不再执行
```

### 6.4 优缺点

**优点**：极致性能、无 manual memo、心智简单（"读写"两件事）。

**缺点**：React 生态不原生支持（与 hooks 模型冲突）、跨组件传递需谨慎、Signal 嵌套深时调试难。

### 6.5 React 中的妥协

```typescript
// useSyncExternalStore 让 React 桥接外部 store（Signal 友好）
import { useSyncExternalStore } from 'react';
```

React 19 的 `use()` hook 让 Promise/Context 解锁，但 **Signal 进 React 仍是"二等公民"**——核心原因是 React 的"渲染时"模型与 Signal 的"订阅时"模型根本不兼容。

---

## 七、状态机 / FSM——XState

### 7.1 心智模型

显式建模"状态 + 转换 + 副作用"，**状态不再是 `loading: true/false` 这种布尔标志，而是结构化的有限状态机**。

```
idle --FETCH--> loading --SUCCESS--> success
                          --ERROR--> error --RETRY--> loading
```

### 7.2 代码示例

```typescript
import { createMachine, interpret } from 'xstate';

const fetchMachine = createMachine({
    id: 'fetch',
    initial: 'idle',
    states: {
        idle: { on: { FETCH: 'loading' } },
        loading: {
            invoke: { src: 'fetchData', onDone: 'success', onError: 'error' },
        },
        success: { type: 'final' },
        error: { on: { RETRY: 'loading' } },
    },
});
```

### 7.3 优缺点

**优点**：状态可可视化、不可能进入非法状态、复杂业务（多步表单、向导、媒体播放器）的可维护性极强、易测试。

**缺点**：学习曲线陡（statechart 理论）、对简单 CRUD 过度、API 较重（XState 5 改进）。

### 7.4 何时该用 XState

```
适合：
- 多步流程（结账、向导、引导）
- 复杂状态切换（视频播放器、编辑器）
- 状态间约束严格（订单生命周期）
- 需要可视化 / 长期维护 / 跨端复用

不适合：
- 简单 CRUD（loading + data + error 三标志足够）
- UI 局部状态
- 团队不熟 statechart
```

---

## 八、派生 / 性能优先——Legend-State

### 8.1 心智模型

把"派生"和"不可变"做到极致，针对大规模状态（百万级节点）优化，号称比其他库快 5-10 倍。

### 8.2 代码示例

```typescript
import { observable } from '@legendapp/state';

const state = observable({ user: { name: 'Alice' } });
state.user.name.set('Bob'); // set API
const name = state.user.name.get(); // get
```

### 8.3 优缺点

**优点**：极致性能、自动追踪、按需更新、SSR 友好、内置持久化。

**缺点**：API 较特殊（`.get()` / `.set()`）、生态小、心智需适应、调试工具弱。

### 8.4 适配场景

- 状态规模大（万级节点）
- 高频更新场景（实时协作、大屏）
- 团队接受新 API 心智

---

## 九、范式横向对比——一张表选型

| 范式 | 代表库 | 写法 | 性能 | 学习成本 | 调试性 | SSR | 适配 |
|---|---|---|---|---|---|---|---|
| Flux | Redux Toolkit / Pinia / Zustand | 不可变 + 纯函数 | 中 | 中 | ★★★★★ | ★★★★ | 大型 / 团队 |
| Atomic | Jotai / Recoil | 原子 + 派生 | 高（精确） | 中 | ★★★ | ★★★ | 高解耦 / 组件库 |
| Proxy | Valtio / MobX / Vue | 直接修改 | 高 | 低 | ★★★ | ★★★ | 高频更新 / Vue |
| Signal | Solid / Preact Signals | 细粒度响应 | 极高 | 低 | ★★★ | ★★ | Solid / 跨框架 |
| FSM | XState | 状态机 | 中 | 高 | ★★★★★ | ★★★★ | 复杂业务流程 |
| 派生优先 | Legend-State | observable + get/set | 极高 | 中 | ★★ | ★★★★ | 大规模 / 高性能 |

---

## 十、优缺点综合（按维度）

### 10.1 心智模型可读性

```
直观度排序（从直观到抽象）：
Valtio > Zustand > Pinia > Legend-State > Jotai > MobX > Redux > XState
```

### 10.2 性能

```
高频局部更新排序：
Solid Signal > Legend-State > Valtio/MobX > Jotai > Zustand > Redux
```

### 10.3 调试能力

```
DevTools 排序：
Redux Toolkit > XState > Pinia > Zustand > MobX > Jotai > Valtio > Legend-State
```

### 10.4 生态成熟度

```
Redux > Pinia > Zustand > MobX > Jotai > XState > Valtio > Legend-State
```

---

## 十一、适配场景（决策树）

```
场景一：Vue 项目
├── 默认：Pinia（官方）
└── 理由：与 Vue Composition API 一体，DevTools 集成

场景二：React 大型项目（团队 5+）
├── 默认：Redux Toolkit
└── 理由：规范统一，调试工具强，生态成熟

场景三：React 中小型项目
├── 默认：Zustand
└── 理由：1KB，覆盖 80% 场景

场景四：高度解耦组件库 / 插件系统
├── 默认：Jotai
└── 理由：原子化，按需引入，无全局 Store

场景五：高频更新（画布 / 拖拽 / 实时协作）
├── React：Valtio 或 Legend-State
├── Vue：原生 reactive
└── 新项目：SolidJS

场景六：复杂业务流程（订单 / 多步表单 / 媒体）
├── 推荐：XState
└── 理由：状态机显式建模，可可视化

场景七：超大状态规模（10w+ 节点）
├── 推荐：Legend-State
└── 理由：性能优先

场景八：服务端数据（列表 / 详情 / 分页）
├── 推荐：React Query / SWR / TanStack Query（不要用状态库）
└── 理由：缓存与失效是数据层职责

场景九：跨端 / 跨框架状态
├── 推荐：XState（框架无关）或 Signal 系
└── 理由：范式脱离框架
```

---

## 十二、不该做的事

```
反模式 1：把所有状态都塞全局
- UI 状态（弹窗开关、选中行）也放全局
- 结果：Store 膨胀，组件失去独立性
- 正确：UI 用 useState，共享才放全局

反模式 2：服务端状态用全局状态库
- 用 Redux 管理 list/detail/cache/loading
- 结果：手写重复逻辑，缓存策略差
- 正确：用 React Query / TanStack Query

反模式 3：一个项目混多种范式
- Redux 管用户 + Zustand 管表单 + Jotai 管主题
- 结果：心智三倍，调试地狱
- 正确：选一种主范式，简单场景用 useState 补充

反模式 4：用 Valtio / BehaviorSubject 当状态库
- 现象：写一个 proxy 全局变量
- 问题：无 DevTools / 时间旅行 / 持久化
- 正确：用 Zustand / Pinia

反模式 5：盲目追新
- 每个新库都迁移一次
- 正确：选一种合适的，坚持用，痛点出现再换

反模式 6：把简单布尔标志做成 XState
- 只有 loading 状态用状态机
- 结果：5 行代码写成 50 行
- 正确：FSM 适合多状态 + 多转换 + 约束严格
```

---

## 十三、局限性

1. **没有银弹**：每种范式都有不适用的场景，理解范式比记 API 重要
2. **跨框架范式难复用**：Vue 的 Pinia 心智搬到 React 不自然，反之亦然
3. **Signal 在 React 是二等公民**：受 React 渲染时模型限制
4. **Atomic 范式调试弱**：依赖图复杂时性能与可观测性下降
5. **状态机过度用**：简单 CRUD 上 XState 是负担
6. **新库生态风险**：Legend-State 等"性能优先"新库生态未成熟

---

## 十四、决策框架（三步选型）

### Step 1：先问"是不是状态库的职责"

```
是服务端状态？  → React Query / SWR（不是状态库）
是 URL 状态？   → useSearchParams / 路由
是 UI 状态？    → useState / useReducer
是真正全局？    → 继续下一步
```

### Step 2：按框架 + 团队规模初选

```
Vue 项目      → Pinia（几乎无可争议）
React 中小项目 → Zustand
React 大型团队 → Redux Toolkit
跨框架         → XState 或 Signal 系
```

### Step 3：按业务特性微调

```
高频更新 / 大屏 / 画布    → Proxy 或 Signal 系（Valtio / Legend-State）
复杂流程 / 订单 / 媒体    → XState
高度解耦组件库           → Jotai
性能极致                → Solid + Signal
```

---

## 十五、总结

### 一句话选型

| 场景 | 选择 |
|---|---|
| Vue 默认 | **Pinia** |
| React 默认 | **Zustand** |
| React 大型 / 团队规范 | **Redux Toolkit** |
| 高频 / 高性能 | **Valtio / Legend-State / Solid** |
| 复杂业务流程 | **XState** |
| 服务端数据 | **React Query / TanStack Query**（不是状态库） |
| 组件库 / 插件 | **Jotai** |

### 范式本质

```
Flux    ：中心 Store + 不可变 + 纯函数
Atomic  ：拆成原子 + 依赖图 + 精确订阅
Proxy   ：可变 + 自动追踪 + 直接修改
Signal  ：细粒度响应 + 绕过 VDOM
FSM     ：显式状态 + 转换图 + 不可能非法
派生优先：observable + 自动追踪 + 性能优先
```

### 核心原则

1. **范式 > 库**：先决定思维模型，再选具体实现
2. **职责分明**：服务端状态用 React Query，UI 状态用 useState，全局才用状态库
3. **不混范式**：一个项目一个主范式
4. **不过度用**：简单场景不上 XState / Legend-State
5. **看框架**：Vue 选 Pinia，React 在 Zustand / RTK / Jotai 间挑

理解范式的本质后，你就能在新库涌现时**不被 API 表象迷惑**，迅速归类、判断适配场景——这才是"精通状态管理"的真正标志。
