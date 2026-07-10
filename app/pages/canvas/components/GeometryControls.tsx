import { InputNumber, Space, Switch, Tooltip, Typography } from 'antd';
import type { CanvasController, Tool } from '../types';
import { EllipseGeometryFields, EllipseRotationSlider } from './EllipseControls';
import { PolygonGeometryFields, PolygonInnerRatioSlider, PolygonRotationSlider, PolygonSidesSlider } from './PolygonControls';
import { TriangleApexSlider, TriangleGeometryFields, TriangleRotationSlider } from './TriangleControls';

/** 支持固定尺寸放置的形状工具（与 useCanvasDrawing 的 mouseDown case 组保持一致） */
const FIXED_SIZE_TOOLS = new Set<Tool>([
    'rect', 'circle', 'triangle', 'ellipse', 'pentagon', 'hexagon', 'octagon', 'star',
]);
/** 产出 polygon 形状的工具键 */
const POLYGON_TOOLS = new Set<Tool>(['pentagon', 'hexagon', 'octagon', 'star']);

export interface GeometryControlsProps {
    controller: CanvasController;
}

/**
 * 几何控件区：固定尺寸开关 + 各形状的尺寸配置（工具态）与几何编辑（选中态）。
 * 矩形/圆/三角/椭圆/多边形统一在此分发，PropertyPanel 仅负责样式与动作。
 */
export function GeometryControls({ controller }: GeometryControlsProps) {
    const {
        tool, selectedLabel, selectedShapeType, commitEditHistory,
        rectW, setRectW, rectH, setRectH, circleR, setCircleR, fixedSize, setFixedSize,
        triangleApex, setTriangleApex, triangleW, setTriangleW, triangleH, setTriangleH,
        triangleRotation, setTriangleRotation,
        ellipseRx, setEllipseRx, ellipseRy, setEllipseRy, ellipseRotation, setEllipseRotation,
        polygonSides, setPolygonSides, polygonInnerRatio, setPolygonInnerRatio,
        polygonR, setPolygonR, polygonRotation, setPolygonRotation,
    } = controller;

    const editingShape = Boolean(selectedLabel);
    const showShapeSize = !editingShape && FIXED_SIZE_TOOLS.has(tool);
    const isPolygonTool = POLYGON_TOOLS.has(tool);
    const isEditingTriangle = editingShape && selectedShapeType === 'triangle';
    const isEditingEllipse = editingShape && selectedShapeType === 'ellipse';
    const isEditingPolygon = editingShape && selectedShapeType === 'polygon';

    return (
        <>
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
                    {fixedSize && tool === 'ellipse' && (
                        <>
                            <Space size={4}>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>X 半径</Typography.Text>
                                <InputNumber min={1} max={1000} value={ellipseRx} onChange={(v) => setEllipseRx(v ?? 60)} size="small" style={{ width: 72 }} />
                            </Space>
                            <Space size={4}>
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Y 半径</Typography.Text>
                                <InputNumber min={1} max={1000} value={ellipseRy} onChange={(v) => setEllipseRy(v ?? 40)} size="small" style={{ width: 72 }} />
                            </Space>
                        </>
                    )}
                    {fixedSize && isPolygonTool && (
                        <Space size={4}>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>半径</Typography.Text>
                            <InputNumber min={1} max={1000} value={polygonR} onChange={(v) => setPolygonR(v ?? 50)} size="small" style={{ width: 72 }} />
                        </Space>
                    )}
                </>
            )}
            {!editingShape && tool === 'triangle' && (
                <>
                    <TriangleApexSlider value={triangleApex} onChange={setTriangleApex} onCommit={commitEditHistory} />
                    <TriangleRotationSlider value={triangleRotation} onChange={setTriangleRotation} onCommit={commitEditHistory} />
                </>
            )}
            {!editingShape && tool === 'ellipse' && (
                <EllipseRotationSlider value={ellipseRotation} onChange={setEllipseRotation} onCommit={commitEditHistory} />
            )}
            {!editingShape && isPolygonTool && (
                <>
                    <PolygonSidesSlider value={polygonSides} onChange={setPolygonSides} onCommit={commitEditHistory} />
                    <PolygonInnerRatioSlider value={polygonInnerRatio} onChange={setPolygonInnerRatio} onCommit={commitEditHistory} />
                    <PolygonRotationSlider value={polygonRotation} onChange={setPolygonRotation} onCommit={commitEditHistory} />
                </>
            )}
            {isEditingTriangle && (
                <TriangleGeometryFields
                    w={triangleW} h={triangleH} apex={triangleApex} rotation={triangleRotation}
                    setW={setTriangleW} setH={setTriangleH} setApex={setTriangleApex} setRotation={setTriangleRotation}
                    onCommit={commitEditHistory}
                />
            )}
            {isEditingEllipse && (
                <EllipseGeometryFields
                    rx={ellipseRx} ry={ellipseRy} rotation={ellipseRotation}
                    setRx={setEllipseRx} setRy={setEllipseRy} setRotation={setEllipseRotation}
                    onCommit={commitEditHistory}
                />
            )}
            {isEditingPolygon && (
                <PolygonGeometryFields
                    r={polygonR} sides={polygonSides} innerRatio={polygonInnerRatio} rotation={polygonRotation}
                    setR={setPolygonR} setSides={setPolygonSides} setInnerRatio={setPolygonInnerRatio} setRotation={setPolygonRotation}
                    onCommit={commitEditHistory}
                />
            )}
        </>
    );
}
