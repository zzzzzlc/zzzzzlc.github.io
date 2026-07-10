import type { DrawStyle } from '../types';
import { rgbToHex } from './color';
import { polygonVertices, triangleVertices } from './shape';

/** 应用通用样式（颜色、线宽、透明度） */
export const applyStyle = (ctx: CanvasRenderingContext2D, style: DrawStyle): void => {
    ctx.globalAlpha = style.opacity / 100;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = style.lineWidth;
    ctx.strokeStyle = style.strokeColor;
    ctx.fillStyle = style.fillColor;
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

/** 绘制三角形：以 (cx, cy) 为包围盒中心，apexRatio 控制顶点横向位置（-1 左 ~ 1 右，0 等腰），rotation 绕中心顺时针旋转 */
export const drawTriangleByCenter = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    w: number,
    h: number,
    apexRatio: number,
    rotation: number,
    style: DrawStyle,
): void => {
    const [top, left, right] = triangleVertices(cx, cy, w, h, apexRatio, rotation);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
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

/** 绘制椭圆：以 (cx, cy) 为中心，rx/ry 为半轴，rotation 绕中心顺时针旋转（度）。半轴钳制 ≥0.1 防退化 */
export const drawEllipseByCenter = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotation: number,
    style: DrawStyle,
): void => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), (rotation * Math.PI) / 180, 0, Math.PI * 2);
    if (style.fillEnabled) ctx.fill();
    ctx.stroke();
};

/** 绘制正多边形/星形：以 (cx, cy) 为中心，r 外接半径，sides 顶点数，innerRatio 0=正多边形 >0=星形，rotation 绕中心顺时针（度） */
export const drawPolygonByCenter = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    sides: number,
    innerRatio: number,
    rotation: number,
    style: DrawStyle,
): void => {
    const verts = polygonVertices(cx, cy, r, sides, innerRatio, rotation);
    if (verts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i += 1) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    if (style.fillEnabled) ctx.fill();
    ctx.stroke();
};

/** 吸管取色：读取 (x, y) 单像素颜色并返回 hex */
export const pickColor = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): string => {
    const px = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return rgbToHex(px[0], px[1], px[2]);
};
