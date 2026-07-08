---
title: 移动端适配方案与常见兼容性问题：从原理到实战
date: '2025-08-18'
tags:
  - 移动端
  - CSS
  - 前端
category: 前端基础
summary: >-
  从移动端页面错乱和兼容性坑的实际痛点出发，系统梳理移动端适配方案——viewport 原理、rem / vw / 响应式三种方案对比、1px
  边框、安全区域适配、横竖屏处理，以及 iOS/Android 常见兼容性问题（键盘遮挡、滚动穿透、300ms
  延迟、软键盘、刘海屏、日期选择器等）与解决方案。
---

# 移动端适配方案与常见兼容性问题：从原理到实战

## 一、问题来源

前端开发中，移动端适配是一个绕不开的坎：

**适配层面的痛点：**

- 设计稿是 375px 宽，在 iPhone 上正常，到了 Android 大屏手机上布局全乱了
- 用 `px` 写死的尺寸，在小屏手机上内容溢出，在大屏手机上内容太小
- 不知道选 `rem`、`vw` 还是 `responsive`，网上的方案相互矛盾
- 1px 的边框在高清屏上看起来像 2px，设计师反复打回

**兼容性层面的痛点：**

- iOS 的 Safari 和 Android 的 Chrome 行为不一致，同一份代码两种表现
- 点击输入框后软键盘弹起，页面被顶上去或输入框被遮挡
- `position: fixed` 在移动端各种诡异行为（滚动时跳动、键盘弹起后错位）
- 日期选择器 `<input type="date">` 在不同机型上表现完全不同
- 页面滚动时卡顿，弹层滚动导致底部页面跟着滚动（滚动穿透）

**核心问题：移动端适配不是"等比缩放"这么简单，它涉及屏幕尺寸、像素密度、浏览器差异、系统交互等多个维度。需要理解原理才能选择合适的方案。**

---

## 二、基础知识：移动端的几个关键概念

### 2.1 物理像素 vs CSS 像素

```
物理像素（Physical Pixel）：
- 屏幕硬件的实际像素点
- iPhone 14 Pro：2556 × 1179 物理像素
- iPhone SE：1334 × 750 物理像素

CSS 像素（Logical Pixel / CSS Pixel）：
- CSS 代码中使用的单位
- width: 100px 就是 100 个 CSS 像素

设备像素比（DPR = Device Pixel Ratio）：
- DPR = 物理像素 / CSS 像素
- iPhone 14 Pro：DPR = 3（1 CSS像素 = 3×3 物理像素）
- iPhone SE：DPR = 2（1 CSS像素 = 2×2 物理像素）
- 普通 PC 屏幕：DPR = 1

这意味着：
- 在 DPR=2 的屏幕上，width: 1px 实际占 2×2=4 个物理像素
- 在 DPR=3 的屏幕上，width: 1px 实际占 3×3=9 个物理像素
- 所以 1px 的边框在高清屏上看起来不细（这是 1px 问题的根源）
```

### 2.2 viewport 详解

```
viewport 是浏览器用来约束 <html> 元素的区域

三种 viewport：

1. Layout Viewport（布局视口）
   - <html> 元素的父容器大小
   - 默认值：移动端通常为 980px（为了让 PC 网页在手机上不溢出）
   - 可通过 document.documentElement.clientWidth 获取

2. Visual Viewport（视觉视口）
   - 用户当前看到的区域
   - 缩放时大小会变
   - 可通过 window.innerWidth 获取

3. Ideal Viewport（理想视口）
   - 设备屏幕的 CSS 像素宽度
   - iPhone 14：390px，iPhone SE：375px，iPad：768px
   - 这是移动端适配的目标——让布局视口 = 理想视口
```

### 2.3 viewport meta 标签

