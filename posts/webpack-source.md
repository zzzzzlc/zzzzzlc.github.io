---
title: Webpack 源码深度解析：设计理念、核心机制与增强实战
date: '2025-10-25'
tags:
  - 工程化
  - Webpack
  - 源码解析
  - 构建工具
category: 前端进阶
summary: >-
  从设计理念出发，深度解析 Webpack 的核心机制与源码——Tapable 事件系统、Compiler/Compilation/Module
  三大对象、make/seal/emit 主流程、Loader 链与 __webpack_require__ 运行时、代码分割/Tree Shaking/HMR
  原理，并延伸到增强思路：Loader/Plugin 开发实战、性能调优（按问题来源→多方案对比→优缺点→适配场景→局限性展开）、Module Federation。
---

# Webpack 源码深度解析：设计理念、核心机制与增强实战

Webpack 是前端工程化绕不开的名字。很多人会配置它，却未必理解它为什么这么设计、内部如何运转。本文既从源码层面拆解 Webpack 的核心架构（Tapable、Compiler/Compilation、主流程、运行时），也从设计理念回答“为什么”，最后落到增强思路——如何写 Loader/Plugin、如何做性能调优、Module Federation 怎么玩。读完你能在源码层面回答：一次 `webpack()` 调用背后发生了什么。

> 本文基于 Webpack 5（5.8x），所有源码脉络与运行时形态均对齐真实实现（为可读性做了精简）。

---

## 一、发展历程与定位

### 1. 版本演进

| 版本 | 年份 | 里程碑 |
| --- | --- | --- |
| Webpack 1 | 2014 | 首版，Code Splitting、Loader 体系诞生 |
| Webpack 2 | 2017 | 原生 ES Module 支持、Tree Shaking |
| Webpack 3 | 2017 | Scope Hoisting、`import()` 动态导入 |
| Webpack 4 | 2018 | 零配置（mode）、并行化、废弃 CommonsChunkPlugin |
| Webpack 5 | 2020 | **持久化缓存**、**Module Federation**、Asset Modules、Node Polyfill 移除 |

### 2. 在构建工具谱系中的定位

```
                静态分析能力
                     ↑
        Rollup       │     Webpack（bundle-based，全场景）
       （库优先）     │     一切皆模块 + 强插件生态
                     │
 ────────────────────┼────────────────────→  生态/运行时能力
   esbuild/swc       │     Parcel
  （编译器，极速）    │    （零配置）
                     │
        Vite = 开发期原生 ESM（esbuild 预构建）+ 生产期 Rollup
```

- **Webpack**：bundle-based，开发期也要先打包再启动，慢但能力全。
- **Vite**：dev 期借浏览器原生 ESM 按需编译（快），prod 期交给 Rollup。
- **Rollup**：产物干净，适合库。
- **esbuild/swc**：底层编译器，极致速度，常被其他工具当引擎。

理解这个定位，才能理解后面 Webpack 的所有设计取舍——**它生来就要“把整个应用打成可在任意环境（含老旧浏览器）运行的 bundle”**，这是它一切复杂性的根源。

---

## 二、核心设计理念

### 1. 一切皆模块（Everything is a Module）

在 Webpack 眼里，`.js / .css / .png / .vue / .ts` 没有本质区别——都是模块，都通过 `import` 串联成一张依赖图。差异只在于“由哪个 Loader 把它翻译成 JS 模块”。

```javascript
import './style.css';      // css-loader → 转成 JS 模块（注入 <style>）
import logo from './a.png'; // asset loader → 转成 URL 字符串
```

这个抽象让“前端应用”第一次能像 Node 一样用统一模块系统组织所有资源。

### 2. 万物皆插件（Plugin-Driven / Tapable）

Webpack 自身只是一个“调度骨架”，真正干活（生成 HTML、压缩、抽取 CSS、注入环境变量）的全是插件。甚至 `SplitChunksPlugin`、`DefinePlugin` 这些“内置能力”也是插件。

骨架与插件之间靠 **Tapable 事件系统** 通信——Webpack 在构建生命周期的每个节点广播事件，插件订阅自己关心的事件插入逻辑。这是 Webpack 可扩展性的根基（第四章详解）。

### 3. 静态依赖图（Dependency Graph）

Webpack 从 Entry 出发，**静态分析** `import / require`，递归构建一张有向依赖图，再据此生成 Chunk、输出文件。它是“先全量分析、再统一输出”的模式，区别于 Vite 的“运行时按需编译”。

