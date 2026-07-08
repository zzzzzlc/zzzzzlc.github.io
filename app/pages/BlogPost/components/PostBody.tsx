import TableOfContents from '@components/TableOfContents';
import type { BlogPostController } from '../types';

export interface PostBodyProps {
    controller: BlogPostController;
}

/** 文章正文：Markdown 渲染 + 目录 */
export function PostBody({ controller }: PostBodyProps) {
    const { processedHtml, tocItems } = controller;

    return (
        <div className="post-body">
            <div
                className="markdown-body"
                style={{ flex: 1, minWidth: 0 }}
                dangerouslySetInnerHTML={{ __html: processedHtml }}
            />
            {tocItems.length > 0 && <TableOfContents items={tocItems} />}
        </div>
    );
}
