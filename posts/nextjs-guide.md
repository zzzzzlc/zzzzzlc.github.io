---
title: Next.js 全指南：从上手到进阶，以及不该用的场景
date: '2026-04-26'
tags:
  - React
  - 前端
category: 前端工程
summary: >-
  系统梳理 Next.js
  的核心能力与使用边界。从路由、渲染模式、数据获取等基础用法，到中间件、并行路由、流式渲染等进阶特性，最终给出明确的选型建议：什么时候该用
  Next.js，什么时候不该用。
---

# Next.js 全指南：从上手到进阶，以及不该用的场景

## 一、问题来源

现代前端项目面临的核心矛盾：**用户需要极致的首屏体验（快、SEO 友好），开发者需要高效的全栈开发体验（路由、数据获取、部署一体化）。**

**具体痛点：**

- 单页应用（SPA）首屏白屏时间长，搜索引擎无法抓取动态内容，SEO 表现差
- 传统 SSR 方案（Express + React 手动拼接）需要自己处理路由、代码分割、数据预取，工程复杂度高
- 静态站点生成（SSG）适合内容不变的页面，但数据频繁变化时需要重新构建，灵活性不足
- 全栈项目需要前后端分离部署，API 跨域、鉴权、部署流程繁琐

**为什么选择 Next.js 而不是其他方案：**

- **对比 CRA / Vite SPA**：Next.js 提供内置 SSR/SSG，无需手动配置服务端渲染
- **对比 Remix**：Next.js 生态更成熟，社区资源更丰富，App Router 的设计理念更贴近 React Server Components 的演进方向
- **对比 Nuxt（Vue）**：如果你团队技术栈是 React，Next.js 是唯一的全栈框架选择
- **对比手搓 SSR**：Next.js 内置路由、代码分割、预渲染、图片优化、中间件等，开箱即用

**但也存在误用风险：**

- 简单的内部管理后台强行使用 Next.js，引入不必要的 SSR 复杂度
- 纯静态展示页用 Next.js，构建产物体积远大于纯静态方案
- 不理解 Server Components 和 Client Components 的边界，导致性能反而变差

本文将系统梳理 Next.js 的核心用法、进阶特性、适用场景以及**明确的使用边界**。

---

## 二、基础用法：从零搭建一个 Next.js 项目

### 2.1 项目初始化

```bash
# 创建项目
npx create-next-app@latest my-app

# 推荐选项：
# ✔ TypeScript: Yes
# ✔ ESLint: Yes
# ✔ Tailwind CSS: Yes
# ✔ src/ directory: Yes
# ✔ App Router: Yes
# ✔ Import alias: @/*
```

项目结构（App Router）：

```
my-app/
├── app/
│   ├── layout.tsx          # 根布局（必须）
│   ├── page.tsx            # 首页
│   ├── loading.tsx         # 全局 loading 状态
│   ├── error.tsx           # 全局 error 边界
│   ├── not-found.tsx       # 404 页面
│   ├── about/
│   │   └── page.tsx        # /about 路由
│   └── blog/
│       ├── page.tsx        # /blog 列表页
│       └── [slug]/
│           └── page.tsx    # /blog/:slug 动态路由
├── components/             # 公共组件
├── lib/                    # 工具函数、配置
├── public/                 # 静态资源
└── middleware.ts           # 中间件（可选）
```

### 2.2 路由系统：App Router 核心概念

App Router 基于**文件系统路由**，`app/` 目录结构即路由结构：

**基本路由：**

```tsx
// app/about/page.tsx → 访问 /about
export default function AboutPage() {
    return <h1>关于我们</h1>;
}
```

**动态路由：**

```tsx
// app/blog/[slug]/page.tsx → 访问 /blog/hello-world
interface Props {
    params: Promise<{ slug: string }>;  // Next.js 15+ params 是 Promise
}

export default async function BlogPost({ params }: Props) {
    const { slug } = await params;
    const post = await getPost(slug);
    return <article>{post.title}</article>;
}

// 生成静态路径（SSG 时使用）
export async function generateStaticParams() {
    const posts = await getAllPosts();
    return posts.map((post) => ({ slug: post.slug }));
}
```

**路由组（Route Groups）：**