```html
<!-- 最常用的 viewport 设置 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<!-- 各属性含义 -->
<!-- width=device-width    → 布局视口 = 设备宽度（理想视口） -->
<!-- initial-scale=1.0     → 初始缩放比例 1:1 -->
<!-- maximum-scale=1.0     → 最大缩放比例（限制用户缩放） -->
<!-- user-scalable=no      → 禁止用户缩放（无障碍场景不建议禁用） -->

<!-- 注意：iOS 10+ Safari 忽略 user-scalable=no -->
<!-- 如需禁止缩放，需通过 JS 阻止 touchstart 的双指手势 -->

<!-- 不同场景的 viewport 设置 -->

<!-- 普通移动端页面（推荐） -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- 允许用户缩放（无障碍友好） -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0">

<!-- 固定宽度的页面（如特定设计稿宽度） -->
<meta name="viewport" content="width=750">
```

---

## 三、适配方案对比

### 3.1 方案一：rem + 动态根字号

```
原理：
- 1rem = <html> 的 font-size 值
- 根据屏幕宽度动态设置 html 的 font-size
- 所有尺寸用 rem 单位，随屏幕等比缩放

计算公式：
- 基准：设计稿宽度 375px，根字号 37.5px
- 换算：元素宽度 75px → 75 / 37.5 = 2rem
- 实际显示：屏幕宽 414px → 根字号 41.4px → 2rem = 82.8px

等比关系：元素宽度 / 屏幕宽度 = 常数
```

```javascript
// 方案 A：flexible.js（淘宝方案）
// 根据屏幕宽度设置 html font-size
(function () {
  const docEl = document.documentElement;
  const dpr = window.devicePixelRatio || 1;

  // 设置 data-dpr 属性（用于根据 DPR 写不同的样式）
  docEl.setAttribute('data-dpr', String(dpr));

  function setRem() {
    const width = docEl.clientWidth;
    // 设计稿宽度 / 10 = 根字号
    // 375 / 10 = 37.5px
    docEl.style.fontSize = (width / 10) + 'px';
  }

  setRem();
  window.addEventListener('resize', setRem);
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) setRem();  // 处理 bfcache
  });
})();

// 方案 B：postcss-pxtorem（自动转换，不需要手动算 rem）
// postcss.config.js
module.exports = {
  plugins: {
    'postcss-pxtorem': {
      rootValue: 37.5,         // 设计稿宽度 / 10
      propList: ['*'],         // 所有属性都转换
      selectorBlackList: [],   // 忽略的选择器
    },
  },
};

// 开发时直接写 px，构建时自动转为 rem
// .box { width: 75px; } → .box { width: 2rem; }
```

### 3.2 方案二：vw 方案

```
原理：
- 1vw = 视口宽度的 1%
- 100vw = 屏幕宽度（CSS 像素）
- 不需要 JS 计算，纯 CSS 方案

计算：
- 设计稿 375px，元素 75px → 75 / 375 * 100 = 20vw
- 开发时用 postcss-px-to-viewport 自动转换
```

```javascript
// postcss.config.js
module.exports = {
  plugins: {
    'postcss-px-to-viewport-8-plugin': {
      viewportWidth: 375,       // 设计稿宽度
      unitPrecision: 5,         // 小数精度
      viewportUnit: 'vw',       // 转换单位
      selectorBlackList: [],    // 忽略的选择器
      minPixelValue: 1,         // 小于 1px 不转换
      mediaQuery: false,        // 不转换媒体查询中的 px
    },
  },
};

// 开发时写 px，构建时自动转为 vw
// .box { width: 75px; } → .box { width: 20vw; }
```

### 3.3 方案三：响应式布局（Responsive）

```
原理：
- 不做等比缩放，而是根据屏幕宽度切换不同的布局
- 使用媒体查询（Media Query）+ 弹性布局（Flexbox / Grid）
- 同一套代码适配手机、平板、桌面

特点：
- 不是等比缩放，而是布局重构
- 手机上是单列，平板上是双列，桌面是三列
- 每个断点的布局是独立设计的
```

