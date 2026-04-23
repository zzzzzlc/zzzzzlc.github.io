---
title: "Webpack 与 Vite 打包工具对比、核心原理与自定义打包工具开发"
date: "2026-04-22"
tags: ["Webpack", "Vite", "构建工具", "前端工程化"]
category: "技术"
summary: "深入对比 Webpack 与 Vite 的设计理念、核心原理与性能差异，并介绍如何从零开发一个简易打包工具来理解构建的本质。"
---

# Webpack 与 Vite 打包工具对比、核心原理与自定义打包工具开发

前端构建工具是现代 Web 开发的基础设施。Webpack 和 Vite 分别代表了两个时代的方案。本文将对比两者差异、剖析核心原理，并动手实现一个简易打包工具。

## 一、Webpack 核心概念

### 1. 五大核心

| 概念 | 说明 |
|------|------|
| **Entry** | 打包入口，Webpack 从这里开始构建依赖图 |
| **Output** | 输出配置，打包后文件的存放位置和命名规则 |
| **Loader** | 文件转换器，让 Webpack 能处理非 JS 文件（CSS、图片、TS 等） |
| **Plugin** | 插件系统，扩展 Webpack 能力（压缩、HTML 生成、环境变量注入） |
| **Module** | 一切皆模块，JS、CSS、图片都是模块，通过 Loader 统一处理 |

### 2. 工作流程

```
读取配置 → 识别入口 → 构建模块依赖图 → 调用 Loader 转换 →
生成 Chunk → Plugin 处理优化 → 输出文件到 dist/
```

```javascript
// webpack.config.js
module.exports = {
    entry: "./src/index.js",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].[contenthash].js",
    },
    module: {
        rules: [
            { test: /\.css$/, use: ["style-loader", "css-loader"] },
            { test: /\.js$/, use: "babel-loader", exclude: /node_modules/ },
            { test: /\.(png|jpg)$/, type: "asset/resource" },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({ template: "./index.html" }),
        new MiniCssExtractPlugin(),
    ],
    optimization: {
        splitChunks: { chunks: "all" },
    },
};
```

### 3. Loader 原理

Loader 本质是一个函数，接收源文件内容，返回转换后的结果：

```javascript
// 一个简单的 Loader：将所有 console.log 移除
module.exports = function(source) {
    return source.replace(/console\.log\(.*?\);?/g, "");
};

// 支持链式调用，从右到左执行
// use: ["style-loader", "css-loader"]
// 执行顺序：css-loader → style-loader
```

### 4. Plugin 原理

Plugin 基于 Tapable 事件系统，在构建生命周期的各个钩子中执行：

```javascript
class MyPlugin {
    apply(compiler) {
        // compilation 完成后触发
        compiler.hooks.done.tap("MyPlugin", (stats) => {
            console.log("打包完成，耗时:", stats.endTime - stats.startTime, "ms");
        });

        // emit：输出文件到 dist 前触发
        compiler.hooks.emit.tapAsync("MyPlugin", (compilation, callback) => {
            // 可以修改或添加输出文件
            compilation.assets["version.txt"] = {
                source: () => "1.0.0",
                size: () => 5,
            };
            callback();
        });
    }
}
```

**Webpack 生命周期主要钩子：**

```
初始化 → entryOption → afterPlugins → compilation →
make（构建模块） → seal（生成 chunk） → emit（输出文件） → done
```

## 二、Vite 核心概念

### 1. 设计理念

Vite 的核心思想是：**开发时利用浏览器原生 ESM，构建时用 Rollup 打包。**

```
开发模式：浏览器直接加载 ESM 模块，按需编译（极速启动）
生产构建：Rollup 打包 + Tree Shaking + 代码分割
```

### 2. 为什么 Vite 快？

**Webpack 的瓶颈：**

```
启动 → 遍历所有模块 → 打包成一个/多个 bundle → 启动服务器
                  （项目越大越慢）
```

**Vite 的方案：**

```
启动 → 立即启动服务器 → 浏览器请求模块 → 按需编译单个文件
                （启动速度与项目大小无关）
```

| 对比项 | Webpack | Vite |
|--------|---------|------|
| 启动方式 | 全量打包后启动 | 先启动，按需编译 |
| HMR 热更新 | 重新构建涉及模块 | 精确替换单个模块 |
| 配置复杂度 | 较高 | 极简 |
| 生产构建 | 自身打包 | Rollup |
| 生态成熟度 | 极高 | 高（快速追赶） |

### 3. Vite 核心能力

