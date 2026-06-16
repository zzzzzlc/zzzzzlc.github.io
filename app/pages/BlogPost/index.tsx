import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate } from 'react-router';
import { Typography, Tag, Divider, Spin } from 'antd';
import postMap from 'virtual:post-map';
import TopButton from '@components/TopButton';
import GobackButton from '@components/GobackButton';
import TableOfContents from '@components/TableOfContents';

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

/**
 * 在 HTML 字符串中给 h2/h3 注入 id，同时提取目录项
 * 这样 id 是 HTML 的一部分，不会被 React 重渲染覆盖
 */
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

    if (state.status === 'notfound') return <Navigate to="/" replace />;
    if (state.status === 'loading') return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

    const post = state.post;
    const { html: processedHtml, tocItems } = processHtml(post.html);

    return (
        <article>
            <Typography.Title level={2}>{post.frontmatter.title}</Typography.Title>
            <Typography.Text type="secondary">{post.frontmatter.date}</Typography.Text>
            <Divider />
            <div style={{ marginBottom: 16 }}>
                {post.frontmatter.tags?.map((tag: string) => (
                    <Tag key={tag}>{tag}</Tag>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>
                <div
                    className="markdown-body"
                    style={{ flex: 1, minWidth: 0 }}
                    dangerouslySetInnerHTML={{ __html: processedHtml }}
                />
                <TableOfContents items={tocItems} />
            </div>

            {/* 悬浮按钮：返回 */}
            <GobackButton />

            {/* 悬浮按钮：回到顶部 */}
            {showBackTop && <TopButton />}
        </article>
    );
}
