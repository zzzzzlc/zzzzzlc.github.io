import { Input, Tooltip } from 'antd';
import type { BlockEditorProps } from './index';

/** 兜底块编辑器：未识别构造（缩进内容/对齐表格等）按原文逐行保留 */
export const RawEditor = ({ block, onChange }: BlockEditorProps) => {
    if (block.type !== 'raw') return null;
    return (
        <div className="block-editor-stack raw-editor">
            <Input.TextArea
                className="mono-area"
                value={block.lines.join('\n')}
                placeholder="原文内容"
                autoSize={{ minRows: 2, maxRows: 16 }}
                onChange={(e) => onChange({ lines: e.target.value.split('\n') })}
            />
            <Tooltip title="该内容为未结构化识别的原文（如缩进代码、对齐表格），逐行原样保留以保证无损">
                <span className="block-editor-hint">未识别构造 · 原文保留</span>
            </Tooltip>
        </div>
    );
};