```tsx
// (marketing)/about/page.tsx → /about
// (dashboard)/settings/page.tsx → /settings
// 括号目录不出现在 URL 中，用于共享布局
```

**布局系统：**

```tsx
// app/layout.tsx — 根布局，所有页面共享
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="zh-CN">
            <body>
                <nav>全局导航栏</nav>
                {children}
            </body>
        </html>
    );
}

// app/dashboard/layout.tsx — dashboard 布局
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex">
            <aside>侧边栏</aside>
            <main>{children}</main>
        </div>
    );
}
```

**模板 vs 布局：**

- `layout.tsx`：跨路由导航时**保持状态**（不会重新渲染）
- `template.tsx`：每次导航都**重新创建**实例（适合需要重置状态的场景）

### 2.3 渲染模式：SSR / SSG / ISR / CSR

Next.js 支持四种渲染模式，通过不同的函数和配置切换：

**① 服务端渲染（SSR） — 每次请求时生成 HTML：**

```tsx
// app/dashboard/page.tsx
// 默认就是 Server Component，每次请求都会在服务端渲染
export default async function DashboardPage() {
    const data = await fetch('https://api.example.com/stats', {
        cache: 'no-store',  // 不缓存，每次请求都获取最新数据
    });
    const stats = await data.json();
    return <Dashboard stats={stats} />;
}
```

**② 静态站点生成（SSG） — 构建时生成 HTML：**

```tsx
// app/blog/page.tsx
// fetch 默认会缓存（Next.js 的行为），构建时获取数据
export default async function BlogPage() {
    const posts = await fetch('https://api.example.com/posts');
    const data = await posts.json();
    return <PostList posts={data} />;
}
```

**③ 增量静态再生（ISR） — 静态页面定时更新：**

```tsx
// app/blog/[slug]/page.tsx
export default async function BlogPost({ params }: Props) {
    const { slug } = await params;
    const post = await fetch(`https://api.example.com/posts/${slug}`, {
        next: { revalidate: 3600 },  // 每 3600 秒重新验证一次
    });
    const data = await post.json();
    return <Article data={data} />;
}
```

**④ 客户端渲染（CSR） — 浏览器中渲染：**

```tsx
'use client';  // 声明为客户端组件

import { useState, useEffect } from 'react';

export default function ClientOnly() {
    const [data, setData] = useState(null);

    useEffect(() => {
        fetch('/api/data').then(r => r.json()).then(setData);
    }, []);

    if (!data) return <div>加载中...</div>;
    return <div>{data.message}</div>;
}
```

**四种模式对比：**

| 模式 | 渲染时机 | 数据新鲜度 | 服务器压力 | SEO | 适用场景 |
|------|---------|-----------|-----------|-----|---------|
| SSR | 每次请求 | 最新 | 高 | 好 | 个性化页面、实时数据 |
| SSG | 构建时 | 构建时 | 最低 | 好 | 博客、文档、营销页 |
| ISR | 构建时+定时更新 | 可控 | 低 | 好 | 内容更新不频繁的页面 |
| CSR | 浏览器 | 最新 | 无 | 差 | 管理后台、交互密集页 |

### 2.4 数据获取

**Server Components 中直接 fetch：**

```tsx
// Server Component — 默认
async function UserProfile({ userId }: { userId: string }) {
    const res = await fetch(`https://api.example.com/users/${userId}`, {
        next: { tags: ['user'] },  // 按需重新验证的 tag
    });
    const user = await res.json();
    return <div>{user.name}</div>;
}
```

**Client Components 中使用 SWR / React Query：**

```tsx
'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

function ClientProfile({ userId }: { userId: string }) {
    const { data, error, isLoading } = useSWR(
        `/api/users/${userId}`,
        fetcher,
        { refreshInterval: 30000 }  // 30 秒自动刷新
    );

    if (error) return <div>加载失败</div>;
    if (isLoading) return <div>加载中...</div>;
    return <div>{data.name}</div>;
}
```

**Route Handlers（API 路由）：**

```tsx
// app/api/users/route.ts → GET /api/users
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';

    const users = await db.user.findMany({
        skip: (Number(page) - 1) * 10,
        take: 10,
    });

    return NextResponse.json({ users, page: Number(page) });
}

