import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Space, Upload, Select, message, Divider, Row, Col, Modal, Tooltip, Tag } from 'antd';
import {
    UploadOutlined, DownloadOutlined, UndoOutlined, RedoOutlined,
    ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined,
    SaveOutlined, DeleteOutlined, CodeOutlined, ApartmentOutlined,
    PlusOutlined, CopyOutlined,
} from '@ant-design/icons';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import './bpmn-overrides.css';

// BPMN.js 容器样式：确保左侧 palette 工具栏完整显示
const containerStyle: React.CSSProperties = {
    height: '65vh',
    minHeight: 500,
    position: 'relative',
    background: '#f8f9fa',
};

const { Title, Text } = Typography;

// 默认空流程模板
const EMPTY_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// 预置模板
const TEMPLATES: Record<string, string> = {
    'simple-approval': `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="ApprovalProcess" name="简单审批流程" isExecutable="true">
    <bpmn:startEvent id="start" name="提交申请">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="leader_approve" name="直属领导审批">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="gateway1" name="是否通过">
      <bpmn:incoming>flow2</bpmn:incoming>
      <bpmn:outgoing>flow3</bpmn:outgoing>
      <bpmn:outgoing>flow4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:serviceTask id="notify" name="发送通知">
      <bpmn:incoming>flow3</bpmn:incoming>
      <bpmn:outgoing>flow5</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end_approve" name="审批完成">
      <bpmn:incoming>flow5</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="end_reject" name="已拒绝">
      <bpmn:incoming>flow4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="leader_approve" />
    <bpmn:sequenceFlow id="flow2" sourceRef="leader_approve" targetRef="gateway1" />
    <bpmn:sequenceFlow id="flow3" name="通过" sourceRef="gateway1" targetRef="notify">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">approved == true</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow4" name="拒绝" sourceRef="gateway1" targetRef="end_reject">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">approved == false</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flow5" sourceRef="notify" targetRef="end_approve" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="ApprovalProcess">
      <bpmndi:BPMNShape id="shape_start" bpmnElement="start">
        <dc:Bounds x="179" y="159" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_leader" bpmnElement="leader_approve">
        <dc:Bounds x="270" y="137" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_gateway" bpmnElement="gateway1" isMarkerVisible="true">
        <dc:Bounds x="425" y="152" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_notify" bpmnElement="notify">
        <dc:Bounds x="530" y="137" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_end_ok" bpmnElement="end_approve">
        <dc:Bounds x="692" y="159" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_end_reject" bpmnElement="end_reject">
        <dc:Bounds x="452" y="279" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="edge_flow1" bpmnElement="flow1">
        <di:waypoint x="215" y="177" />
        <di:waypoint x="270" y="177" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow2" bpmnElement="flow2">
        <di:waypoint x="370" y="177" />
        <di:waypoint x="425" y="177" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow3" bpmnElement="flow3">
        <di:waypoint x="475" y="177" />
        <di:waypoint x="530" y="177" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow5" bpmnElement="flow5">
        <di:waypoint x="630" y="177" />
        <di:waypoint x="692" y="177" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow4" bpmnElement="flow4">
        <di:waypoint x="450" y="202" />
        <di:waypoint x="450" y="279" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`,
};

