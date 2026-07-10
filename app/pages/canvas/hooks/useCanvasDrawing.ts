import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import type {
    CanvasController, EllipseGeometryPatch, EllipseShape, Point, PolygonGeometryPatch, PolygonShape, Rect, Shape, ShapeStylePatch, Tool, ToolStyle, TriangleGeometryPatch, TriangleShape, ShapeType,
} from '../types';
import { pickColor } from '../utils/draw';
import { collectHitsAt, collectInBox, hitTest } from '../utils/hittest';
import { cloneShapes, moveShape, shapeLabel } from '../utils/shape';
import { redraw } from '../utils/render';

const DEFAULT_TOOL_STYLE: ToolStyle = {
    strokeColor: '#000000',
    fillColor: '#ffffff',
    fillEnabled: false,
    lineWidth: 3,
    opacity: 100,
    dotSize: 10,
    rectW: 100,
    rectH: 80,
    circleR: 40,
    triangleApex: 0,
    triangleRotation: 0,
    ellipseRx: 60,
    ellipseRy: 40,
    ellipseRotation: 0,
    polygonSides: 5,
    polygonInnerRatio: 0,
    polygonR: 50,
    polygonRotation: 0,
    fixedSize: false,
};

/** 各工具独立初始样式 */
const buildInitialToolStyles = (): Record<Tool, ToolStyle> => ({
    select: { ...DEFAULT_TOOL_STYLE },
    dot: { ...DEFAULT_TOOL_STYLE, dotSize: 12 },
    pen: { ...DEFAULT_TOOL_STYLE, lineWidth: 4 },
    line: { ...DEFAULT_TOOL_STYLE, lineWidth: 2 },
    rect: { ...DEFAULT_TOOL_STYLE, lineWidth: 2 },
    circle: { ...DEFAULT_TOOL_STYLE, lineWidth: 2 },
    triangle: { ...DEFAULT_TOOL_STYLE, lineWidth: 2 },
    ellipse: { ...DEFAULT_TOOL_STYLE, lineWidth: 2 },
    pentagon: { ...DEFAULT_TOOL_STYLE, lineWidth: 2, polygonSides: 5, polygonInnerRatio: 0 },
    hexagon: { ...DEFAULT_TOOL_STYLE, lineWidth: 2, polygonSides: 6, polygonInnerRatio: 0 },
    octagon: { ...DEFAULT_TOOL_STYLE, lineWidth: 2, polygonSides: 8, polygonInnerRatio: 0 },
    star: { ...DEFAULT_TOOL_STYLE, lineWidth: 2, polygonSides: 5, polygonInnerRatio: 0.382 },
    eraser: { ...DEFAULT_TOOL_STYLE },
    picker: { ...DEFAULT_TOOL_STYLE },
});

type DragMode = 'draw' | 'move' | 'erase' | 'select-box' | null;

/**
 * 画板核心 hook（对象化 + 框选多选）：维护 Shape[]，select 工具左键拖拽框选范围内节点，
 * 选中后支持批量移动 / 改属性 / 删除；历史为 Shape[][] 快照。
 */