export async function POST(request: Request) {
    const body = await request.json();
    const user = await db.user.create({ data: body });
    return NextResponse.json(user, { status: 201 });
}
```

### 2.5 Server Components vs Client Components

这是 Next.js App Router 最核心的概念，也是最容易混淆的：

```
Server Component（默认）
├── 在服务端执行，不发送 JS 到浏览器
├── 可以直接访问数据库、文件系统
├── 不能使用 useState、useEffect、事件处理
└── 不能使用浏览器 API（window、document）

Client Component（'use client'）
├── 在浏览器中执行（SSR 时也会预渲染）
├── 可以使用 React Hooks、事件处理
├── 可以访问浏览器 API
└── 不能直接访问数据库、文件系统
```

**组件划分策略：**

```tsx
// ✅ Server Component — 数据获取层
async function PostPage() {
    const posts = await fetchPosts();  // 服务端直接查数据库
    return <PostList posts={posts} />;
}

// ✅ Client Component — 交互层
'use client';
function PostList({ posts }: { posts: Post[] }) {
    const [filter, setFilter] = useState('');
    const filtered = posts.filter(p => p.title.includes(filter));
    return (
        <div>
            <input value={filter} onChange={e => setFilter(e.target.value)} />
            {filtered.map(post => <PostCard key={post.id} post={post} />)}
        </div>
    );
}
```

**关键原则：尽量让组件保持为 Server Component，只在需要交互时才标记 `'use client'`。**

---

## 三、进阶用法

### 3.1 Middleware 中间件

Middleware 在请求到达页面之前执行，适合鉴权、重定向、日志等：

```typescript
// middleware.ts（项目根目录）
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // 检查登录状态
    const token = request.cookies.get('auth-token')?.value;

    if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 地域重定向
    const country = request.geo?.country || 'CN';
    if (country !== 'CN' && request.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/en', request.url));
    }

    // 添加自定义请求头
    const response = NextResponse.next();
    response.headers.set('x-request-id', crypto.randomUUID());
    return response;
}

// 配置匹配规则
export const config = {
    matcher: [
        '/dashboard/:path*',    // 匹配 /dashboard 及其子路径
        '/api/:path*',          // 匹配所有 API 路由
        '/((?!_next/static|_next/image|favicon.ico).*)',  // 排除静态资源
    ],
};
```

**注意事项：**
- Middleware 运行在 Edge Runtime，不能使用 Node.js API（如 `fs`、`path`）
- 执行时间有限制（Vercel 免费版 5 秒），不适合耗时操作
- 不要在 Middleware 中做大量计算

### 3.2 并行路由与拦截路由

**并行路由（Parallel Routes）— 同一布局内同时渲染多个页面：**

```tsx
// app/dashboard/@analytics/page.tsx
// app/dashboard/@team/page.tsx
// app/dashboard/layout.tsx

export default function DashboardLayout({
    children,
    analytics,
    team,
}: {
    children: React.ReactNode;
    analytics: React.ReactNode;
    team: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-3">
            <div>{children}</div>
            <div>{analytics}</div>
            <div>{team}</div>
        </div>
    );
}
```

**拦截路由（Intercepting Routes）— 在当前布局内打开其他路由：**

```tsx
// 结构：
// app/feed/page.tsx                    → 正常访问 /feed
// app/@modal/(.)photo/[id]/page.tsx    → 从 /feed 点击时在弹层中打开
// app/photo/[id]/page.tsx              → 直接访问 /photo/:id 时全屏展示

// app/@modal/default.tsx
export default function Default() {
    return null;  // 没有拦截时，modal 插槽为空
}

// app/layout.tsx
export default function Layout({
    children,
    modal,
}: {
    children: React.ReactNode;
    modal: React.ReactNode;
}) {
    return (
        <>
            {children}
            {modal}  {/* 拦截路由的内容渲染在这里 */}
        </>
    );
}
```

**适用场景：**
- 社交平台的图片/文章详情弹窗（Instagram 风格）
- 不离开当前页面的快速预览
- 需要独立 URL 但不想丢失当前页面状态

### 3.3 流式渲染与 Suspense

```tsx
// app/page.tsx
import { Suspense } from 'react';

