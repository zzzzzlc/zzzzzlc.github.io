import type { MouseEvent, RefObject } from 'react';

/** 绘制工具（pentagon/hexagon/octagon/star 均产出 polygon 形状，靠各自 ToolStyle 默认值区分） */
export type Tool = 'select' | 'dot' | 'pen' | 'line' | 'rect' | 'circle' | 'triangle' | 'ellipse' | 'pentagon' | 'hexagon' | 'octagon' | 'star' | 'eraser' | 'picker';

/** 平面坐标点 */
export interface Point {
    x: number;
    y: number;
}

/** 轴对齐矩形（包围盒 / 选中框 / 选择框） */
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** 绘制样式：传给纯绘制函数 */
export interface DrawStyle {
    strokeColor: string;
    fillColor: string;
    fillEnabled: boolean;
    lineWidth: number;
    opacity: number;
    dotSize: number;
}

/** 单个工具的完整样式属性集：每类工具独立维护 */
export interface ToolStyle {
    strokeColor: string;
    fillColor: string;
    fillEnabled: boolean;
    lineWidth: number;
    opacity: number;
    dotSize: number;
    rectW: number;
    rectH: number;
    circleR: number;
    /** 三角形顶点横向位置默认值：-1(左) ~ 1(右)，0=等腰 */
    triangleApex: number;
    /** 三角形旋转角度默认值（度，0=顶点朝上） */
    triangleRotation: number;
    /** 椭圆：长短半轴默认 + 旋转（固定尺寸/工具态） */
    ellipseRx: number;
    ellipseRy: number;
    ellipseRotation: number;
    /** 多边形：边数 / 内凹比 / 半径 / 旋转（pentagon/hexagon/octagon/star 共用） */
    polygonSides: number;
    polygonInnerRatio: number;
    polygonR: number;
    polygonRotation: number;
    fixedSize: boolean;
}

// —— 图形对象模型 ——

export type ShapeType = 'dot' | 'stroke' | 'line' | 'rect' | 'circle' | 'triangle' | 'ellipse' | 'polygon';

/** 图形公共字段：身份 + 样式 */
export interface BaseShape {
    id: number;
    type: ShapeType;
    strokeColor: string;
    fillColor: string;
    fillEnabled: boolean;
    lineWidth: number;
    opacity: number;
}

export interface DotShape extends BaseShape {
    type: 'dot';
    x: number;
    y: number;
    size: number;
}

export interface StrokeShape extends BaseShape {
    type: 'stroke';
    points: Point[];
}

export interface LineShape extends BaseShape {
    type: 'line';
    start: Point;
    end: Point;
}

export interface RectShape extends BaseShape {
    type: 'rect';
    cx: number;
    cy: number;
    w: number;
    h: number;
}

export interface CircleShape extends BaseShape {
    type: 'circle';
    cx: number;
    cy: number;
    r: number;
}

export interface TriangleShape extends BaseShape {
    type: 'triangle';
    cx: number;
    cy: number;
    w: number;
    h: number;
    /** 顶点横向位置：-1(底边左端) ~ 1(底边右端)，0=顶点居中(等腰)。UI 钳制在 [-1,1] */
    apexRatio: number;
    /** 绕包围盒中心顺时针旋转角度（度），0=顶点朝上 */
    rotation: number;
}

export interface EllipseShape extends BaseShape {
    type: 'ellipse';
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    /** 绕中心顺时针旋转角度（度），0=轴对齐 */
    rotation: number;
}

export interface PolygonShape extends BaseShape {
    type: 'polygon';
    cx: number;
    cy: number;
    /** 外接圆半径 */
    r: number;
    /** 顶点数 ≥3 */
    sides: number;
    /** 内凹比：0=正多边形，(0,1)=星形（内顶点半径 = r·innerRatio） */
    innerRatio: number;
    /** 绕中心顺时针旋转角度（度） */
    rotation: number;
}

export type Shape = DotShape | StrokeShape | LineShape | RectShape | CircleShape | TriangleShape | EllipseShape | PolygonShape;

/** 图形样式子集（改属性时部分更新） */
export type ShapeStylePatch = Partial<Pick<BaseShape, 'strokeColor' | 'fillColor' | 'fillEnabled' | 'lineWidth' | 'opacity'>>;

