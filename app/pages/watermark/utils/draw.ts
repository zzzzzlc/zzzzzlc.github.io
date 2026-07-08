import type { WatermarkPosition, WatermarkStyle } from '../types';

/** 应用水印样式：透明度、颜色、字体、对齐 */
export const applyWatermarkStyle = (
    ctx: CanvasRenderingContext2D,
    style: WatermarkStyle,
): void => {
    ctx.globalAlpha = style.opacity;
    ctx.fillStyle = style.color;
    ctx.font = `bold ${style.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
};

/** 平铺水印：按 gap 网格化填满画布 */
export const drawTiledWatermark = (
    ctx: CanvasRenderingContext2D,
    style: WatermarkStyle,
    canvasWidth: number,
    canvasHeight: number,
): void => {
    const radians = (style.rotation * Math.PI) / 180;
    for (let y = -canvasHeight; y < canvasHeight * 2; y += style.gapY) {
        for (let x = -canvasWidth; x < canvasWidth * 2; x += style.gapX) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(radians);
            ctx.fillText(style.text, 0, 0);
            ctx.restore();
        }
    }
};

/** 定位水印：在指定位置绘制单条水印（center 保持画布中心） */
export const drawPositionedWatermark = (
    ctx: CanvasRenderingContext2D,
    style: WatermarkStyle,
    pos: WatermarkPosition,
    canvasWidth: number,
    canvasHeight: number,
): void => {
    const radians = (style.rotation * Math.PI) / 180;
    const padding = 40;
    let tx = canvasWidth / 2;
    let ty = canvasHeight / 2;

    if (pos === 'top-left') { tx = padding + 100; ty = padding + 20; }
    else if (pos === 'top-right') { tx = canvasWidth - padding - 100; ty = padding + 20; }
    else if (pos === 'bottom-left') { tx = padding + 100; ty = canvasHeight - padding - 20; }
    else if (pos === 'bottom-right') { tx = canvasWidth - padding - 100; ty = canvasHeight - padding - 20; }

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(radians);
    ctx.fillText(style.text, 0, 0);
    ctx.restore();
};

/**
 * 在图片上渲染水印，返回带水印的离屏 canvas
 * 纯函数：无 React / 状态依赖，给定 (img, style, pos) 输出确定
 */
export const renderWatermarkedCanvas = (
    img: HTMLImageElement,
    style: WatermarkStyle,
    pos: WatermarkPosition,
): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // 绘制原始图片
    ctx.drawImage(img, 0, 0);

    // 应用水印
    applyWatermarkStyle(ctx, style);
    if (pos === 'tile') {
        drawTiledWatermark(ctx, style, canvas.width, canvas.height);
    } else {
        drawPositionedWatermark(ctx, style, pos, canvas.width, canvas.height);
    }

    ctx.globalAlpha = 1;
    return canvas;
};
