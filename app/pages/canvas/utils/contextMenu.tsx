import {
    ClearOutlined, DownloadOutlined, RedoOutlined, ToolOutlined, UndoOutlined,
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
 * 撤销 / 重做（按历史栈可用态置灰）→ 下载 / 清空 → 切换工具子菜单（当前工具标记 ✓）
 */
export const buildContextMenuItems = (controller: CanvasController): MenuProps['items'] => {
    const { canUndo, canRedo, tool } = controller;

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

    return [
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
