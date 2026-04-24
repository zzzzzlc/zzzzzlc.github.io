---
title: "微前端解决方案"
date: "2026-04-23"
tags: ["微前端", "single-spa", "qiankun", "wujie", "micro-app", "架构"]
category: "技术"
summary: "深入对比 single-spa、qiankun、wujie、micro-app 四大微前端方案，从 JS 沙箱、CSS 隔离、应用通信三个维度分析差异，剖析各沙箱方案的实现原理与优缺点。"
---
# 微前端解决方案

微前端允许将一个大型前端应用拆分为多个独立开发、独立部署的子应用。本文从 **JS 隔离、CSS 隔离、应用通信** 三个核心维度，深入对比四大主流方案。

## 一、微前端核心问题

无论选择哪个方案，都需要解决三个根本问题：


| 问题         | 说明                                             |
| ------------ | ------------------------------------------------ |
| **JS 隔离**  | 子应用之间、子应用与主应用之间的全局变量互不污染 |
| **CSS 隔离** | 子应用的样式不泄漏到其他应用，卸载后样式被清理   |
| **应用通信** | 主应用与子应用、子应用与子应用之间的数据传递     |

## 二、四大方案概览

### 1. single-spa

最早的微前端框架（2018），只提供生命周期管理，不提供沙箱和样式隔离。

```
定位：微前端内核（底层引擎）
沙箱：无（需自行实现或搭配 qiankun）
适用：需要完全自定义控制的团队
```

### 2. qiankun

基于 single-spa 的蚂蚁金服出品（2019），补齐了沙箱和样式隔离。

```
定位：开箱即用的微前端框架
沙箱：JS 沙箱（快照 / Proxy） + Shadow DOM / Scoped CSS
适用：大多数中后台系统
```

### 3. micro-app

京东出品（2021），基于 Web Components（Custom Elements）实现。

```
定位：像使用组件一样使用微前端
沙箱：JS 沙箱（Proxy） + Shadow DOM / scoped css
适用：追求简单接入的项目
```

### 4. wujie

腾讯出品（2022），基于 iframe + WebComponents 实现最彻底的隔离。

```
定位：极致隔离的微前端方案
沙箱：iframe（天然 JS/CSS 完全隔离） + WebComponents 渲染
适用：需要完全隔离的场景（如接入第三方应用）
```

## 三、JS 隔离对比

### 3.1 single-spa — 无沙箱

single-spa 本身不提供 JS 沙箱：

```javascript
// 子应用 A
window.myGlobal = "from-app-a";

// 子应用 B（挂载后）
console.log(window.myGlobal); // "from-app-a" — 污染了！
```

需要开发者自行管理全局变量，或通过 import-map + SystemJS 实现模块隔离。

**优点：** 零额外开销
**缺点：** 全局变量污染风险高，依赖开发者自律

### 3.2 qiankun — 三种沙箱

#### （1）SnapshotSandbox（快照沙箱）

```javascript
// 原理：激活时记录 window 快照，卸载时恢复
class SnapshotSandbox {
    constructor() {
        this.windowSnapshot = {};
        this.modifyPropsMap = {};
    }

    activate() {
        // 记录当前 window 状态
        for (const prop in window) {
            this.windowSnapshot[prop] = window[prop];
        }
        // 恢复上次修改的属性
        Object.keys(this.modifyPropsMap).forEach(prop => {
            window[prop] = this.modifyPropsMap[prop];
        });
    }

    deactivate() {
        // 记录本次修改
        for (const prop in window) {
            if (window[prop] !== this.windowSnapshot[prop]) {
                this.modifyPropsMap[prop] = window[prop];
                // 恢复原始值
                window[prop] = this.windowSnapshot[prop];
            }
        }
    }
}
```


| 优点                              | 缺点                 |
| --------------------------------- | -------------------- |
| 兼容性好（不支持 Proxy 的浏览器） | 遍历 window 性能差   |
| 实现简单                          | 无法同时激活多个沙箱 |

