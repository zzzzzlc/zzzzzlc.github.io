# 项目异常记录

记录项目开发过程中遇到的问题、排查过程与修复方案，方便后续查阅。

---

## #004 antd 主题切换动画扩散效果不明显 + 暗→亮二次闪烁

| 字段 | 内容 |
|------|------|
| **发现时间** | 2026-06-16 |
| **出现次数** | 多次迭代 |
| **影响范围** | 全站主题切换体验（BlogLayout 右上角主题切换按钮） |
| **严重程度** | 中（功能可用，但视觉体验差） |

### 问题描述

实现 antd v5 主题亮/暗切换 + View Transitions API 圆形扩散动画时，出现两个问题：

1. **暗→亮切换后快速闪烁**：收缩动画完成后，画面出现一次快速的"二次扩散/收缩"闪动。
2. **扩散效果不明显**："扩散动画和直接切换没区别"——看不到圆形扩散过程。

### 根因分析

经历多次错误诊断后定位到真正的根因，与 antd 官方 PR #55527 / #55534 修复思路一致：**React 状态更新与 VT 截图时机错位**。

```
事件处理器内调用顺序（错误版本）：
  ① toggleAnimationTheme(e, isDark)   // 启动 VT，回调是 microtask
  ② applyMode(nextMode)                // setModeState 批处理，未立即提交

React 18 自动批处理 → setModeState 进入待提交队列
↓
VT 的 microtask 回调先于 React 提交执行
↓
VT 截 NEW 快照时：
  - data-theme 属性已切（瞬时 CSS 变量）
  - 但 antd 的 cssinjs 新 <style> 还没注入（React 没 flush）
↓
NEW 快照里：markdown/CSS 变量层 = 新主题，antd 组件 = 旧主题
OLD 快照里：全部 = 旧主题
↓
扩散动画只展示了 CSS 变量层的差异，antd 组件视觉无变化 → 扩散几乎看不见
↓
VT 动画结束后 React 才提交 → antd 组件才真正切换 → 视觉二次闪动
```

### 修复方案

对齐 antd 官方 `.dumi/hooks/useThemeAnimation.ts` 架构，关键改动：

**1. 抽出独立 hook `app/theme/useThemeAnimation.ts`**

- mount 时一次性注入 VT 全局样式（`::view-transition` 规则 + `keepAlive` keyframe + `forwards`，让 old/new 快照在动画全程保持 z-index，避免动画结束瞬间层级跳变）
- 动画驱动用 `Element.animate()` 直接作用于伪元素（不是 CSS @keyframes），可在 `.ready` 后注入坐标
- 动画期间全局 `* { transition: none !important }`，`finish` 事件才移除——防止其他元素自带 CSS transition 与 VT 打架
- VT 回调里临时反转 `color-scheme`，避免截图时浏览器原生控件（表单/滚动条）非预期瞬间切换

**2. React state 更新放进 VT 回调 + flushSync**

```typescript
toggleAnimationTheme(e, isDark, () => {
    flushSync(() => {
        applyMode(nextMode);  // 强制 React 同步提交
    });
});
```

`flushSync` 让 React 在 VT 回调里同步完成 commit：ConfigProvider 切换 algorithm → antd cssinjs 注入新 `<style>` → antd 组件树重渲染。VT 此时再截 NEW 快照，整个页面（antd + CSS 变量层）都是新主题——OLD/NEW 快照差异最大化，扩散清晰可见。

**3. 动画参数调整**

- `DURATION`: `0.5s` → `0.6s`，扩散过程更易感知
- `EASING`: `ease-in` → `cubic-bezier(0.4, 0, 0.2, 1)`，前者前段过慢视觉感弱，后者全程匀速可见

### 走过的弯路（错误方案）

| 尝试 | 结果 |
|------|------|
| 在 VT 回调里 `requestAnimationFrame` 等下一帧 | 闪烁仍在 |
| 用 `data-vt-active` 标记全局禁用 transition | 治标不治本 |
| 把 React state 更新和 VT 回调彻底解耦（state 在外异步触发） | 扩散完全看不见，等同直接切换 |
| 用 `flushSync` 但状态更新仍在外部 | 闪烁减弱但未根除 |

**关键认知**：`flushSync` 不是问题，问题是没有把 React state 更新放进 VT 回调——只有放进回调内 flushSync，才能保证 NEW 快照是完整新主题。

### 参考

