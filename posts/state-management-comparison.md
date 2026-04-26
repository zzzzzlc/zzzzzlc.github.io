---
title: "前端状态库对比与源码解析"
date: "2026-04-26"
tags:
  - React
  - 状态管理
  - Redux
  - Zustand
  - Jotai
  - Valtio
  - MobX
  - 源码解析
category: "前端工程"
summary: "从 React 状态管理的痛点出发，对比 Redux Toolkit、Zustand、Jotai、Valtio、MobX 五大状态库的核心原理与适用场景，深入解析每个库的源码实现（发布订阅、不可变更新、原子化、代理响应式），给出选型建议与边界。"
---

# 前端状态库对比与源码解析

## 一、问题来源

React 组件的状态管理是一个"看似简单实则复杂"的问题：

**基础痛点：**

- `useState` 只能在组件内使用，跨组件共享需要层层 Props 传递（Prop Drilling）
- `useContext` 解决了共享问题，但每次 Context 值变化，所有消费者都会重新渲染
- 状态逻辑（数据获取、缓存、乐观更新）散落在各组件中，无法复用和测试

**选型困惑：**

- Redux 是经典方案，但 boilerplate 太重，小型项目杀鸡用牛刀
- Zustand 轻量，但状态拆分和中间件机制不如 Redux 成熟
- Jotai / Valtio 是新思路（原子化 / 代理），但团队不一定接受
- MobX 用过的人说好，没用过的人觉得"不 React"

**核心问题：没有"最好的状态库"，只有"最适合当前场景的状态库"。理解它们的源码原理，才能做出正确的选型。**

---

## 二、Redux Toolkit — 单一 Store + 不可变更新

### 2.1 核心概念

```
三大原则：
1. 单一数据源（Single Store）
2. 状态只读（通过 dispatch action 修改）
3. 纯函数修改（Reducer）
```

### 2.2 基本用法

```typescript
// store/userSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface UserState {
    info: User | null;
    loading: boolean;
    error: string | null;
}

const initialState: UserState = {
    info: null,
    loading: false,
    error: null,
};

// 异步 action
export const fetchUser = createAsyncThunk('user/fetch', async (id: string) => {
    const res = await api.getUser(id);
    return res.data;
});

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User>) => {
            state.info = action.payload;  // Immer 允许直接修改
        },
        clearUser: (state) => {
            state.info = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUser.pending, (state) => { state.loading = true; })
            .addCase(fetchUser.fulfilled, (state, action) => {
                state.loading = false;
                state.info = action.payload;
            })
            .addCase(fetchUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Unknown error';
            });
    },
});

export const { setUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
```

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';