### 4. 理念对比：为什么 Webpack 慢但稳

| 理念 | Webpack | Vite/Rollup |
| --- | --- | --- |
| 开发期 | 全量打包后启动 | 原生 ESM 按需编译 |
| 抽象单位 | 模块依赖图 | ESM 导入导出 |
| 扩展模型 | Tapable 事件钩子（重） | Rollup 钩子（轻） |
| 取舍 | 能力全、生态强、可维护历史包袱 | 极速、简洁 |

没有谁绝对更好——Webpack 的“慢”换来的是对任意模块系统（CommonJS/AMD/ESM 混用）、任意部署环境的兜底能力。

---

## 三、核心架构：三大对象

理解 Webpack 源码，先抓住三个核心对象，它们的关系就是整个构建的骨架。

### 1. Compiler —— 全局构建器（单例）

`Compiler` 代表**一次完整的 Webpack 构建**（一次 `webpack()` 调用对应一个 Compiler）。它持有全局配置、所有插件、主入口 `run()`，生命周期贯穿整个 watch/构建周期。

```
Compiler（全局，watch 期间复用）
  ├─ hooks: environment / afterEnvironment / afterPlugins /
  │         beforeRun / run / beforeCompile / compile /
  │         make / afterCompile / emit / done ...
  ├─ 创建 → Compilation
  └─ 持有 webpack.config + 所有 Plugin
```

### 2. Compilation —— 单次构建上下文

每次重新编译（首次或文件变化触发）都会 new 一个 `Compilation`。它持有这次编译的**依赖图、所有模块、生成的 chunk、产物 assets**，以及自己的 hooks（`buildModule / succeedModule / seal / optimize / afterChunks`）。watch 模式下 Compiler 会创建多个 Compilation。

### 3. Module / Chunk / Asset —— 数据三件套

```
Module（源码模块）  →  被解析/Loader 转换后的最小单元
       │ 依赖图
       ▼
Chunk（代码块）     →  一组 Module 的逻辑集合（entry / splitChunks / 动态 import）
       │ 封装
       ▼
Asset（产物文件）   →  最终写入 dist 的文件（含 .js / .css / map）
```

### 4. 源码目录结构（lib/）

```
lib/
├─ webpack.js            # 入口，创建 Compiler
├─ Compiler.js           # 全局构建器，run() 主入口
├─ Compilation.js        # 单次编译上下文（依赖图、模块、chunk）
├─ Module.js             # 模块基类
│  ├─ NormalModule.js    # 普通模块（走 Loader）
│  ├─ ExternalModule.js  # externals
│  └─ ContextModule.js   # require.context
├─ Chunk.js / ChunkGraph.js
├─ dependencies/         # 各种 Dependency 类型（import/require 的抽象）
├─ Tapable.js（独立包）  # 事件系统
├─ ResolverFactory.js    # 模块路径解析（enhanced-resolve）
└─ webpack.config.js
```

记住这条主线：**Compiler.run() → new Compilation → 构建模块图 → seal 生成 chunk → emit 输出 asset**。

---

## 四、Tapable —— 插件系统的基石（源码解析）

Webpack 几乎所有对象（Compiler、Compilation、甚至 Resolver）都继承自 Tapable。它本质上是一个**带类型语义的发布订阅库**。

### 1. Hook 类型全景

Tapable 的 Hook 按「执行方式 × 流控方式」组合成 9 种：

| | Sync（同步） | AsyncSeries（异步串行） | AsyncParallel（异步并行） |
| --- | --- | --- | --- |
| **Basic（普通）** | SyncHook | AsyncSeriesHook | AsyncParallelHook |
| **Bail（熔断）** | SyncBailHook | AsyncSeriesBailHook | AsyncParallelBailHook |
| **Waterfall（瀑布）** | SyncWaterfallHook | AsyncSeriesWaterfallHook | — |
| **Loop（循环）** | SyncLoopHook | — | — |

- **Bail**：任一注册函数返回非 undefined，立即结束（后面不执行）——用于“谁能处理谁接管”。
- **Waterfall**：上一个函数的返回值作为下一个的入参——用于数据流水加工。
- **Loop**：任一函数返回非 undefined 就重来一轮，直到全部 undefined——用于“处理到稳定”。
- **Parallel**：所有异步函数同时触发，等全部完成。
- **Series**：异步函数按顺序执行。