```css
/* 响应式断点（常见约定） */
/* 手机竖屏 */
@media (max-width: 575px) {
  .grid { grid-template-columns: 1fr; }
  .sidebar { display: none; }
}

/* 手机横屏 / 小平板 */
@media (min-width: 576px) and (max-width: 767px) {
  .grid { grid-template-columns: 1fr 1fr; }
}

/* 平板 */
@media (min-width: 768px) and (max-width: 991px) {
  .grid { grid-template-columns: 1fr 1fr 1fr; }
  .sidebar { display: block; width: 200px; }
}

/* 桌面 */
@media (min-width: 992px) {
  .grid { grid-template-columns: repeat(4, 1fr); }
  .sidebar { width: 300px; }
}

/* 推荐的断点（Tailwind CSS 标准） */
/* sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px */
```

### 3.4 三种方案对比

| 维度 | rem 方案 | vw 方案 | 响应式 |
|------|---------|--------|--------|
| 原理 | 等比缩放 | 等比缩放 | 布局重构 |
| 需要 JS | 是（动态根字号） | 否 | 否 |
| 自动转换工具 | postcss-pxtorem | postcss-px-to-viewport | 手写 / Tailwind |
| 字体大小 | 随屏幕缩放（可能过大/过小） | 同 rem | 可独立控制 |
| 第三方库兼容 | 需要特殊处理 | 需要特殊处理 | 天然兼容 |
| PC 端表现 | 宽屏也等比放大（不好） | 同 rem | 自然适配 |
| 适合场景 | 纯移动端 H5 | 纯移动端 H5 | 多端通用 |
| 维护成本 | 中 | 低 | 高（每个断点都设计） |

### 3.5 选型建议

```
决策路径：

1. 纯移动端 H5（微信页面、活动页）
   → vw 方案（最简单，不需要 JS）
   → rem 方案（老项目或团队习惯）

2. 响应式官网 / 博客
   → 响应式方案（媒体查询 + Flexbox/Grid）

3. 移动端 + 桌面端（两套设计稿）
   → 移动端用 vw/rem
   → 桌面端用 max-width 限制最大宽度
   → 或用媒体查询切换

4. 小程序
   → 小程序用 rpx（750rpx = 屏幕宽度）
   → 类似 vw 方案，但单位不同

5. React Native / Flutter
   → 不需要 CSS 适配（各自有布局系统）
```

### 3.6 实际推荐的混合方案

```css
/* 混合方案：vw 为主 + rem 控制字体 + 媒体查询兜底 */

/* 根字号用 vw */
html {
  font-size: calc(100vw / 375 * 16);  /* 基于 375 设计稿，基准字号 16px */
}

/* 间距和尺寸用 vw（或 postcss 自动转换） */
.container {
  padding: 4vw;
}
.card {
  width: 44vw;    /* 接近一半屏幕宽度 */
  margin-bottom: 3vw;
}

/* 字体大小限制最大最小值 */
.text-body {
  font-size: clamp(14px, 4vw, 18px);  /* 最小 14px，最大 18px */
}

/* 大屏限制最大宽度 */
.page {
  max-width: 750px;
  margin: 0 auto;
}

/* 平板和桌面 */
@media (min-width: 768px) {
  .page {
    max-width: 1200px;
  }
  .card {
    width: 30%;
  }
}
```

---

## 四、1px 边框问题

### 4.1 问题原因

```
在 DPR=2 的设备上：
- CSS 写 border: 1px solid #ccc
- 实际渲染为 2 个物理像素宽
- 看起来比设计稿的 1px 粗

在 DPR=3 的设备上：
- CSS 1px 实际渲染为 3 个物理像素
- 看起来更粗
```

### 4.2 解决方案对比

