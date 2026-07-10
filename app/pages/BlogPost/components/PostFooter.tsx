import React, { Suspense, useEffect, useRef, useState } from 'react';
import PrevNextNav from '../../../../component/blog/PrevNextNav';
import RelatedPosts from '../../../../component/blog/RelatedPosts';
import type { BlogPostController } from '../types';

const AuthorBio = React.lazy(() => import('../../../../component/blog/AuthorBio'));

export interface PostFooterProps {
    controller: BlogPostController;
}

/** 文章底部三件套：上一篇/下一篇 + 相关文章 + 作者简介 */
export function PostFooter({ controller }: PostFooterProps) {
    const { state, slug, prev, next } = controller;
    const authorBioTriggerRef = useRef<HTMLDivElement>(null);
    const [shouldLoadAuthorBio, setShouldLoadAuthorBio] = useState(false);

    useEffect(() => {
        if (shouldLoadAuthorBio) return;
        if (typeof IntersectionObserver === 'undefined') {
            setShouldLoadAuthorBio(true);
            return;
        }

        const trigger = authorBioTriggerRef.current;
        if (!trigger) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setShouldLoadAuthorBio(true);
                observer.disconnect();
            }
        }, {
            rootMargin: '200px 0px',
        });

        observer.observe(trigger);
        return () => observer.disconnect();
    }, [shouldLoadAuthorBio]);

    if (state.status !== 'loaded') return null;
    const { frontmatter } = state.post;

    return (
        <footer className="post-footer">
            <PrevNextNav prev={prev} next={next} />
            <RelatedPosts
                slug={slug!}
                tags={frontmatter.tags}
                category={frontmatter.category}
            />
            <div ref={authorBioTriggerRef} style={{ minHeight: 120 }}>
                {shouldLoadAuthorBio && (
                    <Suspense fallback={null}>
                        <AuthorBio variant="compact" />
                    </Suspense>
                )}
            </div>
        </footer>
    );
}
