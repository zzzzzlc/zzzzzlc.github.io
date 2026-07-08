import {
    AimOutlined, BorderOutlined, DeleteOutlined, EditOutlined, LineOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { Tool } from '../types';

export interface ToolOption {
    key: Tool;
    label: string;
    icon: ReactNode;
}

/** 工具栏分组配置 */
export const TOOL_GROUPS: { label: string; items: ToolOption[] }[] = [
    {
        label: '绘制',
        items: [
            { key: 'dot', label: '点', icon: <AimOutlined /> },
            { key: 'pen', label: '画笔', icon: <EditOutlined /> },
            { key: 'line', label: '直线', icon: <LineOutlined /> },
        ],
    },
    {
        label: '形状',
        items: [
            { key: 'rect', label: '矩形', icon: <BorderOutlined /> },
            { key: 'circle', label: '圆形', icon: <BorderOutlined /> },
            { key: 'triangle', label: '三角形', icon: <BorderOutlined /> },
        ],
    },
    {
        label: '编辑',
        items: [{ key: 'eraser', label: '橡皮', icon: <DeleteOutlined /> }],
    },
];

