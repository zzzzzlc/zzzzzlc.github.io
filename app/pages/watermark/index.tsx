import { Col, Row, Typography } from 'antd';
import { LayoutOutlined } from '@ant-design/icons';
import { useWatermark } from './hooks/useWatermark';
import { ModeSelector } from './components/ModeSelector';
import { ConfigPanel } from './components/ConfigPanel';
import { PreviewArea } from './components/PreviewArea';

export default function WatermarkTool() {
    const controller = useWatermark();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>
                <LayoutOutlined /> 水印工具
            </Typography.Title>

            <ModeSelector controller={controller} />

            <Row gutter={16}>
                <Col xs={24} lg={8}>
                    <ConfigPanel controller={controller} />
                </Col>
                <Col xs={24} lg={16}>
                    <PreviewArea controller={controller} />
                </Col>
            </Row>
        </div>
    );
}
