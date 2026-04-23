---
title: "CSS 核心特性、使用方式与注意事项"
date: "2026-04-22"
tags: ["CSS", "前端基础", "样式"]
category: "技术"
summary: "系统介绍 CSS 的核心特性（选择器、盒模型、布局、动画、响应式）、三种使用方式，以及开发中常见的注意事项和最佳实践。"
---

# CSS 核心特性、使用方式与注意事项

CSS（Cascading Style Sheets，层叠样式表）用于控制网页的视觉呈现。掌握 CSS 是前端开发的必备技能。本文将系统梳理 CSS 的核心特性、使用方式以及开发中的注意事项。

## 一、CSS 的三种使用方式

### 1. 行内样式（Inline Style）

直接写在 HTML 元素的 `style` 属性上：

```html
<p style="color: red; font-size: 16px;">这是一段红色文字</p>
```

- 优先级最高，但**不推荐**大量使用
- 适用于临时调试或动态样式

### 2. 内部样式表（Internal Stylesheet）

写在 `<style>` 标签中，位于 `<head>` 内：

```html
<head>
    <style>
        p {
            color: #333;
            line-height: 1.6;
        }
    </style>
</head>
```

- 适用于单页面样式
- 样式与结构仍混在一起，不利于复用

### 3. 外部样式表（External Stylesheet）

独立的 `.css` 文件，通过 `<link>` 引入：

```html
<link rel="stylesheet" href="styles.css" />
```

```css
/* styles.css */
body {
    font-family: -apple-system, sans-serif;
    margin: 0;
    padding: 0;
}
```

- **推荐方式** — 结构与样式完全分离
- 支持浏览器缓存，提升加载性能

## 二、核心特性

### 1. 选择器

选择器决定了样式作用于哪些元素。

```css
/* 基础选择器 */
h1 { }                    /* 标签选择器 */
.title { }                /* 类选择器 */
#header { }               /* ID 选择器 */
* { }                     /* 通配选择器 */

/* 组合选择器 */
.nav a { }                /* 后代选择器 */
.nav > a { }              /* 子代选择器 */
h1 + p { }                /* 相邻兄弟选择器 */
h1 ~ p { }                /* 通用兄弟选择器 */

/* 属性选择器 */
input[type="text"] { }
a[href^="https"] { }

/* 伪类 */
a:hover { }
li:first-child { }
li:nth-child(2n) { }
input:focus { }

/* 伪元素 */
p::before { content: "→ "; }
p::first-line { font-weight: bold; }
::selection { background: #1677ff; color: #fff; }
```

### 2. 盒模型

每个 HTML 元素都遵循盒模型：

```
┌─────────────────────────────────┐
│            margin               │
│  ┌───────────────────────────┐  │
│  │         border            │  │
│  │  ┌─────────────────────┐  │  │
│  │  │      padding        │  │  │
│  │  │  ┌───────────────┐  │  │  │
│  │  │  │   content     │  │  │  │
│  │  │  └───────────────┘  │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

```css
/* 标准盒模型（默认）：width = content */
.box {
    width: 200px;
    padding: 20px;
    border: 1px solid #ddd;
    /* 实际宽度 = 200 + 20*2 + 1*2 = 242px */
}

/* 怪异盒模型：width = content + padding + border */
.box-border {
    box-sizing: border-box;
    width: 200px;
    padding: 20px;
    border: 1px solid #ddd;
    /* 实际宽度 = 200px（padding 和 border 包含在内） */
}
```

> **推荐**：全局设置 `box-sizing: border-box`，更直观地控制元素尺寸。

```css
*, *::before, *::after {
    box-sizing: border-box;
}
```

### 3. 布局

#### Flexbox 弹性布局

一维布局的首选方案：

```css
.container {
    display: flex;
    justify-content: space-between;  /* 主轴对齐 */
    align-items: center;             /* 交叉轴对齐 */
    gap: 16px;                       /* 元素间距 */
}

.item {
    flex: 1;           /* 等分剩余空间 */
    flex-shrink: 0;    /* 不缩小 */
}
```

常见用法：

```css
/* 水平垂直居中 */
.center {
    display: flex;
    justify-content: center;
    align-items: center;
}

/* 导航栏 */
.nav {
    display: flex;
    gap: 24px;
}

/* 等宽卡片 */
.card-list {
    display: flex;
    gap: 16px;
}
.card-list > * {
    flex: 1;
}
```

#### Grid 网格布局

二维布局的强大工具：

```css
.grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);   /* 三等分 */
    grid-template-rows: auto;
    gap: 16px;
}

