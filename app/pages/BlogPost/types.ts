/** 文章 frontmatter */
export interface PostFrontmatter {
    title: string;
    date: string;
    tags?: string[];
    category?: string;
}

/** 文章数据（由 virtual:post-map 动态加载） */
export interface PostData {
    frontmatter: PostFrontmatter;
    html: string;
}

/** 异步加载状态 */
export type LoadState =
    | { status: 'loading' }
    | { status: 'loaded'; post: PostData }
    | { status: 'notfound' };

/** 目录项 */
export interface TocItem {
    id: string;
    text: string;
    level: number;
}

/** blogIndex 条目元信息（仅取导航所需字段） */
export interface BlogIndexMeta {
    slug: string;
    title: string;
    date: string;
}

/** processHtml 返回 */
export interface ProcessedHtmlResult {
    html: string;
    tocItems: TocItem[];
}

/** 上一篇 / 下一篇 */
export interface PrevNext {
    prev: BlogIndexMeta | undefined;
    next: BlogIndexMeta | undefined;
}

/**
 * 文章页控制器：useBlogPost 的对外契约
 * 组件层只依赖此接口，不直接访问 hook 内部实现
 */
export interface BlogPostController {
    /** 路由参数 slug */
    slug: string | undefined;
    /** 异步加载状态 */
    state: LoadState;
    /** 是否展示返回顶部按钮 */
    showBackTop: boolean;
    /** 上一篇 */
    prev: BlogIndexMeta | undefined;
    /** 下一篇 */
    next: BlogIndexMeta | undefined;
    /** 处理后的 HTML（注入锚点 id），仅 loaded 时有效 */
    processedHtml: string;
    /** 提取的目录项，仅 loaded 时有效 */
    tocItems: TocItem[];
    /** 阅读时间（分钟），仅 loaded 时有效 */
    readingTime: number;
}
