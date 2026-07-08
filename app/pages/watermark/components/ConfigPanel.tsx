import {
    Button, Card, ColorPicker, Divider, Input, Select, Slider, Space, Switch, Typography, Upload,
} from 'antd';
import {
    DownloadOutlined, SafetyOutlined, UndoOutlined, UploadOutlined,
} from '@ant-design/icons';
import type { WatermarkController } from '../types';
import { POSITION_OPTIONS } from '../utils/constants';

export interface ConfigPanelProps {
    controller: WatermarkController;
}

/** 配置面板：水印文本 / 字号 / 颜色 / 旋转 / 间距 / 透明度 / 跟随鼠标 / 文件模式额外配置 */
export function ConfigPanel({ controller }: ConfigPanelProps) {
    const {
        config, updateConfig, mode, position, setPosition,
        handleImageUpload, handleDownload, imageEl, handleReset,
    } = controller;

    return (
        <Card title={<><SafetyOutlined /> 水印配置</>} style={{ marginBottom: 16 }}>
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                <div>
                    <Typography.Text strong>水印文本</Typography.Text>
                    <Input
                        value={config.text}
                        onChange={e => updateConfig('text', e.target.value)}
                        placeholder="输入水印文本"
                        style={{ marginTop: 4 }}
                    />
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div>
                    <Typography.Text strong>字号：{config.fontSize}px</Typography.Text>
                    <Slider min={12} max={48} value={config.fontSize} onChange={v => updateConfig('fontSize', v)} />
                </div>

                <div>
                    <Typography.Text strong>颜色</Typography.Text>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ColorPicker
                            value={config.color}
                            onChange={(_, hex) => updateConfig('color', hex)}
                            disabledAlpha
                        />
                        <Typography.Text code>{config.color}</Typography.Text>
                    </div>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div>
                    <Typography.Text strong>旋转角度：{config.rotation}°</Typography.Text>
                    <Slider
                        min={-180} max={180} value={config.rotation}
                        onChange={v => updateConfig('rotation', v)}
                        marks={{ '-45': '-45°', 0: '0°', 45: '45°' }}
                    />
                </div>

                <div>
                    <Typography.Text strong>水平间距：{config.gapX}px</Typography.Text>
                    <Slider min={20} max={400} value={config.gapX} onChange={v => updateConfig('gapX', v)} />
                </div>

                <div>
                    <Typography.Text strong>垂直间距：{config.gapY}px</Typography.Text>
                    <Slider min={20} max={400} value={config.gapY} onChange={v => updateConfig('gapY', v)} />
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div>
                    <Typography.Text strong>透明度：{config.opacity.toFixed(2)}</Typography.Text>
                    <Slider min={0.05} max={1} step={0.05} value={config.opacity} onChange={v => updateConfig('opacity', v)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Typography.Text strong>跟随鼠标</Typography.Text>
                    <Switch checked={config.movable} onChange={v => updateConfig('movable', v)} />
                </div>

                {/* 文件模式额外配置 */}
                {mode === 'file' && (
                    <>
                        <Divider style={{ margin: '8px 0' }} />
                        <div>
                            <Typography.Text strong>水印定位</Typography.Text>
                            <Select
                                value={position}
                                onChange={setPosition}
                                options={POSITION_OPTIONS}
                                style={{ width: '100%', marginTop: 4 }}
                            />
                        </div>
                        <Upload
                            accept=".png,.jpg,.jpeg,.webp,.bmp"
                            showUploadList={false}
                            beforeUpload={handleImageUpload}
                        >
                            <Button icon={<UploadOutlined />} block>上传图片</Button>
                        </Upload>
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleDownload}
                            disabled={!imageEl}
                            block
                        >
                            下载水印图片
                        </Button>
                    </>
                )}

                <Divider style={{ margin: '8px 0' }} />
                <Button icon={<UndoOutlined />} onClick={handleReset} block>重置配置</Button>
            </Space>
        </Card>
    );
}
