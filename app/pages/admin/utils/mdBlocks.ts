/**
 * markdown ⇄ 内容块 双向转换（纯函数，零运行时 import）
 *
 * 设计契约：serializeBlocks(parseMarkdown(md)) === md（字节级）。
 * 实现手段：
 *  1. fence 永远最先判定 —— 围栏内的 ---/#/缩进等永不误判；
 *  2. 每块记录 gap（与上一块之间的空行数）—— 原文紧邻/多空行均精确还原；
 *  3. 表格单元格与分隔行存原始文本 —— 对齐空格逐字保留；
 *  4. 有序列表记录起始编号 —— 支持 "从 3 开始" 的编号；
 *  5. 未识别构造落入 raw 块逐行保留 —— 解析器是"全量的"。
 *
 * 注意：本文件不得引入任何运行时依赖（含枚举），
 * Node 验证脚本 roundtrip.mjs 会直接 import 本文件。
 */
import type {
    BlockType,
    CodeBlock,
    HeadingBlock,
    HrBlock,
    ListBlock,
    ParagraphBlock,
    PostBlock,
    QuoteBlock,
    RawBlock,
    TableBlock,
} from '../types';

export type MakeId = () => string;

/** 默认 id 工厂：自增计数器（确定性，供 Node 验证脚本使用） */
function createCounterId(): MakeId {
    let n = 0;
    return () => `b${n++}`;
}

/* ============ 识别规则（CommonMark 子集 + GFM 表格） ============ */

/** 开栏：``` 或 ~~~（≤3 空格缩进），info 字符串为语言 */
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
/** 闭栏：同字符、长度≥开栏、行内仅有围栏字符 */
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
/** ATX 标题（# 后有空格或行尾） */
const HEADING_RE = /^ {0,3}(#{1,6})(?: (.*))?$/;
/** 引用行前缀（含可选的一个空格；">" 裸行也匹配） */
const QUOTE_PREFIX_RE = /^ {0,3}> ?/;
/**
 * 列表项：`- ` 或 `N. `（标记后必须有空格，文本可为空）。
 * 仅匹配行首（0 缩进）——正文里 1~3 空格缩进的 "- " 是上一级的子列表，
 * 归入段落逐字保留，避免被提为顶层列表后丢失缩进、改变渲染层级。
 */
const LIST_LINE_RE = /^(?:- |(\d{1,9})\. )(.*)$/;
/** 主题分割线：--- /*** /___（同字符≥3 个） */
const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
/** 缩进内容（4 空格或 tab）→ raw 块 */
const INDENT_RE = /^(?: {4}|\t)/;

/** 表格分隔行：由 | : - 空格组成、至少一列（含对齐写法，由调用方降级 raw） */
function isTableDelimiter(line: string): boolean {
    const t = line.trim();
    if (!/^[|: -]+$/.test(t) || !t.includes('-') || !t.includes('|')) return false;
    return splitRowCells(t).every((cell) => /^:?-+:?$/.test(cell.trim()));
}

/** 按未转义 | 切分单元格，保留原始内部空格与 \| 转义 */
function splitRowCells(line: string): string[] {
    let t = line.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|')) t = t.slice(0, -1);
    return t.split(/(?<!\\)\|/);
}

/* ============ 解析 ============ */

export function parseMarkdown(content: string, makeId: MakeId = createCounterId()): PostBlock[] {
    const lines = content.replace(/\r\n?/g, '\n').split('\n');
    // 正文恰好以单个换行结尾 → split 产生的末尾空元素不参与解析
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    const blocks: PostBlock[] = [];
    let gap = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === '') {
            gap++;
            i++;
            continue;
        }
        const block = parseBlockAt(lines, i, makeId);
        block.gap = gap;
        gap = 0;
        blocks.push(block);
        i = consumeTo(lines, i, block);
    }
    return blocks;
}

