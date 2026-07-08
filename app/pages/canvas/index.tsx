import { Typography } from 'antd';
import { useCanvasDrawing } from './hooks/useCanvasDrawing';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { CanvasStage } from './components/CanvasStage';

export default function CanvasBoard() {
    const controller = useCanvasDrawing();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>Canvas 画板</Typography.Title>
            <Toolbar controller={controller} />
            <PropertyPanel controller={controller} />
            <CanvasStage controller={controller} />
        </div>
    );
}
