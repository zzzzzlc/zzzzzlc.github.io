import { Card, List, Space, Typography } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import type { AmapController } from '../types';

const { Text } = Typography;

export interface SearchResultListProps {
    controller: AmapController;
}

/** 搜索结果列表：点击条目选中并飞行定位 */
export function SearchResultList({ controller }: SearchResultListProps) {
    const { searchResults, searchingFor, selectPoi } = controller;
    if (searchResults.length === 0) return null;

    return (
        <Card
            title={
                <Space>
                    <EnvironmentOutlined />
                    搜索结果（{searchingFor === 'start' ? '起点' : '终点'}）
                </Space>
            }
            style={{ marginBottom: 12 }}
            size="small"
        >
            <List
                size="small"
                dataSource={searchResults}
                renderItem={(poi) => (
                    <List.Item
                        style={{ cursor: 'pointer', padding: '6px 8px' }}
                        onClick={() => selectPoi(poi)}
                    >
                        <List.Item.Meta
                            title={poi.name}
                            description={
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {poi.display_name}
                                </Text>
                            }
                        />
                    </List.Item>
                )}
            />
        </Card>
    );
}
