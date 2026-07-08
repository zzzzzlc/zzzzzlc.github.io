import { Col, Row, Typography } from 'antd';
import { useThemeCustomizer } from './hooks/useThemeCustomizer';
import { ConfigPanel } from './components/ConfigPanel';
import { LivePreview } from './components/LivePreview';
import { CssCodePreview } from './components/CssCodePreview';

export default function ThemeCustomizer() {
    const controller = useThemeCustomizer();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>主题定制</Typography.Title>

            <Row gutter={16}>
                {/* 左侧配置面板 */}
                <Col xs={24} lg={10}>
                    <ConfigPanel controller={controller} />
                </Col>

                {/* 右侧预览 */}
                <Col xs={24} lg={14}>
                    <LivePreview controller={controller} />
                    <CssCodePreview controller={controller} />
                </Col>
            </Row>
        </div>
    );
}
