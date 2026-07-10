import {
    Button, Card, ColorPicker, Divider, InputNumber, Slider, Space, Switch, Tag, Tooltip, Typography,
} from 'antd';
import {
    DeleteOutlined, DownloadOutlined, RedoOutlined, UndoOutlined,
} from '@ant-design/icons';
import type { CanvasController } from '../types';
import { TOOL_LABELS } from '../utils/constants';
import { GeometryControls } from './GeometryControls';

export interface PropertyPanelProps {
    controller: CanvasController;
}

/** 属性面板：选中态编辑对象属性（支持多选批量）/ 工具态配置工具属性。几何控件见 GeometryControls */
export function PropertyPanel({ controller }: PropertyPanelProps) {
    const {
        tool, selectedLabel, handleDeleteSelected,
        strokeColor, setStrokeColor, fillColor, setFillColor,
        fillEnabled, setFillEnabled, lineWidth, setLineWidth, opacity, setOpacity,
        dotSize, setDotSize, commitEditHistory,
        canUndo, canRedo, handleUndo, handleRedo, handleClear, handleDownload,
    } = controller;

    // 选中对象时编辑其属性（多选批量）；否则配置当前工具
    const editingShape = Boolean(selectedLabel);

    return (
        <Card style={{ marginBottom: 16 }} size="small">
            <Space wrap size="middle" align="center">
                {editingShape ? (
                    <Tag color="orange" style={{ margin: 0 }}>已选中：{selectedLabel}</Tag>
                ) : (
                    <Tooltip title="各工具属性独立保存：切换工具时互不影响">
                        <Tag color="blue" style={{ margin: 0 }}>{TOOL_LABELS[tool]} 属性</Tag>
                    </Tooltip>
                )}
                <Divider orientation="vertical" style={{ height: 28 }} />
                <Tooltip title="描边颜色">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>描边</Typography.Text>
                        <ColorPicker value={strokeColor} onChange={(_, hex) => setStrokeColor(hex)} onChangeComplete={commitEditHistory} disabledAlpha />
                    </Space>
                </Tooltip>
                <Tooltip title="填充颜色">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>填充</Typography.Text>
                        <ColorPicker value={fillColor} onChange={(_, hex) => setFillColor(hex)} onChangeComplete={commitEditHistory} disabledAlpha disabled={!fillEnabled} />
                    </Space>
                </Tooltip>
                <Tooltip title="启用填充">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>填充</Typography.Text>
                        <Switch size="small" checked={fillEnabled} onChange={(v) => { setFillEnabled(v); commitEditHistory(); }} />
                    </Space>
                </Tooltip>
                <Divider orientation="vertical" style={{ height: 28 }} />
                <Tooltip title="线宽">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>线宽</Typography.Text>
                        <Slider min={1} max={30} value={lineWidth} onChange={setLineWidth} onChangeComplete={commitEditHistory} style={{ width: 100, margin: 0 }} />
                        <span style={{ fontSize: 12, width: 24 }}>{lineWidth}</span>
                    </Space>
                </Tooltip>
                <Tooltip title="不透明度">
                    <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>透明</Typography.Text>
                        <Slider min={10} max={100} value={opacity} onChange={setOpacity} onChangeComplete={commitEditHistory} style={{ width: 90, margin: 0 }} />
                        <span style={{ fontSize: 12, width: 30 }}>{opacity}%</span>
                    </Space>
                </Tooltip>
                <Divider orientation="vertical" style={{ height: 28 }} />
                {!editingShape && tool === 'dot' && (
                    <Tooltip title="点直径">
                        <Space size={4}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>点大小</Typography.Text>
                            <InputNumber min={1} max={200} value={dotSize} onChange={(v) => setDotSize(v ?? 10)} size="small" style={{ width: 72 }} />
                        </Space>
                    </Tooltip>
                )}
                <GeometryControls controller={controller} />
                <Divider orientation="vertical" style={{ height: 28 }} />
                {editingShape && (
                    <Tooltip title="删除选中节点（Delete 键）">
                        <Button icon={<DeleteOutlined />} onClick={handleDeleteSelected} danger size="small" />
                    </Tooltip>
                )}
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