/** 从行 i（非空行）开始识别一个块；消费行数由 consumeTo 依据块数据推算 */
function parseBlockAt(lines: string[], i: number, makeId: MakeId): PostBlock {
    const line = lines[i];

    // 1. 围栏最先判定
    const fence = line.match(FENCE_OPEN_RE);
    if (fence) return parseCode(lines, i, fence[1], fence[2].trim(), makeId);

    // 3. ATX 标题
    const heading = line.match(HEADING_RE);
    if (heading) {
        const block: HeadingBlock = {
            id: makeId(),
            gap: 0,
            type: 'heading',
            level: heading[1].length as HeadingBlock['level'],
            text: heading[2] ?? '',
        };
        return block;
    }

    // 4. 引用
    if (QUOTE_PREFIX_RE.test(line)) return parseQuote(lines, i, makeId);

    // 5. 表格（当前行含 | 且下一行是分隔行）
    if (line.includes('|') && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
        return parseTable(lines, i, makeId);
    }

    // 6. 列表
    if (LIST_LINE_RE.test(line)) return parseList(lines, i, makeId);

    // 7. 主题分割线
    if (HR_RE.test(line)) {
        const block: HrBlock = { id: makeId(), gap: 0, type: 'hr' };
        return block;
    }

    // 8. 缩进内容 → raw
    if (INDENT_RE.test(line)) return parseIndented(lines, i, makeId);

    // 9. 段落（吸收软换行与惰性续行）
    return parseParagraph(lines, i, makeId);
}

function parseCode(lines: string[], i: number, marker: string, lang: string, makeId: MakeId): CodeBlock {
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length) {
        const close = lines[j].match(FENCE_CLOSE_RE);
        if (close && close[1][0] === marker[0] && close[1].length >= marker.length) {
            j++; // 消费闭栏行
            break;
        }
        body.push(lines[j]);
        j++;
    }
    return { id: makeId(), gap: 0, type: 'code', lang, content: body.join('\n') };
}

function parseQuote(lines: string[], i: number, makeId: MakeId): QuoteBlock {
    const body: string[] = [];
    let j = i;
    while (j < lines.length && QUOTE_PREFIX_RE.test(lines[j])) {
        body.push(lines[j].replace(QUOTE_PREFIX_RE, ''));
        j++;
    }
    return { id: makeId(), gap: 0, type: 'quote', text: body.join('\n') };
}

function parseTable(lines: string[], i: number, makeId: MakeId): PostBlock {
    const delimiter = lines[i + 1];
    const rows: string[][] = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim() !== '' && lines[j].includes('|')) {
        rows.push(splitRowCells(lines[j]));
        j++;
    }
    // 对齐写法（:---:）不支持 → 整表降级 raw，逐行原样保留
    if (delimiter.includes(':')) {
        const rawLines = [lines[i], delimiter, ...lines.slice(i + 2, j)];
        return { id: makeId(), gap: 0, type: 'raw', lines: rawLines };
    }
    const block: TableBlock = {
        id: makeId(),
        gap: 0,
        type: 'table',
        header: splitRowCells(lines[i]),
        rows,
        delimiter,
    };
    return block;
}

function parseList(lines: string[], i: number, makeId: MakeId): ListBlock {
    const items: string[] = [];
    let ordered = false;
    let start = 1;
    let j = i;
    while (j < lines.length) {
        const m = lines[j].match(LIST_LINE_RE);
        if (!m) break;
        const isOrdered = m[1] !== undefined;
        if (j === i) {
            ordered = isOrdered;
            start = isOrdered ? Number(m[1]) : 1;
        } else if (isOrdered !== ordered) {
            break; // 有序/无序切换 → 另起一块
        }
        items.push(m[2]);
        j++;
    }
    return { id: makeId(), gap: 0, type: 'list', ordered, start, items };
}

function parseIndented(lines: string[], i: number, makeId: MakeId): RawBlock {
    const body: string[] = [];
    let j = i;
    while (j < lines.length && lines[j].trim() !== '' && INDENT_RE.test(lines[j])) {
        body.push(lines[j]);
        j++;
    }
    return { id: makeId(), gap: 0, type: 'raw', lines: body };
}

function parseParagraph(lines: string[], i: number, makeId: MakeId): ParagraphBlock {
    const body: string[] = [];
    let j = i;
    while (j < lines.length && lines[j].trim() !== '' && !isBlockStart(lines, j)) {
        body.push(lines[j]);
        j++;
    }
    return { id: makeId(), gap: 0, type: 'paragraph', text: body.join('\n') };
}