### 2. 手写 Tapable 核心（源码精简）

理解 Tapable 最好的方式是看它的触发机制。核心是 `tap` 注册、`call` 触发，配合 `interceptors`：

```javascript
// 简化版 SyncHook：同步、顺序执行所有注册函数
class SyncHook {
    constructor(args = []) {
        this.args = args;          // 形参名列表（仅文档用途）
        this.taps = [];            // { name, fn }
        this.interceptors = [];    // 拦截器
    }

    tap(name, fn) {
        this.interceptors.forEach(i => i.register?.({ name, fn }));
        this.taps.push({ name, fn });
    }

    // Tapable 真实实现会动态 new Function 拼接出 call（性能优化），
    // 这里用循环等价表达
    call(...args) {
        for (const t of this.taps) {
            this.interceptors.forEach(i => i.call?.(...args));
            t.fn(...args);
        }
    }
}

// SyncBailHook：返回非 undefined 即熔断
class SyncBailHook extends SyncHook {
    call(...args) {
        for (const t of this.taps) {
            const result = t.fn(...args);
            if (result !== undefined) return result;   // 熔断
        }
    }
}
```

> **性能细节**：真实 Tapable 不会用循环 `call`，而是在 `tap / call` 时通过 `HookCodeFactory` **动态生成一个扁平的函数体**（`new Function(...)`），把所有 tap 内联进去。这避免了每次触发都遍历 taps 数组，是 Webpack 在成百上千个钩子下仍能保持性能的关键。

### 3. Webpack 如何用 Tapable 串联一切

```javascript
class Compiler {
    constructor() {
        this.hooks = {
            environment:      new SyncHook([]),
            beforeRun:        new AsyncSeriesHook(["compiler"]),
            make:             new AsyncParallelHook(["compilation"]),
            shouldEmit:       new SyncBailHook(["compilation"]),
            emit:             new AsyncSeriesHook(["compilation"]),
            done:             new AsyncSeriesHook(["stats"]),
        };
    }
}
```

`make` 用 **AsyncParallelHook**（多个插件可并行往依赖图里塞模块）；`shouldEmit` 用 **SyncBailHook**（任一插件说不发就不发）；`done` 用 AsyncSeriesHook（通知顺序敏感的收尾）。**Hook 类型本身就是 API 的语义文档**。

---

## 五、构建主流程源码走读

把 Compiler、Compilation、Tapable 串起来，就是一次构建的完整脉络。

### 1. 三大阶段总览

```
webpack(config)
   └─ creates Compiler，挂载所有 plugin（plugin.apply(compiler)）
Compiler.run(callback)
   ├─ hooks.beforeRun / run（AsyncSeriesHook）
   ├─ compile()：new Compilation（hooks.compilation 触发插件再挂 compilation 钩子）
   ├─ hooks.make（AsyncParallelHook）── Compilation.addEntry()
   │        ┌────────────  make 阶段：构建依赖图  ────────────┐
   │        │  addEntry → addModuleTree → buildModule           │
   │        │  → runLoaders（Loader 转换源码）                   │
   │        │  → parser.parse（解析 import/require 收集依赖）   │
   │        │  → processModuleDependencies（递归）              │
   │        └──────────────────────────────────────────────────┘
   ├─ hooks.afterCompile
   ├─ Compilation.seal() ── seal 阶段：生成 chunk
   │        ├─ buildChunkGraph（梳理 chunk → module 关系）
   │        ├─ splitChunks（拆分公共依赖）
   │        ├─ optimize（压缩、Tree Shaking、Scope Hoisting）
   │        └─ createChunkAssets（chunk → asset 文件对象）
   ├─ hooks.emit（AsyncSeriesHook）── emit 阶段：可改产物
   └─ 写入 dist → hooks.done（AsyncSeriesHook）
```

### 2. 关键源码脉络（精简伪码）

