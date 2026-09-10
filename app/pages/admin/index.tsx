import { Button, Space } from 'antd';
import { CloseOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import PageContainer from '@components/blog/PageContainer';
import { useAdminPosts } from './hooks/useAdminPosts';
import { PostsList } from './components/PostsList';
import { PostMetaForm } from './components/PostMetaForm';
import { BlocksEditor } from './components/BlocksEditor';
import { ServerNotice } from './components/ServerNotice';
import './admin.css';

/** 文章管理：本地服务（pnpm admin:server）+ /admin 直达，不入公开导航 */
export default function AdminPage() {
    const controller = useAdminPosts();
    const { mode, formData, activeSlug } = controller;

    return (
        <PageContainer variant="content" className="admin-page">
            <header className="admin-header">
                <div>
                    <h1 className="admin-title">文章管理</h1>
                    <p className="admin-subtitle">编辑 posts/ 目录下的 markdown 文章（保存后博客自动刷新）</p>
                </div>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => void controller.refresh()}>
                    刷新列表
                </Button>
            </header>

            {controller.serverError && (
                <ServerNotice message={controller.serverError} onRetry={() => void controller.refresh()} />
            )}

            <div className="admin-layout">
                <PostsList
                    posts={controller.posts}
                    loading={controller.loading}
                    mode={mode}
                    activeSlug={activeSlug}
                    onSelect={(slug) => void controller.selectPost(slug)}
                    onDelete={controller.deletePost}
                    onCreate={controller.startCreate}
                />

                {mode !== 'closed' && (
                    <div className="admin-editor-pane">
                        <div className="admin-editor-head">
                            <h2 className="admin-editor-title">
                                {mode === 'create' ? '新建文章' : `编辑：${activeSlug}`}
                                {controller.dirty && <span className="dirty-dot" title="有未保存修改" />}
                            </h2>
                            <Space>
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<SaveOutlined />}
                                    loading={controller.saving}
                                    onClick={() => void controller.save()}
                                >
                                    保存
                                </Button>
                                <Button size="small" icon={<CloseOutlined />} onClick={controller.closeEditor}>
                                    关闭
                                </Button>
                            </Space>
                        </div>
                        <PostMetaForm
                            formData={formData}
                            mode={mode}
                            originalSlug={activeSlug}
                            onChange={controller.updateFormData}
                        />
                        <BlocksEditor
                            blocks={controller.blocks}
                            onInsert={controller.insertBlock}
                            onRemove={controller.removeBlock}
                            onMove={controller.moveBlock}
                            onUpdate={controller.updateBlock}
                        />
                    </div>
                )}
            </div>
        </PageContainer>
    );
}
