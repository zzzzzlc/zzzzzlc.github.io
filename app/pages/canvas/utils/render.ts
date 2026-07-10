import type { DrawStyle, Point, Rect, Shape } from '../types';
import { applyStyle, drawCircleByCenter, drawDot, drawEllipseByCenter, drawPolygonByCenter, drawRectByCenter, drawTriangleByCenter } from './draw';
import { boundingBox } from './shape';

/** 由 shape 派生绘制样式（dot 的 dotSize 取自 size） */
const shapeToStyle = (shape: Shape): DrawStyle => ({
    strokeColor: shape.strokeColor,
    fillColor: shape.fillColor,
    fillEnabled: shape.fillEnabled,
    lineWidth: shape.lineWidth,
    opacity: shape.opacity,
    dotSize: shape.type === 'dot' ? shape.size : 10,
});

/** 按 shape 类型渲染单个对象（复用 draw.ts 的几何函数） */
export const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape): void => {
    const style = shapeToStyle(shape);
    applyStyle(ctx, style);
    switch (shape.type) {
        case 'dot':
            drawDot(ctx, shape.x, shape.y, style);
            return;
        case 'rect':
            drawRectByCenter(ctx, shape.cx, shape.cy, shape.w, shape.h, style);
            return;
        case 'circle':
            drawCircleByCenter(ctx, shape.cx, shape.cy, shape.r, style);
            return;
        case 'triangle':
            drawTriangleByCenter(ctx, shape.cx, shape.cy, shape.w, shape.h, shape.apexRatio, shape.rotation, style);
            return;
        case 'ellipse':
            drawEllipseByCenter(ctx, shape.cx, shape.cy, shape.rx, shape.ry, shape.rotation, style);
            return;
        case 'polygon':
            drawPolygonByCenter(ctx, shape.cx, shape.cy, shape.r, shape.sides, shape.innerRatio, shape.rotation, style);
            return;
        case 'line':
            ctx.beginPath();
            ctx.moveTo(shape.start.x, shape.start.y);
            ctx.lineTo(shape.end.x, shape.end.y);
            ctx.stroke();
            return;
        case 'stroke': {
            const pts = shape.points;
            if (pts.length === 0) return;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke();
            return;
        }
    }
};

/** 选中可视化：虚线包围盒 + 四角锚点 */
export const drawSelection = (ctx: CanvasRenderingContext2D, shape: Shape): void => {
    const box = boundingBox(shape);
    const pad = 4;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#1677ff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2);
    ctx.setLineDash([]);
    ctx.fillStyle = '#1677ff';
    const corners: Point[] = [
        { x: box.x - pad, y: box.y - pad },
        { x: box.x + box.w + pad, y: box.y - pad },
        { x: box.x - pad, y: box.y + box.h + pad },
        { x: box.x + box.w + pad, y: box.y + box.h + pad },
    ];
    corners.forEach((c) => ctx.fillRect(c.x - 3, c.y - 3, 6, 6));
    ctx.restore();
};

/** 框选橡皮筋矩形（拖拽中的选择框） */
const drawSelectBox = (ctx: CanvasRenderingContext2D, box: Rect): void => {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(22,119,255,0.1)';
    ctx.strokeStyle = '#1677ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([]);
    ctx.restore();
};

export interface RedrawOptions {
    preview?: Shape | null;
    selectedIds?: number[];
    selectBox?: Rect | null;
}

/** 全量重绘：清白底 → shapes → 预览 → 选中框 → 选择框 */
export const redraw = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    shapes: Shape[],
    opts: RedrawOptions = {},
): void => {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    shapes.forEach((s) => drawShape(ctx, s));
    if (opts.preview) drawShape(ctx, opts.preview);
    if (opts.selectedIds && opts.selectedIds.length > 0) {
        const selSet = new Set(opts.selectedIds);
        shapes.forEach((s) => {
            if (selSet.has(s.id)) drawSelection(ctx, s);
        });
    }
    if (opts.selectBox && opts.selectBox.w > 0 && opts.selectBox.h > 0) {
        drawSelectBox(ctx, opts.selectBox);
    }
};
