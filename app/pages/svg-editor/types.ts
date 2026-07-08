/** SVG 示例条目 */
export interface SvgSample {
    label: string;
    code: string;
}

/** SVG 编辑器控制器：useSvgEditor 的对外契约 */
export interface SvgEditorController {
    code: string;
    setCode: (code: string) => void;
    svgError: string | null;
    handleCopy: () => void;
    handleDownload: () => void;
    handleReset: () => void;
}