export const useCanvasDrawing = (): CanvasController => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<Tool>('pen');
    const [toolStyles, setToolStyles] = useState<Record<Tool, ToolStyle>>(buildInitialToolStyles);

    const [shapes, setShapesState] = useState<Shape[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [contextHitId, setContextHitId] = useState<number | null>(null);
    const [cursor, setCursor] = useState<Point | null>(null);

    const [history, setHistory] = useState<Shape[][]>([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // refs：即时跟踪，避免事件闭包陈旧
    const shapesRef = useRef<Shape[]>([]);
    const selectedIdsRef = useRef<number[]>([]);
    const historyRef = useRef<Shape[][]>([[]]);
    const historyIndexRef = useRef(0);
    const idRef = useRef(0);
    const startPos = useRef<Point>({ x: 0, y: 0 });
    const lastPos = useRef<Point>({ x: 0, y: 0 });
    const previewRef = useRef<Shape | null>(null);
    const selectBoxRef = useRef<Rect | null>(null);
    // 框选是否为追加模式（Ctrl/Cmd 拖拽空白时 true，mouseUp 时把命中并入而非替换）
    const selectBoxAdditiveRef = useRef(false);
    const drawingPointsRef = useRef<Point[]>([]);
    const dragModeRef = useRef<DragMode>(null);
    const moveDirtyRef = useRef(false);
    const eraseDirtyRef = useRef(false);

    const style = toolStyles[tool];
    const selectedShapes = selectedIds
        .map((id) => shapes.find((s) => s.id === id))
        .filter((s): s is Shape => s !== undefined);
    const firstSelected = selectedShapes[0] ?? null;

    const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

    /** 同步更新 shapes state 与 ref */
    const commitShapes = useCallback((next: Shape[]) => {
        shapesRef.current = next;
        setShapesState(next);
    }, []);

    const pushHistory = useCallback((next: Shape[]) => {
        const arr = historyRef.current.slice(0, historyIndexRef.current + 1);
        arr.push(cloneShapes(next));
        historyRef.current = arr;
        historyIndexRef.current = arr.length - 1;
        setHistory(arr);
        setHistoryIndex(arr.length - 1);
    }, []);

    const paint = useCallback((preview: Shape | null) => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        redraw(ctx, canvas, shapesRef.current, {
            preview,
            selectedIds: selectedIdsRef.current,
            selectBox: selectBoxRef.current,
        });
    }, [getCtx]);

    // 初始化画布尺寸 + 白底
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        paint(null);
    }, [paint]);

    // shapes / selectedIds 变化时重绘
    useEffect(() => {
        paint(null);
    }, [shapes, selectedIds, paint]);

    // —— 工具样式 setter（不改对象，不进历史）——
    const updateStyle = useCallback(<K extends keyof ToolStyle>(key: K, value: ToolStyle[K]): void => {
        setToolStyles((prev) => ({ ...prev, [tool]: { ...prev[tool], [key]: value } }));
    }, [tool]);

    // —— 选中对象属性 setter（实时改 shapes，不入栈；由 commitEditHistory 在改动完成时入栈）——
    const updateShapesStyle = useCallback((patch: ShapeStylePatch): void => {
        const ids = new Set(selectedIdsRef.current);
        if (ids.size === 0) return;
        const next = shapesRef.current.map((s) => (ids.has(s.id) ? { ...s, ...patch } : s));
        commitShapes(next);
    }, [commitShapes]);

    // —— 选中态几何 setter 通用实现：选中集内匹配 test 的 shape 展开 patch，余者不变（实时改不入栈）——
    const applyGeometry = useCallback(<S extends Shape>(
        test: (s: Shape) => s is S,
        patch: Partial<S>,
    ): void => {
        const ids = new Set(selectedIdsRef.current);
        if (ids.size === 0) return;
        const next = shapesRef.current.map((s) => (test(s) && ids.has(s.id) ? { ...s, ...patch } : s));
        commitShapes(next);
    }, [commitShapes]);
    const patchTriangle = (patch: TriangleGeometryPatch): void =>
        applyGeometry((s): s is TriangleShape => s.type === 'triangle', patch);
    const patchEllipse = (patch: EllipseGeometryPatch): void =>
        applyGeometry((s): s is EllipseShape => s.type === 'ellipse', patch);
    const patchPolygon = (patch: PolygonGeometryPatch): void =>
        applyGeometry((s): s is PolygonShape => s.type === 'polygon', patch);

    /** 提交一次历史快照（仅选中态）；属性控件在改动完成时调用，避免拖滑块产生大量撤销步 */
    const commitEditHistory = useCallback((): void => {
        if (selectedIdsRef.current.length === 0) return;
        pushHistory(shapesRef.current);
    }, [pushHistory]);

    // —— 扁平 getter/setter：选中态批量分发到 shapes，否则工具配置 ——
    const strokeColor = firstSelected ? firstSelected.strokeColor : style.strokeColor;
    const setStrokeColor = (color: string) => (selectedShapes.length ? updateShapesStyle({ strokeColor: color }) : updateStyle('strokeColor', color));
    const fillColor = firstSelected ? firstSelected.fillColor : style.fillColor;
    const setFillColor = (color: string) => (selectedShapes.length ? updateShapesStyle({ fillColor: color }) : updateStyle('fillColor', color));
    const fillEnabled = firstSelected ? firstSelected.fillEnabled : style.fillEnabled;
    const setFillEnabled = (enabled: boolean) => (selectedShapes.length ? updateShapesStyle({ fillEnabled: enabled }) : updateStyle('fillEnabled', enabled));
    const lineWidth = firstSelected ? firstSelected.lineWidth : style.lineWidth;
    const setLineWidth = (width: number) => (selectedShapes.length ? updateShapesStyle({ lineWidth: width }) : updateStyle('lineWidth', width));
    const opacity = firstSelected ? firstSelected.opacity : style.opacity;
    const setOpacity = (value: number) => (selectedShapes.length ? updateShapesStyle({ opacity: value }) : updateStyle('opacity', value));
    // 尺寸配置仅作用于工具（选中态 UI 隐藏）
    const dotSize = style.dotSize;
    const setDotSize = (size: number) => updateStyle('dotSize', size);
    const rectW = style.rectW;
    const setRectW = (width: number) => updateStyle('rectW', width);
    const rectH = style.rectH;
    const setRectH = (height: number) => updateStyle('rectH', height);
    const circleR = style.circleR;
    const setCircleR = (radius: number) => updateStyle('circleR', radius);
    const fixedSize = style.fixedSize;
    const setFixedSize = (fixed: boolean) => updateStyle('fixedSize', fixed);

    // 三角形几何：选中单个三角形时编辑其几何，否则配置工具默认值
    const editingTriangle: TriangleShape | null =
        selectedShapes.length === 1 && firstSelected !== null && firstSelected.type === 'triangle'
            ? firstSelected
            : null;
    const triangleApex = editingTriangle ? editingTriangle.apexRatio : style.triangleApex;
    const setTriangleApex = (ratio: number) => (editingTriangle ? patchTriangle({ apexRatio: ratio }) : updateStyle('triangleApex', ratio));
    const triangleW = editingTriangle ? editingTriangle.w : style.rectW;
    const setTriangleW = (width: number) => (editingTriangle ? patchTriangle({ w: width }) : updateStyle('rectW', width));
    const triangleH = editingTriangle ? editingTriangle.h : style.rectH;
    const setTriangleH = (height: number) => (editingTriangle ? patchTriangle({ h: height }) : updateStyle('rectH', height));
    const triangleRotation = editingTriangle ? editingTriangle.rotation : style.triangleRotation;
    const setTriangleRotation = (deg: number) => (editingTriangle ? patchTriangle({ rotation: deg }) : updateStyle('triangleRotation', deg));

    // 椭圆几何：选中单个椭圆时编辑其几何，否则配置工具默认值
    const editingEllipse: EllipseShape | null =
        selectedShapes.length === 1 && firstSelected !== null && firstSelected.type === 'ellipse'
            ? firstSelected
            : null;
    const ellipseRx = editingEllipse ? editingEllipse.rx : style.ellipseRx;
    const setEllipseRx = (rx: number) => (editingEllipse ? patchEllipse({ rx }) : updateStyle('ellipseRx', rx));
    const ellipseRy = editingEllipse ? editingEllipse.ry : style.ellipseRy;
    const setEllipseRy = (ry: number) => (editingEllipse ? patchEllipse({ ry }) : updateStyle('ellipseRy', ry));
    const ellipseRotation = editingEllipse ? editingEllipse.rotation : style.ellipseRotation;
    const setEllipseRotation = (deg: number) => (editingEllipse ? patchEllipse({ rotation: deg }) : updateStyle('ellipseRotation', deg));

    // 多边形几何：选中单个多边形时编辑其几何，否则配置工具默认值
    const editingPolygon: PolygonShape | null =
        selectedShapes.length === 1 && firstSelected !== null && firstSelected.type === 'polygon'
            ? firstSelected
            : null;
    const polygonSides = editingPolygon ? editingPolygon.sides : style.polygonSides;
    const setPolygonSides = (sides: number) => (editingPolygon ? patchPolygon({ sides }) : updateStyle('polygonSides', sides));
    const polygonInnerRatio = editingPolygon ? editingPolygon.innerRatio : style.polygonInnerRatio;
    const setPolygonInnerRatio = (ratio: number) => (editingPolygon ? patchPolygon({ innerRatio: ratio }) : updateStyle('polygonInnerRatio', ratio));
    const polygonR = editingPolygon ? editingPolygon.r : style.polygonR;
    const setPolygonR = (r: number) => (editingPolygon ? patchPolygon({ r }) : updateStyle('polygonR', r));
    const polygonRotation = editingPolygon ? editingPolygon.rotation : style.polygonRotation;
    const setPolygonRotation = (deg: number) => (editingPolygon ? patchPolygon({ rotation: deg }) : updateStyle('polygonRotation', deg));

    const selectedLabel = selectedShapes.length === 0
        ? null
        : selectedShapes.length === 1
            ? shapeLabel(selectedShapes[0])
            : `${selectedShapes.length} 个节点`;
    const selectedShapeType: ShapeType | null =
        selectedShapes.length === 1 && firstSelected !== null ? firstSelected.type : null;

    const getPos = (e: MouseEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const nextId = (): number => {
        idRef.current += 1;
        return idRef.current;
    };

    const styleBase = () => ({
        strokeColor: style.strokeColor,
        fillColor: style.fillColor,
        fillEnabled: style.fillEnabled,
        lineWidth: style.lineWidth,
        opacity: style.opacity,
    });

    /** 拖拽起止点 → 预览 shape（line/rect/circle/triangle） */
    const buildShapeFromDrag = (start: Point, end: Point): Shape => {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        switch (tool) {
            case 'line':
                return { id: 0, type: 'line', ...styleBase(), start, end };
            case 'rect':
                return { id: 0, type: 'rect', ...styleBase(), cx, cy, w, h };
            case 'circle':
                return { id: 0, type: 'circle', ...styleBase(), cx, cy, r: Math.hypot(end.x - start.x, end.y - start.y) / 2 };
            case 'triangle':
                return { id: 0, type: 'triangle', ...styleBase(), cx, cy, w, h, apexRatio: style.triangleApex, rotation: style.triangleRotation };
            case 'ellipse':
                return { id: 0, type: 'ellipse', ...styleBase(), cx, cy, rx: Math.max(0.1, w / 2), ry: Math.max(0.1, h / 2), rotation: style.ellipseRotation };
            case 'pentagon':
            case 'hexagon':
            case 'octagon':
            case 'star':
                return {
                    id: 0, type: 'polygon', ...styleBase(), cx, cy,
                    r: Math.hypot(end.x - start.x, end.y - start.y) / 2,
                    sides: style.polygonSides, innerRatio: style.polygonInnerRatio, rotation: style.polygonRotation,
                };
            default:
                return { id: 0, type: 'line', ...styleBase(), start, end };
        }
    };

    /** 固定尺寸：以点击点为中心放置 shape */
    const buildFixedSizeShape = (cx: number, cy: number): Shape | null => {
        switch (tool) {
            case 'rect':
                return { id: nextId(), type: 'rect', ...styleBase(), cx, cy, w: style.rectW, h: style.rectH };
            case 'circle':
                return { id: nextId(), type: 'circle', ...styleBase(), cx, cy, r: style.circleR };
            case 'triangle':
                return { id: nextId(), type: 'triangle', ...styleBase(), cx, cy, w: style.rectW, h: style.rectH, apexRatio: style.triangleApex, rotation: style.triangleRotation };
            case 'ellipse':
                return { id: nextId(), type: 'ellipse', ...styleBase(), cx, cy, rx: style.ellipseRx, ry: style.ellipseRy, rotation: style.ellipseRotation };
            case 'pentagon':
            case 'hexagon':
            case 'octagon':
            case 'star':
                return {
                    id: nextId(), type: 'polygon', ...styleBase(), cx, cy,
                    r: style.polygonR, sides: style.polygonSides, innerRatio: style.polygonInnerRatio, rotation: style.polygonRotation,
                };
            default:
                return null;
        }
    };

    const isShapeValid = (shape: Shape): boolean => {
        switch (shape.type) {
            case 'stroke':
                return shape.points.length >= 2;
            case 'line':
                return shape.start.x !== shape.end.x || shape.start.y !== shape.end.y;
            case 'circle':
                return shape.r > 0;
            case 'rect':
            case 'triangle':
                return shape.w > 0 || shape.h > 0;
            case 'ellipse':
                return shape.rx > 0 || shape.ry > 0;
            case 'polygon':
                return shape.r > 0 && shape.sides >= 3;
            case 'dot':
                return true;
            default:
                return false;
        }
    };

    const eraseAt = (pos: Point): void => {
        const before = shapesRef.current.length;
        const next = shapesRef.current.filter((s) => !hitTest(s, pos.x, pos.y));
        if (next.length === before) return;
        commitShapes(next);
        eraseDirtyRef.current = true;
        // 删除波及选中对象时，同步收缩选中集
        if (selectedIdsRef.current.length > 0) {
            const remaining = new Set(next.map((s) => s.id));
            const survived = selectedIdsRef.current.filter((id) => remaining.has(id));
            if (survived.length !== selectedIdsRef.current.length) {
                setSelectedIds(survived);
                selectedIdsRef.current = survived;
            }
        }
    };

    const onMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
        if (e.button !== 0) return;
        const ctx = getCtx();
        if (!ctx) return;
        const pos = getPos(e);
        startPos.current = pos;
        lastPos.current = pos;

        switch (tool) {
            case 'select': {
                const additive = e.ctrlKey || e.metaKey;
                const hit = collectHitsAt(shapesRef.current, pos.x, pos.y)[0];
                if (hit) {
                    const current = selectedIdsRef.current;
                    if (additive) {
                        // Ctrl/Cmd+点击：在选中集中→移除该节点(取消当前选中)；不在→追加(添加未选中)。不进入拖动
                        const next = current.includes(hit.id)
                            ? current.filter((id) => id !== hit.id)
                            : [...current, hit.id];
                        setSelectedIds(next);
                        selectedIdsRef.current = next;
                        dragModeRef.current = null;
                    } else {
                        // 普通点击：未选中则单选它，随后可拖动整组
                        if (!current.includes(hit.id)) {
                            setSelectedIds([hit.id]);
                            selectedIdsRef.current = [hit.id];
                        }
                        dragModeRef.current = 'move';
                    }
                } else {
                    // 未命中：开始框选（Ctrl 时为追加模式）
                    selectBoxAdditiveRef.current = additive;
                    dragModeRef.current = 'select-box';
                    selectBoxRef.current = { x: pos.x, y: pos.y, w: 0, h: 0 };
                }
                return;
            }
            case 'dot': {
                const shape: Shape = {
                    id: nextId(), type: 'dot', x: pos.x, y: pos.y, size: style.dotSize,
                    strokeColor: style.strokeColor, fillColor: style.strokeColor, fillEnabled: true,
                    lineWidth: style.lineWidth, opacity: style.opacity,
                };
                const next = [...shapesRef.current, shape];
                commitShapes(next);
                pushHistory(next);
                return;
            }
            case 'pen': {
                drawingPointsRef.current = [pos];
                previewRef.current = {
                    id: 0, type: 'stroke', points: [pos],
                    strokeColor: style.strokeColor, fillColor: style.strokeColor, fillEnabled: false,
                    lineWidth: style.lineWidth, opacity: style.opacity,
                };
                dragModeRef.current = 'draw';
                paint(previewRef.current);
                return;
            }
            case 'line':
            case 'rect':
            case 'circle':
            case 'triangle':
            case 'ellipse':
            case 'pentagon':
            case 'hexagon':
            case 'octagon':
            case 'star': {
                if (style.fixedSize) {
                    const placed = buildFixedSizeShape(pos.x, pos.y);
                    if (placed) {
                        const next = [...shapesRef.current, placed];
                        commitShapes(next);
                        pushHistory(next);
                    }
                    return;
                }
                dragModeRef.current = 'draw';
                return;
            }
            case 'eraser': {
                dragModeRef.current = 'erase';
                eraseAt(pos);
                return;
            }
            case 'picker': {
                setStrokeColor(pickColor(ctx, pos.x, pos.y));
                commitEditHistory();
                return;
            }
            default:
                return;
        }
    };

    const onMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
        const ctx = getCtx();
        if (!ctx) return;
        const pos = getPos(e);
        setCursor(pos);

        const mode = dragModeRef.current;
        if (!mode) return;

        if (mode === 'draw') {
            if (tool === 'pen') {
                drawingPointsRef.current.push(pos);
                previewRef.current = {
                    id: 0, type: 'stroke', points: drawingPointsRef.current,
                    strokeColor: style.strokeColor, fillColor: style.strokeColor, fillEnabled: false,
                    lineWidth: style.lineWidth, opacity: style.opacity,
                };
            } else {
                previewRef.current = buildShapeFromDrag(startPos.current, pos);
            }
            paint(previewRef.current);
            return;
        }

        if (mode === 'move') {
            const dx = pos.x - lastPos.current.x;
            const dy = pos.y - lastPos.current.y;
            const ids = new Set(selectedIdsRef.current);
            if (ids.size > 0 && (dx !== 0 || dy !== 0)) {
                const next = shapesRef.current.map((s) => (ids.has(s.id) ? moveShape(s, dx, dy) : s));
                commitShapes(next);
                moveDirtyRef.current = true;
            }
            lastPos.current = pos;
            return;
        }

        if (mode === 'erase') {
            eraseAt(pos);
            return;
        }

        if (mode === 'select-box') {
            const sx = startPos.current.x;
            const sy = startPos.current.y;
            selectBoxRef.current = {
                x: Math.min(sx, pos.x),
                y: Math.min(sy, pos.y),
                w: Math.abs(pos.x - sx),
                h: Math.abs(pos.y - sy),
            };
            paint(previewRef.current);
        }
    };

    const onMouseUp = () => {
        const mode = dragModeRef.current;
        dragModeRef.current = null;

        if (mode === 'draw') {
            const preview = previewRef.current;
            previewRef.current = null;
            if (preview && isShapeValid(preview)) {
                const shape: Shape = { ...preview, id: nextId() };
                const next = [...shapesRef.current, shape];
                commitShapes(next);
                pushHistory(next);
            }
            paint(null);
        }

        if (mode === 'select-box') {
            const box = selectBoxRef.current;
            const additive = selectBoxAdditiveRef.current;
            selectBoxRef.current = null;
            selectBoxAdditiveRef.current = false;
            if (box && box.w > 3 && box.h > 3) {
                const hitIds = collectInBox(shapesRef.current, box).map((h) => h.id);
                // 追加模式：并入当前选中；否则替换
                const base = additive ? selectedIdsRef.current : [];
                const ids = Array.from(new Set([...base, ...hitIds]));
                setSelectedIds(ids);
                selectedIdsRef.current = ids;
            } else if (!additive) {
                // 普通单击空白：清空选中（Ctrl 单击空白保留当前选中，便于继续追加）
                setSelectedIds([]);
                selectedIdsRef.current = [];
            }
            paint(null);
        }

        if (mode === 'move' && moveDirtyRef.current) {
            pushHistory(shapesRef.current);
        }
        moveDirtyRef.current = false;

        if (mode === 'erase' && eraseDirtyRef.current) {
            pushHistory(shapesRef.current);
        }
        eraseDirtyRef.current = false;
    };

    const onMouseLeave = () => {
        setCursor(null);
        onMouseUp();
    };

    // 右键命中检测：记录右键位置最上层节点，供右键菜单「删除此节点」
    const onContextMenu = (e: MouseEvent<HTMLCanvasElement>) => {
        const pos = getPos(e);
        const hit = collectHitsAt(shapesRef.current, pos.x, pos.y)[0];
        setContextHitId(hit ? hit.id : null);
    };

    const handleUndo = () => {
        if (historyIndexRef.current <= 0) return;
        const idx = historyIndexRef.current - 1;
        historyIndexRef.current = idx;
        setHistoryIndex(idx);
        commitShapes(cloneShapes(historyRef.current[idx]));
        setSelectedIds([]);
        selectedIdsRef.current = [];
    };

    const handleRedo = () => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        const idx = historyIndexRef.current + 1;
        historyIndexRef.current = idx;
        setHistoryIndex(idx);
        commitShapes(cloneShapes(historyRef.current[idx]));
        setSelectedIds([]);
        selectedIdsRef.current = [];
    };

    const handleClear = () => {
        commitShapes([]);
        pushHistory([]);
        setSelectedIds([]);
        selectedIdsRef.current = [];
    };

    const handleDownload = () => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        redraw(ctx, canvas, shapesRef.current, {}); // 导出无选中框/选择框
        const link = document.createElement('a');
        link.download = 'canvas-drawing.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        paint(null);
    };

    const handleDeleteSelected = () => {
        const ids = new Set(selectedIdsRef.current);
        if (ids.size === 0) return;
        const next = shapesRef.current.filter((s) => !ids.has(s.id));
        commitShapes(next);
        pushHistory(next);
        setSelectedIds([]);
        selectedIdsRef.current = [];
    };

    /** 删除右键命中的单个节点（不依赖选中集） */
    const handleDeleteNode = () => {
        const id = contextHitId;
        if (id == null) return;
        const next = shapesRef.current.filter((s) => s.id !== id);
        commitShapes(next);
        pushHistory(next);
        if (selectedIdsRef.current.includes(id)) {
            const survived = selectedIdsRef.current.filter((x) => x !== id);
            setSelectedIds(survived);
            selectedIdsRef.current = survived;
        }
        setContextHitId(null);
    };

    /** 取消选中（清空选中集，不删除节点） */
    const handleClearSelection = () => {
        setSelectedIds([]);
        selectedIdsRef.current = [];
    };

    /** 反选：未选中↔已选中互换（空选=全选，全选=清空） */
    const handleInvertSelection = () => {
        const selectedSet = new Set(selectedIdsRef.current);
        const ids = shapesRef.current.filter((s) => !selectedSet.has(s.id)).map((s) => s.id);
        setSelectedIds(ids);
        selectedIdsRef.current = ids;
    };

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return {
        canvasRef, cursor, tool, setTool,
        strokeColor, setStrokeColor, fillColor, setFillColor,
        fillEnabled, setFillEnabled, lineWidth, setLineWidth,
        opacity, setOpacity, dotSize, setDotSize,
        rectW, setRectW, rectH, setRectH, circleR, setCircleR,
        fixedSize, setFixedSize,
        triangleApex, setTriangleApex, triangleW, setTriangleW, triangleH, setTriangleH,
        triangleRotation, setTriangleRotation, commitEditHistory,
        ellipseRx, setEllipseRx, ellipseRy, setEllipseRy, ellipseRotation, setEllipseRotation,
        polygonSides, setPolygonSides, polygonInnerRatio, setPolygonInnerRatio,
        polygonR, setPolygonR, polygonRotation, setPolygonRotation,
        selectedIds, selectedLabel, selectedShapeType, handleDeleteSelected, handleClearSelection, handleInvertSelection,
        contextHitId,
        onContextMenu, handleDeleteNode,
        canUndo, canRedo,
        onMouseDown, onMouseMove, onMouseUp, onMouseLeave,
        handleUndo, handleRedo, handleClear, handleDownload,
    };
};