export default function Page() {
    return (
        <div>
            <h1>首页</h1>
            {/* 快速渲染的部分 */}
            <StaticHeader />

            {/* 慢数据 — 流式渲染，不阻塞整个页面 */}
            <Suspense fallback={<Skeleton />}>
                <SlowDataComponent />
            </Suspense>

            <Suspense fallback={<Skeleton />}>
                <AnotherSlowComponent />
            </Suspense>
        </div>
    );
}

// 慢组件 — 数据获取可能需要数秒
async function SlowDataComponent() {
    const data = await fetch('https://slow-api.example.com/data', {
        cache: 'no-store',
    });
    const result = await data.json();
    return <DataView data={result} />;
}
```

**流式渲染的优势：**
- 页面可以分块传输，用户先看到已就绪的内容
- 某个组件的数据请求失败不影响其他组件
- 结合 Suspense，体验优于传统 SSR 的全页等待

### 3.4 Server Actions

Server Actions 允许客户端组件直接调用服务端函数，无需手写 API：

```tsx
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createPost(formData: FormData) {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;

    // 直接操作数据库
    await db.post.create({
        data: { title, content, authorId: 'current-user' },
    });

    // 重新验证缓存
    revalidatePath('/blog');
    redirect('/blog');
}

export async function deletePost(id: string) {
    await db.post.delete({ where: { id } });
    revalidatePath('/blog');
    // 不需要 redirect，返回即可
}
```

```tsx
// app/blog/new/page.tsx
import { createPost } from '../actions';

export default function NewPostPage() {
    return (
        <form action={createPost}>
            <input name="title" placeholder="标题" required />
            <textarea name="content" placeholder="内容" required />
            <button type="submit">发布</button>
        </form>
    );
}

// 在客户端组件中使用
'use client';
import { deletePost } from '../actions';
import { useTransition } from 'react';

function DeleteButton({ id }: { id: string }) {
    const [isPending, startTransition] = useTransition();

    return (
        <button
            disabled={isPending}
            onClick={() => startTransition(() => deletePost(id))}
        >
            {isPending ? '删除中...' : '删除'}
        </button>
    );
}
```

**安全注意事项：**
- Server Actions 本质是 POST 请求，需要验证用户权限
- 对 `formData` 的输入做校验（推荐用 Zod）
- 不要信任客户端传来的任何数据

### 3.5 图片与字体优化

```tsx
import Image from 'next/image';
import { Inter } from 'next/font/google';

// 字体优化 — 自动子集化，避免布局抖动
const inter = Inter({ subsets: ['latin'] });

export default function Page() {
    return (
        <main className={inter.className}>
            {/* 图片优化 — 自动格式转换、尺寸适配、懒加载 */}
            <Image
                src="/hero.jpg"
                alt="首页横幅"
                width={1200}
                height={600}
                priority          // 首屏图片优先加载
                placeholder="blur" // 模糊占位
            />

            {/* 远程图片需要配置域名 */}
            <Image
                src="https://cdn.example.com/photo.jpg"
                alt="远程图片"
                width={800}
                height={600}
                sizes="(max-width: 768px) 100vw, 50vw"
            />
        </main>
    );
}
```

```js
// next.config.ts — 配置远程图片域名
const nextConfig = {
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'cdn.example.com' },
        ],
    },
};
```

### 3.6 国际化（i18n）

```tsx
// app/[lang]/layout.tsx
import { dictionaries } from '@/lib/i18n';

interface Props {
    params: Promise<{ lang: string }>;
}

export default async function LangLayout({ children, params }: Props & { children: React.ReactNode }) {
    const { lang } = await params;
    const dict = await dictionaries[lang]();

    return (
        <html lang={lang}>
            <body>
                <nav>
                    <a href={`/${lang}`}>{dict.nav.home}</a>
                    <a href={`/${lang}/about`}>{dict.nav.about}</a>
                </nav>
                {children}
            </body>
        </html>
    );
}
```

```tsx
// middleware.ts — 语言检测与重定向
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['zh', 'en'];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const pathnameHasLocale = locales.some(
        locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) return;

    // 根据 Accept-Language 头部重定向
    const locale = request.headers.get('accept-language')?.startsWith('zh') ? 'zh' : 'en';
    request.nextUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
}
```

---

## 四、性能优化实践

### 4.1 缓存策略

Next.js 有多级缓存，理解它们是性能优化的关键：

```
请求级缓存（fetch 的 cache 选项）
├── force-cache       → 缓存直到手动失效（SSG 默认）
├── no-store          → 不缓存（SSR 默认）
└── revalidate: N     → N 秒后重新验证（ISR）

