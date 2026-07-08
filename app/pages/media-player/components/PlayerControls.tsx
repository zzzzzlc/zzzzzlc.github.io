import { Segmented, Slider, Tooltip } from 'antd';
import {
    AudioMutedOutlined, CompressOutlined, FullscreenExitOutlined, FullscreenOutlined,
    PauseCircleOutlined, PlayCircleOutlined, RetweetOutlined, SoundOutlined,
    StepBackwardOutlined, StepForwardOutlined,
} from '@ant-design/icons';
import type { MediaPlayerController } from '../types';
import { formatTime } from '../utils/format';
import { RATE_OPTIONS } from '../utils/stream';
import { CtrlBtn } from './CtrlBtn';

export interface PlayerControlsProps {
    player: MediaPlayerController;
}

/** 自定义控件层：进度条 + 播放/音量/倍速/循环/画中画/全屏按钮 */
export function PlayerControls({ player }: PlayerControlsProps) {
    const {
        sliderValue, duration, current, onSliderChange, onSliderComplete,
        isPlaying, togglePlay, skip, muted, volume, onVolumeChange, toggleMute,
        rate, onRateChange, loop, toggleLoop, mode, pipActive, togglePip,
        isFullscreen, toggleFullscreen,
    } = player;

    return (
        <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: '10px 14px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))',
            opacity: player.showControls ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: player.showControls ? 'auto' : 'none',
        }}>
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
    );
}
