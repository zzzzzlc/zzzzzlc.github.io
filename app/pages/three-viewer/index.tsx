import { Typography } from 'antd';
import { useThreeViewer } from './hooks/useThreeViewer';
import { Toolbar } from './components/Toolbar';
import { ViewerStage } from './components/ViewerStage';

export default function ThreeViewer() {
    const controller = useThreeViewer();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>3D 模型查看器</Typography.Title>
            <Toolbar controller={controller} />
            <ViewerStage controller={controller} />
        </div>
    );
}
