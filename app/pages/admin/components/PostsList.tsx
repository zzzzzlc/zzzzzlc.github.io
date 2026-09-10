import { useMemo, useState } from 'react';
import { Button, Input, Table, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PostSummary, SaveMode } from '../types';

interface PostsListProps {
    posts: PostSummary[];
    loading: boolean;
    mode: SaveMode;
    activeSlug: string | null;
    onSelect: (slug: string) => void;
    onDelete: (slug: string) => void;
    onCreate: () => void;
}

/** 文章列表：搜索过滤（标题/分类/标签）+ 行点击编辑 */
export const PostsList = ({ posts, loading, mode, activeSlug, onSelect, onDelete, onCreate }: PostsListProps) => {
    const [keyword, setKeyword] = useState('');

    const filtered = useMemo(() => {
        const kw = keyword.trim().toLowerCase();
        if (!kw) return posts;
        return posts.filter(
            (p) =>
                p.title.toLowerCase().includes(kw) ||
                p.category.toLowerCase().includes(kw) ||
                p.slug.includes(kw) ||
                p.tags.some((t) => t.toLowerCase().includes(kw)),
        );
    }, [keyword, posts]);

    const columns: ColumnsType<PostSummary> = [
        {
            title: '标题',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
            render: (_, record) => (
                <span className="post-title-cell">
                    {record.title || record.slug}
                    {record.draft && <Tag color="orange" style={{ marginInlineStart: 4 }}>草稿</Tag>}
                </span>
            ),
        },
        { title: '日期', dataIndex: 'date', key: 'date', width: 96 },
        { title: '分类', dataIndex: 'category', key: 'category', width: 96, ellipsis: true },
        {
            title: '',
            key: 'actions',
            width: 72,
            render: (_, record) => (
                <span className="post-row-actions">
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onSelect(record.slug)} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(record.slug)} />
                </span>
            ),
        },
    ];

    return (
        <div className="admin-list-pane">
            <div className="admin-list-toolbar">
                <Input
                    size="small"
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="搜索标题/分类/标签"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                    新建
                </Button>
            </div>
            <Table<PostSummary>
                size="small"
                rowKey="slug"
                loading={loading}
                columns={columns}
                dataSource={filtered}
                showSorterTooltip={false}
                pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, hideOnSinglePage: true }}
                onRow={(record) => ({
                    onClick: () => onSelect(record.slug),
                    className:
                        mode !== 'closed' && record.slug === activeSlug ? 'post-row post-row-active' : 'post-row',
                })}
            />
        </div>
    );
};
