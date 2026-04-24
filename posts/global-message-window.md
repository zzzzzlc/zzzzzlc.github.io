---
title: "全局消息处理&窗口管理"
date: "2026-04-24"
tags:
  - 消息总线
  - 窗口管理
  - 架构设计
  - 发布订阅
  - 前端工程化
category: "前端进阶"
summary: "从实际项目痛点出发，对比分析前端全局消息处理和窗口管理的多种实现方案，涵盖发布订阅模式、状态驱动、iframe 窗口池、BroadcastChannel 等技术选型。"
---
# 全局消息处理&窗口管理

## 一、问题来源

在复杂前端项目中，以下场景反复出现却缺乏统一方案：

**消息层面的痛点：**

- 组件嵌套层级深，子组件需要通知顶层弹窗、提示，props 层层传递导致"props drilling"
- 多个模块独立请求接口，错误提示散落各处，无法统一拦截和去重
- WebSocket 推送的消息需要在多个业务模块间广播，模块之间产生了隐式耦合
- 全局 loading 状态管理混乱，多个请求并发时加载态频繁闪烁

**窗口层面的痛点：**

- Modal 弹窗层级失控，多个弹窗叠加时 z-index 冲突，遮罩层互相穿透
- 业务页面需要打开多个独立窗口（审批单、详情页），无法统一管理和定位
- 跨 Tab 页面状态不同步，用户在一个标签页操作后，另一个标签页数据过期
- iframe 嵌入场景下，父页面与子页面之间通信方式混乱，缺乏统一协议

这些问题的本质是：**组件间通信缺乏统一的消息管道，窗口/弹窗缺乏统一的生命周期管理。**

## 二、全局消息处理方案

### 方案一：发布订阅模式（EventEmitter）

最经典的消息通信模式，通过事件中心解耦消息的发送方和接收方。

```typescript
// event-bus.ts
type Handler = (...args: unknown[]) => void;

class EventBus {
    private events = new Map<string, Set<Handler>>();

    on(event: string, handler: Handler) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event)!.add(handler);
        return () => this.off(event, handler);
    }

    off(event: string, handler: Handler) {
        this.events.get(event)?.delete(handler);
    }

    emit(event: string, ...args: unknown[]) {
        this.events.get(event)?.forEach(handler => handler(...args));
    }

    once(event: string, handler: Handler) {
        const wrapper = (...args: unknown[]) => {
            handler(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}

export const eventBus = new EventBus();
```

**使用示例：**

```typescript
// 模块 A：发送消息
eventBus.emit('user:login', { userId: '123', name: '张三' });
eventBus.emit('order:status-changed', { orderId: 'ORD-001', status: 'paid' });

// 模块 B：监听消息
const unsubscribe = eventBus.on('user:login', (data) => {
    console.log('用户登录:', data);
    // 刷新权限、更新头像等
});

// 组件卸载时取消订阅
useEffect(() => {
    return () => unsubscribe();
}, []);
```

**优点：**

- 实现简单，概念直观，上手成本低
- 完全解耦，发送方不关心接收方是谁
- 支持一对多广播，一个事件可以有多个监听者

**缺点：**

- 事件流是隐式的，调用链难以追踪和调试
- 容易产生内存泄漏，忘记取消订阅会导致回调残留
- 没有类型安全，事件名和参数都是字符串，容易拼写错误
- 无法进行时间旅行调试或状态回溯

**适配场景：**

- 中小型项目，模块间简单通信
- 第三方库与业务代码之间的桥接（如 WebSocket 推送到 UI）
- 需要快速落地、团队规模较小的场景

**局限性：**

- 随着事件数量增长，维护成本急剧上升
- 无法保证事件的顺序和可靠性
- 在 React 严格模式下可能导致双重订阅问题

### 方案二：状态驱动模式（Zustand / Redux Middleware）

将消息视为状态变化，通过状态管理工具统一分发，消息的流转可追踪、可回溯。

