import { Input } from 'antd';
import type { BlockEditorProps } from './index';

/** 引用块编辑器：多行文本，每行序列化为 "> " 前缀 */
export const QuoteEditor = ({ block, onChange }: BlockEditorProps) => {
    if (block.type !== 'quote') return null;
    return (
        <Input.TextArea
            value={block.text}
            placeholder="引用内容（多行）"
            autoSize={{ minRows: 2, maxRows: 10 }}
            onChange={(e) => onChange({ text: e.target.value })}
        />
    );
};
