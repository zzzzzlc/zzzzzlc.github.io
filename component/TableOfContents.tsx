import React, { useState, useEffect } from 'react';

interface TocItem {
    id: string;
    text: string;
    level: number;
}

interface TocGroup {
    heading: TocItem;
    children: TocItem[];
}

interface TableOfContentsProps {
    items: TocItem[];
}

function groupItems(items: TocItem[]): TocGroup[] {
    const groups: TocGroup[] = [];
    let cur: TocGroup | null = null;
    for (const item of items) {
        if (item.level === 2) {
            cur = { heading: item, children: [] };
            groups.push(cur);
        } else if (cur) {
            cur.children.push(item);
        }
    }
    return groups;
}

export default function TableOfContents({ items }: TableOfContentsProps) {
    const [activeId, setActiveId] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const groups = groupItems(items);

    // IntersectionObserver 追踪当前标题
    useEffect(() => {
        if (items.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible.length > 0) {
                    setActiveId(visible[0].target.id);
                }
            },
            { rootMargin: '-80px 0px -60% 0px', threshold: [0, 1] }
        );

        items.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [items]);

    const toggleGroup = (id: string) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    if (items.length === 0) return null;

    return (
        <nav className="toc-nav">
            <div className="toc-title">目录</div>
            <ul className="toc-list">
                {groups.map((group) => {
                    const isCollapsed = collapsed.has(group.heading.id);
                    const hasChildren = group.children.length > 0;

                    return (
                        <li key={group.heading.id}>
                            <div className="toc-group-row">
                                <a
                                    href={`#${group.heading.id}`}
                                    className={`toc-item toc-h2 ${activeId === group.heading.id ? 'toc-active' : ''}`}
                                    title={group.heading.text}
                                >
                                    {group.heading.text}
                                </a>
                                {hasChildren && (
                                    <span
                                        className={`toc-toggle ${isCollapsed ? 'toc-toggle-collapsed' : ''}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleGroup(group.heading.id);
                                        }}
                                    >
                                        ▼
                                    </span>
                                )}
                            </div>
                            {hasChildren && !isCollapsed && (
                                <ul className="toc-children-list">
                                    {group.children.map((child) => (
                                        <li key={child.id}>
                                            <a
                                                href={`#${child.id}`}
                                                className={`toc-item toc-h3 ${child.id === activeId ? 'toc-active' : ''}`}
                                                title={child.text}
                                            >
                                                {child.text}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
