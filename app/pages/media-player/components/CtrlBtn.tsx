import type { CSSProperties, ReactNode } from 'react';

export interface CtrlBtnProps {
    icon: ReactNode;
    onClick: () => void;
    style?: CSSProperties;
}

/** 播放器控件按钮：白色图标、悬停高亮；指定 color 时保留强调色不被动效覆盖 */
export function CtrlBtn({ icon, onClick, style }: CtrlBtnProps) {
    return (
        <button
            onClick={onClick}
            style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 20,
                padding: '4px 6px',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'color 0.2s',
                ...style,
            }}
            onMouseEnter={(e) => { if (!style?.color) e.currentTarget.style.color = '#1677ff'; }}
            onMouseLeave={(e) => { if (!style?.color) e.currentTarget.style.color = '#fff'; }}
        >
            {icon}
        </button>
    );
}
