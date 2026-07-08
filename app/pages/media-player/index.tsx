import { Card, Typography } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import { useMediaPlayer } from './hooks/useMediaPlayer';
import { SourceLoader } from './components/SourceLoader';
import { PlayerStage } from './components/PlayerStage';

export default function MediaPlayerPage() {
    const player = useMediaPlayer();

    return (
        <div>
            <Typography.Title level={3} style={{ marginBottom: 16 }}>
                <VideoCameraOutlined /> 影视频播放器
            </Typography.Title>

            {/* 加载区 */}
            <SourceLoader player={player} />

            {/* 播放器 */}
            <Card styles={{ body: { padding: 0, overflow: 'hidden' } }} style={{ marginBottom: 16 }}>
                <PlayerStage player={player} />
            </Card>

            {/* 快捷键说明 */}
            <Card size="small">
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    支持渐进式下载（mp4/webm/mp3 等）、HLS（m3u8，hls.js + Safari 原生自适应码率）、DASH（mpd，dash.js）。快捷键：空格 / K 播放暂停 · ← → 快退快进 5s · ↑ ↓ 音量 · M 静音 · F 全屏。
                </Typography.Text>
            </Card>
        </div>
    );
}
