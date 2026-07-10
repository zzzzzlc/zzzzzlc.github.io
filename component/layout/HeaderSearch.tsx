import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

interface BlogIndexPost {
    slug: string;
    title?: string;
    category?: string;
    tags?: string[];
}

interface HeaderSearchProps {
    onSearchOpen?: () => void;
}

let blogIndexPromise: Promise<BlogIndexPost[]> | null = null;

async function loadBlogIndex(): Promise<BlogIndexPost[]> {
    if (!blogIndexPromise) {
        blogIndexPromise = import('virtual:blog-index').then((mod) => mod.default as BlogIndexPost[]);
    }
    return blogIndexPromise;
}

export default function HeaderSearch({ onSearchOpen }: HeaderSearchProps) {
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [posts, setPosts] = useState<BlogIndexPost[] | null>(null);
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());

    useEffect(() => {
        if (!isOpen && !query.trim()) return;
        let cancelled = false;

        if (!posts) {
            setIsLoading(true);
            loadBlogIndex()
                .then((index) => {
                    if (cancelled) return;
                    setPosts(index);
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        }

        return () => {
            cancelled = true;
        };
    }, [isOpen, query, posts]);

    const results = useMemo(() => {
        if (!deferredQuery || !posts) return [];
        return posts
            .filter((post) =>
                post.title?.toLowerCase().includes(deferredQuery) ||
                post.category?.toLowerCase().includes(deferredQuery) ||
                post.tags?.some((tag) => tag.toLowerCase().includes(deferredQuery)),
            )
            .slice(0, 8);
    }, [deferredQuery, posts]);

    const handleFocus = () => {
        setIsOpen(true);
        onSearchOpen?.();
    };

    const handleSelect = (slug: string) => {
        navigate(`/post/${slug}`);
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
    };

    return (
        <div className="blog-search" onFocusCapture={handleFocus}>
            <label className="blog-search-shell">
                <span className="blog-search-icon" aria-hidden="true">⌕</span>
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={handleFocus}
                    placeholder="搜索文章..."
                    className="blog-search-input"
                    aria-label="搜索文章"
                />
                {query && (
                    <button
                        type="button"
                        className="blog-search-clear"
                        onClick={() => {
                            setQuery('');
                            setIsOpen(false);
                            inputRef.current?.focus();
                        }}
                        aria-label="清空搜索"
                    >
                        ×
                    </button>
                )}
            </label>

            {isOpen && query && (
                <div className="blog-search-panel" role="listbox">
                    {isLoading && <div className="blog-search-empty">加载中...</div>}
                    {!isLoading && results.length === 0 && (
                        <div className="blog-search-empty">未找到相关文章</div>
                    )}
                    {!isLoading && results.map((post) => (
                        <button
                            key={post.slug}
                            type="button"
                            className="blog-search-result"
                            onClick={() => handleSelect(post.slug)}
                        >
                            <span className="blog-search-result-title">{post.title}</span>
                            {post.category && <span className="blog-search-result-category">{post.category}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
