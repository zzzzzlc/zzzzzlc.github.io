/**
 * 解析器往返验证（质量门禁）：pnpm admin:verify
 *
 * 对 posts/ 全部文章执行三级校验，任一失败退出码 1：
 *  A. 正文字节级往返：serialize(parse(matter(raw).content)) === matter(raw).content
 *  B. 幂等性：serialize(parse(out)) === out
 *  C. frontmatter 语义等价：matter.stringify 重新生成的 YAML 能解析回相同数据
 *     （原文 summary 折叠点非 js-yaml 生成，无法字节复现；服务端策略是
 *       frontmatter 数据未变时保留原文 YAML 块，仅编辑后重新生成）
 * 另输出：块类型覆盖统计 / frontmatter 非常规键与键序提示（仅提示，不判失败）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parseMarkdown, serializeBlocks } from '../../app/pages/admin/utils/mdBlocks.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const POSTS_DIR = path.join(ROOT, 'posts');
const STRINGIFY_OPTS = { lineWidth: 0, quotingType: "'", noRefs: true };
const CANONICAL_KEYS = ['title', 'date', 'tags', 'category', 'summary', 'draft'];

/** 首个差异位置的上下文片段 */
function firstDiff(a, b) {
    const al = a.split('\n');
    const bl = b.split('\n');
    const n = Math.max(al.length, bl.length);
    for (let i = 0; i < n; i++) {
        if (al[i] !== bl[i]) {
            const from = Math.max(0, i - 2);
            const ctx = (arr) => arr.slice(from, i + 3).map((l, k) => `${from + k === i ? '>' : ' '} ${String(from + k + 1).padStart(4)} | ${l}`).join('\n');
            return `第 ${i + 1} 行不一致\n--- 期望 ---\n${ctx(al)}\n--- 实际 ---\n${ctx(bl)}`;
        }
    }
    return '';
}

const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).sort();
const typeCount = {};
const extraKeyFiles = [];
const orderDiffFiles = [];
const failures = [];

for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { data, content } = matter(raw);

    // A. 正文往返
    const out = serializeBlocks(parseMarkdown(content));
    if (out !== content) {
        failures.push(`[A 正文往返] ${file}\n${firstDiff(content, out)}`);
        continue;
    }
    // B. 幂等
    const out2 = serializeBlocks(parseMarkdown(out));
    if (out2 !== out) {
        failures.push(`[B 幂等] ${file}\n${firstDiff(out, out2)}`);
        continue;
    }
    // C. frontmatter 语义等价：重新生成 → 再解析 → 数据一致
    const full = matter.stringify(out, data, STRINGIFY_OPTS);
    const reparsed = matter(full);
    if (JSON.stringify(reparsed.data) !== JSON.stringify(data) || reparsed.content !== out) {
        failures.push(`[C frontmatter] ${file}\n${firstDiff(raw, full)}`);
    }

    // 统计（不影响门禁）
    for (const block of parseMarkdown(content)) {
        typeCount[block.type] = (typeCount[block.type] || 0) + 1;
    }
    const keys = Object.keys(data);
    const extras = keys.filter((k) => !CANONICAL_KEYS.includes(k));
    if (extras.length) extraKeyFiles.push(`${file}: ${extras.join(',')}`);
    if (keys.join(',') !== CANONICAL_KEYS.filter((k) => keys.includes(k)).join(',')) {
        orderDiffFiles.push(file);
    }
}

console.log(`共 ${files.length} 篇，块类型分布：`, typeCount);
if (extraKeyFiles.length) console.log('非常规 frontmatter 键（服务端需透传）：\n ', extraKeyFiles.join('\n  '));
if (orderDiffFiles.length) console.log('键序与规范不同（保存时将被规范排序，仅提示）：\n ', orderDiffFiles.join('\n  '));

if (failures.length) {
    console.error(`\n失败 ${failures.length} 篇：\n\n${failures.join('\n\n')}`);
    process.exit(1);
}
console.log(`\n全部 ${files.length} 篇 PASS（正文字节级 / 幂等 / frontmatter 语义 三级校验）`);
