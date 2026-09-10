import { Card } from 'antd';
import { formatPrice } from '../../../market/kline';
import type { Market2DController } from '../types';
import { STAGE_HEIGHT } from '../utils/constants';

export interface Market2DStageProps {
    controller: Market2DController;
}

/** 2D 舞台：canvas 渲染容器 + 连接遮罩 + hover OHLC tooltip（HUD 叠层，不进 canvas） */
export function Market2DStage({ controller }: Market2DStageProps) {
    const { containerRef, hover, connected } = controller;

    return (
        <Card
            className="market2d-stage"
            styles={{ body: { padding: 0, height: STAGE_HEIGHT, position: 'relative', overflow: 'hidden' } }}
        >
            <div ref={containerRef} className="market2d-stage__canvas" />
            {!connected && <div className="market2d-stage__mask">连接实时行情中…</div>}
            {hover && (
                <div
                    className="market2d-stage__tooltip"
                    style={{ left: hover.clientX, top: hover.clientY }}
                >
                    <div className="market2d-stage__tooltip-row"><span>开</span><b>{formatPrice(hover.kline.o)}</b></div>
                    <div className="market2d-stage__tooltip-row"><span>高</span><b>{formatPrice(hover.kline.h)}</b></div>
                    <div className="market2d-stage__tooltip-row"><span>低</span><b>{formatPrice(hover.kline.l)}</b></div>
                    <div className="market2d-stage__tooltip-row"><span>收</span><b>{formatPrice(hover.kline.c)}</b></div>
                    <div className="market2d-stage__tooltip-row"><span>量</span><b>{hover.kline.v.toFixed(2)}</b></div>
                </div>
            )}
        </Card>
    );
}