```css
/* 方案一：使用 transform 缩放（推荐） */
/* 利用伪元素画边框，再用 transform: scaleY(0.5) 缩放到 0.5px */
.border-bottom-1px {
  position: relative;
}
.border-bottom-1px::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: #ccc;
  transform: scaleY(0.5);
  transform-origin: 0 0;
}

/* DPR=3 时 */
@media (-webkit-min-device-pixel-ratio: 3) {
  .border-bottom-1px::after {
    transform: scaleY(0.333);
  }
}

/* 方案二：使用 border-image（SVG） */
.border-1px {
  border-width: 1px;
  border-style: solid;
  border-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='0.5' fill='%23ccc'/%3E%3C/svg%3E") 1 stretch;
}

/* 方案三：使用 box-shadow */
.border-1px {
  box-shadow: 0 0.5px 0 0 #ccc;
}
/* 问题：DPR=3 时仍然不够细 */

/* 方案四：viewport 缩放（适用于全局 1px） */
/* 配合 flexible.js，根据 DPR 设置 initial-scale */
// DPR=2 → initial-scale=0.5，所有元素放大 2 倍，1px 变成真正的 1 物理像素
// 缺点：整个页面都受影响，副作用大
```

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|------|
| transform 缩放 | 精确控制，兼容性好 | 需要每个方向单独写伪元素 | ✅ 推荐 |
| border-image SVG | 简洁 | 圆角边框不支持 | 备选 |
| box-shadow | 一行代码 | DPR=3 不够精确 | 简单场景 |
| viewport 缩放 | 全局解决 | 副作用大 | 不推荐 |

---

## 五、安全区域适配

### 5.1 刘海屏 / 灵动岛适配

```
问题：
iPhone X 之后，屏幕顶部有刘海/灵动岛，底部有 Home 指示条
内容如果延伸到这些区域会被遮挡
```

```html
<!-- viewport 中添加 viewport-fit=cover -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

```css
/* 使用 safe-area-inset-* 变量 */
/* 这些值由系统自动计算，表示安全区域距屏幕边缘的距离 */

/* 顶部：避开刘海 */
.header {
  padding-top: env(safe-area-inset-top);    /* 刘海高度 */
}

/* 底部：避开 Home 指示条 */
.footer {
  padding-bottom: env(safe-area-inset-bottom); /* 指示条高度 */
}

/* 左右：横屏时避开圆角 */
.sidebar-left {
  padding-left: env(safe-area-inset-left);
}
.sidebar-right {
  padding-right: env(safe-area-inset-right);
}

/* 完整的安全区域适配 */
.page {
  padding:
    env(safe-area-inset-top)
    env(safe-area-inset-right)
    env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}

/* env() 和 constant() 的兼容 */
/* iOS 11.0-11.2 使用 constant()，11.2+ 使用 env() */
.page {
  padding-top: constant(safe-area-inset-top);    /* iOS < 11.2 */
  padding-top: env(safe-area-inset-top);         /* iOS >= 11.2 */
}
```

### 5.2 横竖屏适配

```css
/* 检测横竖屏 */
/* 方式一：orientation 媒体查询 */
@media (orientation: portrait) {
  /* 竖屏样式 */
  .layout { flex-direction: column; }
}

@media (orientation: landscape) {
  /* 横屏样式 */
  .layout { flex-direction: row; }
}

