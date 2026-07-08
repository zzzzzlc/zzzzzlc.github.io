import type { ThemeConfig, ThemeMode } from '../types';

/** localStorage 存储键 */
export const STORAGE_KEY = 'blog-theme-config';

/** 默认浅色主题 */
export const DEFAULT_LIGHT: ThemeConfig = {
    mode: 'light',
    primaryColor: '#1677ff',
    borderRadius: 6,
    fontSize: 14,
    colorBgBase: '#ffffff',
    colorTextBase: '#000000',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

/** 默认深色主题 */
export const DEFAULT_DARK: ThemeConfig = {
    mode: 'dark',
    primaryColor: '#1668dc',
    borderRadius: 6,
    fontSize: 14,
    colorBgBase: '#141414',
    colorTextBase: '#ffffff',
    colorSuccess: '#49aa19',
    colorWarning: '#d89614',
    colorError: '#d32029',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export interface ColorPreset {
    label: string;
    primary: string;
}

/** 主色预设 */
export const PRESETS: ColorPreset[] = [
    { label: '默认蓝', primary: '#1677ff' },
    { label: '极客绿', primary: '#00b96b' },
    { label: '热情红', primary: '#f5222d' },
    { label: '优雅紫', primary: '#722ed1' },
    { label: '活力橙', primary: '#fa8c16' },
    { label: '深邃青', primary: '#08979c' },
    { label: '浪漫粉', primary: '#eb2f96' },
    { label: '沉稳灰', primary: '#595959' },
];

export interface FontOption {
    label: string;
    value: string;
}

/** 字体选项 */
export const FONT_OPTIONS: FontOption[] = [
    { label: '系统默认', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    { label: '宋体', value: "'SimSun', serif" },
    { label: '黑体', value: "'SimHei', sans-serif" },
    { label: '楷体', value: "'KaiTi', serif" },
    { label: '等宽', value: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace" },
];

export interface ModeOption {
    label: string;
    value: ThemeMode;
}

/** 主题模式选项 */
export const MODE_OPTIONS: ModeOption[] = [
    { label: '浅色', value: 'light' },
    { label: '深色', value: 'dark' },
];
