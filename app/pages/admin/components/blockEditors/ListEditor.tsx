import { Button, Input, InputNumber, Radio } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { BlockEditorProps } from './index';

/** 列表块编辑器：有序/无序切换 + 起始编号 + 列表项增删移动 */
export const ListEditor = ({ block, onChange }: BlockEditorProps) => {
    if (block.type !== 'list') return null;

    const setItem = (index: number, text: string) =>
        onChange({ items: block.items.map((item, i) => (i === index ? text : item)) });
    const addItem = () => onChange({ items: [...block.items, ''] });
    const removeItem = (index: number) =>
        onChange({ items: block.items.filter((_, i) => i !== index) });
    const moveItem = (index: number, direction: -1 | 1) =>
        onChange({
            items: block.items.map((item, i) => {
                if (i === index) return block.items[index + direction];
                if (i === index + direction) return block.items[index];
                return item;
            }),
        });

    return (
        <div className="block-editor-stack">
            <div className="block-editor-row">
                <Radio.Group
                    size="small"
                    value={block.ordered ? 'ordered' : 'bullet'}
                    onChange={(e) => onChange({ ordered: e.target.value === 'ordered' })}
                    options={[
                        { value: 'bullet', label: '无序' },
                        { value: 'ordered', label: '有序' },
                    ]}
                />
                {block.ordered && (
                    <label className="list-start">
                        起始编号
                        <InputNumber
                            size="small"
                            min={1}
                            value={block.start}
                            onChange={(v) => onChange({ start: v ?? 1 })}
                        />
                    </label>
                )}
            </div>
            {block.items.map((item, i) => (
                <div key={i} className="block-editor-row list-item-row">
                    <span className="list-marker">{block.ordered ? `${block.start + i}.` : '•'}</span>
                    <Input
                        value={item}
                        placeholder="列表项"
                        onChange={(e) => setItem(i, e.target.value)}
                    />
                    <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => moveItem(i, -1)} />
                    <Button
                        size="small"
                        type="text"
                        icon={<ArrowDownOutlined />}
                        disabled={i === block.items.length - 1}
                        onClick={() => moveItem(i, 1)}
                    />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(i)} />
                </div>
            ))}
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addItem} block>
                添加列表项
            </Button>
        </div>
    );
};
