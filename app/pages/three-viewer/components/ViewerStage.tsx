import { Card } from 'antd';
import type { CSSProperties } from 'react';
import type { ThreeViewerController } from '../types';
import { VIEWER_HEIGHT } from '../utils/constants';

export interface ViewerStageProps {
    controller: ThreeViewerController;
}

const stageStyle: CSSProperties = { width: '100%', height: VIEWER_HEIGHT };

/** 3D 舞台：three.js 渲染容器 */
export function ViewerStage({ controller }: ViewerStageProps) {
    const { containerRef } = controller;

    return (
        <Card styles={{ body: { padding: 0, overflow: 'hidden' } }}>
            <div ref={containerRef} style={stageStyle} />
        </Card>
    );
}
