import type { CSSProperties } from 'react';
import { Button, Tooltip } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons';
import type { BlockPatch, PostBlock } from '../types';
import { BLOCK_TYPE_LABELS } from '../utils/constants';
import { BLOCK_EDITOR_REGISTRY } from './blockEditors';

interface BlockCardProps {
    index: number;
    total: number;
    block: PostBlock;
    /** 标题块按级别缩进，编辑时更贴近文章结构 */
    style?: CSSProperties;
    onUpdate: (index: number, patch: BlockPatch) => void;
    onMove: (index: number, direction: -1 | 1) => void;
    onRemove: (index: number) => void;
}

/** 单个内容块的外壳：类型标签 + 上移/下移/删除 + 具体类型编辑器 */
export const BlockCard = ({ index, total, block, style, onUpdate, onMove, onRemove }: BlockCardProps) => {
    const Editor = BLOCK_EDITOR_REGISTRY[block.type];
    return (
        <section className={`block-card block-card-${block.type}`} style={style}>
            <header className="block-card-head">
                <span className="block-type-tag">{BLOCK_TYPE_LABELS[block.type]}</span>
                {block.type === 'heading' && <span className="block-type-tag">H{block.level}</span>}
                <span className="block-card-actions">
                    <Tooltip title="上移">
                        <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => onMove(index, -1)} />
                    </Tooltip>
                    <Tooltip title="下移">
                        <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === total - 1} onClick={() => onMove(index, 1)} />
                    </Tooltip>
                    <Tooltip title="删除">
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(index)} />
                    </Tooltip>
                </span>
            </header>
            <div className="block-card-body">
                <Editor block={block} onChange={(patch) => onUpdate(index, patch)} />
            </div>
        </section>
    );
};
