import type { BlockType } from '../types';

/** 代码块语言建议项（按本站文章实测使用频率排序，支持自由输入） */
export const CODE_LANGUAGES: string[] = [
    'typescript',
    'javascript',
    'tsx',
    'jsx',
    'sql',
    'bash',
    'yaml',
    'python',
    'css',
    'scss',
    'vue',
    'json',
    'js',
    'html',
    'nginx',
    'dockerfile',
    'markdown',
    'ts',
    'java',
    'xml',
    'go',
    'csharp',
    'rust',
    'swift',
];

/** 块类型中文标签（raw 为未识别构造的兜底，不出现在添加菜单） */
export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
    heading: '标题',
    paragraph: '段落',
    code: '代码块',
    list: '列表',
    quote: '引用',
    table: '表格',
    hr: '分割线',
    raw: '原文',
};

/** 添加块菜单项 */
export const BLOCK_TYPE_OPTIONS: Array<{ type: BlockType; label: string }> = [
    { type: 'heading', label: BLOCK_TYPE_LABELS.heading },
    { type: 'paragraph', label: BLOCK_TYPE_LABELS.paragraph },
    { type: 'code', label: BLOCK_TYPE_LABELS.code },
    { type: 'list', label: BLOCK_TYPE_LABELS.list },
    { type: 'table', label: BLOCK_TYPE_LABELS.table },
    { type: 'quote', label: BLOCK_TYPE_LABELS.quote },
    { type: 'hr', label: BLOCK_TYPE_LABELS.hr },
];

/** 新建文章的默认 frontmatter（日期取当天） */
export const todayString = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
