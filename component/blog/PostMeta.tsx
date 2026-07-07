import React from 'react';
import { CalendarOutlined, ClockCircleOutlined, FolderOutlined } from '@ant-design/icons';
import './PostMeta.css';

interface PostMetaProps {
    date?: string;
    /** 阅读时间（分钟），传 0 或 undefined 则不显示 */
    readingTime?: number;
    category?: string;
    className?: string;
}

/**
 * 文章元信息行：日期 / 阅读时间 / 分类
 */
export default function PostMeta({ date, readingTime, category, className }: PostMetaProps) {
    return (
        <div className={`post-meta${className ? ' ' + className : ''}`}>
            {date && (
                <span className="post-meta-item">
                    <CalendarOutlined />
                    <time>{date}</time>
                </span>
            )}
            {readingTime && readingTime > 0 && (
                <span className="post-meta-item">
                    <ClockCircleOutlined />
                    <span>{readingTime} 分钟阅读</span>
                </span>
            )}
            {category && (
                <span className="post-meta-item">
                    <FolderOutlined />
                    <span>{category}</span>
                </span>
            )}
        </div>
    );
}

/**
 * 计算阅读时间（分钟）
 * 中文按 ~400 字/分钟，英文按 ~250 词/分钟；这里用混合估算：纯字数 / 350
 */
export function calcReadingTime(html: string): number {
    const text = html
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, '')
        .trim();
    const chars = text.length;
    return Math.max(1, Math.round(chars / 350));
}