```javascript
// Compiler.run 的核心脉络
class Compiler {
    run(callback) {
        const finalCallback = (err, stats) => callback(err, stats);

        const onCompiled = (compilation) => {
            // ① seal 完成后，决定是否输出
            if (this.hooks.shouldEmit.call(compilation) === false) {
                return this.hooks.done.call(stats);
            }
            // ② emit：把 compilation.assets 写入 dist
            this.emitAssets(compilation, (err) => {
                this.hooks.done.call(stats);   // 构建完成
            });
        };

        // 触发 beforeRun → run，再进入 compile
        this.hooks.beforeRun.callAsync(this, () => {
            this.hooks.run.callAsync(this, () => {
                this.compile(onCompiled);     // ← 创建 Compilation 并 make
            });
        });
    }

    compile(callback) {
        const compilation = new Compilation(this);
        this.hooks.compilation.call(compilation);   // 插件在此挂 compilation 钩子
        // make：触发插件（SingleEntryPlugin）往图里塞入口模块
        this.hooks.make.callAsync(compilation, (err) => {
            compilation.finish(err => {
                compilation.seal(err => {            // ← seal 阶段
                    callback(compilation);
                });
            });
        });
    }
}
```

### 3. make 阶段：依赖图是怎么长出来的

```javascript
// Compilation.addEntry → buildModule 核心脉络
class Compilation {
    addModule(module, callback) {
        // 去重：同一模块只构建一次（缓存）
        if (this.modules.has(module.identifier())) {
            return callback(null, this.getModule(module));
        }
        this.modules.set(module.identifier(), module);
        this.buildModule(module, callback);
    }

    buildModule(module, callback) {
        this.hooks.buildModule.call(module);
        module.build(this, (err) => {
            this.hooks.succeedModule.call(module);
            // 解析出模块的依赖，递归构建
            this.processModuleDependencies(module, callback);
        });
    }
}
```

`module.build()` 内部对 `NormalModule` 来说就是 **runLoaders + parser.parse**（下一章详解）。parse 时遇到 `import xxx`，会创建对应的 `Dependency` 对象，`processModuleDependencies` 据此递归 `addModule`——依赖图就这样深度优先地长出来。

---

## 六、模块解析与 Loader 链（源码）

### 1. 模块路径解析：enhanced-resolve

`import './foo'` 里的 `'./foo'` 怎么变成绝对路径？Webpack 用 `enhanced-resolve`，它比 Node 的 `require.resolve` 强大得多：

```
解析 'lodash'
  ├── alias 替换
  ├── 主字段优先级（package.json 的 main / module / browser / exports）
  ├── 扩展名补全（.js / .json / .tsx ...）
  ├── 符号链接（symlink）处理
  └── 缓存命中
```

### 2. Loader 链：loader-runner 的 runLoaders

`use: ['style-loader', 'css-loader']`，执行顺序是 **从右到左**（css-loader 先、style-loader 后）。为什么？因为从语义上是“洋葱模型”——最右边的 loader 先接触原始源码，逐层向外包装。

```javascript
// NormalModule.build 内部（精简）
function buildModule(module) {
    runLoaders({
        resource: module.resource,        // 源文件绝对路径
        loaders: module.loaders,          // 解析后的 loader 数组
        context: { addDependency, emitFile },  // loader 能用的能力
        readResource: fs.readFile.bind(fs),
    }, (err, result) => {
        // result[0].buffer（或 string）= 所有 loader 处理完的最终源码
        // 此时必须是一段 JS 字符串，才能被 parser.parse
        const source = result[0];
        module.parser.parse(source);
    });
}
```

### 3. loader-runner 的执行机制（源码精简）

```javascript
// loader-runner 核心：iteratePitchingLoaders + runSyncOrAsync
function runLoaders(options, callback) {
    const loaders = options.loaders;
    const resource = options.resource;
    const loaderContext = {};        // 所有 loader 共享 this 上下文

    function processResource() {
        // 读源文件，交给“从右到左”的 normal 阶段
        const source = fs.readFileSync(resource);
        iterateNormalLoaders(0, source);
    }

    // pitch 阶段：从左到右，任一 pitch 返回值就“截断”，跳过后续 pitch 与读文件
    function iteratePitchingLoaders(index, current) {
        if (index >= loaders.length) return processResource();
        const loader = loaders[index];
        if (loader.pitch) {
            loader.pitch.call(loaderContext, ..., (err, result) => {
                if (result !== undefined) {
                    // 截断：直接进入 normal 阶段，从当前 loader 往左
                    iterateNormalLoaders(index, result);
                } else {
                    iteratePitchingLoaders(index + 1, current);
                }
            });
        } else {
            iteratePitchingLoaders(index + 1, current);
        }
    }

    // normal 阶段：从右到左，依次把上一个的输出作为下一个的输入
    function iterateNormalLoaders(index, current) {
        if (index < 0) return callback(null, [{ buffer: current }]);
        const loader = loaders[index];
        const result = loader.normal.call(loaderContext, current);
        iterateNormalLoaders(index - 1, result);
    }

    iteratePitchingLoaders(0);
}
```

