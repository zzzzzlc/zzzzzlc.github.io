import { CHARACTER_DEPTH, CHARACTER_MAX_EDGE, CHARACTER_SRC } from './constants';

/**
 * 角色图采样结果：positions / colors 已按 particleCount 分配完毕，
 * 直接写入 BufferGeometry 的 position / color attribute 即可。
 */
export interface CharacterSample {
    /** xyz 坐标，长度 = particleCount * 3 */
    positions: Float32Array;
    /** rgb(0..1) 颜色，长度 = particleCount * 3 */
    colors: Float32Array;
}

interface RawPoint {
    x: number;
    y: number;
    r: number;
    g: number;
    b: number;
}

/**
 * 加载 character.png 并采样其前景像素 → 粒子目标坐标 + 真实颜色。
 *
 * - 保持原图宽高比，最长边归一化到 CHARACTER_MAX_EDGE；
 * - 透明背景图走 alpha 判定，无透明通道退化到「与四角背景色差异」判定；
 * - 采样步长自适应，使前景点数 ≈ particleCount，保证细节区粒子密度；
 * - 颜色取自对应像素，让粒子拼出的角色保留原色（「包括颜色」）；
 * - 给 z 加小抖动形成 2.5D 厚度，配合轻微 y 轴摆动呈现立体感。
 *
 * 失败（加载失败 / CORS / 无前景）返回 null，调用方回退到球面态。
 */
export const sampleCharacter = (particleCount: number): Promise<CharacterSample | null> =>
    new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const sample = sampleImageElement(img, particleCount);
            resolve(sample);
        };
        img.onerror = () => resolve(null);
        img.src = CHARACTER_SRC;
    });

/** 从已加载的 ImageElement 采样前景像素为粒子坐标 + 颜色 */
const sampleImageElement = (img: HTMLImageElement, particleCount: number): CharacterSample | null => {
    const ow = img.naturalWidth || img.width;
    const oh = img.naturalHeight || img.height;
    const scale = CHARACTER_MAX_EDGE / Math.max(ow, oh);
    const w = Math.max(1, Math.round(ow * scale));
    const h = Math.max(1, Math.round(oh * scale));

    const cvs = document.createElement('canvas');
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    let data: Uint8ClampedArray;
    try {
        data = ctx.getImageData(0, 0, w, h).data;
    } catch {
        return null; // CORS 等异常
    }

    const corners = sampleCorners(data, w, h);
    const hasAlpha = detectAlphaUsage(data, w, h);

    const isFg = (x: number, y: number): boolean => {
        const i = (y * w + x) * 4;
        if (hasAlpha) return data[i + 3] > 128;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        for (const c of corners) {
            const dr = r - c[0], dg = g - c[1], db = b - c[2];
            if (dr * dr + dg * dg + db * db < 900) return false;
        }
        return true;
    };

    // 先粗扫估算前景比例 → 反推步长，使前景点数 ≈ particleCount
    const probeStep = 3;
    let fgCount = 0;
    for (let y = 0; y < h; y += probeStep) {
        for (let x = 0; x < w; x += probeStep) {
            if (isFg(x, y)) fgCount++;
        }
    }
    const totalProbed = Math.ceil(w / probeStep) * Math.ceil(h / probeStep);
    const fgRatio = fgCount / totalProbed;
    const step = Math.max(
        1,
        Math.round(Math.sqrt((w * h * fgRatio) / (particleCount * 1.2)) / probeStep) * probeStep,
    );

    const pts: RawPoint[] = [];
    for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
            if (!isFg(x, y)) continue;
            const i = (y * w + x) * 4;
            pts.push({
                x: x - w / 2,
                y: -(y - h / 2),
                r: data[i] / 255,
                g: data[i + 1] / 255,
                b: data[i + 2] / 255,
            });
        }
    }
    if (pts.length === 0) return null;

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const m = pts.length;
    for (let i = 0; i < particleCount; i++) {
        // 点多于粒子：均匀跨图采样；点少于粒子：循环复用全部点
        const k = m >= particleCount ? Math.floor((i / particleCount) * m) : i % m;
        const p = pts[k];
        const ix = i * 3;
        positions[ix] = p.x;
        positions[ix + 1] = p.y;
        positions[ix + 2] = (Math.random() - 0.5) * CHARACTER_DEPTH; // 2.5D 厚度
        colors[ix] = p.r;
        colors[ix + 1] = p.g;
        colors[ix + 2] = p.b;
    }
    return { positions, colors };
};

/** 取四角像素作为背景色样本（无透明通道时的前景判定基准） */
const sampleCorners = (data: Uint8ClampedArray, w: number, h: number): number[][] => {
    const corner = (cx: number, cy: number): number[] => {
        const i = (cy * w + cx) * 4;
        return [data[i], data[i + 1], data[i + 2]];
    };
    return [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)];
};

/** 网格采样若干点，判断图是否有效使用了透明背景 */
const detectAlphaUsage = (data: Uint8ClampedArray, w: number, h: number): boolean => {
    let lowAlpha = 0;
    const sx = Math.max(1, Math.floor(w / 50));
    const sy = Math.max(1, Math.floor(h / 50));
    for (let y = 0; y < h; y += sy) {
        for (let x = 0; x < w; x += sx) {
            if (data[(y * w + x) * 4 + 3] < 250) lowAlpha++;
        }
    }
    return lowAlpha > 3;
};
