/**
 * 文章管理 API 服务层（唯一 fetch 出口，组件禁止直接请求）。
 * 走 vite dev proxy /api → server/posts-admin（本地）。
 */
import type { PostDetail, PostFormData, PostFrontmatter, PostSummary } from '../types';

const API_BASE = '/api/posts';

/** 服务端错误响应体 */
interface ErrorResponse {
    error: string;
}

/** 统一请求：非 2xx 抛 Error（message 为服务端 error 字段），错误上抛由调用方提示 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json();
    if (!res.ok) {
        const err = data as ErrorResponse;
        throw new Error(err.error ?? `请求失败（${res.status}）`);
    }
    return data as T;
}

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

/** 文章列表（含 draft，date 降序） */
export const listPosts = async (): Promise<PostSummary[]> => {
    const data = await request<{ posts: PostSummary[] }>(API_BASE);
    return data.posts;
};

/** 单篇文章（frontmatter + 原始正文） */
export const getPost = async (slug: string): Promise<PostDetail> => {
    const data = await request<{ post: PostDetail }>(`${API_BASE}/${encodeURIComponent(slug)}`);
    return data.post;
};

export interface SavePayload {
    frontmatter: PostFrontmatter;
    content: string;
}

/** 新建文章，返回最终 slug */
export const createPost = async (payload: SavePayload & { slug: string }): Promise<string> => {
    const data = await request<{ post: { slug: string } }>(API_BASE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    return data.post.slug;
};

/** 更新文章（slug 变化时携带 newSlug 完成改名），返回最终 slug */
export const updatePost = async (
    slug: string,
    payload: SavePayload & { newSlug?: string },
): Promise<string> => {
    const data = await request<{ post: { slug: string } }>(`${API_BASE}/${encodeURIComponent(slug)}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
    return data.post.slug;
};

/** 删除文章 */
export const deletePost = async (slug: string): Promise<void> => {
    await request<void>(`${API_BASE}/${encodeURIComponent(slug)}`, { method: 'DELETE' });
};

/** 表单值 → frontmatter（剥离 slug 字段） */
export const toFrontmatter = (form: PostFormData): PostFrontmatter => ({
    title: form.title,
    date: form.date,
    tags: form.tags,
    category: form.category,
    summary: form.summary,
    draft: form.draft,
});
