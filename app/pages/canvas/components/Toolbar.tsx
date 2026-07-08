import { Card, Divider, Segmented, Space, Tooltip, Typography } from 'antd';
import type { CanvasController, Tool } from '../types';
import { TOOL_GROUPS } from '../utils/constants';

export interface ToolbarProps {
    controller: CanvasController;
}

/** 工具栏：绘制 / 形状 / 编辑 工具分组选择 */
export function Toolbar({ controller }: ToolbarProps) {
    const { tool, setTool } = controller;

    return (
        <Card style={{ marginBottom: 16 }}>
            <Space wrap size="middle" align="center">
                {TOOL_GROUPS.map((group, i) => (
                    <Space key={group.label} size="small" align="center">
                        {i > 0 && <Divider type="vertical" style={{ height: 28, margin: '0 4px' }} />}
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{group.label}</Typography.Text>
                        <Segmented
                            value={tool}
                            onChange={(v) => setTool(v as Tool)}
                            options={group.items.map((item) => ({
                                value: item.key,
                                label: (
                                    <Tooltip title={item.label}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            {item.icon}
                                            <span style={{ fontSize: 12 }}>{item.label}</span>
                                        </span>
                                    </Tooltip>
                                ),
                            }))}
                        />
                    </Space>
                ))}
            </Space>
        </Card>
    );
}
