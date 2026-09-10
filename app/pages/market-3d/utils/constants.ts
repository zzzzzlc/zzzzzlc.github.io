import { MARKET_COLORS, WINDOW_SIZE } from '../../../market/constants';

/**
 * market-3d 页面常量：K线几何、相机、DPR 上限。
 * WS/流控常量与涨跌色真源已上移共享层 app/market/constants.ts。
 */

/** K线柱几何（three 空间单位） */
export const CANDLE_WIDTH = 0.6;
export const CANDLE_SPACING = 1.0;
export const CANDLE_BODY_MAX = 22;     // 实体最大高度（价格归一化用）
export const CANDLE_WICK_MAX = 26;     // 影线最大高度

/** 价格曲面参数（沿历史滚动方向铺开） */
export const SURFACE_COLS = WINDOW_SIZE;
export const SURFACE_ROWS = 12;

/** 颜色（十六进制数字，供 three 使用；涨跌色自共享层 CSS 真源单源派生） */
export const COLOR_UP = Number.parseInt(MARKET_COLORS.up.slice(1), 16);
export const COLOR_DOWN = Number.parseInt(MARKET_COLORS.down.slice(1), 16);
export const COLOR_FLAT = Number.parseInt(MARKET_COLORS.flat.slice(1), 16);
export const COLOR_SURFACE = 0x1677ff;
export const COLOR_POINTER = 0xffd166;
export const COLOR_GRID = 0x2a3142;

/** DPR 上限（防高 DPR 设备渲染 9 倍像素拖垮 GPU） */
export const DPR_CAP = 2;
export const DPR_CAP_MOBILE = 1.5;

/** 相机 */
export const CAMERA_FOV = 50;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200;
export const CAMERA_INITIAL_POSITION: readonly [number, number, number] = [0, 14, 52];
export const CONTROLS_TARGET: readonly [number, number, number] = [0, 6, 0];

/** 舞台容器高度 */
export const STAGE_HEIGHT = '70vh';