#### （2）ProxySandbox（代理沙箱，推荐）

```javascript
// 原理：为每个子应用创建一个 Proxy 代理 window
class ProxySandbox {
    constructor() {
        const fakeWindow = Object.create(null);
        const proxy = new Proxy(fakeWindow, {
            get(target, prop) {
                // 优先从 fakeWindow 取，取不到从真实 window 取
                const value = prop in target
                    ? target[prop]
                    : window[prop];
                // 绑定 this（如 setTimeout、document 等）
                return typeof value === 'function' && !value.name.startsWith('get')
                    ? value.bind(window)
                    : value;
            },
            set(target, prop, value) {
                // 所有赋值操作只修改 fakeWindow，不影响真实 window
                target[prop] = value;
                return true;
            },
        });
        this.proxy = proxy;
    }
}

// 每个子应用获得独立的 proxy
const sandbox1 = new ProxySandbox();
const sandbox2 = new ProxySandbox();

// 子应用 A 通过 proxy1 操作
sandbox1.proxy.myVar = "A";  // 不影响真实 window

// 子应用 B 通过 proxy2 操作
sandbox2.proxy.myVar = "B";  // 不影响真实 window

console.log(window.myVar);   // undefined — 完全隔离
```


| 优点                    | 缺点                                         |
| ----------------------- | -------------------------------------------- |
| 多实例同时激活          | 不支持 Proxy 的旧浏览器无法使用              |
| 性能好（不遍历 window） | 部分 API（如`window.top`）代理可能有边界问题 |
| 真正的隔离              | —                                           |

#### （3）LegacySandbox（单实例代理沙箱）

ProxySandbox 的单实例版本，操作会同步到真实 window，但记录修改并在卸载时恢复。适用于需要操作真实 window 的场景。

### 3.3 micro-app — Proxy + with 沙箱

```javascript
// micro-app 使用 Proxy 拦截 + with 语句实现作用域隔离
// 绑定作用域后，子应用中的全局变量访问被重定向到代理对象
function bindScope(code, proxyWindow) {
    // with 语句将变量查找重定向到 proxyWindow
    return `with(this) { ${code} }`;
}

// 执行时将 this 绑定到 proxyWindow
const fn = new Function('window', bindScope(code, proxyWindow));
fn.call(proxyWindow, proxyWindow);
```

与 qiankun ProxySandbox 类似，但通过 `with` + `Function` 组合实现了更精准的作用域控制。

### 3.4 wujie — iframe 天然隔离

```javascript
// wujie 利用 iframe 的天然 JS 隔离
// 每个 webcomponent 对应一个 iframe 作为 JS 执行环境

// 主应用
import { startApp } from 'wujie';

startApp({
    name: 'sub-app',
    url: 'http://localhost:3001',
    el: document.getElementById('sub-container'),
    // JS 在 iframe 中执行，完全独立的全局作用域
});

// iframe 中的 window 与主应用 window 完全隔离
// 不需要任何代理或快照
```


| 优点                          | 缺点                    |
| ----------------------------- | ----------------------- |
| 完美隔离（操作系统级别）      | iframe 创建有性能开销   |
| 无需任何 hack                 | 调试复杂度增加          |
| 支持`eval`、`new Function` 等 | 部分浏览器 API 行为差异 |

### 3.5 JS 隔离对比总结


| 方案          | 隔离方式     | 多实例 | 性能 | 兼容性   | 隔离程度 |
| ------------- | ------------ | ------ | ---- | -------- | -------- |
| single-spa    | 无           | -      | 最好 | 最好     | 无       |
| qiankun 快照  | window 快照  | 不支持 | 差   | 最好     | 中等     |
| qiankun Proxy | Proxy 代理   | 支持   | 好   | 需 Proxy | 好       |
| micro-app     | Proxy + with | 支持   | 好   | 需 Proxy | 好       |
| wujie         | iframe       | 支持   | 中等 | 好       | 完美     |

## 四、CSS 隔离对比

### 4.1 single-spa — 无隔离

