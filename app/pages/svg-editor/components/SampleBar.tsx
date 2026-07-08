import { Button, Space, Typography } from 'antd';
import type { SvgEditorController } from '../types';
import { SAMPLES } from '../utils/constants';

export interface SampleBarProps {
    controller: SvgEditorController;
}

/** 示例选择栏 */
export function SampleBar({ controller }: SampleBarProps) {
    const { setCode } = controller;

    return (
        <Space wrap style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">示例：</Typography.Text>
            {SAMPLES.map(s => (
                <Button key={s.label} size="small" onClick={() => setCode(s.code)}>
                    {s.label}
                </Button>
            ))}
        </Space>
    );
}
