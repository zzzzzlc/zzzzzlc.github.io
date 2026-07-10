import { createContext, useContext } from 'react';
import type { ThemeToggleAnchor } from './useThemeAnimation';

/** 全局主题模式 */
export type Mode = 'light' | 'dark';

/** 主题上下文对外契约：消费方通过 useThemeMode() 读取 */
export interface ThemeContextValue {
    mode: Mode;
    /** 以默认坐标（右上角）切换主题，带 View Transition 动画 */
    toggle: () => void;
    /** 以鼠标事件坐标为圆心切换主题（用于扩散动画起点） */
    toggleFromEvent: (e: ThemeToggleAnchor) => void;
    /** 直接设定模式 */
    setMode: (m: Mode) => void;
}

/**
 * 主题上下文：与 Provider 组件分文件存放，避免 ThemeProvider.tsx 同时导出组件与非组件
 * 触发 react-refresh/only-export-components。
 */
export const ThemeContext = createContext<ThemeContextValue>({
    mode: 'light',
    toggle: () => {},
    toggleFromEvent: () => {},
    setMode: () => {},
});

/** 读取全局主题上下文（mode / toggle / setMode） */
export function useThemeMode(): ThemeContextValue {
    return useContext(ThemeContext);
}
