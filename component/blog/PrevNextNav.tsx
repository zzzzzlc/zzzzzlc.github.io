import React from 'react';
import { useNavigate } from 'react-router';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import './PrevNextNav.css';

interface NavItem {
    slug: string;
    title: string;
}

interface PrevNextNavProps {
    prev?: NavItem;
    next?: NavItem;
}

/**
 * 文章底部"上一篇 / 下一篇"导航
 */
export default function PrevNextNav({ prev, next }: PrevNextNavProps) {
    const navigate = useNavigate();

    return (
        <nav className="prev-next-nav" aria-label="文章导航">
            {prev ? (
                <button
                    type="button"
                    className="prev-next-item prev-next-prev"
                    onClick={() => navigate(`/post/${prev.slug}`)}
                >
                    <span className="prev-next-label"><LeftOutlined /> 上一篇</span>
                    <span className="prev-next-title">{prev.title}</span>
                </button>
            ) : <span className="prev-next-item prev-next-placeholder" />}
            {next ? (
                <button
                    type="button"
                    className="prev-next-item prev-next-next"
                    onClick={() => navigate(`/post/${next.slug}`)}
                >
                    <span className="prev-next-label">下一篇 <RightOutlined /></span>
                    <span className="prev-next-title">{next.title}</span>
                </button>
            ) : <span className="prev-next-item prev-next-placeholder" />}
        </nav>
    );
}
