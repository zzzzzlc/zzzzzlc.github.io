/* eslint-disable react-refresh/only-export-components -- 工具配置文件：导出数据常量（含图标 JSX 字面量），非 React 组件模块，fast-refresh 不适用 */
import {
    AimOutlined, BorderOutlined, DeleteOutlined, EditOutlined, LineOutlined, StarOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { Tool } from '../types';

export interface ToolOption {
    key: Tool;
    label: string;
    icon: ReactNode;
}

/** 吸管图标：antd icons 无原生滴管，内联 Material colorize 形状 */
const eyeDropperIcon: ReactNode = (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden>
        <path d="M17.66 5.41a3.5 3.5 0 0 1 0 4.95l-1.06 1.06 1.06 1.06-1.41 1.41-3.54-3.54 1.41-1.41 1.06 1.06 1.06-1.06a1.5 1.5 0 0 0 0-2.12 1.5 1.5 0 0 0-2.12 0l-1.06 1.06-1.41-1.41 1.06-1.06a3.5 3.5 0 0 1 4.95 0zM5.5 17.5l1.41-1.41 3.54 3.54-1.41 1.41H6.5v-1.5l-1-1z" />
    </svg>
);

/** 选择工具箭头光标 */
const pointerIcon: ReactNode = (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden>
        <path d="M4 2 L4 19 L8.5 14.5 L11.5 21 L13.8 20 L10.8 13.5 L17.5 13.5 Z" />
    </svg>
);

/** 形状图标通用描边属性（线框感，区别于实心填充图标） */
const shapeIconProps = {
    viewBox: '0 0 24 24', width: '1em', height: '1em',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

/** 椭圆图标 */
const ellipseIcon: ReactNode = (
    <svg {...shapeIconProps}><ellipse cx="12" cy="12" rx="9" ry="6.5" /></svg>
);
/** 正五边形图标（顶点朝上，外接半径 9） */
const pentagonIcon: ReactNode = (
    <svg {...shapeIconProps}><path d="M12 3 L20.6 9.2 L17.3 19.3 L6.7 19.3 L3.4 9.2 Z" /></svg>
);
/** 正六边形图标 */
const hexagonIcon: ReactNode = (
    <svg {...shapeIconProps}><path d="M12 3 L19.8 7.5 L19.8 16.5 L12 21 L4.2 16.5 L4.2 7.5 Z" /></svg>
);
/** 正八边形图标 */
const octagonIcon: ReactNode = (
    <svg {...shapeIconProps}><path d="M12 3 L18.4 5.6 L21 12 L18.4 18.4 L12 21 L5.6 18.4 L3 12 L5.6 5.6 Z" /></svg>
);

/** 工具栏分组配置 */
export const TOOL_GROUPS: { label: string; items: ToolOption[] }[] = [
    {
        label: '选择',
        items: [{ key: 'select', label: '选择', icon: pointerIcon }],
    },
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
            { key: 'ellipse', label: '椭圆', icon: ellipseIcon },
            { key: 'triangle', label: '三角形', icon: <BorderOutlined /> },
        ],
    },
    {
        label: '多边形',
        items: [
            { key: 'pentagon', label: '五边形', icon: pentagonIcon },
            { key: 'hexagon', label: '六边形', icon: hexagonIcon },
            { key: 'octagon', label: '八边形', icon: octagonIcon },
            { key: 'star', label: '星形', icon: <StarOutlined /> },
        ],
    },
    {
        label: '编辑',
        items: [{ key: 'eraser', label: '橡皮', icon: <DeleteOutlined /> }],
    },
    {
        label: '取色',
        items: [{ key: 'picker', label: '吸管', icon: eyeDropperIcon }],
    },
];

/** 工具键 → 中文标签映射（由 TOOL_GROUPS 派生，避免重复维护） */
export const TOOL_LABELS: Record<Tool, string> = Object.fromEntries(
    TOOL_GROUPS.flatMap((group) => group.items.map((item) => [item.key, item.label])),
) as Record<Tool, string>;
