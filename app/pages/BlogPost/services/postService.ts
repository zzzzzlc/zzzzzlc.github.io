import postMap from 'virtual:post-map';
import blogIndex from 'virtual:blog-index';
import type { BlogIndexMeta, PostData, PrevNext } from '../types';

/** 文章模块（动态 import 产物） */
export interface PostModule {
    default: PostData;
}

/**
 * 根据 slug 获取文章加载器；slug 为空或文章不存在时返回 undefined
 * 收口 virtual:post-map 数据源，组件层不直接访问
 */
export function getPostLoader(slug: string | undefined): (() => Promise<PostModule>) | undefined {
    return slug ? postMap[slug] : undefined;
}

/**
 * 根据 slug 在 blogIndex 中查找上一篇 / 下一篇
 * 收口 virtual:blog-index 数据源
 */
export function findPrevNext(slug: string | undefined): PrevNext {
    if (!slug) return { prev: undefined, next: undefined };
    const list = blogIndex as BlogIndexMeta[];
    const idx = list.findIndex(p => p.slug === slug);
    if (idx < 0) return { prev: undefined, next: undefined };
    return {
        prev: idx > 0 ? list[idx - 1] : undefined,
        next: idx < list.length - 1 ? list[idx + 1] : undefined,
    };
}
