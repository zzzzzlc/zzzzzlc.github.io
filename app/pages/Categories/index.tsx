import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import blogIndex from 'virtual:blog-index';
import PageContainer from '../../../component/blog/PageContainer';
import BlogTag from '../../../component/blog/BlogTag';
import './categories.css';

interface PostMeta {
    slug: string;
    title: string;
    date?: string;
    tags?: string[];
    category?: string;
    summary?: string;
}

export default function Categories() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialCat = searchParams.get('cat');
    const [activeCategory, setActiveCategory] = useState<string | null>(initialCat);

    const categories = useMemo(() => {
        const cats = new Map<string, number>();
        blogIndex.forEach(post => {
            const c = post.category || '未分类';
            cats.set(c, (cats.get(c) || 0) + 1);
        });
        return Array.from(cats.entries()).map(([name, count]) => ({ name, count }));
    }, []);

    const allTags = useMemo(() => {
        const tags = new Map<string, number>();
        blogIndex.forEach(post => {
            post.tags?.forEach((tag: string) => {
                tags.set(tag, (tags.get(tag) || 0) + 1);
            });
        });
        return Array.from(tags.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, []);

    const filtered = useMemo(() => {
        const all = blogIndex as PostMeta[];
        if (!activeCategory) return all;
        return all.filter(post => (post.category || '未分类') === activeCategory);
    }, [activeCategory]);

    return (
        <PageContainer>
            <header className="page-header">
                <h1 className="page-title">分类</h1>
                <p className="page-subtitle">共 {blogIndex.length} 篇文章 · {categories.length} 个分类</p>
            </header>

            {/* 分类过滤 pill 行（与首页一致的语言） */}
            <section className="cat-filter" aria-label="分类过滤">
                <button
                    type="button"
                    className={`home-tag home-tag-clickable${activeCategory === null ? ' home-tag-active' : ''}`}
                    onClick={() => setActiveCategory(null)}
                >
                    全部 {blogIndex.length}
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.name}
                        type="button"
                        className={`home-tag home-tag-clickable${activeCategory === cat.name ? ' home-tag-active' : ''}`}
                        onClick={() => setActiveCategory(cat.name)}
                    >
                        {cat.name} {cat.count}
                    </button>
                ))}
            </section>

            {/* 标签云 */}
            <section className="cat-tags-section">
                <div className="cat-tags-title">标签</div>
                <div className="cat-tag-cloud">
                    {allTags.map(tag => (
                        <BlogTag key={tag.name} tag={tag.name} size="small" />
                    ))}
                </div>
            </section>

            <h2 className="section-heading">
                {activeCategory ?? '全部文章'}
                <span className="cat-result-count">{filtered.length}</span>
            </h2>

            {/* 文章网格：3 列，复用共享 .post-card 卡片语言 */}
            <div className="cat-post-grid">
                {filtered.map(post => (
                    <article
                        key={post.slug}
                        className="post-card"
                        onClick={() => navigate(`/post/${post.slug}`)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') navigate(`/post/${post.slug}`);
                        }}
                    >
                        {post.category && (
                            <div className="post-card-meta">
                                {post.date && <time className="post-card-date">{post.date}</time>}
                                <span className="post-card-category">{post.category}</span>
                            </div>
                        )}
                        <Link
                            to={`/post/${post.slug}`}
                            className="post-card-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {post.title}
                        </Link>
                        {post.summary && <p className="post-card-summary">{post.summary}</p>}
                        {post.tags && post.tags.length > 0 && (
                            <div className="post-card-tags">
                                {post.tags.map(tag => (
                                    <BlogTag key={tag} tag={tag} size="small" />
                                ))}
                            </div>
                        )}
                    </article>
                ))}
            </div>
        </PageContainer>
    );
}
