import { Button, Card, Divider, Space, Tag, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { BpmnController } from '../types';

const { Text } = Typography;

export interface SidebarProps {
    controller: BpmnController;
}

/** 右侧面板：快速模板 + 元素属性 + 操作指南 + BPMN 元素速查 */
export function Sidebar({ controller }: SidebarProps) {
    const { selectedElement, handleLoadTemplate, handleNewDiagram } = controller;

    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {/* 快速模板 */}
            <Card title="快速模板" size="small">
                <Space orientation="vertical" style={{ width: '100%' }}>
                    <Button block onClick={() => handleLoadTemplate('simple-approval')} icon={<CopyOutlined />}>
                        审批流程
                    </Button>
                    <Button block onClick={handleNewDiagram} icon={<DeleteOutlined />}>
                        空白流程
                    </Button>
                </Space>
            </Card>

            {/* 元素属性 */}
            <Card title="元素属性" size="small">
                {selectedElement ? (
                    <Space orientation="vertical" style={{ width: '100%' }}>
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
                    <Text type="secondary">选中画布上的元素以查看属性</Text>
                )}
            </Card>

            {/* 操作指南 */}
            <Card title="操作指南" size="small">
                <Space orientation="vertical" style={{ width: '100%', fontSize: 12 }}>
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
                <Space orientation="vertical" style={{ width: '100%', fontSize: 12 }}>
                    <Text><Tag>○</Tag> 事件（开始/结束/中间）</Text>
                    <Text><Tag>□</Tag> 任务（用户/服务/脚本）</Text>
                    <Text><Tag>◇</Tag> 网关（排他/并行/包容）</Text>
                    <Text><Tag>→</Tag> 顺序流（连线）</Text>
                    <Text><Tag>⊞</Tag> 子流程（嵌入/调用）</Text>
                    <Text><Tag>POOL</Tag> 泳道/池</Text>
                </Space>
            </Card>
        </Space>
    );
}
