import type { ProcessedHtmlResult, TocItem } from '../types';

/** TOC 标题正则：匹配 h2 / h3 */
const HEADING_RE = /<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
/** 标签剥离正则 */
const TAG_RE = /<[^>]+>/g;

/**
 * 处理文章 HTML：为 h2 / h3 注入锚点 id，并提取目录项
 */
export function processHtml(html: string): ProcessedHtmlResult {
    const items: TocItem[] = [];
    let idx = 0;
    const processed = html.replace(
        HEADING_RE,
        (match, tag: string, attrs: string | undefined, content: string) => {
            const text = content.replace(TAG_RE, '').trim();
            if (!text) return match;
            const id = `toc-${idx++}`;
            items.push({ id, text, level: parseInt(tag[1], 10) });
            const attrStr = attrs ?? '';
            return `<${tag} id="${id}"${attrStr}>${content}</${tag}>`;
        },
    );
    return { html: processed, tocItems: items };
}
