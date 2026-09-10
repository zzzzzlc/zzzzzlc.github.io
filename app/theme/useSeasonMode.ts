import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { animateThemeSwap, supportsViewTransition } from './useThemeAnimation';
import { isSeasonName, SEASON_STORAGE_KEY, type SeasonName } from './season';

/** 跟随系统「减少动效」设置（与 ThemeProvider 同策略：模块级只读一次） */
const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function readInitialSeason(): SeasonName {
    const saved = localStorage.getItem(SEASON_STORAGE_KEY);
    return isSeasonName(saved) ? saved : 'none';
}

/**
 * 季节主题状态 Hook（逻辑外置自 ThemeProvider）：
 * - 持久化到 localStorage['blog-season']
 * - 同步 <html data-season>，由 CSS 组合选择器覆盖色相层变量
 * - setSeasonFromEvent 带 View Transition 圆形扩散动画（从点击坐标展开）
 */
export function useSeasonMode(mode: 'light' | 'dark') {
    const [season, setSeasonState] = useState<SeasonName>(readInitialSeason);

    // mount / 变化后同步 html 属性（SSR 无关，纯 CSR）
    useEffect(() => {
        document.documentElement.setAttribute('data-season', season);
    }, [season]);

    const applySeason = useCallback((next: SeasonName) => {
        setSeasonState(next);
        localStorage.setItem(SEASON_STORAGE_KEY, next);
        document.documentElement.setAttribute('data-season', next);
    }, []);

    /** 带 VT 圆形扩散的季节切换（不支持 VT / 减少动效时直接应用） */
    const setSeasonFromEvent = useCallback(
        (next: SeasonName, e: { clientX: number; clientY: number }) => {
            if (!supportsViewTransition || prefersReducedMotion) {
                applySeason(next);
                return;
            }
            animateThemeSwap(e, mode === 'dark', () => {
                flushSync(() => applySeason(next));
            });
        },
        [applySeason, mode],
    );

    return { season, setSeason: applySeason, setSeasonFromEvent };
}
