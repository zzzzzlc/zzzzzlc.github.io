/**
 * posts 文章管理服务（本地 dev 用，裸 node:http，零框架依赖）。
 *
 * 启动：node server/posts-admin/index.js [--port 8788]
 *
 * API（全 JSON，经 vite dev proxy `/api` 转发或直连）：
 *   GET    /api/posts          文章列表（含 draft，date 降序）
 *   GET    /api/posts/:slug    单篇（frontmatter + 正文，正文已剥离 frontmatter）
 *   POST   /api/posts          新建 { slug, frontmatter, content }
 *   PUT    /api/posts/:slug    更新 { frontmatter, content, newSlug? }
 *   DELETE /api/posts/:slug    删除
 *
 * 写入策略：frontmatter 数据与原文一致时保留原 YAML 块字节不动（避免
 * js-yaml 重新折叠 summary 产生 diff noise），数据有变时才重新生成。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

const PORT = getArg('port', 8788);
const BODY_LIMIT = 2 * 1024 * 1024; // 2MB
const STRINGIFY_OPTS = { lineWidth: 0, quotingType: "'", noRefs: true };
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FRONTMATTER_RE = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/;

const POSTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../posts');

/** 业务错误：status 会被采用为响应码 */
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/* ============ 文件层 ============ */

/** slug → 绝对路径；白名单正则 + 目录包含双重校验（防目录穿越） */
function resolvePostFile(slug) {
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
        throw new ApiError(400, `invalid slug: ${JSON.stringify(slug)}`);
    }
    const file = path.join(POSTS_DIR, `${slug}.md`);
    if (!file.startsWith(POSTS_DIR + path.sep) || path.basename(file) !== `${slug}.md`) {
        throw new ApiError(400, 'path escape rejected');
    }
    return file;
}

function listPostFiles() {
    if (!fs.existsSync(POSTS_DIR)) return [];
    return fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).sort();
}

function readPost(slug) {
    const file = resolvePostFile(slug);
    if (!fs.existsSync(file)) throw new ApiError(404, 'post not found');
    const raw = fs.readFileSync(file, 'utf-8');
    const { data, content } = matter(raw);
    return { raw, data, content };
}

/** frontmatter 归一化：字段校验 + 固定键序（draft 为 false 时省略，与现存文件一致） */
function normalizeFrontmatter(input) {
    if (!input || typeof input !== 'object') throw new ApiError(400, 'invalid frontmatter');
    const { title, date, tags, category, summary, draft } = input;
    if (typeof title !== 'string' || !title.trim()) throw new ApiError(400, 'frontmatter.title 必填');
    if (typeof date !== 'string' || !DATE_RE.test(date)) throw new ApiError(400, 'frontmatter.date 须为 YYYY-MM-DD');
    if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) {
        throw new ApiError(400, 'frontmatter.tags 须为字符串数组');
    }
    if (typeof category !== 'string' || !category.trim()) throw new ApiError(400, 'frontmatter.category 必填');
    if (typeof summary !== 'string') throw new ApiError(400, 'frontmatter.summary 须为字符串');
    const ordered = { title, date, tags, category, summary };
    if (draft === true) ordered.draft = true;
    return ordered;
}

/**
 * 组装整篇文件内容：frontmatter 数据与磁盘一致 → 保留原 YAML 块字节；
 * 否则由 gray-matter 重新生成（summary 折叠风格将被规范化）。
 */
function buildFileContent(prevRaw, prevData, frontmatter, content) {
    const sameData = JSON.stringify(prevData) === JSON.stringify(frontmatter);
    const m = prevRaw.match(FRONTMATTER_RE);
    if (sameData && m) return m[1] + content;
    return matter.stringify(content, frontmatter, STRINGIFY_OPTS);
}

/* ============ HTTP 层 ============ */

function sendJson(res, status, obj) {
    const body = status === 204 ? '' : JSON.stringify(obj);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > BODY_LIMIT) {
                reject(new ApiError(413, 'body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const text = Buffer.concat(chunks).toString('utf-8');
                resolve(text ? JSON.parse(text) : {});
            } catch {
                reject(new ApiError(400, 'invalid JSON body'));
            }
        });
        req.on('error', () => reject(new ApiError(400, 'request error')));
    });
}

/* ============ 处理器 ============ */

