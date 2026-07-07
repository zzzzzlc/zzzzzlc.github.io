import React from 'react';
import { GithubOutlined, MailOutlined, WifiOutlined } from '@ant-design/icons';
import { author } from '../../app/blog/author';
import './SocialLinks.css';

interface SocialLinksProps {
    /** small / default 两种尺寸 */
    size?: 'small' | 'default';
    /** 横向排布间距 */
    className?: string;
}

interface LinkDef {
    href: string;
    icon: React.ReactNode;
    label: string;
}

/**
 * 作者社交链接组：GitHub / Email / RSS
 * 用在 Header、Footer、About、AuthorBio
 */
export default function SocialLinks({ size = 'default', className }: SocialLinksProps) {
    const links: LinkDef[] = [
        { href: author.social.github, icon: <GithubOutlined />, label: 'GitHub' },
        { href: author.social.email, icon: <MailOutlined />, label: 'Email' },
        { href: author.social.rss, icon: <WifiOutlined />, label: 'RSS' },
    ];

    return (
        <nav
            className={`social-links social-links-${size}${className ? ' ' + className : ''}`}
            aria-label="社交链接"
        >
            {links.map((l) => (
                <a
                    key={l.label}
                    href={l.href}
                    target={l.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="social-link"
                    title={l.label}
                    aria-label={l.label}
                >
                    {l.icon}
                </a>
            ))}
        </nav>
    );
}
