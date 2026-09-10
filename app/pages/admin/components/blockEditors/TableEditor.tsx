import { Button, Input, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { BlockEditorProps } from './index';
import { cellToDisplay, displayToCell, rebuildDelimiter } from '../../utils/mdBlocks';

/**
 * 表格块编辑器：表头 + 数据行网格，行列增删。
 * 单元格输入用「非受控 + onBlur 提交」（key 含 block.id）：
 * 存储的是原始单元格（含对齐空格与 \| 转义），受控转换会导致光标跳动。
 */
export const TableEditor = ({ block, onChange }: BlockEditorProps) => {
    if (block.type !== 'table') return null;
    const cols = block.header.length;

    const commitHeader = (c: number, text: string) =>
        onChange({ header: block.header.map((cell, i) => (i === c ? displayToCell(text) : cell)) });
    const commitCell = (r: number, c: number, text: string) =>
        onChange({
            rows: block.rows.map((row, ri) =>
                ri === r ? row.map((cell, ci) => (ci === c ? displayToCell(text) : cell)) : row,
            ),
        });
    const addRow = () => onChange({ rows: [...block.rows, block.header.map(() => ' ')] });
    const removeRow = (r: number) => onChange({ rows: block.rows.filter((_, ri) => ri !== r) });
    const addCol = () =>
        onChange({
            header: [...block.header, ' '],
            rows: block.rows.map((row) => [...row, ' ']),
            delimiter: rebuildDelimiter(block.delimiter, cols + 1),
        });
    const removeCol = (c: number) => {
        if (cols <= 1) return;
        onChange({
            header: block.header.filter((_, ci) => ci !== c),
            rows: block.rows.map((row) => row.filter((_, ci) => ci !== c)),
            delimiter: rebuildDelimiter(block.delimiter, cols - 1),
        });
    };

    return (
        <div className="block-editor-stack table-editor">
            <div className="table-grid-row table-head-row">
                {block.header.map((cell, c) => (
                    <div key={`${block.id}-h-${c}`} className="table-cell">
                        <Input
                            size="small"
                            defaultValue={cellToDisplay(cell)}
                            placeholder="表头"
                            onBlur={(e) => commitHeader(c, e.target.value)}
                        />
                        <Tooltip title="删除此列">
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeCol(c)} />
                        </Tooltip>
                    </div>
                ))}
            </div>
            {block.rows.map((row, r) => (
                <div key={`${block.id}-r-${r}`} className="table-grid-row">
                    {row.map((cell, c) => (
                        <Input
                            key={`${block.id}-${r}-${c}`}
                            size="small"
                            defaultValue={cellToDisplay(cell)}
                            onBlur={(e) => commitCell(r, c, e.target.value)}
                        />
                    ))}
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(r)} />
                </div>
            ))}
            <div className="block-editor-row">
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addRow}>
                    加行
                </Button>
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addCol}>
                    加列
                </Button>
                <span className="block-editor-hint">单元格内的 | 会自动转义；Tab 切换单元格后失焦生效</span>
            </div>
        </div>
    );
};