/* 方式二：结合安全区域（横屏时左右有安全区域） */
@media (orientation: landscape) {
  .page {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}

/* 方式三：JS 监听 */
// window.addEventListener('orientationchange', handleOrientation);
// 或用 screen.orientation API
```

```javascript
// 某些场景需要锁定竖屏（如游戏、表单页面）
// 只能通过提示用户手动旋转，或使用 Fullscreen API + screen.orientation.lock
// 注意：screen.orientation.lock 只在全屏模式下有效，且 iOS 不支持

// 检测当前方向
function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

// 监听方向变化
window.addEventListener('resize', () => {
  if (isPortrait()) {
    document.body.classList.remove('landscape');
    document.body.classList.add('portrait');
  } else {
    document.body.classList.remove('portrait');
    document.body.classList.add('landscape');
  }
});
```

---

## 六、常见兼容性问题与解决方案

### 6.1 300ms 点击延迟

```
问题：
早期移动端浏览器为了判断"双击缩放"，在 click 事件前加了 300ms 延迟
导致按钮点击响应慢，用户体验差

解决方案：
```

```html
<!-- 方案一：viewport 禁止缩放（最简单） -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<!-- 当有 user-scalable=no 时，浏览器不再等待双击判断 → 无延迟 -->
<!-- 但影响无障碍访问 -->

<!-- 方案二：touch-action: manipulation（推荐） -->
```

```css
/* 告诉浏览器这个元素不需要双击缩放 */
button, a, .clickable {
  touch-action: manipulation;
}
```

```javascript
// 方案三：使用 touchstart 代替 click
// ⚠️ 不推荐，会导致滚动时误触和穿透问题
// 用 FastClick 库（已过时，现代浏览器不需要）
```

```
现状：
- iOS 9.3+ 和 Chrome 32+ 已自动消除 300ms 延迟（当 viewport 设置了 width=device-width）
- 只有极老设备才需要处理
- 新项目不需要额外处理
```

### 6.2 软键盘弹起与遮挡

```
问题：
- 输入框获焦后软键盘弹起
- iOS：页面整体上推，viewport 缩小
- Android：页面不调整，输入框被键盘遮挡（部分机型）

不同系统的行为差异：
┌──────────┬──────────────────────────────────┐
│   iOS    │ visual viewport 缩小             │
│          │ window.innerHeight 变小          │
│          │ document.body 滚动到输入框可见    │
├──────────┼──────────────────────────────────┤
│ Android  │ 行为不一致，取决于系统和浏览器    │
│          │ 部分机型不调整页面                │
│          │ 部分机型 viewport 缩小            │
└──────────┴──────────────────────────────────┘
```

```javascript
// 方案一：监听 viewport 变化，自动滚动到输入框
function handleKeyboard() {
  const inputs = document.querySelectorAll('input, textarea');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      // 延迟等待键盘弹起后再滚动
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    });
  });
}

// 方案二：检测键盘弹起（通过 window.innerHeight 变化）
const originalHeight = window.innerHeight;
window.addEventListener('resize', () => {
  const currentHeight = window.innerHeight;
  const keyboardOpen = currentHeight < originalHeight - 150;  // 键盘高度通常 > 150px

  if (keyboardOpen) {
    document.body.classList.add('keyboard-open');
  } else {
    document.body.classList.remove('keyboard-open');
  }
});

// 配合 CSS
// .keyboard-open .bottom-action { display: none; }  /* 键盘弹起时隐藏底部操作栏 */
```

```html
<!-- iOS 专属属性：控制键盘上方的工具栏 -->
<!-- autocomplete / autocorrect / autocapitalize -->
<input
  type="text"
  autocomplete="off"
  autocorrect="off"
  autocapitalize="off"
  enterkeyhint="done"
/>
<!-- enterkeyhint 控制回车键的显示文字：done/go/next/search/send -->
```

### 6.3 滚动穿透

```
问题：
- 弹层（Modal / Drawer）打开后，滑动弹层内容时，底部页面也跟着滚动
- iOS 上尤其明显（Safari 的橡皮筋效果）
```

```javascript
// 方案一：body 加 overflow: hidden（简单但 iOS 有问题）
function lockScroll() {
  document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  document.body.style.overflow = '';
}
// iOS Safari 问题：即使 overflow:hidden，body 仍然可以弹性滚动

// 方案二：记录滚动位置，固定 body（推荐）
let scrollY = 0;

function lockScroll() {
  scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
}

function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, scrollY);
}

// 方案三：touch-action: none（弹层内可滚动的区域单独处理）
// .modal-overlay { touch-action: none; }
// .modal-content { touch-action: auto; overflow-y: auto; }
```

### 6.4 position: fixed 问题

```
移动端 fixed 的常见问题：

1. 键盘弹起后 fixed 元素跟随页面移动
   → iOS 上最常见
   → 解决：键盘弹起时将 fixed 改为 absolute

2. 滚动时 fixed 元素闪烁/跳动
   → Android 4.x 常见（现代设备已修复）
   → 解决：给 fixed 元素加 transform: translateZ(0)

