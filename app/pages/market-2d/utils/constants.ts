import { MARKET_COLORS } from '../../../market/constants';

/**
 * market-2d 页面常量：布局尺寸、动画参数、深色舞台调色板。
 * 涨跌色真源在共享层 MARKET_COLORS，此处只做 2D 侧派生。
 */

/** 舞台容器高度 */
export const STAGE_HEIGHT = '70vh';

/** 右侧价格轴宽度 / 底部时间轴高度（CSS 像素） */
export const AXIS_W = 64;
export const AXIS_H = 24;

/** 成交量副图占绘图区高度比例 */
export const VOLUME_RATIO = 0.18;

/** 价格坐标上下留白比例（避免柱体贴边） */
export const PAD_RATIO = 0.08;

/** 纵向网格（价格刻度）条数 */
export const PRICE_TICKS = 5;

/** 横向网格间隔（每 N 根 K线一条时间刻度） */
export const TIME_GAP = 10;

/** 动画 lerp 因子与收敛阈值（与 3D 引擎同值，动画节奏一致） */
export const LERP = 0.16;
export const EPS = 0.01;

/** DPR 上限（防高 DPR 设备全量重绘拖垮主线程） */
export const DPR_CAP = 2;
export const DPR_CAP_MOBILE = 1.5;

/** 轴文字字体（等宽数字对齐） */
export const FONT = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** 深色舞台调色板（canvas 透明底色，容器 CSS 负责背景） */
export const PALETTE = {
    grid: 'rgba(148, 163, 184, 0.16)',
    axisText: 'rgba(148, 163, 184, 0.9)',
    crosshair: 'rgba(148, 163, 184, 0.55)',
    bubbleBg: 'rgba(15, 23, 42, 0.92)',
    bubbleText: '#e2e8f0',
    hoverRing: '#e2e8f0',
    pointer: '#ffd166',
    up: MARKET_COLORS.up,
    down: MARKET_COLORS.down,
    flat: MARKET_COLORS.flat,
} as const;