```javascript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { "@": "/src" },
    },
    server: {
        port: 3000,
        proxy: {
            "/api": "http://localhost:8080",
        },
    },
    build: {
        rollupOptions: {
            output: { manualChunks: { vendor: ["react", "react-dom"] } },
        },
    },
});
```

### 4. Vite 插件机制

Vite 插件基于 Rollup 插件接口扩展，增加了 Vite 独有的钩子：

```javascript
export default function myVitePlugin() {
    return {
        name: "my-plugin",

        // Vite 独有钩子
        configureServer(server) {
            // 配置开发服务器
            server.middlewares.use((req, res, next) => {
                // 自定义中间件
                next();
            });
        },

        transformIndexHtml(html) {
            // 转换 index.html
            return html.replace("</head>", '<script>console.log("injected")</script></head>');
        },

        // Rollup 兼容钩子
        resolveId(id) {
            if (id === "virtual-module") return id;
        },
        load(id) {
            if (id === "virtual-module") return 'export default "hello"';
        },
        transform(code, id) {
            if (id.endsWith(".custom")) {
                return code.replace(/OLD/g, "NEW");
            }
        },
    };
}
```

## 三、深度对比

### 1. 模块处理

**Webpack — 统一打包：**

```javascript
// 所有模块被打包进 bundle
// index.js
import React from "react";     // 打包进 vendor chunk
import "./style.css";           // 通过 css-loader 处理
import logo from "./logo.png";  // 通过 asset 处理
```

**Vite — 原生 ESM + 预构建：**

```html
<!-- 开发时浏览器直接加载 -->
<script type="module" src="/src/index.js"></script>
```

```javascript
// Vite 拦截请求，实时转换
// import React from "react"
//   → 拦截 → 返回预构建的 /node_modules/.vite/react.js

// import "./style.css"
//   → 拦截 → 返回 JS 模块，将 CSS 注入 <style> 标签
```

Vite 使用 **esbuild** 进行依赖预构建（比 Webpack 快 10-100 倍）。

### 2. HMR（热模块替换）

**Webpack HMR：**

```
文件修改 → 重新构建该模块及其依赖链 → 通过 WebSocket 推送更新 → 浏览器替换模块
（修改一个文件可能触发大量重新构建）
```

**Vite HMR：**

```
文件修改 → 仅编译该文件 → 通过 WebSocket 推送精确的模块更新 → 浏览器替换
（无论项目多大，速度恒定）
```

### 3. Tree Shaking

两者都支持 Tree Shaking（移除未使用的代码），但实现不同：

- **Webpack** — 基于 `import/export` 静态分析，`package.json` 中 `sideEffects` 字段辅助
- **Vite（Rollup）** — 更激进的 Tree Shaking，默认效果更好

```javascript
// utils.js
export function used() { return "used"; }
export function unused() { return "unused"; }

// app.js
import { used } from "./utils.js";
// Tree Shaking 后，unused 不会出现在最终 bundle 中
```

### 4. 代码分割

**Webpack：**

```javascript
// 动态 import 自动分割
const Module = await import("./heavy-module");

// SplitChunksPlugin 自动提取公共依赖
optimization: {
    splitChunks: {
        chunks: "all",
        cacheGroups: {
            vendor: { test: /node_modules/, name: "vendor" },
        },
    },
}
```

**Vite（Rollup）：**

```javascript
// 动态 import 同样自动分割
const Module = await import("./heavy-module");

// manualChunks 配置
build: {
    rollupOptions: {
        output: {
            manualChunks(id) {
                if (id.includes("node_modules")) return "vendor";
            },
        },
    },
}
```

## 四、如何选择

| 场景 | 推荐 |
|------|------|
| 新项目 | Vite（开发体验更好） |
| 已有大型 Webpack 项目 | 可保持，渐进迁移 |
| 需要极细粒度控制 | Webpack（插件生态更丰富） |
| 库/组件库开发 | Vite（Rollup 输出更干净） |
| SSR 复杂场景 | 两者皆可，Vite 支持日趋完善 |

## 五、从零实现一个简易打包工具

理解打包工具的最好方式是动手写一个。下面实现一个迷你 bundler，核心流程：

```
解析入口 → 读取文件 → 收集依赖 → 递归处理 → 生成 bundle
```

### 1. 解析模块与收集依赖

```javascript
const fs = require("fs");
const path = require("path");
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;

// 解析单个模块
function createModule(filePath) {
    const source = fs.readFileSync(filePath, "utf-8");

    // 用 Babel 解析 AST
    const ast = parse(source, { sourceType: "module" });

    // 收集 import 依赖
    const dependencies = [];
    traverse(ast, {
        ImportDeclaration({ node }) {
            dependencies.push(node.source.value);
        },
    });

    return { filePath, source, dependencies };
}
```

