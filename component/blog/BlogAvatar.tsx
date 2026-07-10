import { author } from '../../app/blog/author';

interface BlogAvatarProps {
    size?: number;
}

export default function BlogAvatar({ size = 56 }: BlogAvatarProps) {
    const baseStyle = {
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        background: 'var(--bg-hover)',
    } as const;

    if (author.avatar) {
        return (
            <img
                src={author.avatar}
                alt={author.name}
                style={baseStyle}
            />
        );
    }

    const initials = author.nickname || author.name.slice(0, 2);
    return (
        <div
            style={{
                ...baseStyle,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent, #1677ff)',
                fontWeight: 600,
                fontSize: size * 0.4,
                background: 'linear-gradient(135deg, rgba(22, 119, 255, 0.12), rgba(22, 119, 255, 0.04))',
                border: '1px solid var(--border-base)',
            }}
            aria-label={author.name}
        >
            {initials}
        </div>
    );
}
