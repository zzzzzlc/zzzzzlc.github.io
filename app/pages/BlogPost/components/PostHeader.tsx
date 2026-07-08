import { Link } from 'react-router';
import BlogTag from '../../../../component/blog/BlogTag';
import PostMeta from '../../../../component/blog/PostMeta';
import type { BlogPostController } from '../types';

export interface PostHeaderProps {
    controller: BlogPostController;
}

/** 文章头部：面包屑 + 标题 + 元信息 + 标签 */
export function PostHeader({ controller }: PostHeaderProps) {
    const { state, readingTime } = controller;
    if (state.status !== 'loaded') return null;
    const { frontmatter } = state.post;

    return (
        <>
            {/* 面包屑 */}
            <nav className="post-breadcrumb" aria-label="面包屑">
                <Link to="/">首页</Link>
                {frontmatter.category && (
                    <>
                        <span className="post-breadcrumb-sep">/</span>
                        <Link to={`/categories?cat=${encodeURIComponent(frontmatter.category)}`}>
                            {frontmatter.category}
                        </Link>
                    </>
                )}
            </nav>

            {/* 文章头部 */}
            <header className="post-header">
                <h1 className="post-title">{frontmatter.title}</h1>
                <PostMeta
                    date={frontmatter.date}
                    readingTime={readingTime}
                    category={frontmatter.category}
                />
                {frontmatter.tags && frontmatter.tags.length > 0 && (
                    <div className="post-tags">
                        {frontmatter.tags.map(tag => (
                            <BlogTag key={tag} tag={tag} size="small" />
                        ))}
                    </div>
                )}
            </header>
        </>
    );
}
