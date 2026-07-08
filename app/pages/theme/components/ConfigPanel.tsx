import {
    Button, Card, ColorPicker, Divider, Segmented, Slider, Space, Typography,
} from 'antd';
import {
    BgColorsOutlined, BorderOutlined, CheckOutlined, CopyOutlined,
    FontSizeOutlined, UndoOutlined,
} from '@ant-design/icons';
import type { ThemeController, ThemeMode } from '../types';
import { FONT_OPTIONS, MODE_OPTIONS, PRESETS } from '../utils/constants';

export interface ConfigPanelProps {
    controller: ThemeController;
}

/** 配置面板：模式 / 主色 / 功能色 / 字号 / 圆角 / 字体 / 操作按钮 */
export function ConfigPanel({ controller }: ConfigPanelProps) {
    const {
        theme, update, globalMode, handleModeChange, textBase,
        handleApply, handleExport, handleReset,
    } = controller;

    return (
        <Card title={<><BgColorsOutlined /> 主题配置</>} style={{ marginBottom: 16 }}>
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">

                {/* 模式切换 */}
                <div>
                    <Typography.Text strong>模式</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                        <Segmented
                            value={globalMode}
                            onChange={v => handleModeChange(v as ThemeMode)}
                            options={MODE_OPTIONS}
                        />
                    </div>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                {/* 主色 */}
                <div>
                    <Typography.Text strong>主色调</Typography.Text>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <ColorPicker
                            value={theme.primaryColor}
                            onChange={(_, hex) => update('primaryColor', hex)}
                            disabledAlpha
                        />
                        <Typography.Text code>{theme.primaryColor}</Typography.Text>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {PRESETS.map(p => (
                            <div
                                key={p.primary}
                                onClick={() => update('primaryColor', p.primary)}
                                style={{
                                    width: 28, height: 28, borderRadius: 6,
                                    background: p.primary, cursor: 'pointer',
                                    border: theme.primaryColor === p.primary ? '2px solid ' + textBase : '2px solid transparent',
                                    transition: 'border 0.2s',
                                }}
                                title={p.label}
                            />
                        ))}
                    </div>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                {/* 功能色 */}
                <div>
                    <Typography.Text strong>功能色</Typography.Text>
                    <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                        <Space><Typography.Text type="secondary">成功</Typography.Text><ColorPicker value={theme.colorSuccess} onChange={(_, hex) => update('colorSuccess', hex)} disabledAlpha size="small" /></Space>
                        <Space><Typography.Text type="secondary">警告</Typography.Text><ColorPicker value={theme.colorWarning} onChange={(_, hex) => update('colorWarning', hex)} disabledAlpha size="small" /></Space>
                        <Space><Typography.Text type="secondary">错误</Typography.Text><ColorPicker value={theme.colorError} onChange={(_, hex) => update('colorError', hex)} disabledAlpha size="small" /></Space>
                    </div>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                {/* 字号 */}
                <div>
                    <Typography.Text strong><FontSizeOutlined /> 字号</Typography.Text>
                    <Slider min={12} max={20} value={theme.fontSize} onChange={v => update('fontSize', v)} />
                </div>

                {/* 圆角 */}
                <div>
                    <Typography.Text strong><BorderOutlined /> 圆角</Typography.Text>
                    <Slider min={0} max={16} value={theme.borderRadius} onChange={v => update('borderRadius', v)} />
                </div>

                {/* 字体 */}
                <div>
                    <Typography.Text strong>字体</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                        <Segmented
                            value={theme.fontFamily}
                            onChange={v => update('fontFamily', v as string)}
                            options={FONT_OPTIONS}
                        />
                    </div>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <Space>
                    <Button type="primary" icon={<CheckOutlined />} onClick={handleApply}>应用主题</Button>
                    <Button icon={<CopyOutlined />} onClick={handleExport}>导出 CSS</Button>
                    <Button icon={<UndoOutlined />} onClick={handleReset}>重置</Button>
                </Space>
            </Space>
        </Card>
    );
}
