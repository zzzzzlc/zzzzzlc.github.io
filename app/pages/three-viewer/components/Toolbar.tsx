import { Button, Card, Space, Switch, Typography, Upload } from 'antd';
import { ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ThreeViewerController } from '../types';
import { ACCEPTED_FORMATS } from '../utils/constants';

const { Text } = Typography;

export interface ToolbarProps {
    controller: ThreeViewerController;
}

/** 工具栏：上传 / 重置 / 自动旋转 / 线框模式 */
export function Toolbar({ controller }: ToolbarProps) {
    const {
        loading, autoRotate, wireframe,
        handleUpload, handleReset, handleAutoRotateChange, handleWireframeChange,
    } = controller;

    return (
        <Card style={{ marginBottom: 16 }}>
            <Space wrap size="middle">
                <Upload accept={ACCEPTED_FORMATS} showUploadList={false} beforeUpload={handleUpload}>
                    <Button type="primary" icon={<UploadOutlined />} loading={loading}>
                        上传模型
                    </Button>
                </Upload>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                <Space>
                    <Text>自动旋转</Text>
                    <Switch checked={autoRotate} onChange={handleAutoRotateChange} />
                </Space>
                <Space>
                    <Text>线框模式</Text>
                    <Switch checked={wireframe} onChange={handleWireframeChange} />
                </Space>
            </Space>
        </Card>
    );
}
