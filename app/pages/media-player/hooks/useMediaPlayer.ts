import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { App } from 'antd';
import type { UploadProps } from 'antd';
import type { MediaPlayerController, MediaType, SampleKind } from '../types';
import { attachStream, type StreamEngine } from '../services/streamEngine';
import { detectStreamType, extractFileName, SAMPLE_SOURCES } from '../utils/stream';

/**
 * 媒体播放器核心逻辑聚合 hook：
 * 持有全部播放状态、DOM 引用与流引擎，对外暴露统一控制器
 */
export const useMediaPlayer = (): MediaPlayerController => {
    // 走 antd App 的 context 版本 message，以继承动态主题（替代静态 message.warning/error/success）
    const { message } = App.useApp();
    const [mode, setMode] = useState<MediaType>('video');
    const [src, setSrc] = useState<string | null>(null);
    const [streamType, setStreamType] = useState<MediaPlayerController['streamType']>('native');
    const [fileName, setFileName] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [rate, setRate] = useState(1);
    const [loop, setLoop] = useState(false);
    const [seeking, setSeeking] = useState(false);
    const [seekValue, setSeekValue] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [pipActive, setPipActive] = useState(false);
    const [showControls, setShowControls] = useState(true);

    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const engineRef = useRef<StreamEngine | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekingRef = useRef(false);

    // 销毁当前挂载的 HLS / DASH 实例
    const teardownStream = useCallback(() => {
        if (engineRef.current) {
            engineRef.current.destroy();
            engineRef.current = null;
        }
    }, []);

    // 统一加载一个媒体源：释放旧 objectURL、销毁旧流引擎，源挂载交给下方 effect
    const loadSource = useCallback((url: string, name: string) => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        teardownStream();
        setSrc(url);
        setFileName(name);
        setStreamType(detectStreamType(url));
        setCurrent(0);
        setSeekValue(0);
        setDuration(0);
        setIsPlaying(false);
    }, [teardownStream]);

    const handleLoadUrl = useCallback((url: string) => {
        const trimmed = url.trim();
        if (!trimmed) {
            message.warning('请输入视频/音频/流媒体地址');
            return;
        }
        const type = detectStreamType(trimmed);
        if (type !== 'native') setMode('video'); // m3u8/mpd 一定是视频流
        loadSource(trimmed, extractFileName(trimmed));
    }, [loadSource, message]);

    const handleUpload: UploadProps['beforeUpload'] = (file) => {
        if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
            message.error('仅支持视频或音频文件');
            return false;
        }
        // 根据文件类型自动切换模式
        setMode(file.type.startsWith('audio/') ? 'audio' : 'video');
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        loadSource(url, file.name);
        message.success(`已加载：${file.name}`);
        return false;
    };

    const loadSample = useCallback((kind: SampleKind) => {
        const sample = SAMPLE_SOURCES[kind];
        setMode(sample.mode);
        loadSource(sample.url, sample.name);
    }, [loadSource]);

    const clearSource = useCallback(() => {
        teardownStream();
        const v = videoRef.current;
        if (v) {
            v.pause();
            v.removeAttribute('src');
            v.load();
        }
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        setSrc(null);
        setFileName('');
        setIsPlaying(false);
        setCurrent(0);
        setDuration(0);
    }, [teardownStream]);

    // 核心：根据 src 与 streamType 把媒体挂到 video 元素上
    useEffect(() => {
        const v = videoRef.current;
        if (!v || !src) return;
        engineRef.current = attachStream(v, src, streamType, (msg) => message.error(msg));
        return () => {
            teardownStream();
        };
    }, [src, streamType, teardownStream, message]);

    // 音量 / 静音同步到 video 元素（修复：仅改 state 未同步，音量滑块原本不生效）
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        v.volume = volume;
        v.muted = muted;
    }, [volume, muted]);

    const togglePlay = useCallback(() => {
        const v = videoRef.current;
        if (!v || !src) return;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
    }, [src]);

    const skip = useCallback((delta: number) => {
        const v = videoRef.current;
        if (!v || !src) return;
        v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), v.duration || 0);
    }, [src]);

    // 进度条：拖拽时仅更新预览，松手才真正 seek
    const onSliderChange = useCallback((value: number) => {
        if (!seekingRef.current) setSeeking(true);
        seekingRef.current = true;
        setSeekValue(value);
    }, []);

    const onSliderComplete = useCallback((value: number) => {
        const v = videoRef.current;
        seekingRef.current = false;
        setSeeking(false);
        if (v) {
            v.currentTime = value;
            setCurrent(value);
        }
    }, []);

    const onVolumeChange = useCallback((value: number) => {
        setVolume(value);
        if (value > 0 && muted) setMuted(false);
    }, [muted]);

    const toggleMute = useCallback(() => setMuted(m => !m), []);

    const onRateChange = useCallback((r: number) => {
        setRate(r);
        if (videoRef.current) videoRef.current.playbackRate = r;
    }, []);

    const toggleLoop = useCallback(() => {
        setLoop(prev => {
            const next = !prev;
            if (videoRef.current) videoRef.current.loop = next;
            return next;
        });
    }, []);

    const toggleFullscreen = useCallback(async () => {
        const el = containerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
            await el.requestFullscreen?.().catch(() => message.error('当前浏览器不支持全屏'));
        } else {
            await document.exitFullscreen?.().catch(() => {});
        }
    }, [message]);

    const togglePip = useCallback(async () => {
        const v = videoRef.current;
        if (!v) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled) {
                await v.requestPictureInPicture();
            } else {
                message.warning('当前浏览器不支持画中画');
            }
        } catch {
            message.warning('画中画不可用，可能受媒体跨域限制');
        }
    }, [message]);

    // 控件自动隐藏（播放时鼠标静止 2.5s 后淡出）
    const revealControls = useCallback(() => {
        setShowControls(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (!videoRef.current?.paused) setShowControls(false);
        }, 2500);
    }, []);

    const hideControls = useCallback(() => setShowControls(false), []);

    // —— video 元素事件 ——
    const onVideoPlay = useCallback(() => {
        setIsPlaying(true);
        revealControls();
    }, [revealControls]);

    const onVideoPause = useCallback(() => {
        setIsPlaying(false);
        setShowControls(true);
    }, []);

    const onVideoTimeUpdate = useCallback((e: SyntheticEvent<HTMLVideoElement>) => {
        if (!seekingRef.current) setCurrent(e.currentTarget.currentTime);
    }, []);

    const onVideoLoadedMetadata = useCallback((e: SyntheticEvent<HTMLVideoElement>) => {
        setDuration(e.currentTarget.duration);
        e.currentTarget.playbackRate = rate;
    }, [rate]);

    const onVideoEnded = useCallback(() => {
        setIsPlaying(false);
        setShowControls(true);
    }, []);

    const onVideoError = useCallback(() => {
        if (src && streamType === 'native') {
            message.error('媒体加载失败，请检查地址或跨域限制');
        }
    }, [src, streamType, message]);

    // 键盘快捷键
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!src) return;
            const target = e.target as HTMLElement;
            if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    skip(-5);
                    break;
                case 'ArrowRight':
                    skip(5);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    onVolumeChange(Math.min(volume + 0.1, 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    onVolumeChange(Math.max(volume - 0.1, 0));
                    break;
                case 'm':
                    toggleMute();
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                default:
                    break;
            }
            revealControls();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [src, volume, togglePlay, skip, onVolumeChange, toggleMute, toggleFullscreen, revealControls]);

    // 监听全屏 / 画中画状态变化（PiP 事件未在当前 @types/react 中声明，改用 addEventListener）
    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        const onPipEnter = () => setPipActive(true);
        const onPipLeave = () => setPipActive(false);
        document.addEventListener('fullscreenchange', onFsChange);
        const v = videoRef.current;
        v?.addEventListener('enterpictureinpicture', onPipEnter);
        v?.addEventListener('leavepictureinpicture', onPipLeave);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            v?.removeEventListener('enterpictureinpicture', onPipEnter);
            v?.removeEventListener('leavepictureinpicture', onPipLeave);
        };
    }, []);

    // 卸载时释放资源：销毁流引擎、撤销 objectURL、清除计时器
    useEffect(() => {
        return () => {
            teardownStream();
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [teardownStream]);

    const sliderValue = seeking ? seekValue : current;
    const hasMedia = !!src;
    const streamLabel = streamType === 'native' ? null : streamType.toUpperCase();

    return {
        mode, setMode, src, fileName, streamType, isPlaying, current, duration,
        volume, muted, rate, loop, isFullscreen, pipActive, showControls,
        containerRef, videoRef, hasMedia, streamLabel, sliderValue,
        handleLoadUrl, handleUpload, loadSample, clearSource,
        togglePlay, skip, onSliderChange, onSliderComplete, onVolumeChange,
        toggleMute, onRateChange, toggleLoop, toggleFullscreen, togglePip,
        revealControls, hideControls,
        onVideoPlay, onVideoPause, onVideoTimeUpdate, onVideoLoadedMetadata,
        onVideoEnded, onVideoError,
    };
};
