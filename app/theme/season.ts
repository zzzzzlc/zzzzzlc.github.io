/**
 * 季节主题：与亮暗模式（data-theme）正交的色相层（data-season）。
 * 'none' = 素雅黑白灰（默认，无季节倾向）；
 * 各季节的 CSS 变量覆盖块见 app/index.css 的 `html[data-theme][data-season]` 组合选择器。
 */

/** 季节名（含"无季节"默认态） */
export type SeasonName = 'none' | 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASON_STORAGE_KEY = 'blog-season';

interface SeasonMeta {
    key: SeasonName;
    /** 菜单文案 */
    label: string;
    /** 菜单图标（emoji，与站内 ☀/☾ 切换按钮的字符风格一致） */
    icon: string;
}

/** 季节菜单顺序（none 在首位 = 恢复默认素雅） */
export const SEASONS: SeasonMeta[] = [
    { key: 'none', label: '默认', icon: '◐' },
    { key: 'spring', label: '春', icon: '🌱' },
    { key: 'summer', label: '夏', icon: '🌳' },
    { key: 'autumn', label: '秋', icon: '🍂' },
    { key: 'winter', label: '冬', icon: '❄' },
];

export function isSeasonName(v: string | null): v is SeasonName {
    return v === 'none' || v === 'spring' || v === 'summer' || v === 'autumn' || v === 'winter';
}

/**
 * antd 主色映射：与 index.css 各季节 `--accent` 成对对齐
 * （亮色取实底强调色、暗色取亮强调色），保证 antd 组件跟随季节。
 */
const SEASON_ANTD_PRIMARY: Record<SeasonName, { light: string; dark: string }> = {
    none: { light: '#27272a', dark: '#d4d4d8' },
    spring: { light: '#558b2f', dark: '#9ccc65' },
    summer: { light: '#1a7a3f', dark: '#4fbe7a' },
    autumn: { light: '#c14a24', dark: '#e8834f' },
    winter: { light: '#c62f4b', dark: '#f05663' },
};

export function getAntdPrimary(mode: 'light' | 'dark', season: SeasonName): string {
    return SEASON_ANTD_PRIMARY[season][mode];
}
