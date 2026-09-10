import type { RefObject } from 'react';
import type { Kline } from '../../market/types';

/** 数据契约（Tick/Kline/MarketMessage/SymbolSnapshot）已上移共享层 app/market/types.ts */
export type { Tick, Kline, MarketMessage, SymbolSnapshot } from '../../market/types';

/** hover 命中 K线时回传给组件的信息（用于定位 HUD tooltip） */
export interface HoverInfo {
    kline: Kline;
    clientX: number;
    clientY: number;
}

/** 页面控制器契约：hook 聚合逻辑与状态，组件纯展示消费 */
export interface MarketController {
    /** three.js canvas 容器 ref（透传给引擎） */
    containerRef: RefObject<HTMLDivElement | null>;
    /** 可选 symbol 列表 */
    symbols: string[];
    activeSymbol: string;
    paused: boolean;
    connected: boolean;
    /** 当前 symbol 最新价 */
    lastPrice: number;
    /** 相对开盘价（窗口首根）涨跌额 */
    change: number;
    /** 相对开盘价涨跌幅 % */
    changePct: number;
    /** hover 命中的 K线（null 表示未命中），供 Stage 渲染 tooltip */
    hover: HoverInfo | null;
    setActiveSymbol: (symbol: string) => void;
    togglePause: () => void;
}
