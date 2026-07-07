import { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router';
import { Spin } from 'antd';
import postMap from 'virtual:post-map';
import blogIndex from 'virtual:blog-index';
import TopButton from '@components/TopButton';
import GobackButton from '@components/GobackButton';
import TableOfContents from '@components/TableOfContents';
import PageContainer from '../../../component/blog/PageContainer';
import BlogTag from '../../../component/blog/BlogTag';
import ReadingProgress from '../../../component/blog/ReadingProgress';
import PostMeta, { calcReadingTime } from '../../../component/blog/PostMeta';
import AuthorBio from '../../../component/blog/AuthorBio';
import PrevNextNav from '../../../component/blog/PrevNextNav';
import RelatedPosts from '../../../component/blog/RelatedPosts';
import './blog-post.css';

interface TocItem {
    id: string;
    text: string;
    level: number;
}

interface PostData {
    frontmatter: {
        title: string;
        date: string;
        tags?: string[];
        category?: string;
    };
    html: string;
}

type LoadState = { status: 'loading' } | { status: 'loaded'; post: PostData } | { status: 'notfound' };

interface IndexMeta {
    slug: string;
    title: string;
    date: string;
}

function usePost(slug: string | undefined) {
    const loader = useMemo(() => slug ? postMap[slug] : undefined, [slug]);
    const [state, setState] = useState<LoadState>(() => (loader ? { status: 'loading' } : { status: 'notfound' }));

    useEffect(() => {
        if (!loader) return;
        let cancelled = false;
        loader()
            .then((mod: { default: PostData }) => {
                if (!cancelled) setState({ status: 'loaded', post: mod.default });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'notfound' });
            });
        return () => { cancelled = true; };
    }, [loader]);

    return state;
}

function processHtml(html: string): { html: string; tocItems: TocItem[] } {
    const items: TocItem[] = [];
    let idx = 0;
    const processed = html.replace(
        /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
        (match, tag, attrs, content) => {
            const text = content.replace(/<[^>]+>/g, '').trim();
            if (!text) return match;
            const id = `toc-${idx++}`;
            items.push({ id, text, level: parseInt(tag[1], 10) });
            const attrStr = attrs || '';
            return `<${tag} id="${id}"${attrStr}>${content}</${tag}>`;
        }
    );
    return { html: processed, tocItems: items };
}

export default function BlogPost() {
    const { slug } = useParams<{ slug: string }>();
    const state = usePost(slug);
    const [showBackTop, setShowBackTop] = useState(false);

    useEffect(() => {
        const onScroll = () => setShowBackTop(window.scrollY > 300);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // 上一篇 / 下一篇（按 blogIndex 顺序）
    const { prev, next } = useMemo(() => {
        if (!slug) return { prev: undefined, next: undefined };
        const list = blogIndex as IndexMeta[];
        const idx = list.findIndex(p => p.slug === slug);
        if (idx < 0) return { prev: undefined, next: undefined };
        return {
            prev: idx > 0 ? list[idx - 1] : undefined,
            next: idx < list.length - 1 ? list[idx + 1] : undefined,
        };
    }, [slug]);

    if (state.status === 'notfound') return <Navigate to="/" replace />;
    if (state.status === 'loading') {
        return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
    }

    const post = state.post;
    const { html: processedHtml, tocItems } = processHtml(post.html);
    const readingTime = calcReadingTime(post.html);

    return (
        <>
            <ReadingProgress />
            <PageContainer variant="wide">
                <article className="post-article">
                    {/* 面包屑 */}
                    <nav className="post-breadcrumb" aria-label="面包屑">
                        <Link to="/">首页</Link>
                        {post.frontmatter.category && (
                            <>
                                <span className="post-breadcrumb-sep">/</span>
                                <Link to={`/categories?cat=${encodeURIComponent(post.frontmatter.category)}`}>
                                    {post.frontmatter.category}
                                </Link>
                            </>
                        )}
                    </nav>

                    {/* 文章头部 */}
                    <header className="post-header">
                        <h1 className="post-title">{post.frontmatter.title}</h1>
                        <PostMeta
                            date={post.frontmatter.date}
                            readingTime={readingTime}
                            category={post.frontmatter.category}
                        />
                        {post.frontmatter.tags && post.frontmatter.tags.length > 0 && (
                            <div className="post-tags">
                                {post.frontmatter.tags.map(tag => (
                                    <BlogTag key={tag} tag={tag} size="small" />
                                ))}
                            </div>
                        )}
                    </header>

                    <div className="post-body">
                        <div
                            className="markdown-body"
                            style={{ flex: 1, minWidth: 0 }}
                            dangerouslySetInnerHTML={{ __html: processedHtml }}
                        />
                        {tocItems.length > 0 && <TableOfContents items={tocItems} />}
                    </div>

                    {/* 底部三件套 */}
                    <footer className="post-footer">
                        <PrevNextNav prev={prev} next={next} />
                        <RelatedPosts
                            slug={slug!}
                            tags={post.frontmatter.tags}
                            category={post.frontmatter.category}
                        />
                        <AuthorBio variant="compact" />
                    </footer>
                </article>
            </PageContainer>

            <GobackButton />
            {showBackTop && <TopButton />}
        </>
    );
}
