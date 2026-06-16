---
title: 浏览器渲染原理与 JS 运行环境对比：从 HTML 解析到 Node.js 差异
date: '2026-05-04'
tags:
  - 性能优化
  - Node.js
category: 前端基础
summary: >-
  从页面加载慢和白屏的实际痛点出发，系统梳理浏览器渲染管线（HTML 解析 → DOM/CSSOM 构建 → 布局 → 绘制 →
  合成）的完整流程，以及浏览器与 Node.js 两个 JS 运行环境的架构对比——V8 引擎、事件循环差异、API 差异、模块系统、适用场景与选择边界。
---

# 浏览器渲染原理与 JS 运行环境对比：从 HTML 解析到 Node.js 差异

## 一、问题来源

前端开发中有两类常见困惑，分别指向浏览器渲染机制和 JS 运行环境：

**浏览器渲染层面的痛点：**

- 首屏加载白屏时间过长，不知道瓶颈在 HTML 解析、CSS 加载还是 JS 执行
- 操作 DOM 很卡，不知道重排（Reflow）和重绘（Repaint）的触发条件
- 说要"减少 DOM 操作"，但不理解为什么 DOM 操作慢，到底慢在哪
- CSS 写在 `<head>` 和 `<body>` 末尾表现不同，说不清原因

**环境差异层面的痛点：**

- 同一段 JS 代码在浏览器能跑，在 Node.js 报错（`window is not defined`）
- 不清楚 `setTimeout`、`Promise`、`process.nextTick` 在两个环境中的执行顺序是否一样
- 面试被问到"浏览器和 Node.js 的事件循环有什么区别"，只能泛泛而谈
- 不知道什么时候该用浏览器 API，什么时候该用 Node.js API

**核心问题：理解浏览器渲染管线能指导性能优化，理解环境差异能避免跨环境开发的坑。两者都指向同一个底层——浏览器和 Node.js 各自如何运行 JavaScript。**

---

## 二、浏览器渲染管线全流程

### 2.1 从 URL 到页面渲染的完整链路

```
用户输入 URL
    │
    ▼
DNS 解析 → 域名转为 IP 地址
    │
    ▼
TCP 三次握手 → 建立连接
    │
    ▼
HTTP 请求 → 获取 HTML 文档
    │
    ▼
┌─────────────────────────────────┐
│      浏览器渲染管线（核心）       │
│                                 │
│  HTML → DOM 树                  │
│  CSS  → CSSOM 树               │
│  DOM + CSSOM → 渲染树           │
│  渲染树 → 布局（Layout）        │
│  布局 → 绘制（Paint）           │
│  绘制 → 合成（Composite）       │
└─────────────────────────────────┘
    │
    ▼
页面显示在屏幕上
```

### 2.2 第一步：HTML 解析与 DOM 树构建

```
HTML 文档 → 字节流 → 字符流 → Token → 节点 → DOM 树

详细过程：
1. 字节流解码：网络传输的二进制数据 → 根据 Content-Encoding 解码为字符
2. 词法分析（Tokenizer）：字符流 → Token 序列
   - 识别标签：开始标签 <div>、结束标签 </div>、自闭合标签 <img />
   - 识别属性：class="container"、id="app"
   - 识别文本内容
3. 语法分析（Parser）：Token → DOM 节点 → 构建树形结构
4. 完成：生成完整的 DOM 树（Document Object Model）
```

```
示例：

<html>
  <head>
    <title>示例</title>
  </head>
  <body>
    <div class="container">
      <h1>标题</h1>
      <p>段落</p>
    </div>
  </body>
</html>

生成的 DOM 树：
Document
└── html
    ├── head
    │   └── title
    │       └── "示例"
    └── body
        └── div.container
            ├── h1
            │   └── "标题"
            └── p
                └── "段落"
```

**DOM 树的特点：**

```
1. 树形结构：每个 HTML 标签对应一个节点，嵌套关系对应父子关系
2. JavaScript 可操作：DOM 是浏览器暴露给 JS 的接口
3. 增量构建：不需要等 HTML 全部下载完，解析一部分就构建一部分
4. 容错处理：HTML 允许不严格（如 <p> 不闭合），浏览器会自动修正
```

### 2.3 第二步：CSS 解析与 CSSOM 构建