**两个关键点**：
- **从右到左**：normal 阶段 index 递减，最后一个 loader（最右）最先拿到原始源码。
- **pitch 机制**：pitch 是从左到右的“前置拦截”，常用于跳过昂贵读取（如 `css-loader`/`style-loader` 用 pitch 协作）。

---

## 七、产物运行时：`__webpack_require__` 源码解剖

构建出的 `bundle.js` 怎么在没有模块系统的浏览器里跑起来？答案是一段 Webpack 注入的 **运行时（runtime）**。下面是真实形态的精简版：

```javascript
// bundle.js 的结构
(() => {
    // ① 模块表：每个模块被包成一个函数
    const __webpack_modules__ = {
        1: (module, __webpack_exports__, __webpack_require__) => {
            // src/index.js 的代码（已被 Loader + parser 转换）
        },
        2: (module, __webpack_exports__, __webpack_require__) => {
            // src/utils.js
        },
    };

    // ② 模块缓存
    const __webpack_module_cache__ = {};

    // ③ 核心：require 函数 —— 实现 CommonJS 语义的模块加载
    function __webpack_require__(moduleId) {
        // 缓存命中：模块只执行一次（单例）
        if (__webpack_module_cache__[moduleId]) {
            return __webpack_module_cache__[moduleId].exports;
        }
        const module = (__webpack_module_cache__[moduleId] = {
            exports: {},
        });
        // 执行模块函数，把 require/exports 注入进去
        __webpack_modules__[moduleId](
            module,
            module.exports,
            __webpack_require__
        );
        return module.exports;
    }

    // ④ 启动入口
    __webpack_require__(1);
})();
```

### 运行时的几个核心辅助函数

| 函数 | 作用 |
| --- | --- |
| `__webpack_require__.r` | 给 exports 打 ESM 标记（`Symbol.toStringTag = 'Module'`） |
| `__webpack_require__.d` | 用 getter 定义具名导出（懒求值，配合 Tree Shaking） |
| `__webpack_require__.o` | `Object.prototype.hasOwnProperty` 的简写 |
| `__webpack_require__.e` | 异步加载 chunk（动态 import 产物），返回 Promise |
| `__webpack_require__.f` | chunk 加载策略表（jsonp / fetch），`e` 会遍历它 |

### 动态 import 的产物：`__webpack_require__.e`

```javascript
// import('./lazy.js') 被编译成：
__webpack_require__
    .e(2)                              // 异步加载 chunk 2 的文件
    .then(__webpack_require__.t.bind(__webpack_require__, 42))
// .e 内部：<script src="2.chunk.js"> 加载，完成后 resolve
// .t：把模块的导出按 ESM 规整后给你
```

理解运行时，就理解了“为什么 Webpack 产物能在任何浏览器跑”——它自带了一套模块系统实现，不依赖浏览器原生 ESM。

---

## 八、代码分割与 Chunk 生成

### 1. ChunkGraph：从依赖图到产物块

依赖图（Module）是“源码维度的图”，但产物要按“加载维度”组织——这就是 Chunk。一个 Chunk 是一组最终会进同一个文件的 Module。

```
入口 chunk（initial）   ← entry 直接产生
异步 chunk（async）     ← import() 产生
公共 chunk（split）     ← SplitChunksPlugin 提取
runtime chunk           ← 运行时代码单独拆出（optimization.runtimeChunk）
```

### 2. SplitChunksPlugin 原理

seal 阶段，`SplitChunksPlugin` 扫描所有 chunk，按规则把“被多个 chunk 共享的 module”提取成独立 chunk：

```javascript
optimization: {
    splitChunks: {
        chunks: 'all',                  // 对同步+异步 chunk 都生效
        minSize: 20000,                 // 提取出的 chunk 至少 20KB
        minChunks: 1,                   // 至少被 N 个 chunk 引用
        cacheGroups: {
            vendors: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
            },
        },
    },
}
```

`cacheGroups` 是“分组规则”——满足 `test` 的 module 被归到 vendors 组，达到 `minSize/minChunks` 就独立成 chunk。

### 3. Chunk 的加载方式

- **同步 chunk**：直接内联进主 bundle 的 modules 表。
- **异步 chunk**：单独文件，运行时通过 `<script>`（jsonp）或 `fetch` 加载，由 `__webpack_require__.e` 触发。

