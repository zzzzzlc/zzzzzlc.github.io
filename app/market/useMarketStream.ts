import { useEffect, useRef, useState } from 'react';
import { bufferTime } from 'rxjs';
import { createMarketStream } from './wsStream';
import { BUFFER_TIME, DEFAULT_SYMBOL, WINDOW_SIZE } from './constants';
import type { Kline, MarketMessage, SymbolSnapshot, Tick } from './types';

/** 超过该时长无消息即视为断线（mock server 每 ~120ms 推送） */
const HEARTBEAT_TIMEOUT = 3000;

/** useMarketStream 对外契约：数据流聚合 + 实时数值 + 控制 */
export interface MarketStreamApi {
    symbols: string[];
    activeSymbol: string;
    connected: boolean;
    paused: boolean;
    lastPrice: number;
    change: number;
    changePct: number;
    /** 引擎每帧调用，读当前 symbol 的最新快照（绕过 React 重渲染，性能优） */
    getActiveSnapshot: () => SymbolSnapshot | undefined;
    setActiveSymbol: (symbol: string) => void;
    togglePause: () => void;
}

/**
 * 订阅 market ws 流，按 symbol 维护滚动 K线窗口，bufferTime 聚合高频 tick，
 * 对外暴露 UI 数值 + 给引擎读的快照 getter。
 */
export const useMarketStream = (): MarketStreamApi => {
    const snapshotsRef = useRef<Map<string, SymbolSnapshot>>(new Map());
    const pausedRef = useRef(false);
    const activeSymbolRef = useRef(DEFAULT_SYMBOL);
    const aliveTimer = useRef<number | undefined>(undefined);

    const [symbols, setSymbols] = useState<string[]>([]);
    const [activeSymbol, setActiveSymbolState] = useState(DEFAULT_SYMBOL);
    const [connected, setConnected] = useState(false);
    const [paused, setPausedState] = useState(false);
    const [quote, setQuote] = useState({ lastPrice: 0, change: 0, changePct: 0 });

    const recomputeQuote = (sym: string) => {
        const snap = snapshotsRef.current.get(sym);
        if (!snap || snap.klines.length === 0) {
            setQuote({ lastPrice: snap?.lastPrice ?? 0, change: 0, changePct: 0 });
            return;
        }
        const open = snap.klines[0].o;
        setQuote({
            lastPrice: snap.lastPrice,
            change: snap.lastPrice - open,
            changePct: ((snap.lastPrice - open) / (open || 1)) * 100,
        });
    };

    const ensureSnapshot = (symbol: string, price: number): SymbolSnapshot => {
        const map = snapshotsRef.current;
        let snap = map.get(symbol);
        if (!snap) {
            snap = { symbol, klines: [], lastPrice: price, prevPrice: price };
            map.set(symbol, snap);
            setSymbols((s) => (s.includes(symbol) ? s : [...s, symbol]));
        }
        return snap;
    };

    const applyMessage = (msg: MarketMessage) => {
        if (msg.type === 'kline') {
            const k = msg as Kline;
            const snap = ensureSnapshot(k.symbol, k.c);
            snap.klines.push(k);
            if (snap.klines.length > WINDOW_SIZE) snap.klines.shift();
            snap.prevPrice = snap.lastPrice;
            snap.lastPrice = k.c;
        } else {
            const t = msg as Tick;
            const snap = ensureSnapshot(t.symbol, t.price);
            snap.prevPrice = snap.lastPrice;
            snap.lastPrice = t.price;
        }
    };

    useEffect(() => {
        const sub = createMarketStream().pipe(bufferTime(BUFFER_TIME)).subscribe({
            next: (batch: MarketMessage[]) => {
                setConnected(true);
                window.clearTimeout(aliveTimer.current);
                aliveTimer.current = window.setTimeout(() => setConnected(false), HEARTBEAT_TIMEOUT);
                if (pausedRef.current || batch.length === 0) return;
                for (const m of batch) applyMessage(m);
                recomputeQuote(activeSymbolRef.current);
            },
        });
        return () => {
            sub.unsubscribe();
            window.clearTimeout(aliveTimer.current);
        };
        // 仅挂载时订阅一次：applyMessage / recomputeQuote 仅依赖稳定 ref 与 setter
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setActiveSymbol = (sym: string) => {
        activeSymbolRef.current = sym;
        setActiveSymbolState(sym);
        recomputeQuote(sym);
    };

    const togglePause = () => {
        const next = !pausedRef.current;
        pausedRef.current = next;
        setPausedState(next);
    };

    return {
        symbols,
        activeSymbol,
        connected,
        paused,
        lastPrice: quote.lastPrice,
        change: quote.change,
        changePct: quote.changePct,
        getActiveSnapshot: () => snapshotsRef.current.get(activeSymbolRef.current),
        setActiveSymbol,
        togglePause,
    };
};
