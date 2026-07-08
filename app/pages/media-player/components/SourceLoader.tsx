import { Button, Card, Input, Segmented, Typography, Upload } from 'antd';
import {
    AudioOutlined, DeleteOutlined, LinkOutlined, UploadOutlined, VideoCameraOutlined,
} from '@ant-design/icons';
import type { MediaPlayerController, MediaType } from '../types';

export interface SourceLoaderProps {
    player: MediaPlayerController;
}

/** 媒体加载区：模式切换、URL 加载、本地文件上传、内置示例 */
export function SourceLoader({ player }: SourceLoaderProps) {
    const {
        mode, setMode, handleLoadUrl, handleUpload, loadSample, hasMedia, clearSource,
    } = player;

    return (
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
                    placeholder="粘贴媒体地址：mp4/webm/mp3，或流媒体 m3u8(HLS) / mpd(DASH)"
                    enterButton={<><LinkOutlined /> 加载</>}
                    onSearch={handleLoadUrl}
                    style={{ flex: 1, minWidth: 260 }}
                    allowClear
                />
                <Upload accept="video/*,audio/*" showUploadList={false} beforeUpload={handleUpload}>
                    <Button icon={<UploadOutlined />}>本地文件</Button>
                </Upload>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>内置示例：</Typography.Text>
                <Button size="small" onClick={() => loadSample('video')}>视频 (mp4)</Button>
                <Button size="small" onClick={() => loadSample('audio')}>音频 (mp3)</Button>
                <Button size="small" onClick={() => loadSample('hls')}>HLS 流 (m3u8)</Button>
                <Button size="small" onClick={() => loadSample('dash')}>DASH 流 (mpd)</Button>
                {hasMedia && (
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={clearSource}>清除</Button>
                )}
            </div>
        </Card>
    );
}
