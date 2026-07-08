import { Card, Segmented, Space, Typography } from 'antd';
import type { WatermarkController, WatermarkMode } from '../types';
import { MODE_OPTIONS } from '../utils/constants';

export interface ModeSelectorProps {
    controller: WatermarkController;
}

/** 模式选择器：页面水印 / 文件下载 / 内容水印 */
export function ModeSelector({ controller }: ModeSelectorProps) {
    const { mode, setMode } = controller;

    return (
        <Card style={{ marginBottom: 16 }}>
            <Space>
                <Typography.Text strong>模式：</Typography.Text>
                <Segmented
                    value={mode}
                    onChange={v => setMode(v as WatermarkMode)}
                    options={MODE_OPTIONS}
                />
            </Space>
        </Card>
    );
}
