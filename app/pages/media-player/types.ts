import type { ReactEventHandler, RefObject } from 'react';
import type { UploadProps } from 'antd';

/** 媒体模式：视频 / 音频 */
export type MediaType = 'video' | 'audio';

/** 流类型：原生渐进式 / HLS / DASH */
export type StreamType = 'native' | 'hls' | 'dash';

/** 内置示例媒体种类 */
export type SampleKind = 'video' | 'audio' | 'hls' | 'dash';

/** video 元素事件处理器类型 */
export type VideoEventHandler = ReactEventHandler<HTMLVideoElement>;

/**
 * 播放器控制器：useMediaPlayer 的对外契约
 * 组件层只依赖此接口，不直接访问 hook 内部实现
 */
export interface MediaPlayerController {
    // —— 基础状态 ——
    mode: MediaType;
    src: string | null;
    fileName: string;
    streamType: StreamType;
    isPlaying: boolean;
    current: number;
    duration: number;
    volume: number;
    muted: boolean;
    rate: number;
    loop: boolean;
    isFullscreen: boolean;
    pipActive: boolean;
    showControls: boolean;

    // —— DOM 引用 ——
    containerRef: RefObject<HTMLDivElement | null>;
    videoRef: RefObject<HTMLVideoElement | null>;

    // —— 派生值 ——
    hasMedia: boolean;
    streamLabel: string | null;
    sliderValue: number;

    // —— 模式与源加载 ——
    setMode: (mode: MediaType) => void;
    handleLoadUrl: (url: string) => void;
    handleUpload: UploadProps['beforeUpload'];
    loadSample: (kind: SampleKind) => void;
    clearSource: () => void;

    // —— 播放控制 ——
    togglePlay: () => void;
    skip: (delta: number) => void;
    onSliderChange: (value: number) => void;
    onSliderComplete: (value: number) => void;
    onVolumeChange: (value: number) => void;
    toggleMute: () => void;
    onRateChange: (rate: number) => void;
    toggleLoop: () => void;
    toggleFullscreen: () => void;
    togglePip: () => void;

    // —— 控件显隐 ——
    revealControls: () => void;
    hideControls: () => void;

    // —— video 元素事件（由 hook 构造，组件直接透传）——
    onVideoPlay: VideoEventHandler;
    onVideoPause: VideoEventHandler;
    onVideoTimeUpdate: VideoEventHandler;
    onVideoLoadedMetadata: VideoEventHandler;
    onVideoEnded: VideoEventHandler;
    onVideoError: VideoEventHandler;
}