```
CSS 文档 → Token → CSSOM 树（CSS Object Model）

过程与 DOM 类似：
1. 解析 CSS 文本（<style> 标签内 或 <link> 引入的外部文件）
2. 构建选择器 → 属性值的映射
3. 生成 CSSOM 树（与 DOM 树结构对应，但只包含样式信息）

CSS 解析的特点：
- CSS 是渲染阻塞资源：浏览器必须等 CSSOM 构建完才能进入下一步
- CSS 不阻塞 DOM 解析：DOM 和 CSSOM 可以并行构建
- CSS 有层叠规则：同一元素的多条规则按优先级合并
```

```
CSSOM 示例：

body { font-size: 16px; }
.container { width: 800px; margin: 0 auto; }
h1 { color: #333; font-size: 24px; }
p { color: #666; line-height: 1.6; }

CSSOM 树：
body  { font-size: 16px }
└── div.container  { width: 800px; margin: 0 auto }
    ├── h1  { color: #333; font-size: 24px }
    └── p   { color: #666; line-height: 1.6 }
```

### 2.4 第三步：渲染树（Render Tree）

```
DOM 树 + CSSOM 树 → 渲染树

渲染树 = DOM 树中"可见"的节点 + 它们计算后的样式

关键规则：
1. <head>、<meta>、<script>、<link> 等不可见元素 → 不在渲染树中
2. display: none 的元素 → 不在渲染树中
3. visibility: hidden 的元素 → 在渲染树中（占据空间，只是不可见）
4. ::before / ::after 伪元素 → 在渲染树中（虽然 DOM 中不存在）

DOM 树                   渲染树
┌──────────────┐        ┌──────────────┐
│ Document     │        │              │
│ └─ html      │        │ body         │
│   ├─ head    │  ───→  │ └─ div       │
│   │ └─ title │ 不包含  │   ├─ h1     │
│   └─ body    │ 不可见  │   └─ p      │
│     └─ div   │  元素   │              │
│       ├─ h1  │        │              │
│       └─ p   │        │              │
└──────────────┘        └──────────────┘
```

### 2.5 第四步：布局（Layout / Reflow）

```
渲染树 → 布局 → 计算每个节点的确切位置和大小

布局过程：
1. 从渲染树的根节点开始遍历
2. 根据 CSS 盒模型（margin → border → padding → content）计算尺寸
3. 根据文档流（normal flow）、浮动（float）、定位（position）计算位置
4. 输出：每个节点的 Box Model（x, y, width, height）

触发布局的关键因素：
- 视口大小变化（窗口 resize）
- 元素尺寸变化（width / height / padding / margin / border）
- 字体变化（font-size / font-family）
- 内容变化（文本内容改变、图片加载完成）
- 添加/删除 DOM 元素
- 激活 CSS 伪类（:hover 导致尺寸变化）
- 读取某些属性（offsetWidth / scrollTop / getComputedStyle）

⚠️ 布局是昂贵的操作：需要遍历渲染树重新计算所有几何信息
```

### 2.6 第五步：绘制（Paint）

```
布局信息 → 绘制指令 → 像素

绘制过程：
1. 遍历布局后的渲染树
2. 将每个节点转化为绘制指令（填充颜色、画边框、渲染文字、画图片...）
3. 按照层叠顺序（z-index）绘制
4. 绘制顺序：背景色 → 背景图 → 边框 → 子元素 → 轮廓

触发的属性：
- color / background / border / outline
- box-shadow / text-shadow
- visibility / opacity

⚠️ 重绘（Repaint）比重排（Reflow）开销小，但仍然有成本
```

### 2.7 第六步：合成（Composite）

```
现代浏览器引入"分层"机制优化渲染：

1. 页面被分成多个图层（Layer）
2. 每个图层独立绘制
3. 最终由 GPU 合成所有图层

哪些元素会独立成层：
- 使用 transform 的元素
- 使用 opacity 动画的元素
- <canvas>、<video> 元素
- will-change 属性显式提示
- position: fixed 的元素

合成的优势：
- 修改某个图层的 transform / opacity → 不需要重排和重绘
- 只需重新合成 → 由 GPU 处理，非常快
- 这就是为什么动画推荐用 transform 而不是 top/left
```

### 2.8 JS 对渲染管线的影响

