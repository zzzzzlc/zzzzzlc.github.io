import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import type { BlogPostController, LoadState, PostData } from '../types';
import { calcReadingTime } from '../../../../component/blog/PostMeta';
import { findPrevNext, getPostLoader, type PostModule } from '../services/postService';
import { processHtml } from '../utils/processHtml';
import { SCROLL_THRESHOLD } from '../utils/constants';

/**
 * 文章页核心逻辑聚合 hook：
 * 异步加载文章、滚动监听、上一篇/下一篇、HTML 处理与阅读时间派生
 */
export const useBlogPost = (): BlogPostController => {
    const { slug } = useParams<{ slug: string }>();

    // —— 异步加载文章（收口于 postService）——
    const loader = useMemo(() => getPostLoader(slug), [slug]);
    const [state, setState] = useState<LoadState>(
        () => (loader ? { status: 'loading' } : { status: 'notfound' }),
    );
    // 记录已加载内容对应的 slug，用于 slug 切换时派生 loading 态
    const [loadedSlug, setLoadedSlug] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!loader) return;
        let cancelled = false;
        loader()
            .then((mod: PostModule) => {
                if (!cancelled) {
                    setLoadedSlug(slug);
                    setState({ status: 'loaded', post: mod.default });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLoadedSlug(slug);
                    setState({ status: 'notfound' });
                }
            });
        return () => { cancelled = true; };
    }, [loader, slug]);

    // —— 返回顶部按钮显隐 ——
    const [showBackTop, setShowBackTop] = useState(false);

    useEffect(() => {
        const onScroll = () => setShowBackTop(window.scrollY > SCROLL_THRESHOLD);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // —— 上一篇 / 下一篇 ——
    const { prev, next } = useMemo(() => findPrevNext(slug), [slug]);

    // —— 派生：仅在 loaded 时计算 ——
    const post: PostData | null = state.status === 'loaded' ? state.post : null;
    const processed = useMemo(
        () => (post ? processHtml(post.html) : { html: '', tocItems: [] }),
        [post],
    );
    const readingTime = useMemo(
        () => (post ? calcReadingTime(post.html) : 0),
        [post],
    );

    // slug 切换后、新内容加载完成前视为 loading（避免保留旧文章内容）
    const effectiveState: LoadState = loadedSlug === slug
        ? state
        : { status: 'loading' };

    return {
        slug,
        state: effectiveState,
        showBackTop,
        prev,
        next,
        processedHtml: processed.html,
        tocItems: processed.tocItems,
        readingTime,
    };
};
