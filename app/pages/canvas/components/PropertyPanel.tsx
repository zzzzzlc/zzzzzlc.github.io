import {
    Button, Card, ColorPicker, Divider, InputNumber, Slider, Space, Switch, Tooltip, Typography,
} from 'antd';
import {
    DeleteOutlined, DownloadOutlined, RedoOutlined, UndoOutlined,
} from '@ant-design/icons';
import type { CanvasController } from '../types';

export interface PropertyPanelProps {
    controller: CanvasController;
}

/** 属性面板：颜色 / 线宽 / 透明度 / 形状尺寸 / 撤销重做清空下载 */
export function PropertyPanel({ controller }: PropertyPanelProps) {
    const {
        tool, strokeColor, setStrokeColor, fillColor, setFillColor,
        fillEnabled, setFillEnabled, lineWidth, setLineWidth, opacity, setOpacity,
        dotSize, setDotSize, rectW, setRectW, rectH, setRectH, circleR, setCircleR,
        fixedSize, setFixedSize, canUndo, canRedo,
        handleUndo, handleRedo, handleClear, handleDownload,
    } = controller;

    // 是否显示形状尺寸输入
    const showShapeSize = tool === 'rect' || tool === 'circle' || tool === 'triangle';

    return (
        <Card style={{ marginBottom: 16 }} size="small">
            <Space wrap size="middle" align="center">
                <Tooltip title="描边颜色">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>描边</Typography.Text>
                        <ColorPicker value={strokeColor} onChange={(_, hex) => setStrokeColor(hex)} disabledAlpha />
                    </Space>
                </Tooltip>
                <Tooltip title="填充颜色">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>填充</Typography.Text>
                        <ColorPicker value={fillColor} onChange={(_, hex) => setFillColor(hex)} disabledAlpha disabled={!fillEnabled} />
                    </Space>
                </Tooltip>
                <Tooltip title="启用填充">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>填充</Typography.Text>
                        <Switch size="small" checked={fillEnabled} onChange={setFillEnabled} />
                    </Space>
                </Tooltip>
                <Divider type="vertical" style={{ height: 28 }} />
                <Tooltip title="线宽">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>线宽</Typography.Text>
                        <Slider min={1} max={30} value={lineWidth} onChange={setLineWidth} style={{ width: 100, margin: 0 }} />
                        <span style={{ fontSize: 12, width: 24 }}>{lineWidth}</span>
                    </Space>
                </Tooltip>
                <Tooltip title="不透明度">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>透明</Typography.Text>
                        <Slider min={10} max={100} value={opacity} onChange={setOpacity} style={{ width: 90, margin: 0 }} />
                        <span style={{ fontSize: 12, width: 30 }}>{opacity}%</span>
                    </Space>
                </Tooltip>
                <Divider type="vertical" style={{ height: 28 }} />
                {tool === 'dot' && (
                    <Tooltip title="点直径">
                        <Space size={4}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>点大小</Typography.Text>
                            <InputNumber min={1} max={200} value={dotSize} onChange={(v) => setDotSize(v ?? 10)} size="small" style={{ width: 72 }} />
                        </Space>
                    </Tooltip>
                )}
                {showShapeSize && (
                    <>
                        <Tooltip title="启用后单击即按指定尺寸放置；不启用则拖拽绘制">
                            <Space size={4}>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>固定尺寸</Typography.Text>
                                <Switch size="small" checked={fixedSize} onChange={setFixedSize} />
                            </Space>
                        </Tooltip>
                        {fixedSize && (tool === 'rect' || tool === 'triangle') && (
                            <>
                                <Space size={4}>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>宽</Typography.Text>
                                    <InputNumber min={1} max={1000} value={rectW} onChange={(v) => setRectW(v ?? 100)} size="small" style={{ width: 72 }} />
                                </Space>
                                <Space size={4}>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>高</Typography.Text>
                                    <InputNumber min={1} max={1000} value={rectH} onChange={(v) => setRectH(v ?? 80)} size="small" style={{ width: 72 }} />
                                </Space>
                            </>
                        )}
                        {fixedSize && tool === 'circle' && (
                            <Space size={4}>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>半径</Typography.Text>
                                <InputNumber min={1} max={500} value={circleR} onChange={(v) => setCircleR(v ?? 40)} size="small" style={{ width: 72 }} />
                            </Space>
                        )}
                    </>
                )}
                <Divider type="vertical" style={{ height: 28 }} />
                <Tooltip title="撤销">
                    <Button icon={<UndoOutlined />} onClick={handleUndo} disabled={!canUndo} size="small" />
                </Tooltip>
                <Tooltip title="重做">
                    <Button icon={<RedoOutlined />} onClick={handleRedo} disabled={!canRedo} size="small" />
                </Tooltip>
                <Tooltip title="清空">
                    <Button icon={<DeleteOutlined />} onClick={handleClear} danger size="small" />
                </Tooltip>
                <Tooltip title="下载">
                    <Button icon={<DownloadOutlined />} onClick={handleDownload} type="primary" size="small" />
                </Tooltip>
            </Space>
        </Card>
    );
}
