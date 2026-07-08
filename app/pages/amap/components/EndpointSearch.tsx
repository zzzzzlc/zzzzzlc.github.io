import { Button, Card, Input, Space, Typography } from 'antd';
import { ArrowRightOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import type { AmapController, EndpointKey } from '../types';

const { Text } = Typography;
const { Search } = Input;

export interface EndpointSearchProps {
    controller: AmapController;
}

interface SearchBoxProps {
    label: string;
    placeholder: string;
    value: string;
    danger?: boolean;
    onChange: (v: string) => void;
    onSearch: (v: string) => void;
    onFocus: () => void;
}

/** 单个起/终点搜索框（带按钮） */
function SearchBox({ label, placeholder, value, danger, onChange, onSearch, onFocus }: SearchBoxProps) {
    return (
        <Search
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onSearch={onSearch}
            onFocus={onFocus}
            enterButton={
                <Button type={danger ? 'default' : 'primary'} danger={danger} size="small" icon={<SearchOutlined />}>
                    {label}
                </Button>
            }
            allowClear
        />
    );
}

/** 起终点搜索区：起点 / 交换 / 规划路线 / 终点 */
export function EndpointSearch({ controller }: EndpointSearchProps) {
    const {
        startQuery, endQuery, startPoint, endPoint, loading,
        setStartQuery, setEndQuery, handleSearch, focusEndpoint,
        swapEndpoints, planRoute, canSwap,
    } = controller;

    const bind = (key: EndpointKey) => ({
        value: key === 'start' ? startQuery : endQuery,
        onChange: key === 'start' ? setStartQuery : setEndQuery,
        onSearch: (v: string) => handleSearch(v, key),
        onFocus: () => focusEndpoint(key),
    });

    return (
        <Card style={{ marginBottom: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
                <SearchBox
                    label="起点"
                    placeholder="起点：搜索地点或点击地图"
                    {...bind('start')}
                />
                <Space style={{ width: '100%' }}>
                    <Button
                        icon={<SwapOutlined />}
                        onClick={swapEndpoints}
                        size="small"
                        disabled={!canSwap}
                    >
                        交换
                    </Button>
                    <Button
                        type="primary"
                        icon={<ArrowRightOutlined />}
                        onClick={planRoute}
                        loading={loading}
                        disabled={!canSwap}
                    >
                        规划路线
                    </Button>
                    {startPoint && endPoint && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            起点：{startPoint.name} → 终点：{endPoint.name}
                        </Text>
                    )}
                </Space>
                <SearchBox
                    label="终点"
                    placeholder="终点：搜索地点或点击地图"
                    danger
                    {...bind('end')}
                />
            </Space>
        </Card>
    );
}
