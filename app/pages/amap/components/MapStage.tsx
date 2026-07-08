import { Card } from 'antd';
import type { AmapController } from '../types';

export interface MapStageProps {
    controller: AmapController;
}

/** 地图舞台：maplibre-gl 容器 */
export function MapStage({ controller }: MapStageProps) {
    const { containerRef } = controller;

    return (
        <Card styles={{ body: { padding: 0, overflow: 'hidden' } }}>
            <div ref={containerRef} style={{ width: '100%', height: '70vh' }} />
        </Card>
    );
}
