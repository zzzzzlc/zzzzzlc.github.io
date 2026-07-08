import { useMemo, useState } from 'react';
import { message } from 'antd';
import type { SvgEditorController } from '../types';
import { DEFAULT_SVG } from '../utils/constants';
import { parseSvgError } from '../utils/svg';

/** SVG 编辑器核心逻辑：代码状态 + 错误解析 + 复制/下载/重置 */
export const useSvgEditor = (): SvgEditorController => {
    const [code, setCode] = useState(DEFAULT_SVG);

    const svgError = useMemo(() => parseSvgError(code), [code]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => message.success('已复制到剪贴板'));
    };

    const handleDownload = () => {
        const blob = new Blob([code], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'drawing.svg';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleReset = () => setCode(DEFAULT_SVG);

    return { code, setCode, svgError, handleCopy, handleDownload, handleReset };
};
