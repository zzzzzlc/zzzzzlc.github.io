import { Button, Card, Col, Divider, Row, Space, Tag, Tooltip, Upload } from 'antd';
import {
    CodeOutlined, DownloadOutlined, FullscreenOutlined,
    PlusOutlined, RedoOutlined, UndoOutlined, UploadOutlined,
    ZoomInOutlined, ZoomOutOutlined,
} from '@ant-design/icons';
import type { BpmnController } from '../types';

export interface ToolbarProps {
    controller: BpmnController;
}

/** 工具栏：文件操作 + 撤销/重做 + 缩放控制 */
export function Toolbar({ controller }: ToolbarProps) {
    const {
        handleNewDiagram, handleUpload, handleDownload, handleViewXml,
        handleUndo, handleRedo, handleZoom, zoom,
    } = controller;

    return (
        <Card size="small" style={{ marginBottom: 16 }}>
            <Row justify="space-between" align="middle" wrap>
                <Col>
                    <Space wrap>
                        <Button icon={<PlusOutlined />} onClick={handleNewDiagram}>新建</Button>
                        <Upload accept=".bpmn,.xml" showUploadList={false} beforeUpload={handleUpload}>
                            <Button icon={<UploadOutlined />}>导入</Button>
                        </Upload>
                        <Button icon={<DownloadOutlined />} onClick={() => handleDownload('bpmn')}>导出 BPMN</Button>
                        <Button icon={<DownloadOutlined />} onClick={() => handleDownload('svg')}>导出 SVG</Button>
                        <Button icon={<CodeOutlined />} onClick={handleViewXml}>查看 XML</Button>
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
    );
}