function handleList() {
    const posts = listPostFiles().map((file) => {
        const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
        const { data } = matter(raw);
        return {
            slug: file.replace(/\.md$/, ''),
            title: typeof data.title === 'string' ? data.title : '',
            date: typeof data.date === 'string' ? data.date : '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            category: typeof data.category === 'string' ? data.category : '',
            summary: typeof data.summary === 'string' ? data.summary : '',
            draft: data.draft === true,
        };
    });
    posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
    return { status: 200, body: { posts } };
}

function handleGetPost(slug) {
    const { data, content } = readPost(slug);
    return {
        status: 200,
        body: {
            post: {
                slug,
                frontmatter: {
                    title: typeof data.title === 'string' ? data.title : '',
                    date: typeof data.date === 'string' ? data.date : '',
                    tags: Array.isArray(data.tags) ? data.tags : [],
                    category: typeof data.category === 'string' ? data.category : '',
                    summary: typeof data.summary === 'string' ? data.summary : '',
                    draft: data.draft === true,
                },
                content,
            },
        },
    };
}

function handleCreate(body) {
    const { slug, frontmatter, content } = body ?? {};
    const file = resolvePostFile(slug);
    if (fs.existsSync(file)) throw new ApiError(409, 'post already exists');
    const normalized = normalizeFrontmatter(frontmatter);
    const text = typeof content === 'string' ? content : '';
    fs.writeFileSync(file, matter.stringify(text, normalized, STRINGIFY_OPTS), 'utf-8');
    return { status: 201, body: { post: { slug } } };
}

function handleUpdate(slug, body) {
    const { frontmatter, content, newSlug } = body ?? {};
    const { raw, data } = readPost(slug);
    const normalized = normalizeFrontmatter(frontmatter);
    const text = typeof content === 'string' ? content : '';
    const file = resolvePostFile(slug);

    if (typeof newSlug === 'string' && newSlug !== slug) {
        const newFile = resolvePostFile(newSlug);
        if (fs.existsSync(newFile)) throw new ApiError(409, 'target slug already exists');
        fs.writeFileSync(newFile, buildFileContent(raw, data, normalized, text), 'utf-8');
        fs.unlinkSync(file);
        return { status: 200, body: { post: { slug: newSlug } } };
    }
    fs.writeFileSync(file, buildFileContent(raw, data, normalized, text), 'utf-8');
    return { status: 200, body: { post: { slug } } };
}

function handleDelete(slug) {
    const file = resolvePostFile(slug);
    if (!fs.existsSync(file)) throw new ApiError(404, 'post not found');
    fs.unlinkSync(file);
    return { status: 204, body: null };
}

/* ============ 路由 ============ */

async function route(req, res) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (req.method === 'OPTIONS') return sendJson(res, 204, null);
    if (segments[0] !== 'api' || segments[1] !== 'posts') {
        throw new ApiError(404, `no route: ${req.method} ${url.pathname}`);
    }

    if (segments.length === 2) {
        if (req.method === 'GET') {
            const r = handleList();
            return sendJson(res, r.status, r.body);
        }
        if (req.method === 'POST') {
            const r = handleCreate(await readBody(req));
            return sendJson(res, r.status, r.body);
        }
    }
    if (segments.length === 3) {
        const slug = segments[2];
        if (req.method === 'GET') {
            const r = handleGetPost(slug);
            return sendJson(res, r.status, r.body);
        }
        if (req.method === 'PUT') {
            const r = handleUpdate(slug, await readBody(req));
            return sendJson(res, r.status, r.body);
        }
        if (req.method === 'DELETE') {
            const r = handleDelete(slug);
            return sendJson(res, r.status, r.body);
        }
    }
    throw new ApiError(405, `method not allowed: ${req.method}`);
}

const server = http.createServer((req, res) => {
    route(req, res).catch((err) => {
        const status = err instanceof ApiError ? err.status : 500;
        sendJson(res, status, { error: err.message ?? 'internal error' });
    });
});

server.listen(PORT, () => {
    const count = listPostFiles().length;
    console.log(`[posts-admin] http://localhost:${PORT}  (posts: ${POSTS_DIR}, ${count} 篇)`);
});

process.on('SIGINT', () => {
    server.close(() => process.exit(0));
});
