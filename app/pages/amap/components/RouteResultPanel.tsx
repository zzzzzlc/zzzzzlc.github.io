import { Card, List, Space, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import type { AmapController } from '../types';
import { formatDistance, formatDuration } from '../utils/format';

const { Text } = Typography;

export interface RouteResultPanelProps {
    controller: AmapController;
}

/** 导航结果面板：总距离 / 总时长 / 分步指引 */
export function RouteResultPanel({ controller }: RouteResultPanelProps) {
    const { route } = controller;
    if (!route) return null;

    return (
        <Card
            title={
                <Space>
                    <ArrowRightOutlined />
                    导航结果
                </Space>
            }
            style={{ marginBottom: 12 }}
            size="small"
        >
            <Space size="large" style={{ marginBottom: 8 }}>
                <Text strong style={{ color: '#1677ff' }}>
                    {formatDistance(route.distance)}
                </Text>
                <Text strong style={{ color: '#1677ff' }}>
                    {formatDuration(route.duration)}
                </Text>
            </Space>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <List
                    size="small"
                    dataSource={route.steps}
                    renderItem={(step, idx) => (
                        <List.Item style={{ padding: '4px 0' }}>
                            <Text>
                                <Text type="secondary">{idx + 1}.</Text>{' '}
                                {step.instruction}
                                {step.name && `，进入${step.name}`}
                                {step.distance > 0 && (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {' '}（{formatDistance(step.distance)}）
                                    </Text>
                                )}
                            </Text>
                        </List.Item>
                    )}
                />
            </div>
        </Card>
    );
}
