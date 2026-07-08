import { Col, Row, Typography } from 'antd';
import { ApartmentOutlined } from '@ant-design/icons';
import { useBpmnEditor } from './hooks/useBpmnEditor';
import { Toolbar } from './components/Toolbar';
import { BpmnCanvas } from './components/BpmnCanvas';
import { Sidebar } from './components/Sidebar';
import { XmlModal } from './components/XmlModal';

export default function BpmnEditor() {
    const controller = useBpmnEditor();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>
                <ApartmentOutlined /> BPMN 流程设计器
            </Typography.Title>
            <Toolbar controller={controller} />
            <Row gutter={16}>
                <Col xs={24} lg={18}>
                    <BpmnCanvas controller={controller} />
                </Col>
                <Col xs={24} lg={6}>
                    <Sidebar controller={controller} />
                </Col>
            </Row>
            <XmlModal controller={controller} />
        </div>
    );
}