/** 三角形几何子集（选中态改底/高/顶点/旋转时部分更新） */
export type TriangleGeometryPatch = Partial<Pick<TriangleShape, 'w' | 'h' | 'apexRatio' | 'rotation'>>;

/** 椭圆几何子集（选中态改 rx/ry/旋转时部分更新） */
export type EllipseGeometryPatch = Partial<Pick<EllipseShape, 'rx' | 'ry' | 'rotation'>>;

/** 多边形几何子集（选中态改半径/边数/凹度/旋转时部分更新） */
export type PolygonGeometryPatch = Partial<Pick<PolygonShape, 'r' | 'sides' | 'innerRatio' | 'rotation'>>;

/**
 * 画板控制器：useCanvasDrawing 的对外契约
 * 组件层只依赖此接口
 */
export interface CanvasController {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    cursor: Point | null;

    // —— 工具与样式状态（选中态分发到 shape，否则工具配置）——
    tool: Tool;
    setTool: (tool: Tool) => void;
    strokeColor: string;
    setStrokeColor: (color: string) => void;
    fillColor: string;
    setFillColor: (color: string) => void;
    fillEnabled: boolean;
    setFillEnabled: (enabled: boolean) => void;
    lineWidth: number;
    setLineWidth: (width: number) => void;
    opacity: number;
    setOpacity: (value: number) => void;
    dotSize: number;
    setDotSize: (size: number) => void;
    rectW: number;
    setRectW: (width: number) => void;
    rectH: number;
    setRectH: (height: number) => void;
    circleR: number;
    setCircleR: (radius: number) => void;
    fixedSize: boolean;
    setFixedSize: (fixed: boolean) => void;
    // —— 三角形几何（顶点/底/高/旋转）：选中三角形时编辑其几何，否则配置工具默认 ——
    triangleApex: number;
    setTriangleApex: (ratio: number) => void;
    triangleW: number;
    setTriangleW: (width: number) => void;
    triangleH: number;
    setTriangleH: (height: number) => void;
    triangleRotation: number;
    setTriangleRotation: (deg: number) => void;
    // —— 椭圆几何（rx/ry/旋转）：选中椭圆时编辑其几何，否则配置工具默认 ——
    ellipseRx: number;
    setEllipseRx: (rx: number) => void;
    ellipseRy: number;
    setEllipseRy: (ry: number) => void;
    ellipseRotation: number;
    setEllipseRotation: (deg: number) => void;
    // —— 多边形几何（边数/凹度/半径/旋转）：选中多边形时编辑其几何，否则配置工具默认 ——
    polygonSides: number;
    setPolygonSides: (sides: number) => void;
    polygonInnerRatio: number;
    setPolygonInnerRatio: (ratio: number) => void;
    polygonR: number;
    setPolygonR: (r: number) => void;
    polygonRotation: number;
    setPolygonRotation: (deg: number) => void;
    /**
     * 提交一次历史快照（仅选中态有意义）。
     * 样式/几何 setter 只实时改 shapes 不入栈；由属性控件在「改动完成」时
     * （滑块 onChangeComplete / 取色器 onChangeComplete / 开关与输入框 onChange）调用本方法入栈一次，
     * 避免拖滑块产生大量撤销步。
     */
    commitEditHistory: () => void;

    // —— 选中态（支持框选多选）——
    selectedIds: number[];
    selectedLabel: string | null;
    /** 单选时的图形类型（多选/未选为 null），供属性面板决定显示哪些几何控件 */
    readonly selectedShapeType: ShapeType | null;
    handleDeleteSelected: () => void;
    handleClearSelection: () => void;
    /** 反选：未选中↔已选中互换（空选=全选，全选=清空） */
    handleInvertSelection: () => void;
    readonly contextHitId: number | null;
    onContextMenu: (e: MouseEvent<HTMLCanvasElement>) => void;
    handleDeleteNode: () => void;

    // —— 派生 ——
    canUndo: boolean;
    canRedo: boolean;

    // —— 画布事件 ——
    onMouseDown: (e: MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;

    // —— 操作 ——
    handleUndo: () => void;
    handleRedo: () => void;
    handleClear: () => void;
    handleDownload: () => void;
}
