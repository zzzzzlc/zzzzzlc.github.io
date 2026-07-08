import { Col, Row, Typography } from 'antd';
import { useSvgEditor } from './hooks/useSvgEditor';
import { SampleBar } from './components/SampleBar';
import { CodeEditorPane } from './components/CodeEditorPane';
import { PreviewPane } from './components/PreviewPane';

export default function SvgEditor() {
    const controller = useSvgEditor();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>SVG 绘制</Typography.Title>
            <SampleBar controller={controller} />
            <Row gutter={16}>
                <Col xs={24} lg={12}>
                    <CodeEditorPane controller={controller} />
                </Col>
                <Col xs={24} lg={12}>
                    <PreviewPane controller={controller} />
                </Col>
            </Row>
        </div>
    );
}