```
<script> 标签的加载和执行会阻塞 DOM 解析：

情况1：普通 <script>
  HTML 解析 → 遇到 <script> → 暂停解析 → 下载 JS → 执行 JS → 继续解析
  ❌ 完全阻塞 DOM 构建

情况2：<script async>
  HTML 解析 → 遇到 <script> → 并行下载 JS → 下载完后立即执行（暂停 HTML 解析）
  ✅ 下载不阻塞，但执行仍会暂停解析
  适用：独立脚本（如统计代码），不依赖 DOM

情况3：<script defer>
  HTML 解析 → 遇到 <script> → 并行下载 JS → 等 HTML 解析完后执行
  ✅ 下载不阻塞，执行也不阻塞（在 DOMContentLoaded 之前执行）
  适用：需要操作 DOM 的脚本，按顺序执行

┌──────────────┬──────────┬──────────────┬──────────────┐
│    属性      │ 下载阻塞 │ 执行阻塞     │ 执行顺序     │
├──────────────┼──────────┼──────────────┼──────────────┤
│ 无           │ 是       │ 是           │ 按文档顺序   │
│ async        │ 否       │ 下载完立即   │ 谁先下完谁先 │
│ defer        │ 否       │ HTML解析后   │ 按文档顺序   │
│ type=module  │ 否       │ 默认 defer   │ 按文档顺序   │
└──────────────┴──────────┴──────────────┴──────────────┘
```

### 2.9 关键渲染路径优化

```
优化目标：缩短从 HTML 下载到首次渲染的时间

1. 压缩关键资源
   - 内联关键 CSS（首屏需要的样式写在 <style> 中）
   - 延迟非关键 CSS（加 media 属性或动态加载）
   - 压缩 HTML/CSS/JS（去掉空格注释）

2. 减少 DOM 节点数
   - 越少的 DOM 节点 → 越快的布局和绘制
   - 避免深层嵌套（超过 30 层的 DOM 结构）

3. 避免 JS 阻塞
   - <script> 加 defer 或 async
   - 关键 JS 内联，非关键 JS 延迟加载

4. 避免强制同步布局
   ❌ 读写交替（强制浏览器在 JS 执行期间做布局）
   element.style.width = '100px';
   console.log(element.offsetWidth);  // 强制布局！
   element.style.height = '200px';
   console.log(element.offsetHeight); // 又一次强制布局！

   ✅ 批量读，批量写
   const width = element.offsetWidth;   // 先读
   const height = element.offsetHeight;
   element.style.width = width + 10 + 'px';  // 再写
   element.style.height = height + 10 + 'px';

5. 使用 transform/opacity 做动画（走合成层，不触发布局和绘制）
```

---

## 三、重排、重绘、合成的触发条件

### 3.1 三者对比

| 操作 | 触发条件 | 开销 | 影响范围 |
|------|---------|------|---------|
| 重排（Reflow） | 几何属性变化 | 高 | 影响周围元素，可能全局 |
| 重绘（Repaint） | 外观属性变化 | 中 | 只影响当前元素 |
| 合成（Composite） | transform / opacity | 低 | GPU 处理，不影响其他元素 |

### 3.2 各属性触发的阶段

```
触发重排的属性（避免频繁修改）：
width / height / padding / margin / display / position
top / left / right / bottom / float / clear
font-size / font-family / text-align
overflow / white-space / line-height
flex / grid 相关属性

触发重绘但不重排的属性：
color / background / border-color
border-style / border-radius
outline / box-shadow / text-shadow
visibility / opacity

只触发合成的属性（推荐动画使用）：
transform / opacity
filter（部分浏览器）
will-change（提示浏览器优化）
```

### 3.3 性能优化实践

```typescript
// ❌ 触发多次重排
element.style.width = '100px';
element.style.height = '200px';
element.style.margin = '10px';
// 每一行都可能触发一次重排

// ✅ 批量修改（合并为一次重排）
element.style.cssText = 'width: 100px; height: 200px; margin: 10px;';
// 或用 class 切换
element.className = 'expanded';  // 一次重排

// ❌ 用 JS 做布局动画
function animate() {
  element.style.left = parseInt(element.style.left) + 1 + 'px';
  requestAnimationFrame(animate);  // 每帧都重排
}

// ✅ 用 transform 做动画（只触发合成）
function animate() {
  element.style.transform = `translateX(${x}px)`;
  requestAnimationFrame(animate);  // GPU 处理，不重排不重绘
}

// ❌ 逐项读取布局信息
for (const item of items) {
  const height = item.offsetHeight;  // 每次循环都强制重排
  item.style.height = height + 10 + 'px';
}

// ✅ 先批量读取，再批量写入
const heights = items.map(item => item.offsetHeight);  // 一次重排
items.forEach((item, i) => {
  item.style.height = heights[i] + 10 + 'px';          // 一次重排
});
```

