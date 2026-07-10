import { useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import type {
    WatermarkConfig, WatermarkController, WatermarkMode, WatermarkPosition, WatermarkProps,
} from '../types';
import { DEFAULT_CONFIG, WATERMARK_TILE_HEIGHT, WATERMARK_TILE_WIDTH } from '../utils/constants';
import { renderWatermarkedCanvas } from '../utils/draw';

/**
 * 水印工具核心逻辑聚合 hook：
 * 模式切换、配置状态、图片上传、预览渲染（canvas）、下载
 */
export const useWatermark = (): WatermarkController => {
    // 走 antd App 的 context 版本 message，以继承动态主题
    const { message } = App.useApp();
    const [mode, setMode] = useState<WatermarkMode>('page');
    const [config, setConfig] = useState<WatermarkConfig>({ ...DEFAULT_CONFIG });

    // 文件模式状态
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
    const [fileName, setFileName] = useState('');
    const [position, setPosition] = useState<WatermarkPosition>('tile');
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    const updateConfig = <K extends keyof WatermarkConfig>(key: K, value: WatermarkConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const handleReset = () => {
        setConfig({ ...DEFAULT_CONFIG });
        message.success('已重置为默认配置');
    };

    // --- 文件模式：图片上传 ---
    const handleImageUpload = (file: File) => {
        if (!file.type.startsWith('image/')) {
            message.error('请上传图片文件');
            return false;
        }

        const url = URL.createObjectURL(file);
        setImageUrl(url);
        setFileName(file.name);

        const img = new Image();
        img.onload = () => setImageEl(img);
        img.src = url;

        return false;
    };

    // --- 文件模式：预览渲染 ---
    // 依赖 config / position / imageEl / mode：参数变化即重绘 canvas
    useEffect(() => {
        if (mode !== 'file' || !imageEl || !previewCanvasRef.current) return;

        const previewCanvas = previewCanvasRef.current;
        const container = previewCanvas.parentElement;
        if (!container) return;

        const maxW = container.clientWidth;
        const maxH = 500;
        const scale = Math.min(maxW / imageEl.naturalWidth, maxH / imageEl.naturalHeight, 1);

        previewCanvas.width = imageEl.naturalWidth * scale;
        previewCanvas.height = imageEl.naturalHeight * scale;

        const watermarked = renderWatermarkedCanvas(imageEl, config, position);
        const ctx = previewCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(watermarked, 0, 0, previewCanvas.width, previewCanvas.height);
    }, [mode, imageEl, config, position]);

    // --- 清理对象 URL ---
    useEffect(() => {
        return () => {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
        };
    }, [imageUrl]);

    // --- antd Watermark props（由 config 派生） ---
    const watermarkProps: WatermarkProps = {
        content: [config.text],
        fontColor: config.color,
        fontSize: config.fontSize,
        rotate: (config.rotation * Math.PI) / 180,
        gap: [config.gapX, config.gapY] as [number, number],
        width: WATERMARK_TILE_WIDTH,
        height: WATERMARK_TILE_HEIGHT,
        movable: config.movable,
    };

    // --- 文件模式：下载 ---
    const handleDownload = () => {
        if (!imageEl) { message.warning('请先上传图片'); return; }

        const canvas = renderWatermarkedCanvas(imageEl, config, position);
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `watermarked_${fileName}`;
            a.click();
            URL.revokeObjectURL(url);
            message.success('下载成功');
        }, 'image/png');
    };

    return {
        previewCanvasRef, mode, setMode, config, updateConfig,
        position, setPosition, imageUrl, imageEl, fileName,
        watermarkProps, handleReset, handleImageUpload, handleDownload,
    };
};
