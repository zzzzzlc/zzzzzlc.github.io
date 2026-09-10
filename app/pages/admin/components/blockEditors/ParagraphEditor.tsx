import { Input } from 'antd';
import type { BlockEditorProps } from './index';

/** 段落块编辑器：多行文本（软换行与行内 md 语法按原文保留） */
export const ParagraphEditor = ({ block, onChange }: BlockEditorProps) => {
    if (block.type !== 'paragraph') return null;
    return (
        <div className="block-editor-stack">
            <Input.TextArea
                value={block.text}
                placeholder="段落文字，行内 md 语法（**加粗**、`代码`、[链接](url)）原样保留"
                autoSize={{ minRows: 2, maxRows: 16 }}
                onChange={(e) => onChange({ text: e.target.value })}
            />
            <span className="block-editor-hint">换行 = 原文软换行；行内加粗/链接/代码语法原样保留</span>
        </div>
    );
};