```typescript
// message-store.ts
import { create } from 'zustand';

interface ToastMessage {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    content: string;
    duration?: number;
}

interface MessageState {
    toasts: ToastMessage[];
    globalLoading: boolean;
    loadingCount: number;
    addToast: (toast: Omit<ToastMessage, 'id'>) => void;
    removeToast: (id: string) => void;
    showLoading: () => void;
    hideLoading: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
    toasts: [],
    globalLoading: false,
    loadingCount: 0,

    addToast: (toast) => {
        const id = Date.now().toString();
        set((state) => ({
            toasts: [...state.toasts, { ...toast, id }],
        }));
        // 自动移除
        const duration = toast.duration ?? 3000;
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter(t => t.id !== id),
            }));
        }, duration);
    },

    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id),
    })),

    showLoading: () => set((state) => ({
        globalLoading: true,
        loadingCount: state.loadingCount + 1,
    })),

    hideLoading: () => set((state) => {
        const next = state.loadingCount - 1;
        return {
            loadingCount: Math.max(0, next),
            globalLoading: next > 0,
        };
    }),
}));
```

**全局消息组件：**

```tsx
// GlobalToast.tsx
function GlobalToast() {
    const { toasts, removeToast } = useMessageStore();

    return (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999 }}>
            {toasts.map(toast => (
                <div key={toast.id} className={`toast toast-${toast.type}`}>
                    <span>{toast.content}</span>
                    <button onClick={() => removeToast(toast.id)}>×</button>
                </div>
            ))}
        </div>
    );
}
```

**与请求层集成：**

```typescript
// 统一请求拦截器
async function request<T>(url: string, options?: RequestInit): Promise<T> {
    useMessageStore.getState().showLoading();
    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        useMessageStore.getState().addToast({
            type: 'error',
            content: error instanceof Error ? error.message : '请求失败',
        });
        throw error;
    } finally {
        useMessageStore.getState().hideLoading();
    }
}
```

**优点：**

- 消息状态可追踪，配合 DevTools 可做时间旅行调试
- 天然支持 React 的响应式更新，组件自动订阅
- 全局 loading 计数器完美解决并发请求闪烁问题
- 与框架生态深度整合，团队容易接受

**缺点：**

- 需要引入状态管理库，增加依赖
- 非响应式的场景（iframe、Web Worker）无法直接使用
- 跨组件树的模块间通信仍然需要依赖 store 的结构设计

**适配场景：**

- 使用 React / Vue 等框架的中大型项目
- 需要统一管理全局提示、Loading、错误信息的场景
- 团队已在使用 Zustand / Redux / Pinia 等状态管理工具

**局限性：**

- 不适合非 UI 场景的消息通信（如 Service Worker 内部）
- Store 结构设计需要前瞻性，后期重构成本高

### 方案三：反应式流（RxJS）

用 Observable 流处理消息，天然支持过滤、合并、去重、防抖等复杂操作。

```typescript
// message-stream.ts
import { Subject, BehaviorSubject, merge } from 'rxjs';
import { debounceTime, filter, map, distinctUntilChanged, scan } from 'rxjs/operators';

// 消息类型定义
interface AppMessage {
    type: string;
    payload: unknown;
    timestamp: number;
}

// 消息总线
const message$ = new Subject<AppMessage>();

// 发送消息
function sendMessage(type: string, payload: unknown) {
    message$.next({ type, payload, timestamp: Date.now() });
}

// 订阅特定类型的消息
function onMessage(type: string) {
    return message$.pipe(filter(msg => msg.type === type));
}

// 使用示例：错误消息去重
const errors$ = onMessage('error').pipe(
    scan((acc, msg) => {
        const key = String(msg.payload);
        if (acc.recent.has(key)) return acc;
        acc.recent.add(key);
        // 5 秒后移除去重记录
        setTimeout(() => acc.recent.delete(key), 5000);
        return { ...acc, messages: [...acc.messages, msg] };
    }, { messages: [] as AppMessage[], recent: new Set<string>() }),
    map(acc => acc.messages),
);

// 全局 loading：300ms 内无新请求才关闭
const loading$ = merge(
    onMessage('request:start').pipe(map(() => true)),
    onMessage('request:end').pipe(map(() => false)),
).pipe(
    scan((count, isStart) => isStart ? count + 1 : Math.max(0, count - 1), 0),
    map(count => count > 0),
    debounceTime(300),
    distinctUntilChanged(),
);

// WebSocket 消息自动重连
import { webSocket } from 'rxjs/webSocket';
import { retryWhen, delay, take } from 'rxjs/operators';

const ws$ = webSocket('wss://api.example.com/realtime').pipe(
    retryWhen(errors => errors.pipe(delay(3000), take(10))),
);

ws$.subscribe({
    next: (data) => sendMessage('ws:message', data),
    error: (err) => sendMessage('ws:error', err),
});
```