3. fixed 元素内的输入框获焦后位置错乱
   → iOS 上常见
   → 解决：将输入框移出 fixed 容器，或键盘弹起时改用 absolute

4. iframe 内的 fixed 相对于 iframe 而非视口
   → 这是标准行为
   → 解决：避免在 iframe 内使用 fixed
```

```css
/* 推荐的底部固定栏写法 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding-bottom: env(safe-area-inset-bottom);  /* 适配底部安全区 */
  transform: translateZ(0);   /* 触发 GPU 加速，减少闪烁 */
  background: #fff;
}

/* 给 body 留出底部空间 */
body {
  padding-bottom: calc(50px + env(safe-area-inset-bottom));
}
```

### 6.5 日期/时间选择器兼容

```html
<!-- date input 在不同平台的表现完全不同 -->
<!-- iOS：原生滚轮选择器 -->
<!-- Android：日历面板（不同厂商样式不同） -->
<!-- PC：文本输入或日历面板 -->

<!-- 不推荐直接使用原生 date input（样式不可控） -->
<input type="date" />
<input type="datetime-local" />

<!-- 推荐方案： -->
<!-- 1. 使用第三方日期选择器组件（vant / antd-mobile） -->
<!-- 2. 如果必须用原生，做好降级处理 -->
```

```javascript
// 检测是否支持原生 date input
function supportsDateInput() {
  const input = document.createElement('input');
  input.type = 'date';
  return input.type === 'date';  // 不支持时会降级为 text
}

// 使用第三方库统一体验（以 Vant 为例）
// import { DatePicker } from 'vant';
// 统一的滚轮选择器样式，跨平台一致
```

### 6.6 其他常见兼容问题

```
┌──────────────────────┬────────────────────────────────────────┐
│        问题          │              解决方案                   │
├──────────────────────┼────────────────────────────────────────┤
│ iOS Safari 橡皮筋    │ overscroll-behavior: none;             │
│ 效果（过度滚动）     │ （现代浏览器支持）                     │
├──────────────────────┼────────────────────────────────────────┤
│ Android 低版本       │ 给动画元素加：                         │
│ 动画闪烁             │ -webkit-backface-visibility: hidden;   │
│                      │ transform: translateZ(0);              │
├──────────────────────┼────────────────────────────────────────┤
│ iOS 点击高亮         │ -webkit-tap-highlight-color: transparent│
│ （灰色闪烁）         │                                        │
├──────────────────────┼────────────────────────────────────────┤
│ iOS 文字大小自动     │ -webkit-text-size-adjust: 100%;        │
│ 调整（横屏时放大）   │                                        │
├──────────────────────┼────────────────────────────────────────┤
│ 长按弹出菜单         │ -webkit-touch-callout: none;           │
│ （复制/粘贴）        │                                        │
├──────────────────────┼────────────────────────────────────────┤
│ 图片模糊（非高清）   │ 用 2x/3x 图，或用 SVG                  │
│                      │ <img srcset="a.png 1x, a@2x.png 2x">  │
├──────────────────────┼────────────────────────────────────────┤
│ 输入框内阴影         │ -webkit-appearance: none;              │
│ （iOS 默认样式）     │ 去掉默认外观                           │
├──────────────────────┼────────────────────────────────────────┤
│ border-radius        │ 部分老 Android 机型 border-radius     │
│ 裁剪不生效           │ 配合 overflow: hidden 使用             │
├──────────────────────┼────────────────────────────────────────┤
│Flexbox 布局          │ 用 autoprefixer 自动添加前缀           │
│ 需要前缀             │ display: -webkit-flex; -webkit-flex... │
├──────────────────────┼────────────────────────────────────────┤
│ CSS overflow scroll  │ overflow-y: auto;                      │
│ 不流畅               │ -webkit-overflow-scrolling: touch;     │
│                      │ （iOS 专用，现代 iOS 已不需要）        │
└──────────────────────┴────────────────────────────────────────┘
```

### 6.7 全局 reset（移动端推荐）

```css
/* 移动端基础 reset */
* {
  -webkit-tap-highlight-color: transparent;  /* 去掉点击高亮 */
  -webkit-text-size-adjust: 100%;            /* 禁止文字自动缩放 */
}

