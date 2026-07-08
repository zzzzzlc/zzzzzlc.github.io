/** 主题模式 */
export type ThemeMode = 'light' | 'dark';

/** 主题配置（用户可调） */
export interface ThemeConfig {
    mode: ThemeMode;
    primaryColor: string;
    borderRadius: number;
    fontSize: number;
    colorBgBase: string;
    colorTextBase: string;
    colorSuccess: string;
    colorWarning: string;
    colorError: string;
    fontFamily: string;
}

/**
 * 主题定制控制器：useThemeCustomizer 的对外契约
 * 组件层只依赖此接口
 */
export interface ThemeController {
    theme: ThemeConfig;
    update: <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) => void;
    globalMode: ThemeMode;
    isDark: boolean;
    bgCard: string;
    bgBody: string;
    textBase: string;
    handleModeChange: (mode: ThemeMode) => void;
    handleReset: () => void;
    handleExport: () => void;
    handleApply: () => void;
}
