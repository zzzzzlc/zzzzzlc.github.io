import type { Point, Rect, Shape } from '../types';
import { boundingBox, isRectIntersect, polygonVertices, triangleVertices } from './shape';

/** 点到线段距离 */
const distToSegment = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/** 点是否在三角形内（叉积同号法）。直接接收三顶点，故对旋转后的三角形同样成立 */
const pointInTriangle = (p: Point, v1: Point, v2: Point, v3: Point): boolean => {
    const d1 = (p.x - v2.x) * (v1.y - v2.y) - (v1.x - v2.x) * (p.y - v2.y);
    const d2 = (p.x - v3.x) * (v2.y - v3.y) - (v2.x - v3.x) * (p.y - v3.y);
    const d3 = (p.x - v1.x) * (v3.y - v1.y) - (v3.x - v1.x) * (p.y - v1.y);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
};

/** 点是否在多边形内（even-odd 射线法）。接收任意顶点序列（含星形等凹多边形） */
const pointInPolygon = (p: Point, verts: Point[]): boolean => {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i, i += 1) {
        const xi = verts[i].x;
        const yi = verts[i].y;
        const xj = verts[j].x;
        const yj = verts[j].y;
        const intersect = (yi > p.y) !== (yj > p.y)
            && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
};

/**
 * 单个 shape 命中检测：点 (x,y) 是否落在对象上（含线宽容差）。
 * 填充对象命中内部；非填充对象命中边框附近。
 */
export const hitTest = (shape: Shape, x: number, y: number): boolean => {
    const tol = 6 + shape.lineWidth / 2;
    const p: Point = { x, y };
    switch (shape.type) {
        case 'dot':
            return Math.hypot(x - shape.x, y - shape.y) <= shape.size / 2 + tol;
        case 'rect': {
            const left = shape.cx - shape.w / 2;
            const right = shape.cx + shape.w / 2;
            const top = shape.cy - shape.h / 2;
            const bottom = shape.cy + shape.h / 2;
            if (shape.fillEnabled && x >= left && x <= right && y >= top && y <= bottom) return true;
            const onVertical = (Math.abs(x - left) <= tol || Math.abs(x - right) <= tol) && y >= top - tol && y <= bottom + tol;
            const onHorizontal = (Math.abs(y - top) <= tol || Math.abs(y - bottom) <= tol) && x >= left - tol && x <= right + tol;
            return onVertical || onHorizontal;
        }
        case 'circle': {
            const d = Math.hypot(x - shape.cx, y - shape.cy);
            if (shape.fillEnabled && d <= shape.r) return true;
            return Math.abs(d - shape.r) <= tol;
        }
        case 'triangle': {
            const [a, b, c] = triangleVertices(shape.cx, shape.cy, shape.w, shape.h, shape.apexRatio, shape.rotation);
            if (shape.fillEnabled && pointInTriangle(p, a, b, c)) return true;
            return distToSegment(p, a, b) <= tol || distToSegment(p, b, c) <= tol || distToSegment(p, c, a) <= tol;
        }
        case 'ellipse': {
            // 反旋转到椭圆局部系
            const rad = (-shape.rotation * Math.PI) / 180;
            const dx = x - shape.cx;
            const dy = y - shape.cy;
            const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
            const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
            const rx = Math.max(0.1, shape.rx);
            const ry = Math.max(0.1, shape.ry);
            const norm = (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry);
            if (shape.fillEnabled && norm <= 1) return true;
            // 描边命中：取该角度方向的椭圆边界点近似最近边界
            const theta = Math.atan2(ly, lx);
            const bx = rx * Math.cos(theta);
            const by = ry * Math.sin(theta);
            return Math.hypot(lx - bx, ly - by) <= tol;
        }
        case 'polygon': {
            const verts = polygonVertices(shape.cx, shape.cy, shape.r, shape.sides, shape.innerRatio, shape.rotation);
            if (shape.fillEnabled && pointInPolygon(p, verts)) return true;
            for (let i = 0; i < verts.length; i += 1) {
                if (distToSegment(p, verts[i], verts[(i + 1) % verts.length]) <= tol) return true;
            }
            return false;
        }
        case 'line':
            return distToSegment(p, shape.start, shape.end) <= tol;
        case 'stroke':
            return shape.points.some((pt, i) => i > 0 && distToSegment(p, shape.points[i - 1], pt) <= tol);
    }
};

/** 从顶层（数组末尾）到底层收集所有命中 shape（重叠点击用，取 [0] 即最上层） */
export const collectHitsAt = (shapes: Shape[], x: number, y: number): Shape[] =>
    [...shapes].reverse().filter((s) => hitTest(s, x, y));

/** 收集与选择框相交的所有 shape（框选多选用） */
export const collectInBox = (shapes: Shape[], box: Rect): Shape[] =>
    shapes.filter((s) => isRectIntersect(boundingBox(s), box));