**优点：**

- 强大的数据变换能力，过滤、合并、去重、防抖等操作符丰富
- 天然处理异步和并发场景，消息流可组合
- 适合处理 WebSocket、SSE 等持续数据流
- 时间维度的操作（防抖、节拍、窗口）非常优雅

**缺点：**

- 学习曲线陡峭，RxJS 操作符概念众多
- 调试困难，流的链式调用断点难以设置
- 包体积较大（完整 RxJS 约 40KB gzip）
- 团队成员水平参差时，代码可读性差

**适配场景：**

- 实时数据密集型应用（金融行情、即时通讯、协同编辑）
- 复杂的异步消息流需要多步变换和组合
- 团队有函数式编程和响应式编程经验

**局限性：**

- 简单场景引入 RxJS 是过度设计
- 在 React 生态中与 Hooks 的配合不如 Zustand 直观
- 流的订阅管理不当同样会造成内存泄漏

### 方案对比


| 维度         | 发布订阅 | 状态驱动         | RxJS 流       |
| ------------ | -------- | ---------------- | ------------- |
| 上手成本     | 低       | 中               | 高            |
| 调试能力     | 弱       | 强（DevTools）   | 中            |
| 类型安全     | 弱       | 强               | 中            |
| 异步处理     | 基础     | 基础             | 强            |
| 消息去重     | 需手动   | 需手动           | 内置操作符    |
| 包体积       | < 1KB    | 中（依赖状态库） | ~40KB         |
| 团队要求     | 低       | 中               | 高            |
| 推荐项目规模 | 小型     | 中大型           | 大型/实时应用 |

## 三、全局窗口管理方案

### 方案一：React Portal + 统一弹窗管理器

利用 React Portal 将弹窗渲染到 body 根节点，配合统一管理器控制层级和生命周期。

```typescript
// modal-manager.ts
interface ModalInstance {
    id: string;
    component: React.ComponentType<{ onClose: () => void }>;
    props?: Record<string, unknown>;
    zIndex: number;
}

interface ModalManagerState {
    modals: ModalInstance[];
    open: <P>(component: React.ComponentType<P>, props?: P) => string;
    close: (id: string) => void;
    closeAll: () => void;
}

export const useModalManager = create<ModalManagerState>((set, get) => ({
    modals: [],

    open: (component, props) => {
        const id = `modal_${Date.now()}`;
        const zIndex = 1000 + get().modals.length;
        set(state => ({
            modals: [...state.modals, { id, component, props, zIndex }],
        }));
        return id;
    },

    close: (id) => set(state => ({
        modals: state.modals.filter(m => m.id !== id),
    })),

    closeAll: () => set({ modals: [] }),
}));
```

**渲染层：**

```tsx
// ModalContainer.tsx
import { createPortal } from 'react-dom';

function ModalContainer() {
    const { modals, close } = useModalManager();

    return createPortal(
        <>
            {modals.map(modal => (
                <div key={modal.id} style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: modal.zIndex,
                }}>
                    <div
                        className="modal-mask"
                        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
                        onClick={() => close(modal.id)}
                    />
                    <div className="modal-content" style={{ position: 'relative', zIndex: 1 }}>
                        <modal.component onClose={() => close(modal.id)} {...modal.props} />
                    </div>
                </div>
            ))}
        </>,
        document.body
    );
}
```

**使用方式：**

```typescript
// 命令式调用弹窗
const modalId = useModalManager.getState().open(ConfirmDialog, {
    title: '确认删除？',
    onConfirm: () => handleDelete(),
});

// 关闭指定弹窗
useModalManager.getState().close(modalId);
```

**优点：**

- 弹窗层级由管理器统一分配，杜绝 z-index 冲突
- 命令式调用，不需要在组件树中声明弹窗组件
- 弹窗队列可视化，便于调试

