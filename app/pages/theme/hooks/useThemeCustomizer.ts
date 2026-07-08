import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useThemeMode } from '../../../theme/ThemeProvider';
import type { ThemeConfig, ThemeController, ThemeMode } from '../types';
import { DEFAULT_DARK, DEFAULT_LIGHT, STORAGE_KEY } from '../utils/constants';
import { generateCss } from '../utils/generateCss';

/**
 * 主题定制核心逻辑聚合 hook：
 * 主题配置状态、模式同步（跟随全局 Provider）、持久化、应用、导出、重置
 */
export const useThemeCustomizer = (): ThemeController => {
    const { mode: globalMode, setMode: setGlobalMode } = useThemeMode();
    const [theme, setTheme] = useState<ThemeConfig>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { return { ...DEFAULT_LIGHT, ...JSON.parse(saved) }; } catch { /* ignore */ }
        }
        return DEFAULT_LIGHT;
    });

    // mode 字段始终跟随全局 Provider（单一数据源）
    useEffect(() => {
        setTheme(prev => ({
            ...prev,
            mode: globalMode,
            ...(globalMode === 'dark'
                ? { colorBgBase: '#141414', colorTextBase: '#ffffff' }
                : { colorBgBase: '#ffffff', colorTextBase: '#000000' }),
        }));
    }, [globalMode]);

    // 持久化到 localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    }, [theme]);

    const isDark = globalMode === 'dark';
    const bgCard = isDark ? '#1f1f1f' : '#ffffff';
    const bgBody = isDark ? '#141414' : '#f5f5f5';
    const textBase = theme.colorTextBase;

    const update = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) => {
        setTheme(prev => ({ ...prev, [key]: value }));
    };

    const handleReset = () => {
        const defaultTheme = isDark ? DEFAULT_DARK : DEFAULT_LIGHT;
        setTheme(defaultTheme);
        message.success('已重置为默认主题');
    };

    const handleModeChange = (mode: ThemeMode) => {
        setGlobalMode(mode);
    };

    const handleExport = () => {
        const css = generateCss(theme);
        navigator.clipboard.writeText(css).then(() => message.success('CSS 已复制到剪贴板'));
    };

    const handleApply = () => {
        const css = generateCss(theme);
        let styleEl = document.getElementById('dynamic-theme') as HTMLStyleElement | null;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'dynamic-theme';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = css;
        message.success('主题已应用');
    };

    return {
        theme, update, globalMode, isDark, bgCard, bgBody, textBase,
        handleModeChange, handleReset, handleExport, handleApply,
    };
};
