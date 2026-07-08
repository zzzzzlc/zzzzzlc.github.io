import type { MediaType, SampleKind, StreamType } from '../types';

/** 倍速可选项 */
export const RATE_OPTIONS: number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** 内置示例媒体源配置 */
export const SAMPLE_SOURCES: Record<SampleKind, { url: string; name: string; mode: MediaType }> = {
    video: {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        name: 'Big Buck Bunny（示例视频）',
        mode: 'video',
    },
    audio: {
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        name: 'SoundHelix Song 1（示例音频）',
        mode: 'audio',
    },
    hls: {
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        name: 'Mux HLS 自适应码率测试流',
        mode: 'video',
    },
    dash: {
        url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
        name: 'Akamai Big Buck Bunny（DASH 测试流）',
        mode: 'video',
    },
};

/**
 * 依据后缀判断流类型：m3u8 -> HLS，mpd -> DASH，其余走原生
 */
export const detectStreamType = (url: string): StreamType => {
    const u = url.toLowerCase().split('?')[0];
    if (u.endsWith('.m3u8')) return 'hls';
    if (u.endsWith('.mpd')) return 'dash';
    return 'native';
};

/**
 * 从 URL 中提取末尾文件名作为展示名
 */
export const extractFileName = (url: string): string =>
    url.split('/').pop()?.split('?')[0] || '网络媒体';