---

## 九、Tree Shaking 与 HMR 原理

### 1. Tree Shaking

Tree Shaking 分两步：**标记 + 删除**。

**第一步：标记（Webpack make 阶段）**
`parser` 解析 `import { used } from './utils'`，在模块的导出表上标记哪些导出被使用（`usedExports`）。未使用的导出标记为 unused。

```javascript
// utils.js
export function used() { return 1; }
export function unused() { return 2; }    // app 只 import { used }
// → Webpack 标记 unused 为「未使用」
```

**第二步：删除（Terser 压缩阶段）**
被标记 unused 的导出，其代码会被 Terser 当作死代码删除（因为没人引用它）。

**`sideEffects` 的作用**：有些模块（如 polyfill、CSS）即使没被使用导出也不能删（因为有副作用）。在 `package.json` 声明 `"sideEffects": false` 告诉 Webpack“我这边没副作用，大胆删”；或声明数组指明哪些文件有副作用。

### 2. HMR（热模块替换）

HMR 的目标：改一个文件，**只替换这个模块，不刷新整页**。

```
浏览器                                  开发服务器（webpack-dev-server）
  │                                          │
  │  ① WebSocket 长连接                       │
  │ ◄───────────────────────────────────────  │ 文件变化 → 增量 rebuild
  │  ② server 推送 {c: [42], m: ['src/a.js']} │  只重新编译受影响模块
  │                                          │  生成 hot-update.json + hot-update.js
  │  ③ module.hot.check() → 下载补丁         │
  │ ───────────────────────────────────────►  │ 返回 hot-update chunk
  │  ④ module.hot.apply()                     │
  │     旧模块 → 新模块替换；调用 accept 回调  │
```

```javascript
// 业务代码声明热替换边界
if (module.hot) {
    module.hot.accept('./app', () => {
        // ./app 更新后，这里被调用，重新挂载新版本
        render();
    });
}
```

没有 `accept` 的模块会向上冒泡，直到某个祖先 `accept`，否则整页刷新。这就是“为什么有些改动 HMR 生效、有些会整页刷新”。

---

## 十、增强思路 ①：Loader 开发实战

### 1. Loader 设计原则

- **单一职责**：一个 Loader 只做一件事，用链式组合复杂能力。
- **纯函数优先**：同样的输入永远产生同样的输出（可缓存）；确需状态用 `this`。
- **output 必须可被下一个环节消费**：normal loader 最终必须返回 JS 字符串（或能被 parser 解析的形式）。
- **pitch 谨慎用**：它会改变执行流，只在“想短路”时用。

### 2. 实战：移除 console 的 Loader

```javascript
// remove-console-loader.js
module.exports = function removeConsoleLoader(source) {
    // this.query 是 loader 配置（v5 推荐用 schema-typed options，这里简化）
    const { exclude = [] } = this.getOptions() || {};
    // 默认移除所有 console.*，exclude 指定的方法保留
    const keep = exclude.join('|');
    const regex = new RegExp(`console\\.(?!${keep})\\w+\\([^)]*\\);?`, 'g');
    return source.replace(regex, '');
};

// webpack.config.js
module: {
    rules: [{
        test: /\.js$/,
        exclude: /node_modules/,
        use: [{ loader: './remove-console-loader.js', options: { exclude: ['error'] } }],
    }],
}
```

### 3. 异步 Loader：处理大文件别阻塞

```javascript
module.exports = function asyncLoader(source) {
    const callback = this.async();          // 声明异步，拿到 callback
    heavyTransform(source).then(result => {
        callback(null, result);             // (err, content, sourceMap, meta)
    }).catch(callback);
};
```

> **常见坑**：① 忘记返回值（同步 loader 必须 return）；② 在 Loader 里直接 `import axios/fetch`——Loader 跑在 Node，应该用 Node 的方式；③ 不处理 `sourceMap` 链，导致后续 sourcemap 断链（应透传或转换）。

---

## 十一、增强思路 ②：Plugin 开发实战

### 1. Plugin 设计模式

一个 Plugin 就是一个带 `apply` 方法的类，`apply` 接收 `compiler`，在里面订阅 hooks：

```javascript
class BuildTimePlugin {
    apply(compiler) {
        compiler.hooks.done.tap('BuildTimePlugin', (stats) => {
            const time = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
            console.log(`✅ 构建完成，耗时 ${time}s`);
        });
    }
}
```

