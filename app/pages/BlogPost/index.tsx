import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Navigate } from 'react-router';
import { Typography, Tag, Divider, Spin } from 'antd';
import postMap from 'virtual:post-map';
import TopButton from '@components/TopButton';
import GobackButton from '@components/GobackButton';

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
            <div
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: post.html }}
            />

            {/* 悬浮按钮：返回 */}
            <GobackButton />

            {/* 悬浮按钮：回到顶部 */}
            {showBackTop && <TopButton />}
        </article>
    );
}
