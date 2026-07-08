import type { DrawStyle } from '../types';

/** 应用通用样式（颜色、线宽、透明度）；橡皮擦固定白色加粗 */
export const applyStyle = (
    ctx: CanvasRenderingContext2D,
    style: DrawStyle,
    isEraser = false,
): void => {
    ctx.globalAlpha = style.opacity / 100;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = isEraser ? style.lineWidth * 4 : style.lineWidth;
    ctx.strokeStyle = isEraser ? '#ffffff' : style.strokeColor;
    ctx.fillStyle = isEraser ? '#ffffff' : style.fillColor;
};

/** 在指定中心点绘制点 */
export const drawDot = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    style: DrawStyle,
): void => {
    ctx.beginPath();
    ctx.arc(x, y, style.dotSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = style.strokeColor;
    ctx.fill();
};

/** 绘制三角形：以 (cx, cy) 为中心，给定宽高 */
export const drawTriangleByCenter = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    style: DrawStyle,
): void => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx - w / 2, cy + h / 2);
    ctx.lineTo(cx + w / 2, cy + h / 2);
    ctx.closePath();
    if (style.fillEnabled) ctx.fill();
    ctx.stroke();
};

/** 绘制矩形：以 (cx, cy) 为中心 */
export const drawRectByCenter = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    style: DrawStyle,
): void => {
    ctx.beginPath();
    ctx.rect(cx - w / 2, cy - h / 2, w, h);
    if (style.fillEnabled) ctx.fill();
    ctx.stroke();
};

/** 绘制圆形：以 (cx, cy) 为中心，半径 r */
export const drawCircleByCenter = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    style: DrawStyle,
): void => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (style.fillEnabled) ctx.fill();
    ctx.stroke();
};