---

## 四、JS 运行环境：浏览器 vs Node.js

### 4.1 共同基础：V8 引擎

```
浏览器和 Node.js 都使用 V8 引擎来执行 JavaScript：

JavaScript 源码
      │
      ▼
┌──────────────────────────┐
│       V8 引擎             │
│                          │
│  Parser（解析器）         │
│    → 源码 → AST          │
│                          │
│  Ignition（解释器）       │
│    → AST → 字节码 → 执行 │
│                          │
│  TurboFan（JIT 编译器）   │
│    → 热点代码 → 机器码    │
│    → 优化执行速度         │
│                          │
│  Orinoco（垃圾回收）      │
│    → 标记-清除、分代回收   │
└──────────────────────────┘

V8 只负责：
- 解析和执行 JavaScript 代码
- 内存管理（垃圾回收）
- JIT 编译优化

V8 不负责（由宿主环境提供）：
- DOM 操作（浏览器提供）
- 文件系统（Node.js 提供）
- 网络请求的具体实现
- 事件循环
```

### 4.2 架构对比

```
浏览器架构：
┌─────────────────────────────────────┐
│           浏览器                     │
├─────────────────────────────────────┤
│  Web API（DOM / BOM / Fetch / ...） │
│  ─────────────────────────────────  │
│           事件循环                   │
│  ─────────────────────────────────  │
│           V8 引擎                   │
└─────────────────────────────────────┘

Node.js 架构：
┌─────────────────────────────────────┐
│          Node.js                     │
├─────────────────────────────────────┤
│  Node API（fs / http / crypto / ..）│
│  ─────────────────────────────────  │
│        libuv（C 库）                 │
│      事件循环 + 异步 I/O            │
│  ─────────────────────────────────  │
│           V8 引擎                   │
└─────────────────────────────────────┘

共同点：V8 引擎 + 事件循环 + 异步非阻塞 I/O
不同点：宿主 API 完全不同、事件循环实现不同
```

### 4.3 API 差异一览

| 类别 | 浏览器 API | Node.js API |
|------|-----------|-------------|
| DOM 操作 | `document.getElementById` | ❌ 没有 DOM |
| 定时器 | `setTimeout` / `setInterval` | `setTimeout` / `setInterval`（通过 libuv 实现） |
| 网络请求 | `fetch` / `XMLHttpRequest` | `http.get` / `axios`（第三方） |
| 文件系统 | ❌ 不能直接操作文件 | `fs.readFile` / `fs.writeFile` |
| 路径操作 | ❌ | `path.join` / `path.resolve` |
| 进程管理 | ❌ | `process.pid` / `process.exit` / `child_process` |
| 环境/平台 | `window` / `navigator` / `location` | `process.env` / `process.platform` |
| 模块系统 | ES Modules（`import/export`） | CommonJS（`require/module.exports`）+ ESM |
| Buffer | `ArrayBuffer` / `TypedArray` | `Buffer`（Node.js 特有） |
| 编码 | `TextEncoder` / `TextDecoder` | `Buffer.from(str, 'utf-8')` |
| 流 | ❌（有 Streams API 但不同） | `stream.Readable` / `stream.Writable` |
| 加密 | `crypto.subtle`（Web Crypto API） | `crypto.createHash` / `crypto.randomBytes` |
| 子线程 | `Web Worker` | `worker_threads` |
| 全局对象 | `window` / `globalThis` | `global` / `globalThis` |

---

## 五、事件循环对比

### 5.1 浏览器事件循环