### 2. 实战：生成产物清单 Plugin

很多团队需要一份产物清单（文件名 + hash + 大小），便于 CDN 对账 / 版本追溯：

```javascript
const { Compilation } = require('webpack');

class AssetManifestPlugin {
    constructor(options = {}) {
        this.output = options.output || 'manifest.json';
    }

    apply(compiler) {
        compiler.hooks.thisCompilation.tap('AssetManifestPlugin', (compilation) => {
            // emit 阶段（assets 已生成、未写入磁盘）
            compilation.hooks.processAssets.tap(
                {
                    name: 'AssetManifestPlugin',
                    stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,   // 产物已就绪阶段
                },
                (assets) => {
                    const manifest = {};
                    for (const [name, source] of Object.entries(assets)) {
                        manifest[name] = {
                            size: source.size(),
                            hash: require('crypto')
                                .createHash('md5')
                                .update(source.buffer())
                                .digest('hex')
                                .slice(0, 8),
                        };
                    }
                    // 把清单也写进产物
                    assets[this.output] = {
                        source: () => JSON.stringify(manifest, null, 2),
                        size: () => JSON.stringify(manifest).length,
                    };
                }
            );
        });
    }
}

// 使用：plugins: [new AssetManifestPlugin({ output: 'manifest.json' })]
```

### 3. Compiler hooks vs Compilation hooks 怎么选

| 想做的事 | 选哪个 |
| --- | --- |
| 读全局配置、只在构建开始/结束动 | `compiler.hooks`（beforeRun / done） |
| 改模块、改产物、参与 seal | `compilation.hooks`（buildModule / processAssets / optimize） |
| 改最终写入的文件内容 | `compilation.hooks.processAssets`（按 stage 分阶段） |

`processAssets` 是 Webpack 5 的新关键钩子，用 **stage** 区分时机（`PRE_PROCESS / ANALYSE / OPTIMIZE / REPORT`），替代了 v4 容易乱序的 `emit`。

---

## 十二、增强思路 ③：性能调优（按规范展开）

> 本节严格按 **问题来源 → 多方案对比 → 优缺点 → 适配场景 → 局限性** 展开。

### 1. 问题来源

大型项目用 Webpack 普遍的痛：
- **启动慢**：一个中型项目 dev 启动 30s+，改一行代码等半天。
- **构建慢**：CI 全量 build 几分钟，PR 反馈滞后。
- **产物大**：bundle 首屏几 MB，LCP 爆红。
- **HMR 慢**：项目越大，单次热更新越久。

根因：Webpack 是 bundle-based，**全量分析依赖图** + **逐模块跑 Loader**，复杂度随模块数线性甚至超线性增长。

### 2. 多方案对比（构建提速）

| 方案 | 原理 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **持久化缓存（5.0+）** | `cache.type: 'filesystem'` 把依赖图、中间产物缓存到磁盘 | 增量启动从分钟级到秒级，零改造 | 首次仍慢；缓存失效场景需排查 |
| **thread-loader** | 把 Loader 放 worker 池并行跑 | 利用多核，CPU 密集 Loader 提速明显 | worker 通信开销；部分 Loader 不兼容 |
| **缩小 include/exclude** | 只让 Loader 处理必要文件 | 立竿见影，配置即生效 | 规则要细心维护 |
| **externals** | 大依赖（react/antd）不打进 bundle，用 CDN | 产物骤减，构建提速 | 运行时依赖 CDN 可用性 |
| **换底层引擎（esbuild/swc）** | 用 esbuild-loader / swc-loader 替代 babel/ts-loader | 单文件编译快 10-100 倍 | 个别语法/插件兼容差异 |
| **DLL（已过时）** | 预打包不变依赖 | 历史方案 | v5 持久化缓存已覆盖，不推荐 |

### 3. 多方案对比（产物优化）

| 方案 | 作用 | 代价 |
| --- | --- | --- |
| **splitChunks 拆 vendor** | 长期缓存第三方库（单独 hash） | 配置需按实际调 |
| **动态 import / 按路由分包** | 首屏只加载必要代码 | 需处理 loading 态 |
| **Tree Shaking + sideEffects** | 删死代码 | 依赖 ESM 静态分析 |
| **代码压缩（Terser/Swc）** | 压缩 + 删注释 | 构建时间增加 |
| **Scope Hoisting** | 合并模块，减少闭包开销 | 仅 ESM 生效 |

### 4. 优缺点深入

