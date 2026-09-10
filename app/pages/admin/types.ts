/**
 * 文章管理页 —— 类型定义
 *
 * 注意：本文件必须保持「可擦除语法」（仅 interface/type，无运行时代码），
 * 因为 Node 验证脚本 server/posts-admin/roundtrip.mjs 会经由
 * utils/mdBlocks.ts 的 import type 间接依赖本文件的类型擦除能力。
 */

/* ============ 内容块模型 ============ */

export type BlockType =
    | 'heading'
    | 'paragraph'
    | 'code'
    | 'list'
    | 'quote'
    | 'table'
    | 'hr'
    | 'raw';

/**
 * 块基座。
 * gap：本块与上一块（首块则为文档起始）之间的空行数。
 * 0 = 与上一块紧邻（原文无空行），用于序列化时字节级还原原文。
 */
interface BlockBase {
    id: string;
    gap: number;
}

export interface HeadingBlock extends BlockBase {
    type: 'heading';
    level: 1 | 2 | 3 | 4 | 5 | 6;
    /** 行内 md 语法（加粗/链接等）原样保留 */
    text: string;
}

export interface ParagraphBlock extends BlockBase {
    type: 'paragraph';
    /** 源码软换行以 \n 保留；行内 md 语法原样保留 */
    text: string;
}

export interface CodeBlock extends BlockBase {
    type: 'code';
    lang: string;
    /** 围栏内部逐字内容，不含首尾换行 */
    content: string;
}

export interface ListBlock extends BlockBase {
    type: 'list';
    ordered: boolean;
    /** 有序列表首项编号（如原文从 3 开始编号则 start=3），无序时恒为 1 */
    start: number;
    items: string[];
}

export interface QuoteBlock extends BlockBase {
    type: 'quote';
    /** 多行引用以 \n 连接 */
    text: string;
}

export interface TableBlock extends BlockBase {
    type: 'table';
    /**
     * 单元格存储「原始文本」：保留原文对齐空格与 \| 转义，
     * 序列化时精确还原字节；编辑过的单元格由编辑器规范化。
     */
    header: string[];
    rows: string[][];
    /** 原文分隔行（如 "| --- | --- |"）逐字保留；增删列时由编辑器重建 */
    delimiter: string;
}

export interface HrBlock extends BlockBase {
    type: 'hr';
}

/** 兜底块：未识别构造（缩进内容/对齐表格等）逐行原样保留，保证无损往返 */
export interface RawBlock extends BlockBase {
    type: 'raw';
    lines: string[];
}

export type PostBlock =
    | HeadingBlock
    | ParagraphBlock
    | CodeBlock
    | ListBlock
    | QuoteBlock
    | TableBlock
    | HrBlock
    | RawBlock;

/* ============ 文章数据 ============ */

export interface PostFrontmatter {
    title: string;
    date: string;
    tags: string[];
    category: string;
    summary: string;
    draft: boolean;
}

export interface PostSummary extends PostFrontmatter {
    slug: string;
}

export interface PostDetail {
    slug: string;
    frontmatter: PostFrontmatter;
    /** 正文 md（服务端已剥离 frontmatter） */
    content: string;
}

/** frontmatter 编辑表单的值（含 slug 字段：新建必填，编辑时可改名） */
export interface PostFormData extends PostFrontmatter {
    slug: string;
}

export type SaveMode = 'closed' | 'create' | 'edit';

/* ============ 控制器 ============ */

/** 块内容变更补丁：按块类型收敛字段 */
export type BlockPatch = Partial<Pick<PostBlock, 'gap'>> &
    Partial<Omit<HeadingBlock, 'type' | 'id' | 'gap'>> &
    Partial<Omit<ParagraphBlock, 'type' | 'id' | 'gap'>> &
    Partial<Omit<CodeBlock, 'type' | 'id' | 'gap'>> &
    Partial<Omit<ListBlock, 'type' | 'id' | 'gap'>> &
    Partial<Omit<QuoteBlock, 'type' | 'id' | 'gap'>> &
    Partial<Omit<TableBlock, 'type' | 'id' | 'gap'>> &
    Partial<Omit<RawBlock, 'type' | 'id' | 'gap'>>;

export interface AdminPostsController {
    /* 列表状态 */
    posts: PostSummary[];
    loading: boolean;
    /** 服务未启动/请求失败时的提示文案；null 表示正常 */
    serverError: string | null;
    refresh: () => Promise<void>;
    /* 编辑器状态 */
    mode: SaveMode;
    activeSlug: string | null;
    formData: PostFormData;
    updateFormData: (patch: Partial<PostFormData>) => void;
    blocks: PostBlock[];
    dirty: boolean;
    saving: boolean;
    /* 编辑器操作 */
    selectPost: (slug: string) => Promise<void>;
    startCreate: () => void;
    closeEditor: () => void;
    insertBlock: (index: number, type: BlockType) => void;
    removeBlock: (index: number) => void;
    moveBlock: (index: number, direction: -1 | 1) => void;
    updateBlock: (index: number, patch: BlockPatch) => void;
    /* 持久化 */
    save: () => Promise<void>;
    /** 弹确认框后删除 */
    deletePost: (slug: string) => void;
}