```
┌──────────────────────────────────┐
│            调用栈（Call Stack）    │
│         ← 同步代码执行            │
└──────────────┬───────────────────┘
               │ 同步代码执行完
               ▼
┌──────────────────────────────────┐
│            微任务队列             │
│  Promise.then / MutationObserver │
│  queueMicrotask                  │
│         ← 全部执行完才继续        │
└──────────────┬───────────────────┘
               │ 微任务清空后
               ▼
┌──────────────────────────────────┐
│          宏任务队列（一个）        │
│  setTimeout / setInterval        │
│  I/O 回调 / UI 渲染              │
│         ← 取一个执行              │
└──────────────┬───────────────────┘
               │ 回到调用栈
               ▼
          循环往复

执行顺序：
1. 执行同步代码（调用栈）
2. 调用栈空了 → 清空所有微任务
3. 取一个宏任务执行
4. 再清空所有微任务
5. 可能渲染 UI
6. 回到第 3 步
```

### 5.2 Node.js 事件循环

```
Node.js 事件循环有更多的阶段：

   ┌──────────────────────────┐
┌─▶│       timers              │  setTimeout / setInterval
│  └─────────────┬────────────┘
│  ┌─────────────┴────────────┐
│  │   pending callbacks       │  系统级回调（TCP 错误等）
│  └─────────────┬────────────┘
│  ┌─────────────┴────────────┐
│  │     idle, prepare         │  内部使用
│  └─────────────┬────────────┘
│  ┌─────────────┴────────────┐
│  │        poll               │  I/O 回调（文件读取、网络响应）
│  └─────────────┬────────────┘
│  ┌─────────────┴────────────┐
│  │       check               │  setImmediate 回调
│  └─────────────┬────────────┘
│  ┌─────────────┴────────────┐
│  │     close callbacks       │  socket.on('close')
│  └─────────────┬────────────┘
│                │
└────────────────┘

Node.js 的微任务：
- process.nextTick（优先级最高，在所有微任务之前）
- Promise.then

Node.js 宏任务阶段：
- timers：setTimeout / setInterval
- poll：I/O 回调
- check：setImmediate

```

### 5.3 关键差异

```
差异1：宏任务队列数量
  浏览器：一个宏任务队列
  Node.js：多个阶段，每个阶段有自己的队列

差异2：微任务执行时机
  浏览器：每个宏任务之后，清空所有微任务
  Node.js（11.x 之前）：每个阶段之后清空微任务
  Node.js（11.x 之后）：与浏览器一致，每个宏任务后清空微任务

差异3：process.nextTick
  浏览器：没有 process.nextTick
  Node.js：process.nextTick 优先于所有微任务（包括 Promise.then）

差异4：setImmediate
  浏览器：没有 setImmediate
  Node.js：setImmediate 在 check 阶段执行
  注意：浏览器有非标准的 window.setImmediate，不要混淆

差异5：setTimeout(fn, 0) vs setImmediate(fn)
  Node.js 中两者执行顺序不确定（取决于机器性能）
  在 I/O 回调中，setImmediate 一定先于 setTimeout
```

### 5.4 执行顺序示例

```javascript
// ========== 浏览器 ==========
console.log('1');                          // 同步
setTimeout(() => console.log('2'), 0);     // 宏任务
Promise.resolve().then(() => console.log('3'));  // 微任务
console.log('4');                          // 同步

// 输出：1, 4, 3, 2
// 1→4（同步） → 3（微任务） → 2（宏任务）


// ========== Node.js ==========
console.log('1');                                     // 同步
setTimeout(() => console.log('2'), 0);                // timers 阶段
setImmediate(() => console.log('3'));                 // check 阶段
Promise.resolve().then(() => console.log('4'));       // 微任务
process.nextTick(() => console.log('5'));             // nextTick
console.log('6');                                     // 同步

// 输出：1, 6, 5, 4, 2/3, 3/2
// 1→6（同步） → 5（nextTick优先） → 4（微任务）
// → 2和3顺序不确定


// ========== I/O 回调中 ==========
const fs = require('fs');
fs.readFile(__filename, () => {
  console.log('1');
  setTimeout(() => console.log('2'), 0);    // timers
  setImmediate(() => console.log('3'));     // check
  // 在 I/O 回调中，check 阶段在 timers 之前
  // 输出：1, 3, 2（setImmediate 先于 setTimeout）
});
```

---

## 六、模块系统差异

### 6.1 CommonJS vs ES Modules

```javascript
// ========== CommonJS（Node.js 默认） ==========

// 导出（moduleA.js）
module.exports = {
  add: (a, b) => a + b,
  multiply: (a, b) => a * b,
};
// 或
exports.add = (a, b) => a + b;

// 导入（moduleB.js）
const math = require('./moduleA');
math.add(1, 2);  // 3

// 特点：
// - 运行时加载（require 是函数调用）
// - 同步加载（代码在 require 时执行）
// - module.exports 输出的是值的拷贝
// - 可以动态 require（条件判断中）
```