路由级缓存
├── React Cache       → 单次请求内的组件缓存（fetch dedup）
├── Full Route Cache  → 构建时缓存整个路由的渲染结果
└── Router Cache      → 客户端路由缓存（浏览器内存）
```

**按需重新验证：**

```tsx
// 使用 tags 实现精确缓存失效
async function getPost(slug: string) {
    const res = await fetch(`https://api.example.com/posts/${slug}`, {
        next: { tags: [`post-${slug}`] },
    });
    return res.json();
}

// 在 Server Action 或 Route Handler 中触发失效
'use server';
import { revalidateTag } from 'next/cache';

export async function updatePost(slug: string, data: PostData) {
    await db.post.update({ where: { slug }, data });
    revalidateTag(`post-${slug}`);  // 只失效这一篇文章的缓存
}
```

### 4.2 Bundle 分析与代码分割

```bash
# 安装 bundle 分析工具
pnpm add -D @next/bundle-analyzer
```

```js
// next.config.ts
import analyze from '@next/bundle-analyzer';

const withBundleAnalyzer = analyze({
    enabled: process.env.ANALYZE === 'true',
});

export default withBundleAnalyzer({
    // 其他配置
});
```

```bash
# 分析
ANALYZE=true pnpm build
```

**减少客户端 JS 体积的技巧：**

```tsx
// ❌ 整个库被打包到客户端
'use client';
import { marked } from 'marked';  // 40KB+

// ✅ 在 Server Component 中处理
async function MarkdownContent({ content }: { content: string }) {
    const html = marked(content);  // 服务端执行，不增加客户端体积
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ✅ 动态导入大型客户端库
'use client';
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('./HeavyChart'), {
    loading: () => <Skeleton />,
    ssr: false,  // 不需要 SSR
});
```

### 4.3 Metadata 与 SEO

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from 'next';

interface Props {
    params: Promise<{ slug: string }>;
}

// 静态 metadata
export const metadata: Metadata = {
    title: '博客',
    description: '技术博客',
};

// 动态 metadata（根据数据生成）
export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPost(slug);

    return {
        title: `${post.title} | 我的博客`,
        description: post.excerpt,
        openGraph: {
            title: post.title,
            description: post.excerpt,
            images: [post.coverImage],
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: post.title,
        },
    };
}
```

---

## 五、部署方案

### 5.1 Vercel 部署（推荐）

```bash
# 安装 Vercel CLI
pnpm add -g vercel

# 部署
vercel

# 生产环境部署
vercel --prod
```

Vercel 原生支持 Next.js 的所有特性（ISR、Middleware、Edge Runtime、Serverless Functions），零配置。

### 5.2 Docker 自托管部署

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# 依赖安装阶段
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

# 运行阶段
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

```js
// next.config.ts — 启用 standalone 输出
export default {
    output: 'standalone',
};
```

### 5.3 静态导出

```js
// next.config.ts
export default {
    output: 'export',  // 导出纯静态 HTML
    images: {
        unoptimized: true,  // 静态导出不支持图片优化
    },
};
```

**局限：** 静态导出不支持 SSR、ISR、Middleware、Route Handlers、动态路由的 `revalidate` 等。

### 5.4 部署方案对比

| 方案 | SSR | ISR | Middleware | Server Actions | 成本 | 复杂度 |
|------|-----|-----|-----------|---------------|------|--------|
| Vercel | 支持 | 支持 | 支持 | 支持 | 免费额度够用 | 最低 |
| Docker 自托管 | 支持 | 支持 | 支持 | 支持 | 服务器费用 | 中等 |
| 静态导出 + CDN | 不支持 | 不支持 | 不支持 | 不支持 | 极低 | 低 |
| AWS Lambda | 支持 | 有限 | 支持 | 支持 | 按请求计费 | 高 |

