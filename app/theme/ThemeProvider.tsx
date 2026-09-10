import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd';
import {
    supportsViewTransition,
    toggleAnimationTheme,
    useThemeAnimation,
} from './useThemeAnimation';
import { useSeasonMode } from './useSeasonMode';
import { getAntdPrimary, type SeasonName } from './season';

type Mode = 'light' | 'dark';

interface ThemeContextValue {
    mode: Mode;
    toggle: () => void;
    toggleFromEvent: (e: React.MouseEvent) => void;
    setMode: (m: Mode) => void;
    /** 季节主题（色相层，与亮暗正交） */
    season: SeasonName;
    setSeason: (s: SeasonName) => void;
    /** 带 VT 圆形扩散动画的季节切换 */
    setSeasonFromEvent: (s: SeasonName, e: { clientX: number; clientY: number }) => void;
}

const STORAGE_KEY = 'blog-mode';
const ThemeContext = createContext<ThemeContextValue>({
    mode: 'light',
    toggle: () => { },
    toggleFromEvent: () => { },
    setMode: () => { },
    season: 'none',
    setSeason: () => { },
    setSeasonFromEvent: () => { },
});

export function useThemeMode(): ThemeContextValue {
    return useContext(ThemeContext);
}

/**
 * 跟随系统「减少动效」设置
 */
const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // mount 时注入全局 VT 样式（::view-transition 规则、keepAlive keyframe）
    useThemeAnimation();

    const [mode, setModeState] = useState<Mode>(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as Mode | null;
        if (saved === 'light' || saved === 'dark') return saved;
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    // 季节主题（色相层），逻辑外置于 useSeasonMode
    const { season, setSeason, setSeasonFromEvent } = useSeasonMode(mode);

    const applyMode = (m: Mode) => {
        setModeState(m);
        localStorage.setItem(STORAGE_KEY, m);
        document.documentElement.setAttribute('data-theme', m);
        document.documentElement.style.colorScheme = m;
    };

    const setMode = (m: Mode) => applyMode(m);

    /**
     * 带 View Transition 的切换（对齐 antd 官方架构）：
     *
     * 关键点：把 React state 更新（applyMode）通过 onApply 回调放进 VT 的回调里，
     * 并用 flushSync 强制 React 同步提交 —— 这样 VT 截 NEW 快照时，
     * antd 的 cssinjs 新 <style> 已经注入到 DOM，组件树已切到新主题，
     * 快照里整个页面（antd 组件 + CSS 变量层）都是新主题。
     *
     * 若把 applyMode 放在 toggleAnimationTheme 之后异步触发，React 提交晚于 VT 截图
     * → NEW 快照里 antd 组件仍是旧主题，扩散动画只有 CSS 变量层在变 → 视觉差异极小，
     * 看起来"和直接切换没啥区别"。
     */
    const toggleFromEvent = (e: React.MouseEvent) => {
        const nextMode: Mode = mode === 'light' ? 'dark' : 'light';
        const isDark = mode === 'dark';

        if (!supportsViewTransition || prefersReducedMotion) {
            applyMode(nextMode);
            return;
        }

        toggleAnimationTheme(e, isDark, () => {
            // ★ VT 回调内同步 flush React，保证 NEW 快照是完整的新主题
            flushSync(() => {
                applyMode(nextMode);
            });
        });
    };

    const toggle = () =>
        toggleFromEvent({ clientX: window.innerWidth - 40, clientY: 40 } as any);

    // mount 后立刻同步 html 属性（首次渲染时确保 data-theme 正确）
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', mode);
        document.documentElement.style.colorScheme = mode;
    }, [mode]);

    // 标记 VT 是否支持：CSS 据此决定 body 是否启用兜底过渡
    useEffect(() => {
        document.documentElement.setAttribute(
            'data-vt',
            supportsViewTransition ? 'true' : 'false',
        );
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            if (!localStorage.getItem(STORAGE_KEY)) {
                setModeState(e.matches ? 'dark' : 'light');
            }
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const value = useMemo(
        () => ({ mode, toggle, toggleFromEvent, setMode, season, setSeason, setSeasonFromEvent }),
        [mode, season, setSeason, setSeasonFromEvent],
    );

    return (
        <ThemeContext.Provider value={value}>
            <ConfigProvider
                theme={{
                    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                    token: {
                        // 主色与 CSS 变量 --accent 成对对齐：素雅黑白灰为默认，
                        // 季节主题（data-season）时跟随各季 accent；
                        // borderRadius 3：antd 组件方角化，跟随整站规则线语言
                        colorPrimary: getAntdPrimary(mode, season),
                        borderRadius: 3,
                        fontSize: 14,
                    },
                }}
            >
                {/* antd App：提供 message/notification/modal 的 context 版本（App.useApp()），取代静态调用以继承主题 */}
                <AntdApp>{children}</AntdApp>
            </ConfigProvider>
        </ThemeContext.Provider>
    );
}
