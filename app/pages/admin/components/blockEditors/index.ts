/**
 * 块编辑器注册表：BlockType → 编辑组件。
 * 各编辑器内部用类型守卫收窄 block（`if (block.type !== 'x') return null`），
 * 保证无 any 的同时与统一的 BlockEditorProps 签名兼容。
 */
import type { ComponentType } from 'react';
import type { BlockPatch, BlockType, PostBlock } from '../../types';
import { HeadingEditor } from './HeadingEditor';
import { ParagraphEditor } from './ParagraphEditor';
import { CodeBlockEditor } from './CodeBlockEditor';
import { ListEditor } from './ListEditor';
import { QuoteEditor } from './QuoteEditor';
import { TableEditor } from './TableEditor';
import { HrEditor } from './HrEditor';
import { RawEditor } from './RawEditor';

export interface BlockEditorProps {
    block: PostBlock;
    onChange: (patch: BlockPatch) => void;
}

export const BLOCK_EDITOR_REGISTRY: Record<BlockType, ComponentType<BlockEditorProps>> = {
    heading: HeadingEditor,
    paragraph: ParagraphEditor,
    code: CodeBlockEditor,
    list: ListEditor,
    quote: QuoteEditor,
    table: TableEditor,
    hr: HrEditor,
    raw: RawEditor,
};