```javascript
// ========== ES Modules（浏览器标准，Node.js 也支持） ==========

// 导出（moduleA.mjs 或 package.json 中 "type": "module"）
export const add = (a, b) => a + b;
export const multiply = (a, b) => a * b;
export default function calculator() {}

// 导入（moduleB.mjs）
import calculator, { add, multiply } from './moduleA.mjs';
add(1, 2);  // 3

// 特点：
// - 编译时静态分析（import 必须在顶层）
// - 异步加载（浏览器中）
// - export 输出的是值的引用（实时绑定）
// - Tree Shaking 友好（打包工具可以分析未使用的导出）
```

### 6.2 对比

| 维度 | CommonJS | ES Modules |
|------|----------|-----------|
| 加载时机 | 运行时 | 编译时（静态） |
| 加载方式 | 同步 | 异步（浏览器） |
| 输出类型 | 值的拷贝 | 值的引用（绑定） |
| 动态导入 | `require(variable)` | `import()` 函数 |
| Tree Shaking | 不支持 | 支持 |
| 循环依赖 | 得到部分执行的结果 | 得到引用但可能未初始化 |
| 浏览器支持 | ❌（需打包工具） | ✅（原生支持） |
| Node.js 支持 | ✅（默认） | ✅（.mjs 或 type: module） |

### 6.3 实际选择

```
浏览器项目：
  → ES Modules（框架默认，打包工具友好）

Node.js 项目：
  → CommonJS（生态大部分包仍是 CJS）
  → ES Modules（新项目推荐，逐步成为标准）

通用库（同时支持浏览器和 Node.js）：
  → 源码用 ES Modules
  → 构建时输出 CJS + ESM 两种格式
  → package.json 中配置 exports 字段
```

```json
// package.json 双格式输出示例
{
  "name": "my-lib",
  "type": "module",
  "exports": {
    "import": "./dist/index.mjs",    // ESM 入口
    "require": "./dist/index.cjs",   // CJS 入口
    "default": "./dist/index.mjs"
  }
}
```

---

## 七、适用场景与选型

### 7.1 浏览器擅长什么

```
1. 用户界面渲染
   - DOM 操作、CSS 样式、动画
   - 丰富的交互体验

2. 客户端逻辑
   - 表单验证、路由管理
   - 状态管理、数据缓存

3. 访问用户设备
   - 摄像头、麦克风、地理位置
   - 通知、剪贴板、全屏

4. 渐进式 Web 应用
   - Service Worker 离线缓存
   - PWA 接近原生应用体验

不擅长：
- 长时间 CPU 密集计算（会阻塞 UI）
- 直接访问文件系统和数据库
- 高并发网络服务
```

### 7.2 Node.js 擅长什么

```
1. 服务端 API / HTTP 服务
   - RESTful API、GraphQL
   - SSR（服务端渲染）
   - BFF（Backend For Frontend）

2. I/O 密集型应用
   - 文件处理、数据流
   - 代理服务器、API 网关
   - 实时通信（WebSocket）

3. 工具链
   - 构建工具（Webpack / Vite / esbuild）
   - CLI 工具
   - 脚本自动化

4. 中间层 / 微服务
   - 数据聚合、协议转换
   - 消息队列消费

不擅长：
- CPU 密集型计算（单线程，会阻塞事件循环）
- 大规模数值计算（考虑用 Worker Threads 或 C++ 扩展）
```

### 7.3 CPU 密集型任务的应对

```
浏览器中的方案：
1. Web Worker（独立线程，不阻塞 UI）
2. requestIdleCallback（利用空闲时间）
3. 分片执行（将大任务拆成小任务，每帧执行一部分）
4. WASM（将计算密集部分用 C/Rust 编写）

Node.js 中的方案：
1. Worker Threads（多线程）
2. Child Process（子进程）
3. C++ Native Addon（N-API）
4. 拆分任务，用 setImmediate 让出事件循环
```

