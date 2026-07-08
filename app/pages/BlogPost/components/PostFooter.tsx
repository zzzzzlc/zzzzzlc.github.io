import AuthorBio from '../../../../component/blog/AuthorBio';
import PrevNextNav from '../../../../component/blog/PrevNextNav';
import RelatedPosts from '../../../../component/blog/RelatedPosts';
import type { BlogPostController } from '../types';

export interface PostFooterProps {
    controller: BlogPostController;
}

/** 文章底部三件套：上一篇/下一篇 + 相关文章 + 作者简介 */
export function PostFooter({ controller }: PostFooterProps) {
    const { state, slug, prev, next } = controller;
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
            <AuthorBio variant="compact" />
        </footer>
    );
}