**缺点：**

- 弹窗状态不参与路由，刷新后丢失
- 命令式调用与 React 声明式理念有冲突
- 弹窗间通信需要额外处理

**适配场景：**

- 弹窗数量多、类型杂的管理后台
- 需要支持多弹窗并存的业务（审批流、多步表单）
- 弹窗调用方分散在多个不相关的组件中

**局限性：**

- 不适合需要 URL 关联的弹窗（如详情页弹窗需要可分享链接）
- SSR 场景下 Portal 需要额外处理

### 方案二：路由驱动模式

将弹窗/窗口的状态映射到 URL，通过路由参数控制窗口的打开和关闭。

```typescript
// 路由配置：使用 search params 管理弹窗
// URL: /orders?modal=detail&orderId=123

function OrderPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeModal = searchParams.get('modal');
    const orderId = searchParams.get('orderId');

    const openDetail = (id: string) => {
        setSearchParams({ modal: 'detail', orderId: id });
    };

    const closeModal = () => {
        setSearchParams({});
    };

    return (
        <div>
            <OrderList onItemClick={openDetail} />

            {activeModal === 'detail' && orderId && (
                <DetailModal orderId={orderId} onClose={closeModal} />
            )}
        </div>
    );
}
```

**多窗口并行管理：**

```typescript
// 支持 URL 中多个弹窗同时存在
// URL: /orders?modals=detail:123,approval:456

function parseModals(search: string): Array<{ type: string; id: string }> {
    const params = new URLSearchParams(search);
    const modalsStr = params.get('modals') || '';
    if (!modalsStr) return [];
    return modalsStr.split(',').map(m => {
        const [type, id] = m.split(':');
        return { type, id };
    });
}

function ModalRenderer() {
    const location = useLocation();
    const modals = parseModals(location.search);
    const navigate = useNavigate();

    const closeModal = (type: string, id: string) => {
        const remaining = modals.filter(m => !(m.type === type && m.id === id));
        const params = new URLSearchParams();
        if (remaining.length > 0) {
            params.set('modals', remaining.map(m => `${m.type}:${m.id}`).join(','));
        }
        navigate({ search: params.toString() });
    };

    return (
        <>
            {modals.map((modal, index) => (
                <div key={`${modal.type}-${modal.id}`} style={{ zIndex: 1000 + index }}>
                    {modal.type === 'detail' && (
                        <DetailModal id={modal.id} onClose={() => closeModal(modal.type, modal.id)} />
                    )}
                    {modal.type === 'approval' && (
                        <ApprovalModal id={modal.id} onClose={() => closeModal(modal.type, modal.id)} />
                    )}
                </div>
            ))}
        </>
    );
}
```

**优点：**

- 弹窗状态可分享、可收藏，刷新不丢失
- 与浏览器前进/后退按钮天然集成
- 弹窗的打开和关闭有据可查（URL 即状态）
- 符合 React 声明式理念

**缺点：**

- URL 参数有长度限制，复杂弹窗参数难以全部放入
- 弹窗类型和参数需要在路由层维护映射关系
- 对 SEO 无意义的弹窗参数会污染 URL

**适配场景：**

- 弹窗内容需要可分享链接（详情页、审批页）
- 需要浏览器前进/后退按钮控制弹窗的 SPA 应用
- 弹窗数量有限且类型固定

**局限性：**

- 不适合弹窗数量多且频繁变化的场景
- 复杂参数（对象、数组）需要序列化，增加 URL 复杂度

### 方案三：window.open 窗口池管理

对于需要真正独立窗口的场景（多屏展示、独立审批流），使用 `window.open` 并统一管理。

