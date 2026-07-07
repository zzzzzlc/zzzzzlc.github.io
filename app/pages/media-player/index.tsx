import { useRef, useState, useEffect, useCallback } from 'react';
import {
    Card, Typography, Segmented, Input, Upload, Button, Slider, Tooltip, message,
} from 'antd';
import type { UploadProps } from 'antd';
import {
    PlayCircleOutlined, PauseCircleOutlined, StepBackwardOutlined, StepForwardOutlined,
    SoundOutlined, AudioMutedOutlined, RetweetOutlined, FullscreenOutlined,
    FullscreenExitOutlined, CompressOutlined, CustomerServiceOutlined,
    VideoCameraOutlined, AudioOutlined, LinkOutlined, UploadOutlined, DeleteOutlined,
} from '@ant-design/icons';

type MediaType = 'video' | 'audio';

const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

// 秒数格式化为 m:ss 或 h:mm:ss
const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    const ss = s.toString().padStart(2, '0');
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss}`;
    return `${m}:${ss}`;
};

export default function MediaPlayer() {
    const [mode, setMode] = useState<MediaType>('video');
    const [src, setSrc] = useState<string | null>(null);
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
    const objectUrlRef = useRef<string | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekingRef = useRef(false);

    const video = videoRef.current;

    // 统一加载一个媒体源：释放旧的 object URL，重置播放状态
    const loadSource = useCallback((url: string, name: string) => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        setSrc(url);
        setFileName(name);
        setCurrent(0);
        setSeekValue(0);
        setDuration(0);
        setIsPlaying(false);
        // 等待元素挂载 src 后自动播放
        requestAnimationFrame(() => {
            const v = videoRef.current;
            if (!v) return;
            v.play().catch(() => {/* 自动播放被拦截时保持暂停 */});
        });
    }, []);

    // URL 加载
    const handleLoadUrl = (url: string) => {
        const trimmed = url.trim();
        if (!trimmed) {
            message.warning('请输入视频/音频地址');
            return;
        }
        loadSource(trimmed, trimmed.split('/').pop()?.split('?')[0] || '网络媒体');
    };

    // 本地文件上传
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

    const loadSample = (type: MediaType) => {
        setMode(type);
        loadSource(type === 'video' ? SAMPLE_VIDEO : SAMPLE_AUDIO, type === 'video' ? 'Big Buck Bunny（示例）' : 'SoundHelix Song 1（示例）');
    };

    const clearSource = () => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        setSrc(null);
        setFileName('');
        setIsPlaying(false);
        setCurrent(0);
        setDuration(0);
    };

    // 播放 / 暂停
    const togglePlay = useCallback(() => {
        const v = videoRef.current;
        if (!v || !src) return;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
    }, [src]);

    // 快退 / 快进
    const skip = (delta: number) => {
        const v = videoRef.current;
        if (!v || !src) return;
        v.currentTime = Math.min(Math.max(v.currentTime + delta, 0), v.duration || 0);
    };

    // 进度条：拖拽时仅更新预览，松手才真正 seek
    const onSliderChange = (value: number) => {
        if (!seekingRef.current) setSeeking(true);
        seekingRef.current = true;
        setSeekValue(value);
    };
    const onSliderComplete = (value: number) => {
        const v = videoRef.current;
        seekingRef.current = false;
        setSeeking(false);
        if (v) {
            v.currentTime = value;
            setCurrent(value);
        }
    };

    const onVolumeChange = (value: number) => {
        setVolume(value);
        if (value > 0 && muted) setMuted(false);
    };
    const toggleMute = () => setMuted(m => !m);

    const onRateChange = (r: number) => {
        setRate(r);
        if (videoRef.current) videoRef.current.playbackRate = r;
    };

    const toggleLoop = () => {
        const next = !loop;
        setLoop(next);
        if (videoRef.current) videoRef.current.loop = next;
    };

    // 全屏
    const toggleFullscreen = useCallback(async () => {
        const el = containerRef.current;
        if (!el) return;
        if (!document.fullscreenElement) {
            await el.requestFullscreen?.().catch(() => message.error('当前浏览器不支持全屏'));
        } else {
            await document.exitFullscreen?.().catch(() => {});
        }
    }, []);

    // 画中画
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
    }, []);

    // 控件自动隐藏（播放时鼠标静止 2.5s 后淡出）
    const revealControls = useCallback(() => {
        setShowControls(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (!videoRef.current?.paused) setShowControls(false);
        }, 2500);
    }, []);

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
    }, [src, volume, togglePlay, toggleFullscreen, revealControls]);

    // 监听全屏 / 画中画状态变化
    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        const onPipLeave = () => setPipActive(false);
        document.addEventListener('fullscreenchange', onFsChange);
        const v = videoRef.current;
        v?.addEventListener('enterpictureinpicture', () => setPipActive(true));
        v?.addEventListener('leavepictureinpicture', onPipLeave);
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            v?.removeEventListener('enterpictureinpicture', () => setPipActive(true));
            v?.removeEventListener('leavepictureinpicture', onPipLeave);
        };
    }, [src]);

    // 卸载时释放 object URL
    useEffect(() => {
        return () => {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, []);

    const sliderValue = seeking ? seekValue : current;
    const hasMedia = !!src;

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>
                <VideoCameraOutlined /> 影视频播放器
            </Typography.Title>

            {/* 加载区 */}
            <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <Segmented
                        value={mode}
                        onChange={(v) => setMode(v as MediaType)}
                        options={[
                            { label: <span><VideoCameraOutlined /> 视频</span>, value: 'video' },
                            { label: <span><AudioOutlined /> 音频</span>, value: 'audio' },
                        ]}
                    />
                    <Input.Search
                        placeholder="粘贴视频 / 音频直链 URL（mp4、webm、mp3、m4a…）"
                        enterButton={<><LinkOutlined /> 加载</>}
                        onSearch={handleLoadUrl}
                        style={{ flex: 1, minWidth: 260 }}
                        allowClear
                    />
                    <Upload accept="video/*,audio/*" showUploadList={false} beforeUpload={handleUpload}>
                        <Button icon={<UploadOutlined />}>本地文件</Button>
                    </Upload>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Typography.Text type="secondary" style={{ lineHeight: '32px' }}>内置示例：</Typography.Text>
                    <Button size="small" onClick={() => loadSample('video')}>示例视频</Button>
                    <Button size="small" onClick={() => loadSample('audio')}>示例音频</Button>
                    {hasMedia && (
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={clearSource}>清除</Button>
                    )}
                </div>
            </Card>

            {/* 播放器 */}
            <Card styles={{ body: { padding: 0, overflow: 'hidden' } }} style={{ marginBottom: 16 }}>
                <div
                    ref={containerRef}
                    onMouseMove={revealControls}
                    onMouseLeave={() => hasMedia && isPlaying && setShowControls(false)}
                    style={{
                        position: 'relative',
                        width: '100%',
                        minHeight: mode === 'audio' ? '40vh' : '62vh',
                        background: '#000',
                        cursor: hasMedia ? 'default' : 'default',
                    }}
                >
                    <video
                        ref={videoRef}
                        src={src ?? undefined}
                        style={{
                            width: '100%',
                            height: '100%',
                            display: mode === 'audio' ? 'none' : 'block',
                            objectFit: 'contain',
                        }}
                        onClick={togglePlay}
                        onPlay={() => { setIsPlaying(true); revealControls(); }}
                        onPause={() => { setIsPlaying(false); setShowControls(true); }}
                        onTimeUpdate={(e) => {
                            if (!seekingRef.current) setCurrent(e.currentTarget.currentTime);
                        }}
                        onLoadedMetadata={(e) => {
                            setDuration(e.currentTarget.duration);
                            e.currentTarget.playbackRate = rate;
                        }}
                        onEnded={() => { setIsPlaying(false); setShowControls(true); }}
                        onError={() => { if (src) message.error('媒体加载失败，请检查地址或跨域限制'); }}
                        playsInline
                    />

                    {/* 无媒体占位 */}
                    {!hasMedia && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            color: '#888', gap: 12,
                        }}>
                            <VideoCameraOutlined style={{ fontSize: 64 }} />
                            <Typography.Text style={{ color: '#888' }}>
                                输入 URL、上传文件或加载示例后开始播放
                            </Typography.Text>
                        </div>
                    )}

                    {/* 音频模式占位（带音波动画） */}
                    {hasMedia && mode === 'audio' && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', gap: 16, pointerEvents: 'none',
                            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                        }}>
                            <CustomerServiceOutlined
                                style={{ fontSize: 72, filter: 'drop-shadow(0 0 12px rgba(22,119,255,0.6))' }}
                                spin={isPlaying}
                            />
                            <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', maxWidth: '70%', textAlign: 'center' }} ellipsis>
                                {fileName || '音频播放中'}
                            </Typography.Text>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
                                {Array.from({ length: 16 }).map((_, i) => (
                                    <span
                                        key={i}
                                        style={{
                                            width: 3,
                                            height: isPlaying ? `${20 + ((i * 37) % 80)}%` : '20%',
                                            background: '#1677ff',
                                            borderRadius: 2,
                                            transition: 'height 0.3s ease',
                                            animation: isPlaying ? `eq 0.9s ${i * 0.06}s ease-in-out infinite alternate` : 'none',
                                        }}
                                    />
                                ))}
                            </div>
                            <style>{`@keyframes eq { from { transform: scaleY(0.4) } to { transform: scaleY(1) } }`}</style>
                        </div>
                    )}

                    {/* 自定义控件层 */}
                    {hasMedia && (
                        <div
                            style={{
                                position: 'absolute', left: 0, right: 0, bottom: 0,
                                padding: '10px 14px',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))',
                                opacity: showControls ? 1 : 0,
                                transition: 'opacity 0.25s ease',
                                pointerEvents: showControls ? 'auto' : 'none',
                            }}
                        >
                            {/* 进度条 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace', width: 52, textAlign: 'right' }}>
                                    {formatTime(sliderValue)}
                                </span>
                                <Slider
                                    value={sliderValue}
                                    max={duration || 0}
                                    min={0}
                                    step={0.1}
                                    tooltip={{ open: false }}
                                    onChange={onSliderChange}
                                    onChangeComplete={onSliderComplete}
                                    style={{ flex: 1, margin: 0 }}
                                />
                                <span style={{ color: '#bbb', fontSize: 12, fontFamily: 'monospace', width: 52 }}>
                                    {formatTime(duration)}
                                </span>
                            </div>

                            {/* 控制按钮 */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Tooltip title="快退 5s">
                                        <CtrlBtn icon={<StepBackwardOutlined />} onClick={() => skip(-5)} />
                                    </Tooltip>
                                    <Tooltip title={isPlaying ? '暂停 (k)' : '播放 (k)'}>
                                        <CtrlBtn
                                            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                                            onClick={togglePlay}
                                            style={{ fontSize: 30 }}
                                        />
                                    </Tooltip>
                                    <Tooltip title="快进 5s">
                                        <CtrlBtn icon={<StepForwardOutlined />} onClick={() => skip(5)} />
                                    </Tooltip>
                                    <span style={{ color: '#ddd', fontSize: 12, marginLeft: 8, fontFamily: 'monospace' }}>
                                        {formatTime(current)} / {formatTime(duration)}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {/* 音量 */}
                                    <Tooltip title={muted || volume === 0 ? '取消静音 (m)' : '静音 (m)'}>
                                        <CtrlBtn
                                            icon={muted || volume === 0 ? <AudioMutedOutlined /> : <SoundOutlined />}
                                            onClick={toggleMute}
                                        />
                                    </Tooltip>
                                    <Slider
                                        value={muted ? 0 : volume}
                                        min={0} max={1} step={0.01}
                                        tooltip={{ open: false }}
                                        onChange={onVolumeChange}
                                        style={{ width: 80, margin: '0 4px' }}
                                    />

                                    {/* 倍速 */}
                                    <Segmented
                                        size="small"
                                        value={rate}
                                        onChange={(v) => onRateChange(v as number)}
                                        options={RATE_OPTIONS.map(r => ({ label: `${r}x`, value: r }))}
                                    />

                                    <Tooltip title={loop ? '关闭循环' : '循环播放'}>
                                        <CtrlBtn
                                            icon={<RetweetOutlined />}
                                            onClick={toggleLoop}
                                            style={{ color: loop ? '#1677ff' : '#fff' }}
                                        />
                                    </Tooltip>

                                    {/* 画中画（仅视频且浏览器支持时） */}
                                    {mode === 'video' && (
                                        <Tooltip title={pipActive ? '退出画中画' : '画中画'}>
                                            <CtrlBtn
                                                icon={<CompressOutlined />}
                                                onClick={togglePip}
                                                style={{ color: pipActive ? '#1677ff' : '#fff' }}
                                            />
                                        </Tooltip>
                                    )}

                                    {/* 全屏 */}
                                    <Tooltip title={isFullscreen ? '退出全屏 (f)' : '全屏 (f)'}>
                                        <CtrlBtn
                                            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                                            onClick={toggleFullscreen}
                                        />
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* 快捷键说明 */}
            <Card size="small">
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    快捷键：空格 / K 播放暂停 · ← → 快退快进 5s · ↑ ↓ 音量 · M 静音 · F 全屏。音频文件由 video 元素承载播放，画中画仅在视频模式下可用。
                </Typography.Text>
            </Card>
        </div>
    );
}

/** 播放器控件按钮：白色图标、悬停高亮 */
function CtrlBtn({
    icon, onClick, style,
}: {
    icon: React.ReactNode;
    onClick: () => void;
    style?: React.CSSProperties;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 20,
                padding: '4px 6px',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'color 0.2s',
                ...style,
            }}
            onMouseEnter={(e) => { if (!style?.color) e.currentTarget.style.color = '#1677ff'; }}
            onMouseLeave={(e) => { if (!style?.color) e.currentTarget.style.color = '#fff'; }}
        >
            {icon}
        </button>
    );
}