/** 行 j 是否为可中断段落的块起点（表格不中断段落，围栏/标题/引用/列表/分割线会） */
function isBlockStart(lines: string[], j: number): boolean {
    const line = lines[j];
    return (
        FENCE_OPEN_RE.test(line) ||
        HEADING_RE.test(line) ||
        QUOTE_PREFIX_RE.test(line) ||
        LIST_LINE_RE.test(line) ||
        HR_RE.test(line)
    );
}

/** 推算块在源码中占用的行数，返回下一块起始行号 */
function consumeTo(lines: string[], i: number, block: PostBlock): number {
    switch (block.type) {
        case 'heading':
        case 'hr':
            return i + 1;
        case 'paragraph':
            return i + 1 + block.text.split('\n').length - 1;
        case 'code':
            // 开栏 + 内容行数 + 闭栏（未闭合时到 EOF，body 已含全部行）
            return block.content === ''
                ? i + 2
                : i + 2 + block.content.split('\n').length;
        case 'quote':
            return i + block.text.split('\n').length;
        case 'list':
            return i + block.items.length;
        case 'table':
            return i + 2 + block.rows.length;
        case 'raw':
            return i + block.lines.length;
    }
}

/* ============ 序列化 ============ */

export function serializeBlocks(blocks: PostBlock[]): string {
    if (blocks.length === 0) return '';
    const out: string[] = [];
    for (const block of blocks) {
        for (let g = 0; g < block.gap; g++) out.push('');
        out.push(...blockToLines(block));
    }
    return out.join('\n') + '\n';
}

function blockToLines(block: PostBlock): string[] {
    switch (block.type) {
        case 'heading':
            return [`${'#'.repeat(block.level)}${block.text === '' ? '' : ' ' + block.text}`];
        case 'paragraph':
            return block.text.split('\n');
        case 'code':
            // 空代码块（开栏紧跟闭栏）不产出内容行；
            // 注：围栏内仅一个空行的极端形态会归一为空块（textarea 同样无法区分）
            return [
                '```' + block.lang,
                ...(block.content === '' ? [] : block.content.split('\n')),
                '```',
            ];
        case 'list':
            return block.items.flatMap((item, n) => {
                const [first, ...rest] = item.split('\n');
                const marker = block.ordered ? `${block.start + n}. ` : '- ';
                return [marker + first, ...rest];
            });
        case 'quote':
            return block.text.split('\n').map((l) => (l === '' ? '>' : '> ' + l));
        case 'table':
            return [
                '|' + block.header.join('|') + '|',
                block.delimiter,
                ...block.rows.map((row) => '|' + row.join('|') + '|'),
            ];
        case 'hr':
            return ['---'];
        case 'raw':
            return block.lines;
    }
}

/* ============ 编辑器辅助 ============ */

/** 新建块的默认值（gap=1：与上一块间隔一个空行） */
export function createBlock(type: BlockType, makeId: MakeId): PostBlock {
    const base = { id: makeId(), gap: 1 };
    switch (type) {
        case 'heading':
            return { ...base, type, level: 2, text: '' };
        case 'paragraph':
            return { ...base, type, text: '' };
        case 'code':
            return { ...base, type, lang: 'typescript', content: '' };
        case 'list':
            return { ...base, type, ordered: false, start: 1, items: [''] };
        case 'quote':
            return { ...base, type, text: '' };
        case 'table':
            return { ...base, type, header: [' ', ' '], rows: [[' ', ' ']], delimiter: makeDelimiter(2) };
        case 'hr':
            return { ...base, type };
        case 'raw':
            return { ...base, type, lines: [''] };
    }
}

/** 生成 n 列的标准分隔行 */
export function makeDelimiter(cols: number): string {
    return '|' + Array.from({ length: cols }, () => ' --- |').join('');
}

/** 原始单元格 → 展示文本（去首尾空格、还原 \|） */
export function cellToDisplay(raw: string): string {
    return raw.trim().replace(/\\\|/g, '|');
}

/** 展示文本 → 规范化原始单元格（首尾各一空格、转义 |） */
export function displayToCell(text: string): string {
    return ` ${text.replace(/\|/g, '\\|')} `;
}

/** 表格行列变动时按新列数重建分隔行（列数未变则保留原文） */
export function rebuildDelimiter(delimiter: string, cols: number): string {
    return splitRowCells(delimiter).length === cols ? delimiter : makeDelimiter(cols);
}