single-spa 不提供 CSS 隔离方案，需要开发者自行处理：

```javascript
// 常见做法：命名前缀 + CSS Modules + 动态加载
// 子应用 A 的样式
.app-a .btn { color: red; }

// 子应用 B 的样式
.app-b .btn { color: blue; }
```

### 4.2 qiankun — 两种方案

#### （1）StrictStyleIsolation（Shadow DOM）

```javascript
registerMicroApps([{
    name: 'sub-app',
    entry: '//localhost:3001',
    container: '#sub-container',
    sandbox: {
        strictStyleIsolation: true,  // 使用 Shadow DOM
    },
}]);
```

```
#sub-container
└── #shadow-root (open)    ← 子应用的 DOM 和样式被封装在 Shadow DOM 内
    ├── <style>...</style>
    ├── <div>子应用内容</div>
    └── ...
```


| 优点            | 缺点                                       |
| --------------- | ------------------------------------------ |
| 真正的 CSS 隔离 | 弹窗/Modal 会挂在 body 上，脱离 Shadow DOM |
| 浏览器原生支持  | 部分组件库（如 antd 的 Modal）不兼容       |
| —              | CSS 选择器穿透受限                         |

#### （2）ExperimentalStyleIsolation（Scope CSS）

```javascript
sandbox: {
    experimentalStyleIsolation: true,
}
```

原理：为子应用的 CSS 规则自动添加前缀选择器：

```css
/* 子应用原始样式 */
.btn { color: red; }
.container .title { font-size: 16px; }

/* qiankun 转换后 */
div[data-qiankun="sub-app"] .btn { color: red; }
div[data-qiankun="sub-app"] .container .title { font-size: 16px; }
```


| 优点             | 缺点                             |
| ---------------- | -------------------------------- |
| 兼容性好         | 不是真正隔离（优先级可能被覆盖） |
| 弹窗组件正常工作 | 动态插入的 style 标签需额外处理  |
| 性能开销小       | @keyframes、:root 等无法隔离     |

### 4.3 micro-app — Shadow DOM + CSS 内联

```html
<micro-app
    name="sub-app"
    url="http://localhost:3001"
    shadowDOM                    <!-- 启用 Shadow DOM -->
></micro-app>
```

micro-app 默认使用类似 qiankun 的 scope 方案（自动添加前缀），也可开启 Shadow DOM：

```css
/* 默认 scope 模式：自动添加前缀 */
micro-app[name="sub-app"] .btn { color: red; }
```

### 4.4 wujie — iframe + WebComponents 天然隔离

```
渲染流程：
iframe（JS 执行环境）
  ↓ DOM 操作通过代理转发
WebComponent（渲染容器）
  └── Shadow DOM（CSS 隔离）
```

子应用的 CSS 天然被隔离在 iframe 中，渲染到 WebComponent 的 Shadow DOM 内，不会泄漏到主应用。


| 优点         | 缺点                         |
| ------------ | ---------------------------- |
| 完美隔离     | 同样有 Shadow DOM 的弹窗问题 |
| 无需额外处理 | —                           |

### 4.5 CSS 隔离对比总结


| 方案                 | 隔离方式            | 隔离程度 | 弹窗兼容 | 性能 |
| -------------------- | ------------------- | -------- | -------- | ---- |
| single-spa           | 无                  | 无       | 好       | 最好 |
| qiankun Shadow DOM   | Shadow DOM          | 完美     | 差       | 好   |
| qiankun Scope CSS    | 前缀选择器          | 中等     | 好       | 好   |
| micro-app scope      | 前缀选择器          | 中等     | 好       | 好   |
| micro-app Shadow DOM | Shadow DOM          | 完美     | 差       | 好   |
| wujie                | iframe + Shadow DOM | 完美     | 中等     | 中等 |

## 五、应用通信对比

### 5.1 single-spa — 自定义事件 + import-map

