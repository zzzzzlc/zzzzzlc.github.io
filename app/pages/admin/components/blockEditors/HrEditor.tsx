import type { BlockEditorProps } from './index';

/** 分割线块编辑器：无字段，仅预览 */
export const HrEditor = ({ block }: BlockEditorProps) => {
    if (block.type !== 'hr') return null;
    return <div className="hr-preview" aria-hidden="true" />;
};
