import { Button, Dropdown } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { BlockPatch, BlockType, PostBlock } from '../types';
import { BLOCK_TYPE_OPTIONS } from '../utils/constants';
import { BlockCard } from './BlockCard';

interface BlocksEditorProps {
    blocks: PostBlock[];
    onInsert: (index: number, type: BlockType) => void;
    onRemove: (index: number) => void;
    onMove: (index: number, direction: -1 | 1) => void;
    onUpdate: (index: number, patch: BlockPatch) => void;
}

/** 内容块列表：块间/末尾可插入新块（按类型选择） */
export const BlocksEditor = ({ blocks, onInsert, onRemove, onMove, onUpdate }: BlocksEditorProps) => {
    const renderAddSlot = (index: number) => (
        <div key={`slot-${index}`} className="add-block-slot">
            <Dropdown
                menu={{
                    items: BLOCK_TYPE_OPTIONS.map((opt) => ({ key: opt.type, label: opt.label })),
                    onClick: ({ key }) => onInsert(index, key as BlockType),
                }}
                trigger={['click']}
            >
                <Button size="small" type="text" icon={<PlusOutlined />} className="add-block-btn">
                    插入块
                </Button>
            </Dropdown>
        </div>
    );

    return (
        <div className="blocks-editor">
            {renderAddSlot(0)}
            {blocks.map((block, i) => (
                <BlockCard
                    key={block.id}
                    index={i}
                    total={blocks.length}
                    block={block}
                    onUpdate={onUpdate}
                    onMove={onMove}
                    onRemove={onRemove}
                />
            ))}
            {renderAddSlot(blocks.length)}
        </div>
    );
};
