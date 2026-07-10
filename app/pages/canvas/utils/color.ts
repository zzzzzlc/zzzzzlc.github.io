/** 颜色转换工具：hex/rgb 互转，供绘制层的填充与取色纯函数复用 */

/** #rgb / #rrggbb → [r, g, b]；非法输入回退为黑色 */
export const hexToRgb = (hex: string): [number, number, number] => {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) {
        h = h
            .split('')
            .map((c) => c + c)
            .join('');
    }
    if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return [0, 0, 0];
    const num = Number.parseInt(h, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

/** [r, g, b] → #rrggbb，分量被钳制到 0–255 */
export const rgbToHex = (r: number, g: number, b: number): string => {
    const clamp = (v: number): number => Math.max(0, Math.min(255, Math.trunc(v)));
    const toHex = (v: number): string => clamp(v).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
