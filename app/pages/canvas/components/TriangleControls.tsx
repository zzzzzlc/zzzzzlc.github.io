import { InputNumber, Slider, Space, Tooltip, Typography } from 'antd';
import { apexRatioLabel } from '../utils/shape';

export interface TriangleApexSliderProps {
    value: number;
    onChange: (ratio: number) => void;
    /** 松手回调：提交一次历史（不传则不入栈，用于工具态） */
    onCommit?: () => void;
    width?: number;
}

/**
 * 三角形顶点位置滑块：中=等腰，偏左/右=斜三角形，最左/右=直角。
 * 工具态（配置默认顶点）与选中态（改某个三角形顶点）复用同一控件。
 */
export function TriangleApexSlider({ value, onChange, onCommit, width = 90 }: TriangleApexSliderProps) {
    return (
        <Tooltip title="顶点横向位置：中=等腰，偏左/右=斜三角形，最左/右=直角">
            <Space size={4}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>顶点</Typography.Text>
                <Slider min={-1} max={1} step={0.01} value={value} onChange={onChange} onChangeComplete={onCommit} style={{ width, margin: 0 }} />
                <span style={{ fontSize: 12, width: 44 }}>{apexRatioLabel(value)}</span>
            </Space>
        </Tooltip>
    );
}

export interface TriangleRotationSliderProps {
    value: number;
    onChange: (deg: number) => void;
    onCommit?: () => void;
    width?: number;
}

/** 三角形旋转滑块：绕中心顺时针，0=顶点朝上 */
export function TriangleRotationSlider({ value, onChange, onCommit, width = 90 }: TriangleRotationSliderProps) {
    return (
        <Tooltip title="旋转角度（绕中心顺时针）">
            <Space size={4}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>旋转</Typography.Text>
                <Slider min={0} max={360} step={1} value={value} onChange={onChange} onChangeComplete={onCommit} style={{ width, margin: 0 }} />
                <span style={{ fontSize: 12, width: 36 }}>{value}°</span>
            </Space>
        </Tooltip>
    );
}

export interface TriangleGeometryFieldsProps {
    w: number;
    h: number;
    apex: number;
    rotation: number;
    setW: (width: number) => void;
    setH: (height: number) => void;
    setApex: (ratio: number) => void;
    setRotation: (deg: number) => void;
    /** 每次改动完成时提交一次历史 */
    onCommit: () => void;
}

/** 选中单个三角形时的几何编辑：底宽 / 高 / 顶点 / 旋转（仅单选 triangle 时由面板渲染） */
export function TriangleGeometryFields({ w, h, apex, rotation, setW, setH, setApex, setRotation, onCommit }: TriangleGeometryFieldsProps) {
    return (
        <>
            <Tooltip title="底边宽度">
                <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>底</Typography.Text>
                    <InputNumber min={1} max={1000} value={w} onChange={(v) => { setW(v ?? 100); onCommit(); }} size="small" style={{ width: 72 }} />
                </Space>
            </Tooltip>
            <Tooltip title="高度">
                <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>高</Typography.Text>
                    <InputNumber min={1} max={1000} value={h} onChange={(v) => { setH(v ?? 80); onCommit(); }} size="small" style={{ width: 72 }} />
                </Space>
            </Tooltip>
            <TriangleApexSlider value={apex} onChange={setApex} onCommit={onCommit} />
            <TriangleRotationSlider value={rotation} onChange={setRotation} onCommit={onCommit} />
        </>
    );
}