```typescript
// window-manager.ts
interface ManagedWindow {
    id: string;
    window: Window | null;
    name: string;
    url: string;
    features: string;
}

class WindowManager {
    private windows = new Map<string, ManagedWindow>();
    private listeners = new Map<string, (data: unknown) => void>();

    open(id: string, url: string, options?: {
        width?: number;
        height?: number;
        x?: number;
        y?: number;
    }): Window | null {
        // 如果窗口已存在，聚焦
        const existing = this.windows.get(id);
        if (existing?.window && !existing.window.closed) {
            existing.window.focus();
            return existing.window;
        }

        const features = [
            `width=${options?.width ?? 800}`,
            `height=${options?.height ?? 600}`,
            options?.x !== undefined ? `left=${options.x}` : '',
            options?.y !== undefined ? `top=${options.y}` : '',
            'scrollbars=yes',
            'resizable=yes',
        ].filter(Boolean).join(',');

        const win = window.open(url, `managed_${id}`, features);

        if (win) {
            this.windows.set(id, { id, window: win, name: id, url, features });

            // 监听窗口关闭
            const checkClosed = setInterval(() => {
                if (win.closed) {
                    clearInterval(checkClosed);
                    this.windows.delete(id);
                    this.notifyParent(id, 'closed');
                }
            }, 1000);
        }

        return win;
    }

    close(id: string) {
        const managed = this.windows.get(id);
        if (managed?.window && !managed.window.closed) {
            managed.window.close();
        }
        this.windows.delete(id);
    }

    closeAll() {
        this.windows.forEach((managed) => {
            if (managed.window && !managed.window.closed) {
                managed.window.close();
            }
        });
        this.windows.clear();
    }

    // 通过 postMessage 与子窗口通信
    send(id: string, data: unknown) {
        const managed = this.windows.get(id);
        if (managed?.window && !managed.window.closed) {
            managed.window.postMessage({ source: 'window-manager', data }, '*');
        }
    }

    // 父窗口监听子窗口消息
    onMessage(id: string, callback: (data: unknown) => void) {
        this.listeners.set(id, callback);
    }

    private notifyParent(id: string, event: string) {
        const listener = this.listeners.get(id);
        if (listener) listener({ event, id });
    }

    getOpenWindows(): string[] {
        return Array.from(this.windows.entries())
            .filter(([, m]) => m.window && !m.window.closed)
            .map(([id]) => id);
    }
}

export const windowManager = new WindowManager();
```

**子窗口侧通信：**

```typescript
// 子窗口向父窗口发消息
window.opener?.postMessage({
    source: 'managed-child',
    id: 'approval-window',
    event: 'approved',
    data: { orderId: '123' },
}, '*');

// 监听父窗口消息
window.addEventListener('message', (e) => {
    if (e.data?.source === 'window-manager') {
        console.log('收到父窗口消息:', e.data.data);
    }
});
```

**优点：**

- 真正的多窗口体验，每个窗口独立运行
- 窗口可以拖拽到不同显示器
- 子窗口崩溃不影响主窗口
- 窗口间通过 postMessage 通信，安全可控

**缺点：**

- 浏览器可能拦截 window.open（需要用户交互触发）
- 移动端不支持多窗口
- postMessage 是异步的，调试复杂
- 窗口间无法共享内存状态

**适配场景：**

- 管理后台的多屏展示（主屏看列表，副屏看详情）
- 需要同时操作多个独立业务流程的系统（客服、交易）
- 弹窗内容过于复杂，不适合在模态框中展示

**局限性：**

- 浏览器弹窗拦截策略越来越严格
- 无法在移动端使用
- 窗口间同步大量数据时性能受限

### 方案四：BroadcastChannel 跨 Tab 通信

利用浏览器原生 BroadcastChannel API 实现跨标签页通信。

```typescript
// cross-tab-sync.ts
type TabEvent = {
    type: 'state-update' | 'user-action' | 'tab-open' | 'tab-close';
    source: string;
    payload: unknown;
    timestamp: number;
};

class CrossTabSync {
    private channel: BroadcastChannel;
    private tabId: string;
    private handlers = new Map<string, (payload: unknown) => void>();

    constructor(channelName = 'app-sync') {
        this.tabId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        this.channel = new BroadcastChannel(channelName);
        this.channel.onmessage = (e: MessageEvent<TabEvent>) => {
            // 忽略自己发出的消息
            if (e.data.source === this.tabId) return;
            const handler = this.handlers.get(e.data.type);
            handler?.(e.data.payload);
        };

        this.send('tab-open', { url: location.href });
    }

    send(type: TabEvent['type'], payload: unknown) {
        this.channel.postMessage({
            type,
            source: this.tabId,
            payload,
            timestamp: Date.now(),
        });
    }

    on(type: string, handler: (payload: unknown) => void) {
        this.handlers.set(type, handler);
    }

    destroy() {
        this.send('tab-close', { url: location.href });
        this.channel.close();
    }
}

export const crossTabSync = new CrossTabSync();
```

