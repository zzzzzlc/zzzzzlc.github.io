import type { RefObject } from 'react';

/** 水印模式 */
export type WatermarkMode = 'page' | 'file' | 'content';

/** 水印定位（文件模式） */
export type WatermarkPosition = 'tile' | 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/** 水印绘制样式：由 config 派生，传给纯绘制函数 */
export interface WatermarkStyle {
    text: string;
    fontSize: number;
    color: string;
    rotation: number;
    gapX: number;
    gapY: number;
    opacity: number;
}

/** 水印配置（用户可调） */
export interface WatermarkConfig extends WatermarkStyle {
    movable: boolean;
}

/** antd Watermark 组件所需 props（由 config 派生） */
export interface WatermarkProps {
    content: string[];
    fontColor: string;
    fontSize: number;
    rotate: number;
    gap: [number, number];
    width: number;
    height: number;
    movable: boolean;
}

/**
 * 水印控制器：useWatermark 的对外契约
 * 组件层只依赖此接口
 */
export interface WatermarkController {
    previewCanvasRef: RefObject<HTMLCanvasElement | null>;
    mode: WatermarkMode;
    setMode: (mode: WatermarkMode) => void;
    config: WatermarkConfig;
    updateConfig: <K extends keyof WatermarkConfig>(key: K, value: WatermarkConfig[K]) => void;
    position: WatermarkPosition;
    setPosition: (pos: WatermarkPosition) => void;
    imageUrl: string | null;
    imageEl: HTMLImageElement | null;
    fileName: string;
    watermarkProps: WatermarkProps;
    handleReset: () => void;
    handleImageUpload: (file: File) => boolean;
    handleDownload: () => void;
}
