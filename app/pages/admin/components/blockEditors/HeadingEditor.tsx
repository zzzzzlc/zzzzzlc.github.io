import { Input, Select } from 'antd';
import type { HeadingBlock } from '../../types';
import type { BlockEditorProps } from './index';

const LEVEL_OPTIONS: Array<{ value: HeadingBlock['level']; label: string }> = [1, 2, 3, 4, 5, 6].map(
    (n) => ({ value: n as HeadingBlock['level'], label: `H${n}` }),
);

/** 标题块编辑器：级别选择 + 标题文字 */
export const HeadingEditor = ({ block, onChange }: BlockEditorProps) => {
    if (block.type !== 'heading') return null;
    return (
        <div className="block-editor-row">
            <Select<HeadingBlock['level']>
                size="small"
                value={block.level}
                options={LEVEL_OPTIONS}
                onChange={(level) => onChange({ level })}
                className="block-level-select"
            />
            <Input
                value={block.text}
                placeholder="标题文字（支持行内 md 语法）"
                onChange={(e) => onChange({ text: e.target.value })}
            />
        </div>
    );
};