```javascript
// 方案一：CustomEvent
// 主应用发送
window.dispatchEvent(new CustomEvent('my-event', {
    detail: { user: 'Tom' }
}));

// 子应用接收
window.addEventListener('my-event', (e) => {
    console.log(e.detail); // { user: 'Tom' }
});

// 方案二：共享状态模块（需自行实现）
// shared-store.js
export const store = new EventTarget();
export const state = { user: null };
```

### 5.2 qiankun — initGlobalState

```javascript
// 主应用
import { initGlobalState } from 'qiankun';

const { onGlobalStateChange, setGlobalState } = initGlobalState({
    user: { name: 'Tom', role: 'admin' },
    token: 'abc123',
});

// 主应用监听变化
onGlobalStateChange((state, prev) => {
    console.log('主应用:', state);
});

// 主应用更新状态
setGlobalState({ token: 'new-token' });

// ----- 子应用 -----
export function mount(props) {
    // 子应用通过 props 获取通信 API
    props.onGlobalStateChange((state, prev) => {
        console.log('子应用收到:', state);
    });

    // 子应用也可以修改全局状态
    props.setGlobalState({ user: { name: 'Jerry' } });
}
```

**原理：** 基于 `onGlobalStateChange` 发布订阅模式，主应用持有状态源，子应用通过 props 获得读写能力。

### 5.3 micro-app — Data 机制

```html
<!-- 主应用通过 data 属性传递数据 -->
<micro-app
    name="sub-app"
    url="http://localhost:3001"
    :data="myData"
></micro-app>
```

```javascript
// 主应用发送
import { setData } from '@micro-zoe/micro-app';
setData('sub-app', { type: 'new-data', payload: { user: 'Tom' } });

// 子应用接收
window.microApp?.addDataListener((data) => {
    console.log('收到主应用数据:', data);
});

// 子应用向主应用发送
window.microApp?.dispatch({ type: 'response', payload: { status: 'ok' } });

// 主应用接收子应用数据
import { addGlobalDataListener } from '@micro-zoe/micro-app';
addGlobalDataListener((data) => {
    console.log('收到子应用数据:', data);
});
```

### 5.4 wujie — bus 事件总线

```javascript
// 主应用
import { bus } from 'wujie';

// 监听子应用消息
bus.$on('sub-app', (data) => {
    console.log('主应用收到:', data);
});

// 向子应用发送消息
bus.$emit('sub-app', { command: 'update-user', data: { name: 'Tom' } });

// ----- 子应用 -----
import { bus } from 'wujie';

// 监听主应用消息
bus.$on('main-app', (data) => {
    console.log('子应用收到:', data);
});

// 向主应用发送
bus.$emit('main-app', { type: 'ready' });

// wujie 还支持 window.$wujie 直接通信
// 子应用中
window.$wujie?.bus.$on('main-app', handler);
window.$wujie?.bus.$emit('main-app', data);
```

### 5.5 通信对比总结


| 方案       | 通信方式              | 易用性             | 跨框架 | 实时性 |
| ---------- | --------------------- | ------------------ | ------ | ------ |
| single-spa | 自定义事件 / 自行实现 | 低（需自行封装）   | 是     | 是     |
| qiankun    | initGlobalState       | 高（发布订阅）     | 是     | 是     |
| micro-app  | data 属性 + dispatch  | 高（类 Vue props） | 是     | 是     |
| wujie      | bus 事件总线          | 高（EventEmitter） | 是     | 是     |

## 六、沙箱方案优缺点汇总

### Proxy 沙箱（qiankun / micro-app）

```javascript
// 核心：拦截对 window 的读写
new Proxy(fakeWindow, { get, set, has, deleteProperty });
```

**优点：**

- 多实例支持，可同时运行多个子应用
- 性能好，不遍历 window
- 代理层面可精细控制白名单/黑名单

**缺点：**

- 不兼容不支持 Proxy 的浏览器（IE11）
- `with` + `eval` 场景下变量查找可能穿透
- 部分第三方库直接操作 `window` 的不可代理属性

### 快照沙箱（qiankun Legacy）

