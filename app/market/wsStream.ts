import { Observable, retry, timer } from 'rxjs';
import type { MarketMessage } from './types';
import { RECONNECT_BASE_DELAY, WS_URL } from './constants';

/**
 * 把 WebSocket 封装为冷 Observable，断线自动重连（retry + 定时退避）。
 * 订阅即连接，取消订阅即断开；页面卸载时由 hook 负责 unsubscribe。
 */
export const createMarketStream = (): Observable<MarketMessage> =>
    new Observable<MarketMessage>((subscriber) => {
        let socket: WebSocket | null = null;
        let closedByUs = false;
        const open = () => {
            socket = new WebSocket(WS_URL);
            socket.onmessage = (e) => {
                try {
                    subscriber.next(JSON.parse(e.data as string) as MarketMessage);
                } catch {
                    /* 非 JSON 报文忽略 */
                }
            };
            socket.onclose = () => {
                if (closedByUs) return;
                subscriber.error(new Error('socket closed'));
            };
            socket.onerror = () => {
                /* 错误由 onclose 兜底触发重连 */
            };
        };
        open();
        return () => {
            closedByUs = true;
            socket?.close();
        };
    }).pipe(retry({ delay: () => timer(RECONNECT_BASE_DELAY) }));
