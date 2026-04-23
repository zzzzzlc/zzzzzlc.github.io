import React, { useState, useMemo } from 'react';
import { Row, Col, Card, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router';
import blogIndex from 'virtual:blog-index';

export default function Categories() {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const categories = useMemo(() => {
        const cats = new Map<string, number>();
        blogIndex.forEach(post => {
            if (post.category) {
                cats.set(post.category, (cats.get(post.category) || 0) + 1);
            }
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
        return Array.from(tags.entries()).map(([name, count]) => ({ name, count }));
    }, []);

    const filtered = useMemo(() => {
        if (!activeCategory) return blogIndex;
        return blogIndex.filter(post => post.category === activeCategory);
    }, [activeCategory]);

    return (
        <div>
            <Typography.Title level={3}>分类</Typography.Title>
            <div style={{ marginBottom: 16 }}>
                <Tag
                    color={!activeCategory ? 'blue' : undefined}
                    style={{ cursor: 'pointer', fontSize: 14, padding: '4px 12px' }}
                    onClick={() => setActiveCategory(null)}
                >
                    全部 ({blogIndex.length})
                </Tag>
                {categories.map(cat => (
                    <Tag
                        key={cat.name}
                        color={activeCategory === cat.name ? 'blue' : undefined}
                        style={{ cursor: 'pointer', fontSize: 14, padding: '4px 12px' }}
                        onClick={() => setActiveCategory(cat.name)}
                    >
                        {cat.name} ({cat.count})
                    </Tag>
                ))}
            </div>

            <Typography.Title level={4}>标签</Typography.Title>
            <div style={{ marginBottom: 24 }}>
                {allTags.map(tag => (
                    <Tag key={tag.name} style={{ marginBottom: 8 }}>{tag.name} ({tag.count})</Tag>
                ))}
            </div>

            <Row gutter={[16, 16]}>
                {filtered.map(post => (
                    <Col xs={24} sm={12} key={post.slug}>
                        <Card hoverable onClick={() => navigate(`/post/${post.slug}`)}>
                            <Card.Meta title={post.title} description={post.summary} />
                            <div style={{ marginTop: 8 }}>
                                {post.tags?.map((tag: string) => <Tag key={tag}>{tag}</Tag>)}
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>
        </div>
    );
}
