import { Form, Input, Select, Switch } from 'antd';
import type { PostFormData, SaveMode } from '../types';

interface PostMetaFormProps {
    formData: PostFormData;
    mode: SaveMode;
    originalSlug: string | null;
    onChange: (patch: Partial<PostFormData>) => void;
}

/** frontmatter 表单（受控，值与校验逻辑都在控制器 hook 中） */
export const PostMetaForm = ({ formData, mode, originalSlug, onChange }: PostMetaFormProps) => {
    const slugChanged = mode === 'edit' && originalSlug !== null && formData.slug !== originalSlug;
    return (
        <Form
            className="post-meta-form"
            layout="vertical"
            component="div"
        >
            <div className="meta-grid">
                <Form.Item label="标题" required>
                    <Input
                        value={formData.title}
                        placeholder="文章标题"
                        onChange={(e) => onChange({ title: e.target.value })}
                    />
                </Form.Item>
                <Form.Item label="slug（文件名与访问路径）" required>
                    <Input
                        value={formData.slug}
                        placeholder="如 react-source"
                        suffix=".md"
                        onChange={(e) => onChange({ slug: e.target.value })}
                    />
                    {slugChanged && (
                        <span className="slug-rename-hint">保存后文件将改名，文章访问路径随之变化</span>
                    )}
                </Form.Item>
                <Form.Item label="日期" required>
                    <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => onChange({ date: e.target.value })}
                    />
                </Form.Item>
                <Form.Item label="分类" required>
                    <Input
                        value={formData.category}
                        placeholder="如 前端基础 / 工程化"
                        onChange={(e) => onChange({ category: e.target.value })}
                    />
                </Form.Item>
            </div>
            <Form.Item label="标签">
                <Select
                    mode="tags"
                    value={formData.tags}
                    placeholder="输入后回车添加"
                    onChange={(tags) => onChange({ tags })}
                    open={false}
                />
            </Form.Item>
            <Form.Item label="摘要">
                <Input.TextArea
                    value={formData.summary}
                    placeholder="文章摘要（展示在列表与详情页）"
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    onChange={(e) => onChange({ summary: e.target.value })}
                />
            </Form.Item>
            <Form.Item label="草稿" valuePropName="checked" className="meta-draft-item">
                <Switch
                    checked={formData.draft}
                    checkedChildren="草稿（博客不展示）"
                    unCheckedChildren="发布"
                    onChange={(draft) => onChange({ draft })}
                />
            </Form.Item>
        </Form>
    );
};
