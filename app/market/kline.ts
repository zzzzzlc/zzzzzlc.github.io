import type { Kline } from './types';
import { MARKET_COLORS } from './constants';

/** 取滚动窗口内的价格区间 [min, max]（含影线），用于归一化柱高 */
export const priceRange = (klines: readonly Kline[]): [number, number] => {
    if (klines.length === 0) return [0, 1];
    let min = Infinity;
    let max = -Infinity;
    for (const k of klines) {
        if (k.l < min) min = k.l;
        if (k.h > max) max = k.h;
    }
    if (min === max) {
        min -= 1;
        max += 1;
    }
    return [min, max];
};

/** 价格 → [0,1] 归一化 */
export const normalize = (price: number, min: number, max: number): number => {
    const range = max - min || 1;
    return (price - min) / range;
};

/** K线涨跌色（CSS 字符串，Canvas 2D / DOM 用） */
export const klineColorCss = (k: Kline): string =>
    k.c > k.o ? MARKET_COLORS.up : k.c < k.o ? MARKET_COLORS.down : MARKET_COLORS.flat;

/** 成交量窗口最大值（成交量副图归一化用，0 安全） */
export const maxVolume = (klines: readonly Kline[]): number => {
    let m = 0;
    for (const k of klines) if (k.v > m) m = k.v;
    return m || 1;
};

/** 涨跌幅 %（基于开盘价） */
export const changePctOf = (k: Kline): number =>
    k.o === 0 ? 0 : ((k.c - k.o) / k.o) * 100;

/** 把数值格式化为带千分位的字符串 */
export const formatPrice = (n: number): string =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
