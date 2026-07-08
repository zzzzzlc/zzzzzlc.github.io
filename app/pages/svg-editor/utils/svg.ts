/**
 * 解析 SVG 代码，返回语法错误文本（无错返回 null）
 * 使用 DOMParser 解析 image/svg+xml，捕获 parsererror 节点
 */
export const parseSvgError = (code: string): string | null => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(code, 'image/svg+xml');
        const errNode = doc.querySelector('parsererror');
        return errNode ? errNode.textContent : null;
    } catch {
        return null;
    }
};