---

## 六、Next.js 的边界：什么时候不该用

### 6.1 不该用 Next.js 的场景

**① 纯后台管理系统**

内部使用的管理系统，不需要 SEO，不需要 SSR，用户量有限：

```
推荐方案：Vite + React SPA + antd
原因：
- SPA 更简单，不需要理解 Server/Client Components 边界
- 构建更快，部署更简单（扔到 CDN 即可）
- 表单交互密集，Next.js 的服务端渲染反而增加复杂度
```

**② 高交互的 Web 应用**

在线编辑器、协作白板、实时游戏等：

```
推荐方案：Vite + React + WebSocket
原因：
- 这类应用的状态管理极其复杂，SSR 带来的收益趋近于零
- 首屏渲染不是瓶颈，持续交互的性能才是
- 大量客户端状态，Server Components 无法参与
```

**③ 纯静态展示站**

只有几个页面的公司官网、活动页：

```
推荐方案：Astro / 纯 HTML
原因：
- Astro 生成的 JS 体积更小（默认零 JS）
- 构建速度更快
- Next.js 的 SSR/ISR 能力完全浪费
```

**④ 已有成熟的 SPA 项目**

现有项目运行良好，没有 SEO 需求：

```
推荐方案：维持现状
原因：
- 迁移成本高，需要重构路由、数据获取、组件拆分
- 如果只是想用 React Server Components，可以渐进引入（但心智负担大）
- "技术上更先进" 不是重构的理由，业务价值才是
```

### 6.2 Next.js 的固有局限

**框架层面：**

- **Vendor Lock-in 风险**：深度使用 Vercel 特有功能（ISR、Edge Middleware）后，迁移成本高
- **构建速度**：App Router 的构建比 Pages Router 慢，大型项目可能需要 2-5 分钟
- **缓存复杂度**：多级缓存机制难以理解和调试，`cache` 行为在版本间有过破坏性变更
- **Server Components 生态不成熟**：很多 UI 库尚未适配 RSC，强制 `'use client'` 后失去服务端优势

**运维层面：**

- **Node.js 运行时依赖**：SSR/ISR 需要服务器运行 Node.js，不像纯静态站可以完全依赖 CDN
- **内存泄漏风险**：Server Components 中的不当操作可能导致服务端内存泄漏
- **冷启动延迟**：Serverless 部署时，首次请求响应较慢（Vercel 通过 OOM 缓解，但仍有感知）

### 6.3 选型决策树

```
你的项目需要 SEO 吗？
├── 不需要
│   └── 是管理后台或内部工具吗？
│       ├── 是 → Vite + React SPA
│       └── 否 → 是高交互应用吗？
│           ├── 是 → Vite + React SPA + 状态管理
│           └── 否 → Next.js（CSR 模式也可以）
└── 需要
    └── 内容更新频率？
        ├── 几乎不变 → Astro / Next.js SSG
        ├── 定期更新 → Next.js ISR
        └── 实时更新 → Next.js SSR
```

---

## 七、总结

### 核心要点

- **Next.js 解决的核心问题是 SSR + 全栈一体化**，不是所有项目都需要这个能力
- **App Router + Server Components 是 React 的未来方向**，但学习曲线较陡
- **Server/Client Components 的边界划分**是写出高性能 Next.js 应用的关键
- **多级缓存机制**强大但复杂，需要刻意理解才能用好

### 技术选型速查表

| 维度 | Next.js | Vite SPA | Astro |
|------|---------|----------|-------|
| SSR/SSG | 原生支持 | 需要自己实现 | 原生支持 |
| SEO | 好 | 差（需预渲染） | 好 |
| 全栈能力 | Server Actions + API Routes | 需要独立后端 | 有限 |
| 学习成本 | 高（RSC + 缓存） | 低 | 中 |
| 构建速度 | 慢 | 快 | 中 |
| 交互密集应用 | 可以但非最优 | 最优 | 不适合 |
| 部署灵活度 | Vercel 最优 | 任意静态服务器 | 任意静态服务器 |

### 一句话建议

**Next.js 是需要 SEO 和全栈能力的 React 项目的最佳选择，但不要为了"技术先进"而在不需要 SSR 的项目中使用它。**