```javascript
// 核心：激活时拍照，卸载时 diff 恢复
activate() → diff(window, snapshot) → record changes
deactivate() → restore(snapshot)
```

**优点：**

- 兼容性好，不依赖 Proxy
- 实现简单

**缺点：**

- 遍历 window 性能差
- 单实例，不能同时激活
- 子应用操作 window 期间如果切换应用，状态可能丢失

### iframe 沙箱（wujie）

```javascript
// 核心：利用浏览器原生的 iframe 进程级隔离
// iframe 有独立的 window、document、history
```

**优点：**

- 操作系统级别的完美隔离
- 支持 `eval`、`new Function`、动态脚本等一切操作
- 无需任何 JS hack，稳定可靠
- 子应用可以运行不同版本的框架（React 17 + 18 共存）

**缺点：**

- iframe 创建有性能开销（约 50-100ms）
- DOM 操作需要从 iframe 代理到主文档，有通信损耗
- 弹窗、Modal 等 append 到 body 的行为需要特殊处理
- URL 同步需要额外处理（iframe 有独立的 history）
- 调试时需要切换 iframe 上下文

### Shadow DOM（CSS 隔离）

```javascript
// 核心：浏览器原生的 DOM 封装
element.attachShadow({ mode: 'open' });
```

**优点：**

- 真正的 CSS 隔离，外部样式进不来，内部样式出不去
- 浏览器原生支持，零运行时开销

**缺点：**

- antd/element-plus 的 Modal、Drawer 等 append 到 body 的组件样式丢失
- 全局字体、主题变量无法穿透 Shadow DOM
- 部分第三方库的 CSS 选择器在 Shadow DOM 内行为异常

## 七、选型建议


| 场景                  | 推荐方案   | 理由                          |
| --------------------- | ---------- | ----------------------------- |
| 中后台系统集成        | qiankun    | 生态成熟，文档完善，开箱即用  |
| 像用组件一样用微前端  | micro-app  | 接入成本最低，vue 风格 API    |
| 接入第三方/不可控应用 | wujie      | iframe 完美隔离，无需担心冲突 |
| 需要极致性能和自定义  | single-spa | 无沙箱开销，完全自由          |
| 多版本框架共存        | wujie      | iframe 隔离最彻底             |
| 简单子模块整合        | micro-app  | 轻量，学习成本最低            |

## 八、接入成本对比

```javascript
// ----- qiankun 接入 -----
// 主应用
import { registerMicroApps, start } from 'qiankun';
registerMicroApps([{ name: 'sub', entry: '//localhost:3001', container: '#sub', activeRule: '/sub' }]);
start();

// 子应用：需导出生命周期钩子
export async function bootstrap() {}
export async function mount(props) {}
export async function unmount() {}

// ----- micro-app 接入 -----
// 主应用：一行 HTML
<micro-app name="sub" url="http://localhost:3001"></micro-app>

// 子应用：几乎零改造（可选设置跨域）

// ----- wujie 接入 -----
// 主应用
import { startApp } from 'wujie';
startApp({ name: 'sub', url: 'http://localhost:3001', el: '#sub' });

// 子应用：零改造

// ----- single-spa 接入 -----
// 最复杂，需自行处理加载、沙箱、样式
```

**接入成本：micro-app ≈ wujie < qiankun << single-spa**

## 总结

微前端的核心挑战是**隔离与通信的平衡**：

- **隔离越彻底**（wujie/iframe），性能和通信成本越高
- **隔离越宽松**（single-spa），灵活度高但风险大
- **qiankun 和 micro-app** 在隔离与性能之间取得了较好的平衡

没有银弹，选型取决于业务场景。大多数中后台项目 qiankun 足够；需要极致隔离选 wujie；追求简单接入选 micro-app；需要完全控制选 single-spa。

记住一个原则：**能用简单方案解决的，不要用复杂方案。** 如果只是集成 2-3 个内部子应用，micro-app 可能就够了。如果需要接入大量不可控的第三方应用，wujie 的 iframe 隔离会更让人安心。
