import { Button, Card, Space, Tag, Typography } from 'antd';
import { PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { Market2DController } from '../types';

const { Text } = Typography;

export interface Market2DToolbarProps {
    controller: Market2DController;
}

/** 工具栏：标的切换 / 暂停 / 连接状态（纯展示，消费 controller） */
export function Market2DToolbar({ controller }: Market2DToolbarProps) {
    const { symbols, activeSymbol, paused, connected, setActiveSymbol, togglePause } = controller;

    return (
        <Card style={{ marginBottom: 16 }}>
            <Space wrap size="middle">
                <Space>
                    <Text type="secondary">标的</Text>
                    {symbols.length === 0 && <Tag>等待推送…</Tag>}
                    {symbols.map((s) => (
                        <Tag.CheckableTag
                            key={s}
                            checked={s === activeSymbol}
                            onChange={() => setActiveSymbol(s)}
                        >
                            {s}
                        </Tag.CheckableTag>
                    ))}
                </Space>
                <Button
                    icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                    onClick={togglePause}
                >
                    {paused ? '继续' : '暂停'}
                </Button>
                <Tag color={connected ? 'success' : 'warning'}>
                    {connected ? '已连接' : '连接中…'}
                </Tag>
            </Space>
        </Card>
    );
}
