import { useEffect, useRef, useState } from 'react';
import type { MarketEngine } from '../services/marketEngine';
import { createMarketEngine } from '../services/marketEngine';
import type { HoverInfo, MarketController } from '../types';
import { useMarketStream } from '../../../market/useMarketStream';

/**
 * 聚合 hook：创建 three.js 引擎并接入数据流，对外暴露 MarketController。
 * 生命周期参考 useThreeViewer：useEffect[] + engineRef + destroy。
 * 引擎通过 getActiveSnapshot 每帧主动拉数据，故仅创建一次即可，不依赖 stream 闭包刷新。
 */
export const useMarket3D = (): MarketController => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const engineRef = useRef<MarketEngine | null>(null);
    const stream = useMarketStream();
    const [hover, setHover] = useState<HoverInfo | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const engine = createMarketEngine(containerRef.current, stream.getActiveSnapshot);
        engine.setHoverHandler(setHover);
        engineRef.current = engine;
        return () => {
            engine.destroy();
            engineRef.current = null;
        };
        // 仅创建一次：getActiveSnapshot 内部读 ref，始终拿到最新数据
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        containerRef,
        symbols: stream.symbols,
        activeSymbol: stream.activeSymbol,
        paused: stream.paused,
        connected: stream.connected,
        lastPrice: stream.lastPrice,
        change: stream.change,
        changePct: stream.changePct,
        hover,
        setActiveSymbol: stream.setActiveSymbol,
        togglePause: stream.togglePause,
    };
};
