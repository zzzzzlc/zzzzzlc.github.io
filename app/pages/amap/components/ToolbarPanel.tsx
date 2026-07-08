import { Button, Card, Radio, Segmented, Space, Typography } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import type { AmapController, MapStyle, RouteProfile } from '../types';

const { Text } = Typography;

export interface ToolbarPanelProps {
    controller: AmapController;
}

/** 顶部工具栏：路线模式 / 底图样式 / 定位 / 清空 */
export function ToolbarPanel({ controller }: ToolbarPanelProps) {
    const { profile, setProfile, style, switchStyle, locate, clearAll } = controller;

    return (
        <Card style={{ marginBottom: 12 }}>
            <Space wrap size="middle" align="center">
                <Text strong>路线模式：</Text>
                <Radio.Group
                    value={profile}
                    onChange={(e) => setProfile(e.target.value as RouteProfile)}
                    optionType="button"
                    buttonStyle="solid"
                    size="small"
                >
                    <Radio.Button value="driving">驾车</Radio.Button>
                    <Radio.Button value="walking">步行</Radio.Button>
                    <Radio.Button value="cycling">骑行</Radio.Button>
                </Radio.Group>

                <Segmented
                    value={style}
                    onChange={(v) => switchStyle(v as MapStyle)}
                    options={[
                        { label: '标准', value: 'standard' },
                        { label: '卫星', value: 'satellite' },
                        { label: '暗色', value: 'dark' },
                    ]}
                />

                <Button icon={<AimOutlined />} onClick={locate} size="small">定位</Button>
                <Button onClick={clearAll} size="small">清空</Button>
            </Space>
        </Card>
    );
}
