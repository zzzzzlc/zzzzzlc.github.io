import { Card } from 'antd';
import type { MarketController } from '../types';
import { STAGE_HEIGHT } from '../utils/constants';
import { formatPrice } from '../../../market/kline';

export interface Market3DStageProps {
    controller: MarketController;
}

/** 3D 舞台：three.js 渲染容器 + 连接遮罩 + hover OHLC tooltip（HUD 叠层，不进 three 场景） */
export function Market3DStage({ controller }: Market3DStageProps) {
    const { containerRef, hover, connected } = controller;

    return (
        <Card
            className="market-stage"
            styles={{ body: { padding: 0, height: STAGE_HEIGHT, position: 'relative', overflow: 'hidden' } }}
        >
            <div ref={containerRef} className="market-stage__canvas" />
            {!connected && <div className="market-stage__mask">连接实时行情中…</div>}
            {hover && (
                <div
                    className="market-stage__tooltip"
                    style={{ left: hover.clientX, top: hover.clientY }}
                >
                    <div className="market-stage__tooltip-row"><span>开</span><b>{formatPrice(hover.kline.o)}</b></div>
                    <div className="market-stage__tooltip-row"><span>高</span><b>{formatPrice(hover.kline.h)}</b></div>
                    <div className="market-stage__tooltip-row"><span>低</span><b>{formatPrice(hover.kline.l)}</b></div>
                    <div className="market-stage__tooltip-row"><span>收</span><b>{formatPrice(hover.kline.c)}</b></div>
                </div>
            )}
        </Card>
    );
}
