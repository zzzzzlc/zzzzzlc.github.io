import { useEffect } from 'react';

/**
 * 主题切换的「锚点坐标」：扩散动画的圆心。仅取 clientX/clientY，
 * 既兼容真实 React.MouseEvent，也允许无事件时手动传入坐标（避免 as any）。
 */
export type ThemeToggleAnchor = { clientX: number; clientY: number };

/**
 * 极简 CSS 注入工具（对齐 antd @rc-component/util 的 updateCSS/removeCSS 行为）。
 * 用 id 复用同一个 <style>，避免重复注入。
 */
const STYLE_ATTR = 'data-vt-style';
function updateCSS(css: string, id: string) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('style');
        el.id = id;
        el.setAttribute(STYLE_ATTR, '');
        document.head.appendChild(el);
    }
    el.textContent = css;
}
function removeCSS(id: string) {
    document.getElementById(id)?.remove();
}

/**
 * 主题切换动画 Hook（对齐 antd 官方 .dumi/hooks/useThemeAnimation.ts 思路）
 *
 * 与之前实现的本质区别：
 * 1. startViewTransition 的回调里 **只切 <html> 的 DOM 属性**（CSS 变量层），
 *    不触碰 React state —— 避免 VT 截图时 React 还没把 cssinjs 新 <style> flush 到 DOM，
 *    导致快照是「半切换」状态、动画结束后真实 DOM 补齐 → 二次闪烁。
 * 2. 动画驱动用 Element.animate() 直接作用于 ::view-transition-new/old 伪元素，
 *    而不是依赖 CSS @keyframes —— 更可控、可在 .ready 后再注入坐标。
 * 3. 动画期间全局 `* { transition: none !important }`，结束后才移除 —— 防止其他
 *    元素自带的 CSS transition 与 VT 动画打架，造成视觉抖动。
 * 4. keepAlive keyframe + forwards 让 old/new 快照在动画全程保持各自 z-index，
 *    避免动画结束瞬间被浏览器移除导致层级跳变。
 */

const DURATION = 0.6; // 秒
// 用 cubic-bezier 替代 ease-in：ease-in 前段太慢、视觉上"扩散感"弱
// cubic-bezier(0.4, 0, 0.2, 1) 是 Material 标准缓动，全程匀速可见
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

const VIEW_TRANSITION_STYLE = `
@keyframes vt-keep-alive { 100% { z-index: -1 } }
::view-transition-old(root),
::view-transition-new(root) {
    animation: vt-keep-alive ${DURATION}s linear;
    animation-fill-mode: forwards;
    mix-blend-mode: normal;
}
/* 切到暗色：新画面（暗色）从点击位置圆形扩散盖住旧画面（亮色） */
html[data-theme='dark']::view-transition-old(root) { z-index: 1; }
html[data-theme='dark']::view-transition-new(root) { z-index: 999; }
/* 切到亮色：旧画面（暗色）保持在上层并圆形收缩，露出下层新画面（亮色） */
html[data-theme='light']::view-transition-old(root) { z-index: 999; }
html[data-theme='light']::view-transition-new(root) { z-index: 1; }
`;

/**
 * 是否支持 View Transitions API
 */
const supportsViewTransition =
    typeof document !== 'undefined' &&
    typeof (document as any).startViewTransition === 'function';

/**
 * 在 ::view-transition-new/old 伪元素上跑圆形 clip-path 动画。
 * - 动画期间禁用全局 transition。
 * - 动画结束（finish 事件）才解除禁用。
 */
function startAnimationTheme(clipPath: string[], isDark: boolean) {
    updateCSS(`* { transition: none !important; }`, 'vt-disable-transition');

    const animation = document.documentElement.animate(
        { clipPath: isDark ? [...clipPath].reverse() : clipPath },
        {
            duration: DURATION * 1000,
            easing: EASING,
            pseudoElement: isDark
                ? '::view-transition-old(root)'
                : '::view-transition-new(root)',
        },
    );

    animation.addEventListener('finish', () => {
        removeCSS('vt-disable-transition');
    });
}

/**
 * 主题切换动画主入口。
 *
 * @param event    触发切换的鼠标事件（用于取点击坐标做圆心）
 * @param isDark   当前（旧）主题是否为暗色 —— 决定动画方向与作用伪元素
 * @param onApply  在 VT 回调内执行的同步应用函数（应包含 flushSync 包裹的 React 状态更新）。
 *                 ★ 关键：把 React state 更新放这里，配合 flushSync，
 *                 保证 VT 截 NEW 快照时 DOM（含 antd cssinjs 注入的 <style>）已完整切到新主题。
 *                 若放在外部异步触发，React 提交晚于 VT 截图 → 快照差异极小 → 扩散几乎看不见。
 */
export async function toggleAnimationTheme(
    event: ThemeToggleAnchor,
    isDark: boolean,
    onApply?: () => void | Promise<void>,
) {
    if (!supportsViewTransition || !event) return;

    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
    );

    // 临时反转 color-scheme：避免 VT 截图时浏览器根据 color-scheme 渲染表单/滚动条
    // 出现非预期的瞬间切换（与 antd 官方一致）
    updateCSS(
        `
        html[data-theme='dark']  { color-scheme: light !important; }
        html[data-theme='light'] { color-scheme: dark !important; }
        `,
        'vt-color-scheme',
    );

    const transition = (document as any).startViewTransition(async () => {
        const root = document.documentElement;
        const next = isDark ? 'light' : 'dark';
        // ① 让调用方在此同步应用新主题（含 React flushSync）
        if (onApply) await onApply();
        // ② 兜底：确保 DOM 属性已切换（即使调用方忘了设置）
        root.setAttribute('data-theme', next);
        root.style.colorScheme = next;
    });

    transition.ready.then(() => {
        // VT 准备好后再注入坐标驱动的圆形动画 + 移除 color-scheme 锁
        removeCSS('vt-color-scheme');
        const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
        ];
        startAnimationTheme(clipPath, isDark);
    });

    transition.ready.catch(() => { /* 用户中断时忽略 */ });
    transition.finished.catch(() => { /* 跳过中断错误 */ });
}

/**
 * Hook：在 mount 时一次性注入全局 VT 样式。
 */
export function useThemeAnimation() {
    useEffect(() => {
        if (supportsViewTransition) {
            updateCSS(VIEW_TRANSITION_STYLE, 'vt-style');
        }
    }, []);

    return toggleAnimationTheme;
}

export { supportsViewTransition };