export default function BpmnEditor() {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<BpmnModeler | null>(null);
    const [currentXml, setCurrentXml] = useState<string>('');
    const [xmlModalOpen, setXmlModalOpen] = useState(false);
    const [selectedElement, setSelectedElement] = useState<{ id: string; type: string; name: string } | null>(null);
    const [zoom, setZoom] = useState(1);

    // 初始化 BPMN Modeler
    useEffect(() => {
        if (!containerRef.current) return;

        const modeler = new BpmnModeler({
            container: containerRef.current,
            keyboard: { bindTo: document },
        });
        modelerRef.current = modeler;

        // 加载空白流程
        modeler.importXML(EMPTY_DIAGRAM).then(() => {
            const canvas = modeler.get('canvas') as any;
            canvas.zoom('fit-viewport', 'auto');
            setZoom(canvas.zoom());
        }).catch((err: Error) => {
            message.error('初始化流程图失败: ' + err.message);
        });

        // 监听元素选中
        const eventBus = modeler.get('eventBus') as any;
        eventBus.on('selection.changed', (e: { newSelection: Array<{ id: string; type: string; businessObject?: { name?: string } }> }) => {
            const selection = e.newSelection;
            if (selection && selection.length === 1) {
                const el = selection[0];
                setSelectedElement({
                    id: el.id,
                    type: el.type?.replace('bpmn:', '') || '',
                    name: el.businessObject?.name || '',
                });
            } else {
                setSelectedElement(null);
            }
        });

        // 监听画布缩放
        eventBus.on('canvas.viewbox.changed', (e: { viewbox: { scale: number } }) => {
            if (e.viewbox) setZoom(Math.round(e.viewbox.scale * 100));
        });

        return () => {
            modeler.destroy();
        };
    }, []);

    // 导入 BPMN XML
    const handleImportXml = useCallback((xml: string) => {
        if (!modelerRef.current) return;
        modelerRef.current.importXML(xml).then(() => {
            const canvas = modelerRef.current!.get('canvas') as any;
            canvas.zoom('fit-viewport', 'auto');
            message.success('导入成功');
        }).catch((err: Error) => {
            message.error('导入失败: ' + err.message);
        });
    }, []);

    // 上传文件
    const handleUpload = useCallback((file: File) => {
        if (!file.name.endsWith('.bpmn') && !file.name.endsWith('.xml')) {
            message.error('请上传 .bpmn 或 .xml 文件');
            return false;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const xml = e.target?.result as string;
            handleImportXml(xml);
        };
        reader.readAsText(file);
        return false;
    }, [handleImportXml]);

    // 导出下载
    const handleDownload = useCallback(async (format: 'bpmn' | 'svg') => {
        if (!modelerRef.current) return;
        try {
            if (format === 'bpmn') {
                const { xml } = await modelerRef.current.saveXML({ format: true });
                if (!xml) return;
                const blob = new Blob([xml], { type: 'application/xml' });
                downloadBlob(blob, 'diagram.bpmn');
                message.success('BPMN 文件已下载');
            } else {
                const { svg } = await modelerRef.current.saveSVG();
                const blob = new Blob([svg], { type: 'image/svg+xml' });
                downloadBlob(blob, 'diagram.svg');
                message.success('SVG 图片已下载');
            }
        } catch (err) {
            message.error('导出失败');
        }
    }, []);

    // 查看 XML
    const handleViewXml = useCallback(async () => {
        if (!modelerRef.current) return;
        try {
            const { xml } = await modelerRef.current.saveXML({ format: true });
            if (xml) {
                setCurrentXml(xml);
                setXmlModalOpen(true);
            }
        } catch { /* ignore */ }
    }, []);

    // 缩放控制
    const handleZoom = useCallback((action: 'in' | 'out' | 'fit' | 'reset') => {
        if (!modelerRef.current) return;
        const canvas = modelerRef.current.get('canvas') as any;
        switch (action) {
            case 'in': canvas.zoom(canvas.zoom() * 1.15); break;
            case 'out': canvas.zoom(canvas.zoom() / 1.15); break;
            case 'fit': canvas.zoom('fit-viewport', 'auto'); break;
            case 'reset': canvas.zoom(1); break;
        }
        setZoom(Math.round(canvas.zoom() * 100));
    }, []);

    // 撤销/重做
    const handleUndo = useCallback(() => {
        (modelerRef.current?.get('commandStack') as any)?.undo();
    }, []);
    const handleRedo = useCallback(() => {
        (modelerRef.current?.get('commandStack') as any)?.redo();
    }, []);

    // 清空画布
    const handleNewDiagram = useCallback(() => {
        Modal.confirm({
            title: '新建流程图',
            content: '当前内容将被清空，确认新建？',
            onOk: () => handleImportXml(EMPTY_DIAGRAM),
        });
    }, [handleImportXml]);

    // 加载模板
    const handleLoadTemplate = useCallback((key: string) => {
        const xml = TEMPLATES[key];
        if (xml) {
            handleImportXml(xml);
            message.success('模板已加载');
        }
    }, [handleImportXml]);

    return (
        <div>
            <Title level={3} style={{ marginBottom: 16 }}>
                <ApartmentOutlined /> BPMN 流程设计器
            </Title>

            {/* 工具栏 */}
            <Card size="small" style={{ marginBottom: 16 }}>
                <Row justify="space-between" align="middle" wrap>
                    <Col>
                        <Space wrap>
                            <Button icon={<PlusOutlined />} onClick={handleNewDiagram}>
                                新建
                            </Button>
                            <Upload
                                accept=".bpmn,.xml"
                                showUploadList={false}
                                beforeUpload={handleUpload}
                            >
                                <Button icon={<UploadOutlined />}>导入</Button>
                            </Upload>
                            <Button icon={<DownloadOutlined />} onClick={() => handleDownload('bpmn')}>
                                导出 BPMN
                            </Button>
                            <Button icon={<DownloadOutlined />} onClick={() => handleDownload('svg')}>
                                导出 SVG
                            </Button>
                            <Button icon={<CodeOutlined />} onClick={handleViewXml}>
                                查看 XML
                            </Button>
                        </Space>
                    </Col>
                    <Col>
                        <Space wrap>
                            <Tooltip title="撤销 (Ctrl+Z)">
                                <Button icon={<UndoOutlined />} onClick={handleUndo} />
                            </Tooltip>
                            <Tooltip title="重做 (Ctrl+Y)">
                                <Button icon={<RedoOutlined />} onClick={handleRedo} />
                            </Tooltip>
                            <Divider type="vertical" />
                            <Tooltip title="缩小">
                                <Button icon={<ZoomOutOutlined />} onClick={() => handleZoom('out')} />
                            </Tooltip>
                            <Tag color="blue">{zoom}%</Tag>
                            <Tooltip title="放大">
                                <Button icon={<ZoomInOutlined />} onClick={() => handleZoom('in')} />
                            </Tooltip>
                            <Tooltip title="适应画布">
                                <Button icon={<FullscreenOutlined />} onClick={() => handleZoom('fit')} />
                            </Tooltip>
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Row gutter={16}>
                {/* BPMN 画布 */}
                <Col xs={24} lg={18}>
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
                </Col>

                {/* 右侧面板 */}
                <Col xs={24} lg={6}>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {/* 快速模板 */}
                        <Card title="快速模板" size="small">
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <Button
                                    block
                                    onClick={() => handleLoadTemplate('simple-approval')}
                                    icon={<CopyOutlined />}
                                >
                                    审批流程
                                </Button>
                                <Button
                                    block
                                    onClick={handleNewDiagram}
                                    icon={<DeleteOutlined />}
                                >
                                    空白流程
                                </Button>
                            </Space>
                        </Card>

                        {/* 元素属性 */}
                        <Card title="元素属性" size="small">
                            {selectedElement ? (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>ID</Text>
                                        <br />
                                        <Text code>{selectedElement.id}</Text>
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>类型</Text>
                                        <br />
                                        <Tag color="blue">{selectedElement.type}</Tag>
                                    </div>
                                    {selectedElement.name && (
                                        <div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>名称</Text>
                                            <br />
                                            <Text strong>{selectedElement.name}</Text>
                                        </div>
                                    )}
                                    <Divider style={{ margin: '4px 0' }} />
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        双击元素可编辑名称，右侧面板可修改属性
                                    </Text>
                                </Space>
                            ) : (
                                <Text type="secondary">
                                    选中画布上的元素以查看属性
                                </Text>
                            )}
                        </Card>

                        {/* 操作指南 */}
                        <Card title="操作指南" size="small">
                            <Space direction="vertical" style={{ width: '100%', fontSize: 12 }}>
                                <Text><Text strong>拖拽</Text> 左侧工具栏元素到画布</Text>
                                <Text><Text strong>连线</Text> 拖拽元素边缘的锚点</Text>
                                <Text><Text strong>双击</Text> 元素编辑名称</Text>
                                <Text><Text strong>右键</Text> 元素弹出上下文菜单</Text>
                                <Text><Text strong>Delete</Text> 删除选中元素</Text>
                                <Text><Text strong>Ctrl+Z/Y</Text> 撤销/重做</Text>
                                <Text><Text strong>Ctrl+A</Text> 全选</Text>
                            </Space>
                        </Card>

                        {/* BPMN 元素说明 */}
                        <Card title="BPMN 元素速查" size="small">
                            <Space direction="vertical" style={{ width: '100%', fontSize: 12 }}>
                                <Text><Tag>○</Tag> 事件（开始/结束/中间）</Text>
                                <Text><Tag>□</Tag> 任务（用户/服务/脚本）</Text>
                                <Text><Tag>◇</Tag> 网关（排他/并行/包容）</Text>
                                <Text><Tag>→</Tag> 顺序流（连线）</Text>
                                <Text><Tag>⊞</Tag> 子流程（嵌入/调用）</Text>
                                <Text><Tag>POOL</Tag> 泳道/池</Text>
                            </Space>
                        </Card>
                    </Space>
                </Col>
            </Row>

            {/* XML 查看弹窗 */}
            <Modal
                title="BPMN XML"
                open={xmlModalOpen}
                onCancel={() => setXmlModalOpen(false)}
                width={800}
                footer={[
                    <Button key="copy" icon={<CopyOutlined />} onClick={() => {
                        navigator.clipboard.writeText(currentXml);
                        message.success('已复制到剪贴板');
                    }}>
                        复制
                    </Button>,
                    <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => {
                        const blob = new Blob([currentXml], { type: 'application/xml' });
                        downloadBlob(blob, 'diagram.bpmn');
                    }}>
                        下载
                    </Button>,
                    <Button key="close" onClick={() => setXmlModalOpen(false)}>
                        关闭
                    </Button>,
                ]}
            >
                <pre style={{
                    background: '#1e1e1e',
                    color: '#d4d4d4',
                    padding: 16,
                    borderRadius: 8,
                    maxHeight: '60vh',
                    overflow: 'auto',
                    fontSize: 12,
                    lineHeight: 1.5,
                }}>
                    {currentXml}
                </pre>
            </Modal>
        </div>
    );
}

// 工具函数：触发浏览器下载
function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
}