**持久化缓存**是 Webpack 5 提速的银弹，但有坑：升级 Loader/Plugin 版本后旧缓存可能不兼容（用 `cache.buildDependencies` 把配置文件纳入缓存指纹可缓解）。`thread-loader` 对 IO 密集型 Loader（读文件为主）反而可能变慢——它只对 CPU 密集（如 babel 编译）有效。

### 5. 适配场景

- **中型项目首选组合**：持久化缓存 + 缩小 include/exclude + esbuild-loader（替换 babel）
- **大型项目**：再加 splitChunks 精细分包 + externals CDN 化重度依赖
- **CI 全量构建**：持久化缓存配合 CI 缓存目录，二次构建秒级
- **首屏优化**：动态 import 路由级分包 + Tree Shaking + Scope Hoisting

### 6. 分析工具（必配）

- `webpack-bundle-analyzer`：可视化产物体积，找胖包
- `speed-measure-webpack-plugin`：各 Loader/Plugin 耗时排行，定位慢点

### 7. 局限性

- bundle-based 架构的“慢”是基因决定的，提速有上限——要根本解决得换 Vite/esbuild（见 build-tools.md 对比）。
- 持久化缓存在配置频繁变动时收益打折。
- 过度分包会导致 HTTP 请求过多（尤其 HTTP/1.1），需在“分包粒度”和“请求数”间平衡。

---

## 十三、增强思路 ④：Module Federation 与微前端

### 1. Module Federation 是什么

Webpack 5 原生支持**跨应用共享模块**：一个应用（remote）可以把某个模块 `expose` 出去，另一个应用（host）在运行时 `import` 它——两个独立构建的产物，能在浏览器里互相消费。

```javascript
// remote（子应用）：webpack.config.js
new ModuleFederationPlugin({
    name: 'remoteApp',
    filename: 'remoteEntry.js',
    exposes: {
        './Widget': './src/Widget',      // 暴露 Widget 模块
    },
    shared: ['react', 'react-dom'],      // 共享依赖，避免重复加载
});

// host（主应用）
new ModuleFederationPlugin({
    name: 'hostApp',
    remotes: {
        remoteApp: 'remoteApp@https://cdn/remoteEntry.js',
    },
    shared: ['react', 'react-dom'],
});
```

```javascript
// host 运行时动态加载 remote 的模块
const Widget = React.lazy(() => import('remoteApp/Widget'));
```

### 2. 原理

`remoteEntry.js` 是一个**运行时模块清单 + 加载器**。host 遇到 `import('remoteApp/Widget')` 时，先拉取 remoteEntry.js，按它提供的映射加载对应 chunk。`shared` 让两端协商共享依赖版本（优先复用已加载的高版本）。

### 3. 与 qiankun / single-spa 对比

| | Module Federation | qiankun / single-spa |
| --- | --- | --- |
| 共享粒度 | 模块级（细） | 应用级（粗） |
| 依赖共享 | 原生支持（shared） | 需手动 externals |
| 接入成本 | 需统一 Webpack 5 | 框架无关，接入更灵活 |
| 适配场景 | 同技术栈、需细粒度共享 | 异构技术栈微前端 |

### 4. 局限性

- 强依赖 Webpack 5（两端都得是），异构构建工具（Vite/Rollup）需额外适配。
- 版本协商有运行时开销，shared 版本不一致时可能加载多份。
- 调试链路跨越应用边界，问题定位成本高。

---

## 十四、总结

Webpack 的复杂性来自它要解决的问题：**把任意模块系统的任意资源，打包成能在任意环境运行的 bundle**。理解它，抓住一条主线和三块基石：

- **一条主线**：`Compiler.run() → make（构建依赖图）→ seal（封装 chunk）→ emit（输出产物）`
- **基石一**：Tapable——所有扩展点都是 Hook，Hook 类型即语义。
- **基石二**：三大对象——Compiler（全局）、Compilation（单次）、Module/Chunk/Asset（数据流）。
- **基石三**：运行时——`__webpack_require__` 让产物自带模块系统。

至于增强（Loader / Plugin / 性能调优 / Module Federation），本质都是**在 Tapable 钩子上插入逻辑** + **理解模块图与产物的关系**。掌握了源码主线，配置和排错就不再是黑盒。

> 本文与 [Webpack 与 Vite 对比](./build-tools) 互补：那篇讲“选哪个”，本篇讲“Webpack 内部怎么跑”。
