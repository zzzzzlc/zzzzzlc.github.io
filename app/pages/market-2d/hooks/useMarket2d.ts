import { useEffect, useRef, useState } from 'react';
import { useMarketStream } from '../../../market/useMarketStream';
import type { Market2dEngine } from '../services/market2dEngine';
import { createMarket2dEngine } from '../services/market2dEngine';
import type { HoverInfo2D, Market2DController } from '../types';

/**
 * 聚合 hook：创建 Canvas 2D 引擎并接入数据流，对外暴露 Market2DController。
 * 生命周期参考 useMarket3D：useEffect[] + engineRef + destroy。
 * 引擎通过 getActiveSnapshot 每帧主动拉数据，故仅创建一次即可，不依赖 stream 闭包刷新。
 */
export const useMarket2d = (): Market2DController => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const engineRef = useRef<Market2dEngine | null>(null);
    const stream = useMarketStream();
    const [hover, setHover] = useState<HoverInfo2D | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const engine = createMarket2dEngine(containerRef.current, stream.getActiveSnapshot);
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
