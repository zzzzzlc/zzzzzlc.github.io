import type { MouseEvent, RefObject } from 'react';

/** 绘制工具 */
export type Tool = 'dot' | 'pen' | 'line' | 'rect' | 'circle' | 'triangle' | 'eraser';

/** 历史快照条目 */
export interface HistoryEntry {
    data: ImageData;
}

/** 平面坐标点 */
export interface Point {
    x: number;
    y: number;
}

/** 绘制样式：由画板状态派生，传给纯绘制函数 */
export interface DrawStyle {
    strokeColor: string;
    fillColor: string;
    fillEnabled: boolean;
    lineWidth: number;
    opacity: number;
    dotSize: number;
}

/**
 * 画板控制器：useCanvasDrawing 的对外契约
 * 组件层只依赖此接口
 */
export interface CanvasController {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    cursor: Point | null;

    // —— 工具与样式状态 ——
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
    setOpacity: (opacity: number) => void;
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
