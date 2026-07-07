import React, { useMemo } from 'react';
import { useNavigate } from 'react-router';
import blogIndex from 'virtual:blog-index';
import './RelatedPosts.css';

interface RelatedPostsProps {
    /** 当前文章 slug，用于排除自身 */
    slug: string;
    /** 当前文章标签，用于按交集打分 */
    tags?: string[];
    /** 当前文章分类，同分类加分 */
    category?: string;
    /** 推荐数量，默认 3 */
    limit?: number;
}

interface PostMeta {
    slug: string;
    title: string;
    date: string;
    tags?: string[];
    category?: string;
    summary?: string;
}

/**
 * 按标签交集 + 同分类加权，给当前文章推荐相关文章
 */
function scorePost(curr: { tags?: string[]; category?: string }, target: PostMeta): number {
    let score = 0;
    const currTags = new Set(curr.tags?.map(t => t.toLowerCase()) ?? []);
    target.tags?.forEach((t) => {
        if (currTags.has(t.toLowerCase())) score += 2;
    });
    if (curr.category && target.category === curr.category) score += 1;
    return score;
}

export default function RelatedPosts({ slug, tags, category, limit = 3 }: RelatedPostsProps) {
    const navigate = useNavigate();

    const related = useMemo<PostMeta[]>(() => {
        return (blogIndex as PostMeta[])
            .filter(p => p.slug !== slug)
            .map(p => ({ post: p, score: scorePost({ tags, category }, p) }))
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score || (b.post.date > a.post.date ? 1 : -1))
            .slice(0, limit)
            .map(x => x.post);
    }, [slug, tags, category, limit]);

    if (related.length === 0) return null;

    return (
        <section className="related-posts" aria-label="相关文章">
            <h3 className="related-posts-title">相关文章</h3>
            <ul className="related-posts-list">
                {related.map(p => (
                    <li key={p.slug}>
                        <button
                            type="button"
                            className="related-post-row"
                            onClick={() => navigate(`/post/${p.slug}`)}
                        >
                            <span className="related-post-title">{p.title}</span>
                            {p.summary && <span className="related-post-summary">{p.summary}</span>}
                            <span className="related-post-date">{p.date}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}
