import React, { useState, useMemo } from 'react';
import { Tag, Typography, Empty, Input } from 'antd';
import { useNavigate } from 'react-router';
import blogIndex from 'virtual:blog-index';

interface CategoryGroup {
    name: string;
    posts: typeof blogIndex;
}

/**
 * 根据标签文本返回分类 key，用于驱动不同主题色的浅色背景
 * 通过关键词命中规则归类，未命中时回退到默认色
 */
function getTagKind(tag: string): string {
    const t = tag.toLowerCase();
    if (/(ai|agent|大模型|claude|langchain|llm|gpt|视觉)/i.test(tag)) return 'ai';
    if (/(react|vue|javascript|typescript|css|html|node|前端|框架)/i.test(tag)) return 'frontend';
    if (/(工程化|devops|cicd|架构|设计原则|性能|监控|稳定性|规范)/i.test(tag)) return 'engineering';
    if (/(小程序|uni-app|跨端|移动端|app|rn|react-native|3d|three)/i.test(tag)) return 'mobile';
    if (/(数据库|sql|mysql|postgres|redis)/i.test(tag)) return 'database';
    if (/(编程语言|java|go|python|rust|php|c\+\+)/i.test(tag)) return 'language';
    if (/(docker|nginx|部署|运维|容器|k8s)/i.test(tag)) return 'devops';
    if (/(企业|系统|rbac|权限|后台)/i.test(tag)) return 'system';
    if (/(测试|jest|unit|单元)/i.test(tag)) return 'testing';
    if (/(工具|cli|效率)/i.test(tag)) return 'tool';
    return 'default';
}

export default function Home() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const categories = useMemo(() => {
        const map = new Map<string, typeof blogIndex>();
        blogIndex.forEach(post => {
            const cat = post.category || '未分类';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(post);
        });
        return Array.from(map.entries()).map(([name, posts]) => ({ name, posts }));
    }, []);

    const displayed = useMemo(() => {
        const byCategory = activeCategory
            ? blogIndex.filter(p => p.category === activeCategory)
            : blogIndex;
        if (!search.trim()) return byCategory;
        const q = search.toLowerCase();
        return byCategory.filter(post =>
            post.title?.toLowerCase().includes(q) ||
            post.tags?.some((t: string) => t.toLowerCase().includes(q))
        );
    }, [search, activeCategory]);

    const toggleCollapse = (name: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    };

    const selectCategory = (name: string | null) => {
        setActiveCategory(name);
        if (name && collapsed.has(name)) {
            setCollapsed(prev => {
                const next = new Set(prev);
                next.delete(name);
                return next;
            });
        }
    };

    return (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            {/* 主区域：文章列表 */}
            <div className="home-content">
                <div style={{ marginBottom: 20 }}>
                    <Typography.Title level={2} style={{ marginBottom: 12 }}>
                        {activeCategory || '最新文章'}
                    </Typography.Title>
                    <Input.Search
                        placeholder="搜索文章..."
                        onSearch={setSearch}
                        onChange={e => { if (!e.target.value) setSearch(''); }}
                        style={{ maxWidth: 400 }}
                        allowClear
                    />
                </div>

                {displayed.length === 0 && <Empty description="暂无文章" />}

                {displayed.map(post => (
                    <div
                        key={post.slug}
                        className="home-post-card"
                        onClick={() => navigate(`/post/${post.slug}`)}
                    >
                        <div className="home-post-title">{post.title}</div>
                        <div className="home-post-meta">
                            <span>{post.date}</span>
                            {post.category && <span>{post.category}</span>}
                        </div>
                        {post.summary && (
                            <div className="home-post-summary">{post.summary}</div>
                        )}
                        <div>
                            {post.tags?.map((tag: string) => (
                                <Tag key={tag} className={`home-tag home-tag-${getTagKind(tag)}`}>{tag}</Tag>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* 右侧分类目录 */}
            <aside className="home-sidebar">
                <div className="home-sidebar-title">文章分类</div>
                <div
                    className={`home-category-header ${!activeCategory ? 'active' : ''}`}
                    onClick={() => selectCategory(null)}
                >
                    <span>全部 <span className="home-category-count">{blogIndex.length}</span></span>
                </div>
                {categories.map(cat => {
                    const isCollapsed = collapsed.has(cat.name);
                    const isActive = activeCategory === cat.name;
                    return (
                        <div key={cat.name} className="home-category">
                            <div
                                className={`home-category-header ${isActive ? 'active' : ''}`}
                                onClick={() => selectCategory(cat.name)}
                            >
                                <span>
                                    {cat.name}
                                    <span className="home-category-count">{cat.posts.length}</span>
                                </span>
                                <span
                                    className={`home-category-toggle ${isCollapsed ? 'home-category-toggle-collapsed' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); toggleCollapse(cat.name); }}
                                >
                                    ▼
                                </span>
                            </div>
                            {!isCollapsed && cat.posts.map(post => (
                                <div
                                    key={post.slug}
                                    className="home-article-item"
                                    onClick={() => navigate(`/post/${post.slug}`)}
                                    title={post.title}
                                >
                                    {post.title}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </aside>
        </div>
    );
}
