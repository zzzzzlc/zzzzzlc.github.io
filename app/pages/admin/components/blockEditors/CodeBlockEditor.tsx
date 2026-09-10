import { AutoComplete, Input } from 'antd';
import { CODE_LANGUAGES } from '../../utils/constants';
import type { BlockEditorProps } from './index';

/** 代码块编辑器：语言（可搜可自由输入）+ 等宽编辑区 */
export const CodeBlockEditor = ({ block, onChange }: BlockEditorProps) => {
    if (block.type !== 'code') return null;
    return (
        <div className="block-editor-stack">
            <div className="block-editor-row">
                <AutoComplete
                    size="small"
                    value={block.lang}
                    options={CODE_LANGUAGES.map((l) => ({ value: l }))}
                    placeholder="语言"
                    filterOption={(input, option) =>
                        String(option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    onChange={(lang) => onChange({ lang })}
                    className="block-lang-select"
                />
            </div>
            <Input.TextArea
                className="mono-area"
                value={block.content}
                placeholder="代码内容"
                autoSize={{ minRows: 3, maxRows: 24 }}
                onChange={(e) => onChange({ content: e.target.value })}
            />
        </div>
    );
};
