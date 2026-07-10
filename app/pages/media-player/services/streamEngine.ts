import Hls from 'hls.js';
import { MediaPlayer } from 'dashjs';
import type { StreamType } from '../types';

/**
 * 流引擎句柄：持有当前挂载的 HLS / DASH 实例，提供统一销毁入口
 * native 类型 destroy 为空操作（靠下一次 src 赋值覆盖）
 */
export interface StreamEngine {
    readonly type: StreamType;
    destroy: () => void;
}


type ErrorHandler = (message: string) => void;

async function createPlayer(type: "hls" | "dash") {
    if (type === "hls") {
        const { default: Hls } = await import("hls.js");
        return new Hls();
    }

    if (type === "dash") {
        const dashjs = await import("dashjs");
        return dashjs.MediaPlayer().create();
    }
}

/**
 * 统一挂载媒体源到 video 元素：
 * - native：直接设 src
 * - hls：Safari 走原生，其余走 hls.js
 * - dash：走 dash.js
 *
 * 引擎创建与销毁在此收口，组件/hook 不直接 new Hls / dashjs
 */
export const attachStream = (
    video: HTMLVideoElement,
    src: string,
    streamType: StreamType,
    onError: ErrorHandler,
): StreamEngine | null => {
    if (streamType === 'hls') {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari 原生 HLS
            video.src = src;
            video.play().catch(() => {});
            return { type: 'hls', destroy: () => {} };
        }
        if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
            hls.on(Hls.Events.ERROR, (_evt, data) => {
                if (data.fatal) {
                    onError(`HLS 致命错误（${data.type}），请检查地址或网络`);
                }
            });
            return { type: 'hls', destroy: () => hls.destroy() };
        }
        onError('当前浏览器不支持 HLS 播放');
        return null;
    }

    if (streamType === 'dash') {
        const player = MediaPlayer().create();
        player.initialize(video, src, false);
        player.on(MediaPlayer.events.STREAM_INITIALIZED, () => video.play().catch(() => {}));
        player.on(MediaPlayer.events.ERROR, () => {
            onError('DASH 流初始化失败，请检查地址或网络');
        });
        return { type: 'dash', destroy: () => player.reset() };
    }

    // 原生渐进式下载
    video.src = src;
    video.play().catch(() => {});
    return { type: 'native', destroy: () => {} };
};
