/**
 * 文章管理页唯一控制器：列表状态 + 编辑器状态 + 全部业务操作。
 * 组件只消费 AdminPostsController，不持有业务逻辑。
 */
import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import type {
    AdminPostsController,
    BlockPatch,
    BlockType,
    PostBlock,
    PostFormData,
    PostSummary,
    SaveMode,
} from '../types';
import { createBlock, parseMarkdown, serializeBlocks } from '../utils/mdBlocks';
import { newBlockId } from '../utils/blockId';
import { todayString } from '../utils/constants';
import {
    createPost,
    deletePost,
    getPost,
    listPosts,
    toFrontmatter,
    updatePost,
} from '../services/postAdminService';

const EMPTY_FORM: PostFormData = {
    slug: '',
    title: '',
    date: todayString(),
    tags: [],
    category: '',
    summary: '',
    draft: false,
};

/** 必填校验，返回首个错误文案（null 表示通过） */
const validateForm = (form: PostFormData, mode: SaveMode): string | null => {
    if (!form.slug.trim()) return 'slug 必填（小写字母、数字、中划线）';
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(form.slug.trim())) return 'slug 仅允许小写字母、数字、中划线';
    if (!form.title.trim()) return '标题必填';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return '日期格式须为 YYYY-MM-DD';
    if (!form.category.trim()) return '分类必填';
    if (mode === 'create' && form.slug === 'admin') return 'slug 不能为 admin';
    return null;
};

export const useAdminPosts = (): AdminPostsController => {
    const { message, modal } = App.useApp();

    /* 列表状态 */
    const [posts, setPosts] = useState<PostSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [serverError, setServerError] = useState<string | null>(null);

    /* 编辑器状态 */
    const [mode, setMode] = useState<SaveMode>('closed');
    const [activeSlug, setActiveSlug] = useState<string | null>(null);
    const [formData, setFormData] = useState<PostFormData>(EMPTY_FORM);
    const [blocks, setBlocks] = useState<PostBlock[]>([]);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setPosts(await listPosts());
            setServerError(null);
        } catch (err) {
            setServerError(
                `文章服务不可用：${err instanceof Error ? err.message : String(err)}。请先运行 pnpm admin:server`,
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const updateFormData = useCallback((patch: Partial<PostFormData>) => {
        setFormData((prev) => ({ ...prev, ...patch }));
        setDirty(true);
    }, []);

    const selectPost = useCallback(
        async (slug: string) => {
            try {
                const detail = await getPost(slug);
                setFormData({ slug: detail.slug, ...detail.frontmatter });
                setBlocks(parseMarkdown(detail.content, newBlockId));
                setActiveSlug(detail.slug);
                setMode('edit');
                setDirty(false);
            } catch (err) {
                void message.error(`加载失败：${err instanceof Error ? err.message : String(err)}`);
            }
        },
        [message],
    );

    const startCreate = useCallback(() => {
        setFormData({ ...EMPTY_FORM, date: todayString() });
        setBlocks([createBlock('paragraph', newBlockId)]);
        setActiveSlug(null);
        setMode('create');
        setDirty(false);
    }, []);

    const closeEditor = useCallback(() => {
        const doClose = () => {
            setMode('closed');
            setActiveSlug(null);
            setDirty(false);
        };
        if (dirty) {
            modal.confirm({ title: '有未保存的修改', content: '关闭后修改将丢失，确定关闭？', onOk: doClose });
        } else {
            doClose();
        }
    }, [dirty, modal]);

    /* ---- 块操作（gap 规则：新块默认与上一块隔一空行；移动时 gap 留在原位） ---- */

    const insertBlock = useCallback((index: number, type: BlockType) => {
        setBlocks((prev) => {
            const next = [...prev];
            next.splice(Math.max(0, Math.min(index, next.length)), 0, createBlock(type, newBlockId));
            return next;
        });
        setDirty(true);
    }, []);

    const removeBlock = useCallback((index: number) => {
        setBlocks((prev) => prev.filter((_, i) => i !== index));
        setDirty(true);
    }, []);

    const moveBlock = useCallback((index: number, direction: -1 | 1) => {
        setBlocks((prev) => {
            const target = index + direction;
            if (index < 0 || index >= prev.length || target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            // 交换内容、gap 留在原下标，块间相对间距不变
            next[index] = { ...prev[target], gap: prev[index].gap };
            next[target] = { ...prev[index], gap: prev[target].gap };
            return next;
        });
        setDirty(true);
    }, []);

    const updateBlock = useCallback((index: number, patch: BlockPatch) => {
        setBlocks((prev) =>
            prev.map((block, i) => (i === index ? ({ ...block, ...patch } as PostBlock) : block)),
        );
        setDirty(true);
    }, []);

    /* ---- 持久化 ---- */

    const save = useCallback(async () => {
        if (mode === 'closed') return;
        const error = validateForm(formData, mode);
        if (error) {
            void message.warning(error);
            return;
        }
        setSaving(true);
        try {
            const content = serializeBlocks(blocks);
            const frontmatter = toFrontmatter(formData);
            const slug =
                mode === 'create'
                    ? await createPost({ slug: formData.slug.trim(), frontmatter, content })
                    : await updatePost(activeSlug ?? formData.slug, {
                          frontmatter,
                          content,
                          newSlug: formData.slug.trim() !== activeSlug ? formData.slug.trim() : undefined,
                      });
            setActiveSlug(slug);
            setMode('edit');
            setDirty(false);
            void message.success(`已保存：${slug}`);
            await refresh();
        } catch (err) {
            void message.error(`保存失败：${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setSaving(false);
        }
    }, [activeSlug, blocks, formData, message, mode, refresh]);

    const deletePostWithConfirm = useCallback(
        (slug: string) => {
            modal.confirm({
                title: `删除文章`,
                content: `确定删除 ${slug}.md？该操作不可撤销。`,
                okButtonProps: { danger: true },
                onOk: async () => {
                    try {
                        await deletePost(slug);
                        void message.success(`已删除：${slug}`);
                        if (activeSlug === slug) {
                            setMode('closed');
                            setActiveSlug(null);
                            setDirty(false);
                        }
                        await refresh();
                    } catch (err) {
                        void message.error(`删除失败：${err instanceof Error ? err.message : String(err)}`);
                    }
                },
            });
        },
        [activeSlug, message, modal, refresh],
    );

    return {
        posts,
        loading,
        serverError,
        refresh,
        mode,
        activeSlug,
        formData,
        updateFormData,
        blocks,
        dirty,
        saving,
        selectPost,
        startCreate,
        closeEditor,
        insertBlock,
        removeBlock,
        moveBlock,
        updateBlock,
        save,
        deletePost: deletePostWithConfirm,
    };
};
