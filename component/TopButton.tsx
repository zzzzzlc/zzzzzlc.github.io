import React from "react";
import { VerticalAlignTopOutlined } from '@ant-design/icons';

export default function TopButton() {
    const floatBtnStyle: React.CSSProperties = {
        position: 'fixed',
        right: 32,
        zIndex: 100,
        width: 44,
        height: 44,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        border: 'none',
        transition: 'opacity 0.3s, transform 0.3s',
    };
    return (
        <button
            style={{
                ...floatBtnStyle,
                bottom: 64,
                background: '#1677ff',
                color: '#fff',
            }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            title="回到顶部"
        >
            <VerticalAlignTopOutlined />
        </button>
    )
}