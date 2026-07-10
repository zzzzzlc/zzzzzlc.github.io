import type { Point, Rect, Shape } from '../types';

/** 深拷贝 shapes 数组（历史快照用，Shape 为纯数据） */
export const cloneShapes = (shapes: Shape[]): Shape[] => shapes.map((s) => structuredClone(s));

/**
 * 三角形三顶点（统一来源，draw/hittest/boundingBox 共用，避免重复推导）。
 * apexRatio: -1=顶点落在底边左端, 0=顶点居中(等腰), 1=落在底边右端。
 * rotation: 绕中心 (cx,cy) 顺时针旋转角度（度；canvas y 轴向下，故正值=画面顺时针）。
 * 返回顺序：[顶点, 底左, 底右]（已应用旋转，世界坐标）
 */
export const triangleVertices = (
    cx: number,
    cy: number,
    w: number,
    h: number,
    apexRatio: number,
    rotation = 0,
): [Point, Point, Point] => {
    // 局部坐标（以中心为原点，rotation=0 时顶点朝上）
    const local: [Point, Point, Point] = [
        { x: (apexRatio * w) / 2, y: -h / 2 },
        { x: -w / 2, y: h / 2 },
        { x: w / 2, y: h / 2 },
    ];
    if (rotation === 0) {
        return [
            { x: cx + local[0].x, y: cy + local[0].y },
            { x: cx + local[1].x, y: cy + local[1].y },
            { x: cx + local[2].x, y: cy + local[2].y },
        ];
    }
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rotate = (p: Point): Point => ({
        x: cx + p.x * cos - p.y * sin,
        y: cy + p.x * sin + p.y * cos,
    });
    return [rotate(local[0]), rotate(local[1]), rotate(local[2])];
};

/**
 * 正多边形 / 星形顶点（draw/hittest/boundingBox 共用）。
 * - innerRatio = 0：正多边形，sides 个顶点均匀分布在外接圆上。
 * - innerRatio > 0：星形，2*sides 个顶点在外/内圆上交替（内顶点半径 = r·innerRatio）。
 * rotation：绕中心顺时针旋转角度（度；canvas y 轴向下，故正值=画面顺时针，与 triangle 约定一致）。
 * 起始角 -π/2 使 rotation=0 时首个(外)顶点朝上。
 */
export const polygonVertices = (
    cx: number,
    cy: number,
    r: number,
    sides: number,
    innerRatio: number,
    rotation = 0,
): Point[] => {
    const isStar = innerRatio > 0;
    const count = isStar ? sides * 2 : sides;
    const step = (Math.PI * 2) / count;
    const base = -Math.PI / 2 + (rotation * Math.PI) / 180;
    const verts: Point[] = [];
    for (let i = 0; i < count; i += 1) {
        const inner = isStar && i % 2 === 1;
        const radius = inner ? r * innerRatio : r;
        const a = base + i * step;
        verts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
    }
    return verts;
};

/** 顶点位置 → 中文标签（属性面板展示用）：0=中，负=左 N%，正=右 N% */
export const apexRatioLabel = (ratio: number): string => {
    if (Math.abs(ratio) < 0.005) return '中';
    const pct = Math.round(Math.abs(ratio) * 100);
    return ratio < 0 ? `左 ${pct}%` : `右 ${pct}%`;
};

/** 两矩形是否相交（框选命中用） */
export const isRectIntersect = (a: Rect, b: Rect): boolean =>
    !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);

/** 各类型 shape 的轴对齐包围盒（选中框 / hit-test 辅助） */
export const boundingBox = (shape: Shape): Rect => {
    switch (shape.type) {
        case 'dot': {
            const r = shape.size / 2;
            return { x: shape.x - r, y: shape.y - r, w: shape.size, h: shape.size };
        }
        case 'rect':
            return { x: shape.cx - shape.w / 2, y: shape.cy - shape.h / 2, w: shape.w, h: shape.h };
        case 'triangle': {
            // 旋转后包围盒为三顶点的轴对齐外接框
            const [a, b, c] = triangleVertices(shape.cx, shape.cy, shape.w, shape.h, shape.apexRatio, shape.rotation);
            const xs = [a.x, b.x, c.x];
            const ys = [a.y, b.y, c.y];
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
        }
        case 'circle':
            return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 };
        case 'ellipse': {
            if (shape.rotation === 0) {
                return { x: shape.cx - shape.rx, y: shape.cy - shape.ry, w: shape.rx * 2, h: shape.ry * 2 };
            }
            // 旋转椭圆的精确轴对齐外接框
            const rad = (shape.rotation * Math.PI) / 180;
            const cos = Math.abs(Math.cos(rad));
            const sin = Math.abs(Math.sin(rad));
            const w = 2 * Math.sqrt((shape.rx * cos) ** 2 + (shape.ry * sin) ** 2);
            const h = 2 * Math.sqrt((shape.rx * sin) ** 2 + (shape.ry * cos) ** 2);
            return { x: shape.cx - w / 2, y: shape.cy - h / 2, w, h };
        }
        case 'polygon': {
            const verts = polygonVertices(shape.cx, shape.cy, shape.r, shape.sides, shape.innerRatio, shape.rotation);
            const xs = verts.map((p) => p.x);
            const ys = verts.map((p) => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
        }
        case 'line': {
            const minX = Math.min(shape.start.x, shape.end.x);
            const minY = Math.min(shape.start.y, shape.end.y);
            return { x: minX, y: minY, w: Math.abs(shape.end.x - shape.start.x), h: Math.abs(shape.end.y - shape.start.y) };
        }
        case 'stroke': {
            const xs = shape.points.map((p) => p.x);
            const ys = shape.points.map((p) => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
        }
    }
};

/** 平移 shape（移动用），返回新 shape */
export const moveShape = (shape: Shape, dx: number, dy: number): Shape => {
    const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
    switch (shape.type) {
        case 'dot':
            return { ...shape, x: shape.x + dx, y: shape.y + dy };
        case 'rect':
        case 'triangle':
        case 'circle':
        case 'ellipse':
        case 'polygon':
            return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy };
        case 'line':
            return { ...shape, start: shift(shape.start), end: shift(shape.end) };
        case 'stroke':
            return { ...shape, points: shape.points.map(shift) };
    }
};

/** shape 中文类型名（选中提示用） */
export const shapeLabel = (shape: Shape): string => {
    const labels: Record<Shape['type'], string> = {
        dot: '点',
        stroke: '画笔',
        line: '直线',
        rect: '矩形',
        circle: '圆形',
        triangle: '三角形',
        ellipse: '椭圆',
        polygon: '多边形',
    };
    return labels[shape.type];
};
