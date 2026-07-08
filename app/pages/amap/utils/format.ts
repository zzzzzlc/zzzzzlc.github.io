import type { RouteManeuver } from '../types';

/**
 * 秒数格式化为时长文案：<60s → "N 秒"，<60min → "N 分钟"，否则 "H 小时 M 分钟"
 */
export const formatDuration = (sec: number): string => {
    if (sec < 60) return `${Math.round(sec)} 秒`;
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} 分钟`;
    const h = Math.floor(m / 60);
    return `${h} 小时 ${m % 60} 分钟`;
};

/**
 * 距离格式化：<1000m → "N 米"，否则 "X.X 公里"
 */
export const formatDistance = (m: number): string =>
    m < 1000 ? `${Math.round(m)} 米` : `${(m / 1000).toFixed(1)} 公里`;

const MANEUVER_LABELS: Record<string, (modifier?: string) => string> = {
    depart: () => '出发',
    arrive: () => '到达目的地',
    turn: (mod) => `向${mod === 'left' ? '左' : mod === 'right' ? '右' : mod}转`,
    continue: () => '继续直行',
    merge: (mod) => `汇入${mod === 'left' ? '左侧' : '右侧'}道路`,
    'new name': () => '进入新道路',
    end: () => '结束',
};

/**
 * 由 OSRM maneuver 构造中文导航指令（替代原 buildInstruction 的 any 入参）
 */
export const buildInstruction = (maneuver: RouteManeuver): string => {
    const { type, modifier } = maneuver;
    const factory = MANEUVER_LABELS[type];
    if (factory) return factory(modifier);
    return type === 'turn' ? '转弯' : '前行';
};