- antd 官方实现：[`ant-design/.dumi/hooks/useThemeAnimation.ts`](https://github.com/ant-design/ant-design/blob/master/.dumi/hooks/useThemeAnimation.ts)
- antd 官方实现：[`ant-design/.dumi/theme/common/ThemeSwitch/index.tsx`](https://github.com/ant-design/ant-design/blob/master/.dumi/theme/common/ThemeSwitch/index.tsx)
- antd 闪烁问题修复 PR：[#55527](https://github.com/ant-design/ant-design/pull/55527) / [#55534](https://github.com/ant-design/ant-design/pull/55534)

### 涉及文件

- `app/theme/useThemeAnimation.ts` — **新增**，VT 动画引擎（对齐 antd 官方）
- `app/theme/ThemeProvider.tsx` — 改造 `toggleFromEvent`：React state 更新通过 `onApply` 回调放进 VT 回调内 + `flushSync`
- `app/index.css` — 移除手写的 `::view-transition` 规则和 `@keyframes`（改由 hook 注入）

---

## #003 dangerouslySetInnerHTML 中 DOM 操作被 React 重渲染覆盖

| 字段 | 内容 |
|------|------|
| **发现时间** | 2026-06-04 |
| **出现次数** | 1 |
| **影响范围** | 博客文章页右侧目录导航（TOC） |
| **严重程度** | 高（功能完全不可用） |

### 问题描述

右侧目录导航组件（TableOfContents）需要给文章中的 `<h2>`/`<h3>` 标签注入 `id` 属性，以实现锚点跳转和 IntersectionObserver 定位。最初的实现是在 `useEffect` 中通过 DOM 操作 `heading.id = id` 注入。

**现象**：目录正常生成，但点击跳转失效。检查 DOM 发现 heading 元素没有 `id` 属性。

### 根因分析

React 的 `dangerouslySetInnerHTML` 在组件重渲染时，会用原始 HTML 字符串重新设置 `innerHTML`。父组件 `BlogPost` 有一个 `scroll` 事件监听器（控制"返回顶部"按钮显隐），每次滚动都会触发 `setState` → 重渲染 → `innerHTML` 被覆盖 → 之前通过 DOM 操作注入的 `id` 全部丢失。

```
滚动事件 → setShowBackTop() → BlogPost 重渲染
→ dangerouslySetInnerHTML 用原始 post.html 覆盖 DOM
→ heading.id 丢失 → getElementById 返回 null → 跳转失效
```

### 修复方案

**从 DOM 层面注入改为 HTML 字符串层面注入**。在将 HTML 传给 `dangerouslySetInnerHTML` 之前，用正则替换在 `<h2>`/`<h3>` 标签中直接写入 `id` 属性，同时提取目录数据。

```typescript
function processHtml(html: string) {
    let idx = 0;
    const items = [];
    const processed = html.replace(
        /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
        (match, tag, attrs, content) => {
            const id = `toc-${idx++}`;
            items.push({ id, text, level: ... });
            return `<${tag} id="${id}"${attrs || ''}>${content}</${tag}>`;
        }
    );
    return { html: processed, tocItems: items };
}
```

**核心思路**：ID 成为 HTML 内容的一部分，React 无论怎么重渲染都不会丢失。

### 涉及文件

- `app/pages/BlogPost/index.tsx` — 新增 `processHtml()` 处理 HTML 字符串
- `component/TableOfContents.tsx` — 改为接收 `items` props，不再扫描 DOM

---

## #002 IntersectionObserver 重渲染导致 scroll 事件监听器频繁触发

| 字段 | 内容 |
|------|------|
| **发现时间** | 2026-06-04 |
| **出现次数** | 1 |
| **影响范围** | 博客文章页滚动性能 |
| **严重程度** | 低 |

### 问题描述

`BlogPost` 组件中的 `scroll` 事件监听器在每次滚动时都调用 `setState`，导致组件高频重渲染。在长文章页面，滚动时会产生大量不必要的 React reconciliation。

### 修复方案

当前未做优化。后续可通过 `requestAnimationFrame` 节流或使用 `IntersectionObserver` 替代 scroll 监听来判断是否显示"返回顶部"按钮。

---

## #001 Markdown 文章 heading 缺少 id 属性

| 字段 | 内容 |
|------|------|
| **发现时间** | 2026-06-04 |
| **出现次数** | 1 |
| **影响范围** | 博客文章页锚点跳转、目录导航 |
| **严重程度** | 高 |

### 问题描述

Vite 插件 `plugins/markdown.ts` 使用 `remark-html` 编译 Markdown，`remark-html` 默认不给 heading 标签添加 `id` 属性。导致：
1. 无法通过 URL hash 定位到文章章节
2. 无法实现右侧目录导航的锚点跳转

### 修复方案

不在插件层面修改（避免增加插件复杂度），而是在组件渲染前通过 `processHtml()` 函数用正则注入 ID。这样：
- 不需要安装新的 remark 插件
- 不修改 Vite 插件的虚拟模块缓存逻辑
- ID 注入和目录数据提取在同一步完成

### 涉及文件

- `app/pages/BlogPost/index.tsx` — `processHtml()` 函数

---

## 记录模板

```markdown
## #NNN 问题标题

| 字段 | 内容 |
|------|------|
| **发现时间** | YYYY-MM-DD |
| **出现次数** | N |
| **影响范围** | 影响的页面/模块 |
| **严重程度** | 高/中/低 |

### 问题描述

简要描述问题现象和复现步骤。

### 根因分析

分析问题的根本原因。

### 修复方案

描述修复思路和关键代码变更。

### 涉及文件

- `path/to/file.tsx` — 变更说明
```
