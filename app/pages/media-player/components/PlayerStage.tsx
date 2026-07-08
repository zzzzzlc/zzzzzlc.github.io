import { Typography } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import type { MediaPlayerController } from '../types';
import { AudioPlaceholder } from './AudioPlaceholder';
import { PlayerControls } from './PlayerControls';

export interface PlayerStageProps {
    player: MediaPlayerController;
}

/** 播放器舞台：容器 + video 元素 + 流类型角标 + 占位 + 控件层 */
export function PlayerStage({ player }: PlayerStageProps) {
    const {
        mode, videoRef, containerRef, hasMedia, isPlaying,
        revealControls, hideControls, togglePlay, streamLabel,
        fileName, onVideoPlay, onVideoPause, onVideoTimeUpdate,
        onVideoLoadedMetadata, onVideoEnded, onVideoError,
    } = player;

    return (
        <div
            ref={containerRef}
            onMouseMove={revealControls}
            onMouseLeave={() => hasMedia && isPlaying && hideControls()}
            style={{
                position: 'relative',
                width: '100%',
                minHeight: mode === 'audio' ? '40vh' : '62vh',
                background: '#000',
            }}
        >
            <video
                ref={videoRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: mode === 'audio' ? 'none' : 'block',
                    objectFit: 'contain',
                }}
                onClick={togglePlay}
                onPlay={onVideoPlay}
                onPause={onVideoPause}
                onTimeUpdate={onVideoTimeUpdate}
                onLoadedMetadata={onVideoLoadedMetadata}
                onEnded={onVideoEnded}
                onError={onVideoError}
                playsInline
            />

            {/* 流类型角标 */}
            {hasMedia && streamLabel && (
                <div style={{
                    position: 'absolute', top: 10, left: 10,
                    padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(22,119,255,0.85)', color: '#fff',
                    fontSize: 11, fontWeight: 600, letterSpacing: 0.5, pointerEvents: 'none',
                }}>
                    {streamLabel}
                </div>
            )}

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
                <AudioPlaceholder isPlaying={isPlaying} fileName={fileName} />
            )}

            {/* 自定义控件层 */}
            {hasMedia && <PlayerControls player={player} />}
        </div>
    );
}
