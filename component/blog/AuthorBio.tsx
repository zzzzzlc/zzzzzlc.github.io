import React from 'react';
import { author } from '../../app/blog/author';
import SocialLinks from './SocialLinks';
import './AuthorBio.css';

interface AuthorBioProps {
    /** compact 模式：横向小头像 + 名字 + 简介（用在文章底部） */
    variant?: 'compact' | 'full';
}

/**
 * 头像组件：avatar 为空时渲染 monogram（姓名首字母）
 */
function BlogAvatar({ size = 56 }: { size?: number }) {
    if (author.avatar) {
        return (
            <img
                src={author.avatar}
                alt={author.name}
                className="blog-avatar"
                style={{ width: size, height: size }}
            />
        );
    }
    const initials = author.nickname || author.name.slice(0, 2);
    return (
        <div
            className="blog-avatar blog-avatar-monogram"
            style={{ width: size, height: size, fontSize: size * 0.4 }}
            aria-label={author.name}
        >
            {initials}
        </div>
    );
}

export default function AuthorBio({ variant = 'full' }: AuthorBioProps) {
    if (variant === 'compact') {
        return (
            <div className="author-bio author-bio-compact">
                <BlogAvatar size={48} />
                <div className="author-bio-content">
                    <div className="author-bio-name">{author.name}</div>
                    <div className="author-bio-text">{author.bio}</div>
                </div>
                <SocialLinks size="small" />
            </div>
        );
    }
    return (
        <div className="author-bio author-bio-full">
            <BlogAvatar size={72} />
            <div className="author-bio-content">
                <div className="author-bio-name">{author.name}</div>
                <div className="author-bio-text">{author.bio}</div>
                <SocialLinks />
            </div>
        </div>
    );
}

export { BlogAvatar };