```javascript
// 浏览器：Web Worker 处理计算密集任务
// main.js
const worker = new Worker('compute.js');
worker.postMessage({ data: largeArray });
worker.onmessage = (e) => {
  console.log('计算结果:', e.data);
  // UI 不受影响
};

// compute.js
self.onmessage = (e) => {
  const result = heavyComputation(e.data);
  self.postMessage(result);
};

// Node.js：Worker Threads
const { Worker } = require('worker_threads');
const worker = new Worker('./compute.js', {
  workerData: largeArray,
});
worker.on('message', (result) => {
  console.log('计算结果:', result);
});
```

---

## 八、同构/通用 JavaScript

### 8.1 一套代码两端运行

```
同构的目标：同一份 JS 代码在浏览器和 Node.js 中都能运行

需要处理的问题：
1. 全局对象差异
   window / document / navigator → 浏览器特有
   process / global / __dirname → Node.js 特有

2. 模块系统差异
   import/export vs require/module.exports

3. API 差异
   fetch（浏览器内置）vs node-fetch / undici
   localStorage vs fs

4. 路径差异
   浏览器：URL 相对路径
   Node.js：文件系统绝对路径
```

### 8.2 环境检测

```javascript
// 检测当前运行环境
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node != null;

// 更可靠的检测（避免 SSR 时的误判）
const isBrowser = (
  typeof window !== 'undefined'
  && typeof document !== 'undefined'
  && typeof navigator !== 'undefined'
);

// 条件使用不同 API
const readFile = isBrowser
  ? async (path) => (await fetch(path)).text()   // 浏览器用 fetch
  : async (path) => {                             // Node.js 用 fs
      const fs = await import('fs/promises');
      return fs.readFile(path, 'utf-8');
    };
```

### 8.3 SSR 的原理

```
SSR（Server-Side Rendering）= Node.js 渲染 HTML → 浏览器直接展示

流程：
1. 用户请求页面
2. Node.js 服务器执行 React/Vue 组件
3. 生成 HTML 字符串（此时没有 DOM，只有字符串拼接）
4. 返回 HTML 给浏览器
5. 浏览器直接渲染 HTML（用户看到内容）
6. 下载 JS bundle → 水合（Hydration）→ 页面变为可交互

SSR 的关键约束：
- 服务端没有 DOM → 不能直接操作 document / window
- 生命周期受限 → 不能用 componentDidMount（浏览器才执行）
- 异步数据需在服务端预取 → asyncData / getServerSideProps
```

---

## 九、局限性与边界

```
本文方法的局限：

1. 浏览器渲染管线因引擎而异
   - Chromium（Chrome/Edge）使用 Blink
   - Firefox 使用 Gecko
   - Safari 使用 WebKit
   - 核心流程相同，但优化策略和细节不同

2. 事件循环在持续演化
   - Node.js 11 后向浏览器对齐，但仍有 process.nextTick 等差异
   - 新 API（如 requestIdleCallback、queueMicrotask）不断增加

3. 模块系统仍在过渡期
   - Node.js 的 ESM 支持逐步完善但未完全稳定
   - CJS 和 ESM 混用仍有一些边界问题

4. 过度关注渲染管线可能导致过度优化
   - 大部分应用的性能瓶颈在网络请求和包体积
   - 先优化加载性能，再考虑渲染性能

5. 环境差异在工具链层面被逐步抹平
   - 打包工具（Vite/Webpack）屏蔽了大部分差异
   - SSR 框架（Next.js/Nuxt）处理了环境切换
   - 直接处理环境差异的场景在减少
```

---

## 十、Code Review 检查清单

```
渲染性能：
□ CSS 是否在 <head> 中引入？（避免阻塞渲染）
□ JS 是否使用 defer / async？（避免阻塞解析）
□ 动画是否使用 transform / opacity？（避免重排）
□ 是否有频繁读取布局属性后立即修改样式的问题？
□ 大量 DOM 操作是否批量处理？

环境兼容：
□ 是否有直接使用 window / document 但可能在 Node.js 中运行的代码？
□ 是否有直接使用 process / fs 但可能在浏览器中运行的代码？
□ 环境相关的 API 调用是否有条件判断或 polyfill？
□ 模块导入语法是否与目标环境一致？

事件循环：
□ 是否理解 setTimeout(fn, 0) 不是立即执行？
□ 是否有依赖微任务/宏任务执行顺序的逻辑？
□ CPU 密集任务是否使用了 Worker？
□ 是否有阻塞事件循环的长同步操作？
```
