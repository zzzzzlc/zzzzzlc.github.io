import { InputNumber, Slider, Space, Tooltip, Typography } from 'antd';

/** 内凹比 → 简短标签：0=正多边形，否则百分比（属性面板展示用） */
const innerRatioLabel = (ratio: number): string =>
    Math.abs(ratio) < 0.005 ? '正' : `${Math.round(ratio * 100)}%`;

export interface PolygonSidesSliderProps {
    value: number;
    onChange: (sides: number) => void;
    /** 松手回调：提交一次历史（不传则不入栈，用于工具态） */
    onCommit?: () => void;
    width?: number;
}

/** 多边形边数滑块：3~12。工具态（配置默认边数）与选中态（改某个多边形边数）复用 */
export function PolygonSidesSlider({ value, onChange, onCommit, width = 90 }: PolygonSidesSliderProps) {
    return (
        <Tooltip title="顶点数：3=三角形 … 5=五边形 … 6=六边形">
            <Space size={4}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>边数</Typography.Text>
                <Slider min={3} max={12} step={1} value={value} onChange={onChange} onChangeComplete={onCommit} style={{ width, margin: 0 }} />
                <span style={{ fontSize: 12, width: 36 }}>{value}边</span>
            </Space>
        </Tooltip>
    );
}

export interface PolygonInnerRatioSliderProps {
    value: number;
    onChange: (ratio: number) => void;
    onCommit?: () => void;
    width?: number;
}

/** 多边形内凹比滑块：0=正多边形，>0=星形（值越大星芒越尖）。多边形↔星形可平滑互转 */
export function PolygonInnerRatioSlider({ value, onChange, onCommit, width = 90 }: PolygonInnerRatioSliderProps) {
    return (
        <Tooltip title="内凹比：0=正多边形，越大越接近星形（0.38≈标准五角星）">
            <Space size={4}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>凹度</Typography.Text>
                <Slider min={0} max={0.9} step={0.01} value={value} onChange={onChange} onChangeComplete={onCommit} style={{ width, margin: 0 }} />
                <span style={{ fontSize: 12, width: 36 }}>{innerRatioLabel(value)}</span>
            </Space>
        </Tooltip>
    );
}

export interface PolygonRotationSliderProps {
    value: number;
    onChange: (deg: number) => void;
    onCommit?: () => void;
    width?: number;
}

/** 多边形旋转滑块：绕中心顺时针，0=顶点朝上 */
export function PolygonRotationSlider({ value, onChange, onCommit, width = 90 }: PolygonRotationSliderProps) {
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

export interface PolygonGeometryFieldsProps {
    r: number;
    sides: number;
    innerRatio: number;
    rotation: number;
    setR: (r: number) => void;
    setSides: (sides: number) => void;
    setInnerRatio: (ratio: number) => void;
    setRotation: (deg: number) => void;
    /** 每次改动完成时提交一次历史 */
    onCommit: () => void;
}

/** 选中单个多边形时的几何编辑：外接半径 / 边数 / 凹度 / 旋转（仅单选 polygon 时由面板渲染） */
export function PolygonGeometryFields({
    r, sides, innerRatio, rotation, setR, setSides, setInnerRatio, setRotation, onCommit,
}: PolygonGeometryFieldsProps) {
    return (
        <>
            <Tooltip title="外接圆半径">
                <Space size={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>半径</Typography.Text>
                    <InputNumber min={1} max={1000} value={r} onChange={(v) => { setR(v ?? 50); onCommit(); }} size="small" style={{ width: 72 }} />
                </Space>
            </Tooltip>
            <PolygonSidesSlider value={sides} onChange={setSides} onCommit={onCommit} />
            <PolygonInnerRatioSlider value={innerRatio} onChange={setInnerRatio} onCommit={onCommit} />
            <PolygonRotationSlider value={rotation} onChange={setRotation} onCommit={onCommit} />
        </>
    );
}
