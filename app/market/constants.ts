/**
 * 行情共享常量（market-3d / market-2d 页面共用）。
 * 颜色以 CSS 字符串为唯一真源；three.js 需要的数字形态由 market-3d 页面常量单源派生。
 */

/** WebSocket 地址（mock server，仅 dev 可达） */
export const WS_URL = 'ws://localhost:8787';

/** 断线重连初始延迟 ms（指数退避基数） */
export const RECONNECT_BASE_DELAY = 1500;

/** RxJS bufferTime：聚合高频 tick，每帧最多喂一次引擎，避免每 tick 重算几何 */
export const BUFFER_TIME = 80;

/** 滚动窗口 K线根数（同时显示的柱数） */
export const WINDOW_SIZE = 60;

/** 初始 symbol */
export const DEFAULT_SYMBOL = 'BTC';

/** 涨跌色唯一真源（CSS 字符串） */
export const MARKET_COLORS = {
    up: '#2ecc71',
    down: '#e74c3c',
    flat: '#95a5a6',
} as const;
