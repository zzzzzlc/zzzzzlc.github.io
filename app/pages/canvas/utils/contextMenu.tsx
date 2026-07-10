import {
    ClearOutlined, CloseCircleOutlined, DeleteOutlined, DownloadOutlined, RedoOutlined, RetweetOutlined, ToolOutlined, UndoOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { CanvasController, Tool } from '../types';
import { TOOL_GROUPS } from './constants';

type MenuItem = NonNullable<MenuProps['items']>[number];

/** 右键菜单点击信息：仅依赖 key，与 antd MenuInfo 兼容 */
export interface ContextMenuClickInfo {
    key: string;
}

/**
 * 构建画布右键菜单项：
 * 删除此节点（右键命中）/ 反选 / 取消选中全部（选中态）→ 撤销 / 重做 → 下载 / 清空 → 切换工具子菜单
 */
export const buildContextMenuItems = (controller: CanvasController): MenuProps['items'] => {
    const { canUndo, canRedo, tool, selectedIds, contextHitId } = controller;

    const toolItems: MenuItem[] = TOOL_GROUPS.flatMap((group, groupIndex) => {
        const items: MenuItem[] = group.items.map((item) => ({
            key: `tool:${item.key}`,
            icon: item.icon,
            label: `${item.label}${item.key === tool ? ' ✓' : ''}`,
        }));
        const separator: MenuItem[] =
            groupIndex < TOOL_GROUPS.length - 1 ? [{ type: 'divider' }] : [];
        return [...items, ...separator];
    });

    // 顶部操作区：删除右键命中的节点 / 反选 / 取消选中全部（仅改选中态，不删节点）
    const topItems: MenuItem[] = [];
    if (contextHitId != null) {
        topItems.push({ key: 'delete-node', icon: <DeleteOutlined />, label: '删除此节点', danger: true });
    }
    if (selectedIds.length > 0) {
        topItems.push({ key: 'invert-selection', icon: <RetweetOutlined />, label: '反选' });
        topItems.push({ key: 'clear-selection', icon: <CloseCircleOutlined />, label: '取消选中全部' });
    }
    const topSection: MenuItem[] = topItems.length > 0 ? [...topItems, { type: 'divider' }] : [];

    return [
        ...topSection,
        { key: 'undo', icon: <UndoOutlined />, label: '撤销', disabled: !canUndo },
        { key: 'redo', icon: <RedoOutlined />, label: '重做', disabled: !canRedo },
        { type: 'divider' },
        { key: 'download', icon: <DownloadOutlined />, label: '下载图片' },
        { key: 'clear', icon: <ClearOutlined />, label: '清空画布', danger: true },
        { type: 'divider' },
        { key: 'tools', icon: <ToolOutlined />, label: '切换工具', children: toolItems },
    ];
};

/** 右键菜单点击分发：按 key 路由到对应 controller 操作 */
export const handleContextMenuClick = (
    info: ContextMenuClickInfo,
    controller: CanvasController,
): void => {
    const { key } = info;
    switch (key) {
        case 'delete-node':
            controller.handleDeleteNode();
            return;
        case 'clear-selection':
            controller.handleClearSelection();
            return;
        case 'invert-selection':
            controller.handleInvertSelection();
            return;
        case 'undo':
            controller.handleUndo();
            return;
        case 'redo':
            controller.handleRedo();
            return;
        case 'download':
            controller.handleDownload();
            return;
        case 'clear':
            controller.handleClear();
            return;
        default:
            if (key.startsWith('tool:')) {
                controller.setTool(key.slice('tool:'.length) as Tool);
            }
    }
};
