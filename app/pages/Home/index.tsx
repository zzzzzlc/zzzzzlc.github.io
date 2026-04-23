import React, { useState, useMemo } from 'react';
import { Row, Col, Card, Tag, Typography, Pagination, Empty, Input } from 'antd';
import { useNavigate } from 'react-router';
import blogIndex from 'virtual:blog-index';

const PAGE_SIZE = 10;

export default function Home() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return blogIndex;
        const q = search.toLowerCase();
        return blogIndex.filter(post =>
            post.title?.toLowerCase().includes(q) ||
            post.tags?.some((t: string) => t.toLowerCase().includes(q))
        );
    }, [search]);

    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div>
            <div style={{ marginBottom: 32 }}>
                <Typography.Title level={2} style={{ marginBottom: 8 }}>最新文章</Typography.Title>
                <Input.Search
                    placeholder="搜索文章..."
                    onSearch={setSearch}
                    onChange={e => { if (!e.target.value) setSearch(''); }}
                    style={{ maxWidth: 400 }}
                    allowClear
                />
            </div>
            <Row gutter={[16, 16]}>
                {paged.map(post => (
                    <Col xs={24} sm={12} md={8} key={post.slug}>
                        <Card
                            hoverable
                            onClick={() => navigate(`/post/${post.slug}`)}
                            style={{ height: '100%' }}
                        >
                            <Typography.Title level={4} style={{ marginTop: 0 }}>{post.title}</Typography.Title>
                            <Typography.Text type="secondary">{post.date}</Typography.Text>
                            <Typography.Paragraph
                                type="secondary"
                                ellipsis={{ rows: 3 }}
                                style={{ marginTop: 8 }}
                            >
                                {post.summary}
                            </Typography.Paragraph>
                            <div>
                                {post.tags?.map((tag: string) => (
                                    <Tag key={tag}>{tag}</Tag>
                                ))}
                            </div>
                        </Card>
                    </Col>
                ))}
            </Row>
            {paged.length === 0 && <Empty description="暂无文章" />}
            {filtered.length > PAGE_SIZE && (
                <Pagination
                    current={page}
                    pageSize={PAGE_SIZE}
                    total={filtered.length}
                    onChange={setPage}
                    style={{ textAlign: 'center', marginTop: 32 }}
                />
            )}
        </div>
    );
}