### 2. 构建依赖图

```javascript
function createGraph(entry) {
    const entryModule = createModule(entry);
    const graph = [entryModule];

    for (const mod of graph) {
        mod.mapping = {};
        const dir = path.dirname(mod.filePath);

        mod.dependencies.forEach((dep) => {
            const absPath = path.resolve(dir, dep) +
                (path.extname(dep) ? "" : ".js");
            const child = createModule(absPath);
            mod.mapping[dep] = graph.length;  // 记录模块索引
            graph.push(child);
        });
    }

    return graph;
}
```

### 3. 生成 bundle

```javascript
function bundle(graph) {
    let modules = "";

    // 将每个模块包装为函数
    graph.forEach((mod, i) => {
        modules += `${i}: [
            function(require, module, exports) {
                ${mod.source}
            },
            ${JSON.stringify(mod.mapping)}
        ],`;
    });

    // 生成自执行函数，实现 require 机制
    return `
        (function(modules) {
            function require(id) {
                const [fn, mapping] = modules[id];
                const module = { exports: {} };

                function localRequire(name) {
                    return require(mapping[name]);
                }

                fn(localRequire, module, module.exports);
                return module.exports;
            }

            require(0);  // 从入口模块开始
        })({${modules}})
    `;
}

// 运行
const graph = createGraph("./src/index.js");
const output = bundle(graph);
fs.writeFileSync("./dist/bundle.js", output);
```

### 4. 加入 Loader 支持

```javascript
function createModule(filePath, loaders = []) {
    let source = fs.readFileSync(filePath, "utf-8");

    // 匹配并执行对应 Loader
    loaders.forEach(({ test, transform }) => {
        if (test.test(filePath)) {
            source = transform(source);
        }
    });

    // ...后续 AST 解析不变
}

// 使用
const graph = createGraph("./src/index.js", [
    {
        test: /\.css$/,
        transform(source) {
            return `
                const style = document.createElement("style");
                style.textContent = ${JSON.stringify(source)};
                document.head.appendChild(style);
            `;
        },
    },
]);
```

### 5. 加入 Plugin 支持

```javascript
class Bundler {
    constructor({ entry, loaders, plugins = [] }) {
        this.entry = entry;
        this.loaders = loaders;
        this.hooks = {
            beforeBuild: [],
            afterBuild: [],
            beforeEmit: [],
        };

        // 注册插件钩子
        plugins.forEach(plugin => plugin.apply(this));
    }

    build() {
        this.hooks.beforeBuild.forEach(fn => fn());
        const graph = createGraph(this.entry, this.loaders);
        const output = bundle(graph);
        this.hooks.beforeEmit.forEach(fn => fn(output));
        fs.writeFileSync("./dist/bundle.js", output);
        this.hooks.afterBuild.forEach(fn => fn());
    }
}

// 使用
const bundler = new Bundler({
    entry: "./src/index.js",
    loaders: [/* ... */],
    plugins: [
        {
            apply(bundler) {
                bundler.hooks.afterBuild.push(() => {
                    console.log("Build complete!");
                });
            },
        },
    ],
});

bundler.build();
```

这就是一个简易打包工具的完整骨架。真实的 Webpack 和 Vite 在此基础上增加了：
- 代码分割（Code Splitting）
- Tree Shaking（基于 AST 分析未使用导出）
- 缓存机制（增量构建）
- HMR（WebSocket 推送 + 模块热替换）
- 插件生命周期（数十个钩子）

## 六、总结

| 维度 | Webpack | Vite |
|------|---------|------|
| 核心理念 | 一切皆模块，统一打包 | 原生 ESM，按需编译 |
| 开发启动 | 全量构建（慢） | 秒级启动（快） |
| HMR | 依赖链重构建 | 精确模块替换 |
| 生产构建 | 自有打包引擎 | Rollup |
| 配置 | 复杂但灵活 | 简洁够用 |
| 生态 | 极其丰富 | 快速增长 |
| 适用 | 大型复杂项目 | 新项目首选 |

**理解打包工具的核心**在于三个步骤：**解析（Parse）→ 转换（Transform）→ 生成（Emit）**。无论是 Webpack 的 Loader/Plugin 体系，还是 Vite 的 ESM + Rollup 方案，本质上都在解决"如何把开发代码变成浏览器能高效运行的产物"这个问题。掌握了原理，切换工具只是学习新 API 的事情。