export const store = configureStore({
    reducer: {
        user: userReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```tsx
// 组件中使用
import { useSelector, useDispatch } from 'react-redux';
import { fetchUser } from '@/store/userSlice';

function UserProfile({ userId }: { userId: string }) {
    const { info, loading } = useSelector((state: RootState) => state.user);
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(fetchUser(userId));
    }, [userId]);

    if (loading) return <Spin />;
    return <div>{info?.name}</div>;
}
```

### 2.3 源码解析

**核心原理：发布订阅模式 + 不可变更新。**

```typescript
// Redux 核心源码简化版（createStore）
function createStore(reducer: Reducer, initialState: any) {
    let currentState = initialState;
    let listeners: (() => void)[] = [];
    let isDispatching = false;

    function getState() {
        return currentState;
    }

    function subscribe(listener: () => void) {
        listeners.push(listener);
        // 返回取消订阅函数
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    }

    function dispatch(action: Action) {
        if (isDispatching) {
            throw new Error('Reducers may not dispatch actions.');
        }

        try {
            isDispatching = true;
            // 调用 reducer 计算新状态
            currentState = reducer(currentState, action);
        } finally {
            isDispatching = false;
        }

        // 通知所有订阅者
        listeners.forEach(listener => listener());
        return action;
    }

    return { getState, subscribe, dispatch };
}
```

**React-Redux 的 useSelector 如何实现精确渲染：**

```typescript
// useSelector 核心逻辑简化
function useSelector<T>(selector: (state: RootState) => T): T {
    const store = useStore();
    const [, forceRender] = useReducer(c => c + 1, 0);

    const selectedRef = useRef<T>();
    selectedRef.current = selector(store.getState());

    useEffect(() => {
        return store.subscribe(() => {
            const newSelected = selector(store.getState());
            // 浅比较：只有选中的数据变化时才重渲染
            if (!shallowEqual(newSelected, selectedRef.current)) {
                forceRender();
            }
        });
    }, [store]);

    return selectedRef.current;
}
```

**Immer 如何实现"可变写法、不可变结果"：**

```typescript
// Immer 核心原理：Proxy 代理
function produce(baseState: any, recipe: (draft: any) => void) {
    const copies = new Map();       // 存放被修改节点的副本
    const proxies = new Map();      // 存放代理对象

    function createProxy(target: any) {
        if (proxies.has(target)) return proxies.get(target);

        const proxy = new Proxy(target, {
            get(target, prop) {
                // 读取时返回副本（如果已创建）或原始值
                const source = copies.get(target) || target;
                const value = source[prop];
                if (typeof value === 'object' && value !== null) {
                    return createProxy(value);  // 深层代理
                }
                return value;
            },
            set(target, prop, value) {
                // 写入时创建副本（Copy-on-Write）
                if (!copies.has(target)) {
                    copies.set(target, { ...target });  // 浅拷贝
                }
                copies.get(target)[prop] = value;
                return true;
            },
        });

        proxies.set(target, proxy);
        return proxy;
    }

    // 在代理环境中执行修改
    recipe(createProxy(baseState));

    // 收集所有修改过的副本，构建新的状态树
    return copies.size > 0 ? buildNewState(baseState, copies) : baseState;
}
```

**优点：** 可预测、可调试（DevTools 时间旅行）、生态成熟、大团队规范统一
**缺点：** boilerplate 重、异步处理需要额外中间件（虽然 RTK 简化了很多）

---

## 三、Zustand — 极简 Store + Hook

### 3.1 基本用法

```typescript
// stores/useUserStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UserState {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

export const useUserStore = create<UserState>()(
    devtools(
        persist(
            (set) => ({
                user: null,
                token: null,

                login: async (email, password) => {
                    const res = await api.login(email, password);
                    set({ user: res.user, token: res.token }, false, 'user/login');
                },

                logout: () => set({ user: null, token: null }, false, 'user/logout'),
            }),
            { name: 'user-storage' },
        ),
    ),
);

// 组件中使用 — 精确选择，避免不必要的渲染
function UserName() {
    const name = useUserStore(state => state.user?.name);
    return <span>{name}</span>;
}

// 也可以在 React 外部使用
// useUserStore.getState().logout();
```

### 3.2 源码解析

**核心原理：发布订阅 + selector 浅比较，没有 Context，没有 Provider。**

```typescript
// Zustand 核心源码简化版
function createState<T>(createStateFn: (set: SetFn, get: GetFn) => T) {
    let state: T;
    const listeners = new Set<() => void>();

    const get = () => state;

    const set = (partial: Partial<T> | ((s: T) => Partial<T>)) => {
        // 支持函数式更新：set(s => ({ count: s.count + 1 }))
        const nextState = typeof partial === 'function' ? partial(state) : partial;

        // 浅合并
        state = { ...state, ...nextState };

        // 通知所有订阅者
        listeners.forEach(listener => listener());
    };

    // 初始化状态
    state = createStateFn(set, get);

    // 返回 Hook
    function useStore<Selected>(selector?: (s: T) => Selected): Selected {
        const [, forceRender] = useReducer(c => c + 1, 0);

        const selectedRef = useRef<Selected>();
        selectedRef.current = selector ? selector(state) : (state as any);

        useEffect(() => {
            const listener = () => {
                const newSelected = selector ? selector(state) : (state as any);
                // 浅比较，只有选中部分变化才重渲染
                if (!Object.is(newSelected, selectedRef.current)) {
                    selectedRef.current = newSelected;
                    forceRender();
                }
            };
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        }, []);

        return selectedRef.current;
    }

    // 静态方法（React 外部使用）
    useStore.getState = get;
    useStore.setState = set;
    useStore.subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    return useStore;
}
```

**中间件机制的源码：**

```typescript
// Zustand 中间件本质是高阶函数
// applyMiddleware(middleware1, middleware2)(createState)

// devtools 中间件简化
const devtools = (config) => (set, get, api) => {
    // 包装 set 函数，在每次更新时发送到 DevTools
    const devtoolsSet = (partial, replace, actionName) => {
        const prevState = get();
        set(partial);
        const nextState = get();
        // 发送到 Redux DevTools
        devtoolsConnection.send(actionName || 'setState', { prevState, nextState });
    };

    return config(devtoolsSet, get, api);
};

// persist 中间件简化
const persist = (config) => (set, get, api) => {
    // 从 storage 恢复状态
    const stored = localStorage.getItem('my-storage');
    const initialState = stored ? JSON.parse(stored) : config(set, get, api);

    // 包装 set，在更新时同步到 storage
    const persistSet = (partial) => {
        set(partial);
        localStorage.setItem('my-storage', JSON.stringify(get()));
    };

    return { ...initialState, ...config(persistSet, get, api) };
};
```

**优点：** 极简 API、无 Provider、支持 React 外部使用、中间件灵活
**缺点：** 大型项目的状态拆分和类型推导不如 Redux 系统化

---

## 四、Jotai — 原子化状态

### 4.1 基本用法

```typescript
// atoms/user.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// 基础原子
const userIdAtom = atom<string | null>(null);

// 派生原子（只读）
const userAtom = atom(async (get) => {
    const id = get(userIdAtom);
    if (!id) return null;
    const res = await api.getUser(id);
    return res.data;
});

// 可持久化的原子
const themeAtom = atomWithStorage<'light' | 'dark'>('theme', 'light');

// 可写派生原子
const updateUserNameAtom = atom(
    null,  // 只写原子不需要 getter
    async (get, set, name: string) => {
        const user = await get(userAtom);
        if (user) {
            await api.updateUser(user.id, { name });
            // 让 userAtom 失效，触发重新获取
            set(userIdAtom, user.id);
        }
    },
);
```

```tsx
// 组件中使用
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

function UserProfile() {
    // useAtom — 读写
    const [userId, setUserId] = useAtom(userIdAtom);
    // useAtomValue — 只读
    const user = useAtomValue(userAtom);
    // useSetAtom — 只写（不订阅重渲染）
    const updateName = useSetAtom(updateUserNameAtom);

    if (!user) return <div>未登录</div>;
    return (
        <div>
            <span>{user.name}</span>
            <button onClick={() => updateName('新名字')}>改名</button>
        </div>
    );
}
```

### 4.2 源码解析

**核心原理：原子图 + 拓扑排序 + 依赖追踪。**

```typescript
// Jotai 核心源码简化版

// 原子定义
function atom<Value>(read: Value | Read<Value>, write?: Write<Value>) {
    return {
        read,
        write,
        // 每个原子有唯一标识（初始值 + toString）
        toString: () => `atom(${JSON.stringify(read)})`,
    };
}

// Store 实现
function createStore() {
    const atomStateMap = new WeakMap<Atom, AtomState>();

    type AtomState = {
        value: any;
        deps: Set<Atom>;          // 依赖的原子
        listeners: Set<() => void>; // 订阅者
    };

    function getAtomState(atom: Atom): AtomState {
        if (atomStateMap.has(atom)) return atomStateMap.get(atom)!;

        const state: AtomState = { value: undefined, deps: new Set(), listeners: new Set() };

        // 如果 read 是函数，执行并追踪依赖
        if (typeof atom.read === 'function') {
            state.value = atom.read({
                get: (depAtom: Atom) => {
                    state.deps.add(depAtom);       // 记录依赖
                    return getAtomState(depAtom).value;
                },
            });
        } else {
            state.value = atom.read;  // 基础原子的初始值
        }

        atomStateMap.set(atom, state);
        return state;
    }

    function writeAtom(atom: Atom, value: any) {
        const state = getAtomState(atom);
        state.value = value;

        // 通知所有依赖此原子的派生原子重新计算
        const dirtyAtoms = collectDirtyAtoms(atom);
        dirtyAtoms.forEach(dirtyAtom => {
            const dirtyState = atomStateMap.get(dirtyAtom);
            if (dirtyState) {
                // 重新计算派生原子的值
                dirtyState.value = (dirtyAtom.read as Function)({
                    get: (depAtom: Atom) => getAtomState(depAtom).value,
                });
                // 通知订阅者
                dirtyState.listeners.forEach(l => l());
            }
        });
    }

    // 收集所有受影响的派生原子（BFS 拓扑排序）
    function collectDirtyAtoms(sourceAtom: Atom): Atom[] {
        const dirty: Atom[] = [];
        const visited = new Set<Atom>();
        const queue = [sourceAtom];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            atomStateMap.forEach((state, atom) => {
                if (state.deps.has(current)) {
                    dirty.push(atom);
                    queue.push(atom);
                }
            });
        }

        return dirty;
    }

    return { getAtomState, writeAtom };
}
```

**Jotai 的 Provider 机制：**

```typescript
// Jotai 的 Provider 用 WeakMap 管理原子状态
// 每个 Provider 创建一个独立的 Store
// 没有 Provider 时使用默认的全局 Store

function useAtom<Value>(atom: Atom<Value>): [Value, SetFn<Value>] {
    // 从最近的 Provider 获取 Store（或用全局 Store）
    const store = useContext(AtomProviderContext) || defaultStore;

    const [value, setValue] = useState(() => store.getAtomState(atom).value);

    useEffect(() => {
        // 订阅原子变化
        const state = store.getAtomState(atom);
        state.listeners.add(() => {
            const newValue = store.getAtomState(atom).value;
            if (!Object.is(newValue, value)) {
                setValue(newValue);
            }
        });
    }, [store, atom]);

    const setAtom = (newValue: Value) => {
        store.writeAtom(atom, newValue);
    };

    return [value, setAtom];
}
```

**优点：** 最小粒度、按需渲染、TypeScript 友好、组合灵活
**缺点：** 大量原子管理复杂、调试不如 Redux DevTools 直观

---

## 五、Valtio — 代理响应式

### 5.1 基本用法

```typescript
// stores/userStore.ts
import { proxy, subscribe, snapshot } from 'valtio';

// 创建响应式对象（可变写法）
export const userStore = proxy({
    user: null as User | null,
    token: null as string | null,
    cart: [] as CartItem[],

    async login(email: string, password: string) {
        const res = await api.login(email, password);
        this.user = res.user;    // 直接修改，自动触发渲染
        this.token = res.token;
    },

    addToCart(item: CartItem) {
        this.cart.push(item);    // 数组方法也能触发更新
    },

    removeFromCart(itemId: string) {
        this.cart = this.cart.filter(item => item.id !== itemId);
    },
});

// 在 React 外部监听变化
subscribe(userStore, () => {
    console.log('Store changed:', snapshot(userStore));
});
```

```tsx
// 组件中使用
import { useSnapshot } from 'valtio/react';

function Cart() {
    const snap = useSnapshot(userStore);  // 自动追踪访问的属性
    // snap 是只读的，修改要通过 userStore

    return (
        <div>
            <h2>购物车 ({snap.cart.length})</h2>
            {snap.cart.map(item => (
                <div key={item.id}>
                    {item.name} - ¥{item.price}
                    <button onClick={() => userStore.removeFromCart(item.id)}>删除</button>
                </div>
            ))}
        </div>
    );
}
```

### 5.2 源码解析

**核心原理：ES6 Proxy + 自动依赖追踪。**

```typescript
// Valtio 核心源码简化版

// 创建响应式代理
function proxy<T extends object>(initialObject: T): T {
    const snapshotCache = new WeakMap();
    const listenerMap = new Map<string, Set<() => void>>();

    // 递归代理对象
    function createProxy(target: any, path: string[] = []): any {
        return new Proxy(target, {
            get(obj, prop) {
                const value = obj[prop];

                // 如果值是对象，递归代理
                if (typeof value === 'object' && value !== null && !isRef(value)) {
                    return createProxy(value, [...path, String(prop)]);
                }
                return value;
            },

            set(obj, prop, newValue) {
                const oldValue = obj[prop];
                obj[prop] = newValue;

                // 通知订阅了该路径的监听器
                const fullPath = [...path, String(prop)].join('.');
                notifyListeners(fullPath);

                // 同时通知父路径的监听器
                for (let i = path.length; i > 0; i--) {
                    notifyListeners(path.slice(0, i).join('.'));
                }

                return true;
            },

            // 拦截数组方法
            apply(target, thisArg, args) {
                const result = Reflect.apply(target, thisArg, args);
                // push/pop/splice 等操作后通知
                notifyListeners(path.join('.'));
                return result;
            },
        });
    }

    function notifyListeners(changedPath: string) {
        listenerMap.forEach((listeners, listenedPath) => {
            if (changedPath.startsWith(listenedPath) || listenedPath.startsWith(changedPath)) {
                listeners.forEach(l => l());
            }
        });
    }

    return createProxy(initialObject);
}

// useSnapshot 的实现
function useSnapshot<T extends object>(proxyObject: T): Readonly<T> {
    const [, forceRender] = useReducer(c => c + 1, 0);
    const accessedPaths = useRef(new Set<string>());

    useEffect(() => {
        // 订阅所有访问过的路径
        accessedPaths.current.forEach(path => {
            subscribe(proxyObject, path, () => {
                forceRender();
            });
        });
    }, []);
}
```

**snapshot 的实现：**

```typescript
// snapshot 返回一个不可变的快照
// 本质是深拷贝 + Object.freeze
function snapshot<T extends object>(proxyObject: T): Readonly<T> {
    return deepFreeze(structuredClone(getRawObject(proxyObject)));
}

function deepFreeze(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    Object.freeze(obj);
    Object.values(obj).forEach(value => deepFreeze(value));
    return obj;
}
```

**优点：** 写法最自然（直接修改对象）、学习成本最低、性能好
**缺点：** 可变思维和 React 不可变理念冲突、调试困难（没有时间旅行）

---

## 六、MobX — 可观察对象 + 自动追踪

### 6.1 基本用法

```typescript
// stores/userStore.ts
import { makeAutoObservable } from 'mobx';

class UserStore {
    user: User | null = null;
    loading = false;

    constructor() {
        makeAutoObservable(this);  // 自动标记所有属性为 observable
    }

    get fullName(): string {
        return this.user ? `${this.user.firstName} ${this.user.lastName}` : '';
    }

    async login(email: string, password: string) {
        this.loading = true;
        try {
            const res = await api.login(email, password);
            this.user = res.user;
        } finally {
            this.loading = false;
        }
    }

    logout() {
        this.user = null;
    }
}

export const userStore = new UserStore();
```

```tsx
// 组件中使用（observer HOC / hook）
import { observer } from 'mobx-react-lite';

const UserProfile = observer(function UserProfile() {
    const { userStore } = useStores();

    if (!userStore.user) return <div>未登录</div>;

    return (
        <div>
            <h2>{userStore.fullName}</h2>
            <button onClick={() => userStore.logout()}>退出</button>
        </div>
    );
});
```

### 6.2 源码解析

**核心原理：Observable + Derivation + Reaction。**

```typescript
// MobX 核心源码简化版

// 全局追踪上下文
let trackingDerivation: Derivation | null = null;

interface Derivation {
    deps: Set<Observable>;   // 依赖的可观察属性
    run: () => void;          // 重新执行函数
}

// 创建可观察属性
function observable<T>(value: T): { get(): T; set(v: T): void } {
    const listeners = new Set<Derivation>();

    return {
        get() {
            // 自动追踪依赖
            if (trackingDerivation) {
                listeners.add(trackingDerivation);
                trackingDerivation.deps.add(/* this observable */);
            }
            return value;
        },
        set(newValue: T) {
            if (value !== newValue) {
                value = newValue;
                // 通知所有依赖此属性的 Derivation
                listeners.forEach(d => d.run());
            }
        },
    };
}

// observer 组件的实现
function observer(Component: React.FC) {
    return function ObserverWrapper(props: any) {
        const [, forceRender] = useReducer(c => c + 1, 0);

        useEffect(() => {
            // 创建 Derivation
            const derivation: Derivation = {
                deps: new Set(),
                run: () => forceRender(),
            };

            // 渲染时收集依赖
            trackingDerivation = derivation;
            // 渲染组件时，所有访问的 observable.get() 都会注册依赖
            trackingDerivation = null;

            return () => {
                // 清理依赖
                derivation.deps.clear();
            };
        }, []);
    };
}
```

**优点：** 自动追踪依赖、OOP 风格、适合复杂业务逻辑
**缺点：** 魔法太多（隐式依赖追踪）、调试困难、非 React 惯用思维

---

## 七、横向对比

### 7.1 架构理念

| 库 | 核心理念 | 状态模型 | 更新方式 | 学习曲线 |
|---|---------|---------|---------|---------|
| Redux | 单一 Store + Reducer | 集中式不可变树 | dispatch(action) | 高 |
| Zustand | 极简 Store + Hook | 集中式可变树 | set(partial) | 低 |
| Jotai | 原子化 + 组合 | 分散的原子图 | setAtom(value) | 中 |
| Valtio | Proxy 响应式 | 可变对象 | 直接修改 | 最低 |
| MobX | 可观察 + 自动追踪 | OOP 对象 | 直接修改 | 高 |

### 7.2 性能对比

```
场景：一个包含 1000 个列表项的页面，更新其中一个项的名称

Redux：
- dispatch(action) → reducer 计算整个 state 树 → 所有 useSelector 浅比较
- 性能：中等（reducer 计算快，但 selector 比较多）
- 优化：使用 memoized selector（reselect）

Zustand：
- set({ items: newItems }) → 所有订阅者浅比较
- 性能：中等（和 Redux 类似）
- 优化：精确 selector（state => state.items[42].name）

Jotai：
- set(item42Atom, newItem) → 只有订阅了 item42Atom 的组件重渲染
- 性能：最好（天然精确更新）

Valtio：
- items[42].name = 'new' → Proxy 拦截 → 只通知访问了 items[42].name 的组件
- 性能：好（Proxy 自动追踪）

MobX：
- item.name = 'new' → Observable 触发 → 只重渲染用到 item.name 的组件
- 性能：好（自动依赖追踪）
```

### 7.3 TypeScript 支持

| 库 | 类型推导 | Boilerplate |
|---|---------|------------|
| Redux Toolkit | 好（但需要 RootState / AppDispatch 类型） | 中等 |
| Zustand | 好（create\<T\>() 自动推导） | 少 |
| Jotai | 最好（原子自带类型） | 少 |
| Valtio | 好（但 proxy 的类型推导有时需要手动标注） | 最少 |
| MobX | 中等（装饰器类型需要额外配置） | 中等 |

### 7.4 调试能力

| 库 | DevTools | 时间旅行 | 热重载 |
|---|---------|---------|-------|
| Redux | Redux DevTools（最强） | 支持 | 支持 |
| Zustand | Redux DevTools（通过中间件） | 支持 | 支持 |
| Jotai | 有限（jotai-devtools） | 有限 | 支持 |
| Valtio | 有限 | 不支持 | 支持 |
| MobX | mobx-devtools | 不支持 | 支持 |

### 7.5 包体积

| 库 | Minified | Gzipped |
|---|---------|---------|
| Redux Toolkit | ~12KB | ~4KB |
| Zustand | ~2KB | ~1KB |
| Jotai | ~3KB | ~1KB |
| Valtio | ~6KB | ~3KB |
| MobX | ~17KB | ~6KB |

---

## 八、选型建议

### 8.1 按场景选型

```
场景一：管理后台 / 内部工具
├── 状态：中等复杂度，表单交互为主
├── 推荐：Zustand（简单、够用）
└── 理由：不需要 Redux 的规范约束，也不需要 Jotai 的原子化

场景二：电商 / 内容平台
├── 状态：复杂，购物车、用户、商品、筛选条件多维度交互
├── 推荐：Redux Toolkit（规范、可调试）
└── 理由：多人协作需要统一的代码规范，Redux DevTools 方便排查问题

场景三：组件库 / 插件系统
├── 状态：高度解耦，组件之间独立
├── 推荐：Jotai（原子化、按需引入）
└── 理由：不希望引入全局 Store，每个组件独立管理自己的原子

场景四：复杂表单 / 画布编辑器
├── 状态：频繁局部更新（拖拽、实时预览）
├── 推荐：Valtio 或 MobX（直接修改，性能好）
└── 理由：不可变更新的性能开销在高频更新场景下不可接受

场景五：个人项目 / 快速原型
├── 推荐：Zustand 或 Valtio（最少代码）
└── 理由：快速上手，不需要学习成本
```

### 8.2 不该做的事

```
反模式 1：一个项目用多个状态库
- Redux 管用户状态，Zustand 管表单状态，Jotai 管主题
- 结果：维护者需要理解三种范式，心智负担三倍
- 正确做法：选一个主状态库，简单场景用 useState 补充

反模式 2：所有状态都放全局
- 弹窗开关、表单输入值、选中行 —— 这些是 UI 状态，不需要全局
- 结果：全局 Store 膨胀，组件失去独立性
- 正确做法：UI 状态用 useState，共享状态才放全局

反模式 3：服务端状态也用状态库管理
- 列表数据、详情数据、分页状态 —— 这些是服务端状态的缓存
- 结果：手动管理 loading/error/refresh/cache，代码重复
- 正确做法：用 React Query / SWR 管服务端状态

反模式 4：追逐新库
- 每次出现新状态库就迁移
- 结果：永远在迁移，业务逻辑没积累
- 正确做法：选一个合适的，坚持用，在真正的痛点出现时再换
```

---

## 九、总结

### 核心原理总结

| 库 | 底层机制 | 渲染优化方式 |
|---|---------|------------|
| Redux | 发布订阅 + Reducer | useSelector 浅比较 |
| Zustand | 发布订阅 + set | selector + Object.is |
| Jotai | 原子图 + 依赖追踪 | 天然精确（只订阅用到的原子） |
| Valtio | Proxy + 属性追踪 | 访问路径追踪 |
| MobX | Observable + Derivation | 自动依赖收集 |

### 一句话选型

- **默认选 Zustand**：覆盖 80% 场景，学习成本最低
- **大型团队选 Redux Toolkit**：规范统一，调试工具强
- **高度解耦场景选 Jotai**：原子化，无全局依赖
- **高频更新场景选 Valtio/MobX**：直接修改，性能最优
- **服务端状态选 React Query**：不要用状态库管理服务端数据
