/// <reference types="vite/client" />

declare module 'virtual:blog-index' {
    interface PostMeta {
        slug: string;
        title: string;
        date: string;
        tags: string[];
        category: string;
        summary: string;
        draft?: boolean;
    }
    const blogIndex: PostMeta[];
    export default blogIndex;
}

declare module 'virtual:post-map' {
    interface PostData {
        frontmatter: {
            title: string;
            date: string;
            tags?: string[];
            category?: string;
        };
        html: string;
    }
    const postMap: Record<string, () => Promise<{ default: PostData }>>;
    export default postMap;
}
