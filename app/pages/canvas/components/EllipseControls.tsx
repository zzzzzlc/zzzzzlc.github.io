import { InputNumber, Slider, Space, Tooltip, Typography } from 'antd';

export interface EllipseRotationSliderProps {
    value: number;
    onChange: (deg: number) => void;
    /** 松手回调：提交一次历史（不传则不入栈，用于工具态） */
    onCommit?: () => void;
    width?: number;
}

/** 椭圆旋转滑块：绕中心顺时针，0=轴对齐 */
export function EllipseRotationSlider({ value, onChange, onCommit, width = 90 }: EllipseRotationSliderProps) {
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

export interface EllipseGeometryFieldsProps {
    rx: number;
    ry: number;
    rotation: number;
    setRx: (rx: number) => void;
    setRy: (ry: number) => void;
    setRotation: (deg: number) => void;
    /** 每次改动完成时提交一次历史 */
    onCommit: () => void;
}

/** 选中单个椭圆时的几何编辑：长半轴 / 短半轴 / 旋转（仅单选 ellipse 时由面板渲染） */
export function EllipseGeometryFields({
    rx, ry, rotation, setRx, setRy, setRotation, onCommit,
}: EllipseGeometryFieldsProps) {
    return (
        <>
            <Tooltip title="长半轴（水平方向半径）">
                <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>X 半径</Typography.Text>
                    <InputNumber min={1} max={1000} value={rx} onChange={(v) => { setRx(v ?? 60); onCommit(); }} size="small" style={{ width: 72 }} />
                </Space>
            </Tooltip>
            <Tooltip title="短半轴（垂直方向半径）">
                <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>Y 半径</Typography.Text>
                    <InputNumber min={1} max={1000} value={ry} onChange={(v) => { setRy(v ?? 40); onCommit(); }} size="small" style={{ width: 72 }} />
                </Space>
            </Tooltip>
            <EllipseRotationSlider value={rotation} onChange={setRotation} onCommit={onCommit} />
        </>
    );
}