**与状态管理集成：**

```typescript
// 某个 Tab 更新数据后，通知其他 Tab
function updateOrder(orderId: string, data: unknown) {
    // 1. 本地更新
    orderStore.update(orderId, data);
    // 2. 广播给其他 Tab
    crossTabSync.send('state-update', { entity: 'order', id: orderId, data });
}

// 其他 Tab 监听并同步
crossTabSync.on('state-update', (payload) => {
    const { entity, id, data } = payload as { entity: string; id: string; data: unknown };
    if (entity === 'order') {
        orderStore.update(id, data);
    }
});
```

**优点：**

- 浏览器原生 API，零依赖，性能好
- 同源策略保护，安全性高
- 实现简洁，几行代码即可完成跨 Tab 通信
- 不需要服务器中转

**缺点：**

- 不支持 IE，Safari 15.4+ 才支持
- 只能在同源页面间通信
- 消息不可持久化，Tab 关闭后消息丢失
- 无法跨浏览器实例通信

**适配场景：**

- 需要多个 Tab 之间数据同步的管理系统
- 用户可能开多个标签页并行操作的业务
- 需要通知其他 Tab "数据已过期，请刷新"

**局限性：**

- 不同浏览器的标签页无法通信（Chrome ↔ Firefox）
- 需要降级方案兼容旧浏览器（可用 localStorage 事件模拟）

### 窗口管理方案对比


| 维度       | Portal 管理器 | 路由驱动   | window.open    | BroadcastChannel |
| ---------- | ------------- | ---------- | -------------- | ---------------- |
| 窗口类型   | 模态弹窗      | 模态弹窗   | 独立浏览器窗口 | 跨 Tab 同步      |
| 状态持久化 | 刷新丢失      | URL 保留   | 独立生命周期   | 实时同步         |
| 可分享性   | 不可分享      | URL 可分享 | URL 可分享     | 不适用           |
| 移动端     | 完全支持      | 完全支持   | 不支持         | 部分支持         |
| 多窗口并存 | 支持          | 支持       | 支持           | 天然支持         |
| 实现复杂度 | 中            | 低         | 高             | 低               |
| 浏览器兼容 | 好            | 好         | 弹窗拦截风险   | 较新浏览器       |

## 四、综合架构：消息 + 窗口统一管理

在实际项目中，消息处理和窗口管理通常需要组合使用。以下是一个推荐的综合架构：

```typescript
// 统一消息架构
// ┌─────────────────────────────────┐
// │         UI 层（React）          │
// │  Toast / Modal / Notification   │
// └──────────┬──────────────────────┘
//            │ subscribe
// ┌──────────▼──────────────────────┐
// │       消息总线层（核心）         │
// │  EventBus / Zustand / RxJS      │
// └──────────┬──────────────────────┘
//            │ dispatch
// ┌──────────▼──────────────────────┐
// │          适配层                  │
// │  WebSocket / HTTP / Storage     │
// │  BroadcastChannel / postMessage │
// └─────────────────────────────────┘
```

**选型建议：**

- **小型项目**：发布订阅 + React Portal 管理器，足够应对
- **中型项目**：Zustand 状态驱动 + 路由驱动弹窗，消息和窗口统一管理
- **大型项目**：RxJS 消息流 + Portal 管理器 + BroadcastChannel，覆盖所有场景
- **多窗口系统**：window.open 窗口池 + postMessage + BroadcastChannel 三层通信

## 总结

全局消息处理和窗口管理没有万能方案，核心是在 **简单性** 和 **可控性** 之间取舍：

1. 发布订阅最简单但最难维护，适合小项目和临时方案
2. 状态驱动最均衡，是大多数 React 项目的推荐选择
3. RxJS 最强大但门槛最高，留给复杂异步场景
4. 窗口管理优先用路由驱动，其次用 Portal 管理器，多窗口场景才用 window.open

选择时先评估项目规模、团队能力和维护周期，避免过度设计。
