import { Card, Space, Typography } from 'antd';
import type { BpmnController } from '../types';
import { containerStyle } from '../utils/constants';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import '../bpmn-overrides.css';

const { Text } = Typography;

export interface BpmnCanvasProps {
    controller: BpmnController;
}

/** BPMN 画布区域：渲染 bpmn-js 容器 + 选中元素提示 */
export function BpmnCanvas({ controller }: BpmnCanvasProps) {
    const { containerRef, selectedElement } = controller;

    return (
        <Card
            title="流程画布"
            styles={{ body: { padding: 0 } }}
            extra={
                <Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {selectedElement
                            ? `选中: ${selectedElement.name || selectedElement.type} (${selectedElement.id})`
                            : '点击元素查看属性'
                        }
                    </Text>
                </Space>
            }
        >
            <div
                ref={containerRef}
                className="bpmn-container"
                style={containerStyle}
            />
        </Card>
    );
}