html {
  -webkit-font-smoothing: antialiased;       /* 字体抗锯齿 */
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  -webkit-overflow-scrolling: touch;  /* iOS 弹性滚动 */
  overscroll-behavior: none;          /* 禁止过度滚动传播 */
}

a {
  text-decoration: none;
  color: inherit;
}

img {
  max-width: 100%;
  height: auto;
  -webkit-touch-callout: none;  /* 禁止长按弹出菜单 */
}

input, textarea, button {
  -webkit-appearance: none;     /* 去掉 iOS 默认样式 */
  appearance: none;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;  /* iOS < 16px 会触发自动缩放 */
}

/* iOS 输入框字体小于 16px 时会自动缩放页面 */
/* 解决方案：input font-size >= 16px */
```

---

## 七、图片适配

### 7.1 响应式图片

```html
<!-- 方式一：srcset + sizes -->
<img
  src="photo-400.jpg"
  srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1200.jpg 1200w"
  sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
  alt="响应式图片"
/>
<!-- 浏览器根据视口宽度和 DPR 选择最合适的图片 -->

<!-- 方式二：picture 元素（不同格式/不同裁剪） -->
<picture>
  <!-- 现代格式优先 -->
  <source type="image/avif" srcset="photo.avif">
  <source type="image/webp" srcset="photo.webp">
  <!-- 回退到 JPEG -->
  <img src="photo.jpg" alt="带格式降级的图片">
</picture>

<!-- 方式三：picture + media（不同尺寸用不同裁剪） -->
<picture>
  <source media="(min-width: 768px)" srcset="photo-wide.jpg">
  <source media="(min-width: 480px)" srcset="photo-medium.jpg">
  <img src="photo-narrow.jpg" alt="不同裁剪">
</picture>
```

### 7.2 高清屏图片策略

```
DPR=1 → 1x 图（@1x）
DPR=2 → 2x 图（@2x）→ 宽高各放大 2 倍，显示时缩小到 1x 尺寸
DPR=3 → 3x 图（@3x）

CSS 方式：
.icon {
  width: 24px;
  height: 24px;
  background: url('icon@1x.png');
  background-size: 24px 24px;
}

@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 2dppx) {
  .icon { background-image: url('icon@2x.png'); }
}

@media (-webkit-min-device-pixel-ratio: 3), (min-resolution: 3dppx) {
  .icon { background-image: url('icon@3x.png'); }
}

推荐：直接用 SVG 或 3x 图，在任何 DPR 下都清晰
```

---

## 八、触摸与手势

### 8.1 touch 事件基础

```
触摸事件（按触发顺序）：

touchstart → 手指触摸屏幕
touchmove  → 手指移动
touchend   → 手指离开屏幕
touchcancel → 触摸被系统中断（来电等）

每个 TouchEvent 包含：
touches        → 当前屏幕上所有手指的触摸信息
targetTouches  → 当前元素上的触摸信息
changedTouches → 本次事件变化的触摸信息

每个 Touch 对象：
identifier  → 触摸点唯一标识
clientX/Y   → 相对视口
pageX/Y     → 相对页面（包含滚动）
target      → 触摸的元素
```

### 8.2 点击穿透问题

```
问题：
- 触摸弹出层上的"关闭"按钮
- touchend → 隐藏弹层 → click 延迟 300ms 触发
- 此时 click 的目标变成了弹层下面的元素
- 导致"关闭弹层的同时触发了底层按钮"

解决方案：
1. 全部用 touch 事件替代 click（不推荐，影响可访问性）
2. 弹层关闭后延迟 300ms 再允许底层点击
3. 用 pointer-events 控制

