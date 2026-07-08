/**
 * 秒数格式化为 m:ss 或 h:mm:ss
 * 非有限数或负数返回 '0:00'
 */
export const formatTime = (sec: number): string => {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    const ss = s.toString().padStart(2, '0');
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss}`;
    return `${m}:${ss}`;
};