/* 响应式自适应列数 */
.grid-auto {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
}
```

### 4. 定位

```css
.static { position: static; }       /* 默认，正常文档流 */
.relative { position: relative; }   /* 相对自身偏移，不脱离文档流 */
.absolute { position: absolute; }   /* 相对最近定位祖先 */
.fixed { position: fixed; }         /* 相对视口 */
.sticky { position: sticky; top: 0; } /* 滚动到阈值时固定 */
```

### 5. 动画与过渡

#### 过渡（Transition）

```css
.button {
    background: #1677ff;
    transition: all 0.3s ease;
}
.button:hover {
    background: #0958d9;
    transform: translateY(-2px);
}
```

#### 关键帧动画（Keyframes）

```css
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
}

.element {
    animation: fadeIn 0.5s ease forwards;
}
```

### 6. 响应式设计

#### 媒体查询

```css
/* 移动优先 */
.container {
    padding: 16px;
}

@media (min-width: 768px) {
    .container {
        padding: 24px;
        max-width: 720px;
    }
}

@media (min-width: 1024px) {
    .container {
        max-width: 960px;
    }
}
```

#### 常用响应式技巧

```css
/* 流式排版 */
h1 {
    font-size: clamp(1.5rem, 4vw, 3rem);
}

/* 容器查询（现代 CSS） */
.card-container {
    container-type: inline-size;
}
@container (min-width: 400px) {
    .card { flex-direction: row; }
}

/* 响应式图片 */
img {
    max-width: 100%;
    height: auto;
}
```

### 7. CSS 变量

```css
:root {
    --color-primary: #1677ff;
    --color-bg: #ffffff;
    --spacing: 16px;
    --radius: 8px;
}

.button {
    background: var(--color-primary);
    padding: var(--spacing);
    border-radius: var(--radius);
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
    :root {
        --color-primary: #1668dc;
        --color-bg: #141414;
    }
}
```

## 三、层叠与优先级

当多条规则作用于同一元素时，CSS 按优先级决定最终样式：

**优先级从高到低：**

1. `!important` — 覆盖一切（**慎用**）
2. 行内样式 `style=""` — 权重 1000
3. ID 选择器 `#id` — 权重 100
4. 类 / 伪类 / 属性 `.class` — 权重 10
5. 标签 / 伪元素 `div` — 权重 1
6. 通配符 `*` — 权重 0

```css
/* 权重: 0-1-1 */
.header .nav-item { color: blue; }

/* 权重: 1-0-0，优先级更高 */
#special-item { color: red; }
```

> 同权重下，后写的规则覆盖先写的。

## 四、注意事项

### 1. 避免 `!important`

```css
/* 不好 */
.title { color: red !important; }

/* 好 — 提高选择器权重 */
.page .title { color: red; }
```

`!important` 会打破正常的优先级规则，导致后期维护困难。

### 2. 避免过深嵌套

```css
/* 不好 — 嵌套过深，权重过高 */
body .container .main .sidebar .widget .title { }

/* 好 — 使用 BEM 命名或扁平选择器 */
.widget__title { }
```

建议选择器嵌套不超过 3 层。

### 3. 注意 margin 塌陷

相邻块级元素的上下 margin 会合并（取较大值）：

```css
/* 两个段落的间距是 30px，不是 50px */
.p1 { margin-bottom: 30px; }
.p2 { margin-top: 20px; }
```

解决方案：使用 `padding` 代替，或设置 `overflow: hidden`，或使用 Flex/Grid 布局。

### 4. 图片默认间隙

行内图片底部有 3-5px 间隙：

```css
/* 方案一 */
img { display: block; }

/* 方案二 */
img { vertical-align: middle; }

/* 方案三 */
img { font-size: 0; }
```

### 5. 移动端 300ms 点击延迟

```css
a, button {
    touch-action: manipulation;  /* 禁用双击缩放 */
}
```

### 6. 性能优化

```css
/* 使用 transform 和 opacity 做动画（GPU 加速） */
.good {
    transition: transform 0.3s, opacity 0.3s;
}
.good:hover {
    transform: translateX(10px);
    opacity: 0.8;
}

/* 避免触发重排的属性做动画 */
.bad {
    transition: left 0.3s, top 0.3s, width 0.3s;
}
```

会触发重排（Layout）的属性：`width`、`height`、`margin`、`top`、`left`

只会触发重绘（Paint）的属性：`color`、`background`、`box-shadow`

GPU 加速的属性：`transform`、`opacity`

### 7. 全局样式重置

推荐的最小重置：

```css
*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
}

img, video, svg {
    max-width: 100%;
    display: block;
}
```

## 总结

CSS 从简单的样式语言发展到现在，拥有了 Flexbox、Grid、变量、动画、容器查询等强大特性。掌握选择器优先级、盒模型、布局模式以及性能优化技巧，是写出高质量 CSS 的关键。核心原则是：**结构与样式分离，保持选择器扁平，善用现代布局方案。**
