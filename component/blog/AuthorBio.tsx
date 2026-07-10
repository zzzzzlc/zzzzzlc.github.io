import React from 'react';
import { author } from '../../app/blog/author';
import BlogAvatar from './BlogAvatar';
import SocialLinks from './SocialLinks';
import './AuthorBio.css';

interface AuthorBioProps {
    /** compact 模式：横向小头像 + 名字 + 简介（用于文章底部） */
    variant?: 'compact' | 'full';
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
