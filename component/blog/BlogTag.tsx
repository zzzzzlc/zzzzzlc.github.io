import React from 'react';

/**
 * 复用 Home 页 .home-tag-{kind} 11 色板的统一 Tag 组件
 * 调用方传 tag 字符串，自动归类并附上对应 className
 */
function getTagKind(tag: string): string {
    const t = tag.toLowerCase();
    if (/(ai|agent|大模型|claude|langchain|llm|gpt|视觉)/i.test(tag)) return 'ai';
    if (/(react|vue|javascript|typescript|css|html|node|前端|框架)/i.test(tag)) return 'frontend';
    if (/(工程化|devops|cicd|架构|设计原则|性能|监控|稳定性|规范)/i.test(tag)) return 'engineering';
    if (/(小程序|uni-app|跨端|移动端|app|rn|react-native|3d|three)/i.test(tag)) return 'mobile';
    if (/(数据库|sql|mysql|postgres|redis)/i.test(tag)) return 'database';
    if (/(编程语言|java|go|python|rust|php|c\+\+)/i.test(tag)) return 'language';
    if (/(docker|nginx|部署|运维|容器|k8s)/i.test(tag)) return 'devops';
    if (/(企业|系统|rbac|权限|后台)/i.test(tag)) return 'system';
    if (/(测试|jest|unit|单元)/i.test(tag)) return 'testing';
    if (/(工具|cli|效率)/i.test(tag)) return 'tool';
    return 'default';
}

interface BlogTagProps {
    tag: string;
    /** 可选：强制指定 kind（如对 category 用统一蓝色） */
    kind?: string;
    onClick?: (tag: string) => void;
    active?: boolean;
    size?: 'small' | 'default';
    style?: React.CSSProperties;
}

export default function BlogTag({ tag, kind, onClick, active, size = 'default', style }: BlogTagProps) {
    const resolvedKind = kind ?? getTagKind(tag);
    const cls = [
        'home-tag',
        `home-tag-${resolvedKind}`,
        onClick ? 'home-tag-clickable' : '',
        active ? 'home-tag-active' : '',
        size === 'small' ? 'home-tag-small' : '',
    ].filter(Boolean).join(' ');

    if (onClick) {
        return (
            <button
                type="button"
                className={cls}
                style={style}
                onClick={() => onClick(tag)}
            >
                {tag}
            </button>
        );
    }
    return (
        <span className={cls} style={style}>
            {tag}
        </span>
    );
}

export { getTagKind };
