/**
 * 行情共享数据契约（market-3d / market-2d 页面共用）。
 * 边界原则：共享层只放数据契约与数据流，页面渲染/交互契约（HoverInfo、Controller）留在各页面 types.ts。
 */

/** 单条 tick 报文（最新价 + 成交量） */
export interface Tick {
    type: 'tick';
    symbol: string;
    price: number;
    volume: number;
    ts: number;
}

/** K线报文（开高低收 + 成交量） */
export interface Kline {
    type: 'kline';
    symbol: string;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    ts: number;
}

export type MarketMessage = Tick | Kline;

/** 单个 symbol 的滚动快照：引擎每帧读取它渲染（绕过 React 重渲染） */
export interface SymbolSnapshot {
    symbol: string;
    klines: Kline[];
    lastPrice: number;
    prevPrice: number;
}