// 推荐：使用 touch-action + pointer-events
```

```javascript
// 方案：弹层关闭后延迟移除遮罩
function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  overlay.style.pointerEvents = 'none';  // 立即禁止点击穿透
  overlay.style.opacity = '0';

  setTimeout(() => {
    overlay.remove();  // 动画结束后再移除 DOM
  }, 300);
}
```

---

## 九、调试方法

### 9.1 移动端调试工具

```
1. Chrome DevTools 远程调试（Android）
   - 手机开启 USB 调试
   - Chrome → F12 → 更多工具 → 远程设备
   - 可实时查看移动端页面的 DOM、Network、Console

2. Safari Web Inspector（iOS）
   - iPhone → 设置 → Safari → 高级 → Web 检查器
   - Mac Safari → 开发 → [你的 iPhone]
   - 可实时调试

3. vConsole / Eruda（无线调试）
   - 在页面中注入调试面板
   - 可查看 Console、Network、DOM、Storage
   - 适合无法连线的场景（微信内、测试机不在身边）

4. Charles / Fiddler（代理抓包）
   - 手机设置代理到电脑
   - 抓取 HTTPS 请求
   - Mock 接口数据
```

```html
<!-- vConsole 使用 -->
<script src="https://unpkg.com/vconsole@latest/dist/vconsole.min.js"></script>
<script>
  if (location.search.includes('debug=true')) {  // 只在需要时开启
    new VConsole();
  }
</script>
```

### 9.2 常用调试 CSS

```css
/* 调试时高亮所有元素边界 */
* {
  outline: 1px solid rgba(255, 0, 0, 0.3);
}

/* 查看 viewport 大小 */
body::before {
  content: 'width: ' + document.documentElement.clientWidth + 'px';
  position: fixed;
  top: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 4px 8px;
  font-size: 12px;
  z-index: 99999;
}

/* 检查 DPR */
console.log('DPR:', window.devicePixelRatio);
console.log('Screen:', screen.width, 'x', screen.height);
console.log('Viewport:', document.documentElement.clientWidth, 'x', document.documentElement.clientHeight);
```

---

## 十、局限性与边界

```
移动端适配的局限：

1. 设备碎片化无法穷尽
   - Android 阵营有数万种设备，不可能逐一测试
   - 只能覆盖主流机型（Top 20 覆盖 90%+ 用户）

2. WebView 差异巨大
   - 微信 WebView、钉钉 WebView、各厂商浏览器行为各异
   - 某些 WebView 不支持最新的 CSS 特性
   - 需要 feature detection 而不是 UA 检测

3. rem/vw 方案的固有缺陷
   - 等比缩放不适合所有场景（大屏手机不需要更大的字）
   - 文字大小应该有合理范围（clamp 限制）
   - 第三方 UI 库可能用 px，混用时需要特殊处理

4. 系统级行为不可控
   - 键盘行为、滚动行为、手势行为因系统而异
   - 只能做防御性处理，无法完全统一

5. 性能与适配的取舍
   - 更精细的适配方案（如多套图片、复杂的 CSS）会增加包体积
   - overscroll-behavior 和 touch-action 可能影响滚动性能
```

---

## 十一、Code Review 检查清单

```
适配：
□ viewport meta 标签是否正确设置？
□ 是否选择了合适的适配方案（rem/vw/responsive）？
□ font-size 是否 >= 16px（避免 iOS 自动缩放）？
□ 是否有硬编码 px 值需要转为响应式单位？
□ 安全区域是否用 env(safe-area-inset-*) 适配？
□ 图片是否做了高清屏适配（srcset / SVG）？
□ 大屏是否限制了最大宽度？

兼容性：
□ 是否处理了 1px 边框问题？
□ 点击延迟是否已消除（touch-action: manipulation）？
□ 软键盘弹起时输入框是否可见？
□ 弹层是否处理了滚动穿透？
□ position: fixed 是否在目标机型上表现正确？
□ iOS 默认样式是否已清除（-webkit-appearance: none）？
□ CSS 是否用了 autoprefixer 添加浏览器前缀？
□ 是否在真机上测试过（不仅是浏览器模拟器）？
```
