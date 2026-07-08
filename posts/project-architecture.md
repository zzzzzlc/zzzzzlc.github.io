---
title: 项目架构设计：从前端到全栈的架构选型与落地
date: '2026-02-24'
tags:
  - 设计原则
  - 架构
category: 架构
summary: >-
  从项目架构混乱的痛点出发，系统梳理前端架构（SPA / SSR / Islands）、全栈架构（单体 / 微服务 / BFF）、工程架构（Monorepo
  / Polyrepo）、状态管理与数据流设计，覆盖分层设计、目录规范、模块通信、错误边界等核心问题，给出不同规模的选型建议与明确的架构边界。
---

# 项目架构设计：从前端到全栈的架构选型与落地

## 一、问题来源

架构问题的本质：**代码量增长后，如何保持开发效率和可维护性。**

**小项目阶段（< 1 万行）：**

- 代码怎么放都行，一个人几天就能看完全部代码
- 改一个功能顺手就改了，不需要考虑模块边界

**中型项目（1-10 万行）：**

- 目录结构混乱，找个组件要在 10 个文件夹里翻
- 公共组件和业务组件混在一起，改一个组件牵出一串 bug
- 新人入职一周还看不懂项目结构，上手成本极高

**大型项目（10 万行+）：**

- 多团队协作时互相阻塞，一个发布流程要等所有人
- 技术栈锁定（想升级 React 版本，但老模块不敢动）
- 构建时间从 1 分钟涨到 10 分钟，开发体验急剧下降

**核心矛盾：架构不是"设计"出来的，是在业务增长过程中"演进"出来的。过早的架构设计是过度工程，过晚的架构调整是技术债。**

---

## 二、前端架构模式

### 2.1 单页应用（SPA）

最经典的前端架构，所有 UI 在客户端渲染。

```
适用场景：管理后台、内部工具、交互密集型应用
代表技术：React + Vite、Vue + Vite、Angular
```

```
project/
├── public/                  # 静态资源（不经过构建）
│   └── favicon.ico
├── src/
│   ├── app/                 # 应用入口 + 路由配置
│   │   ├── App.tsx
│   │   └── router.tsx
│   ├── pages/               # 页面组件（路由级别）
│   │   ├── Home/
│   │   │   └── index.tsx
│   │   ├── User/
│   │   │   ├── index.tsx
│   │   │   └── components/  # 页面私有组件
│   │   │       └── UserCard.tsx
│   │   └── Settings/
│   │       └── index.tsx
│   ├── components/          # 公共组件（跨页面复用）
│   │   ├── Button/
│   │   │   └── index.tsx
│   │   ├── Table/
│   │   │   └── index.tsx
│   │   └── Layout/
│   │       └── index.tsx
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useAuth.ts
│   │   └── usePagination.ts
│   ├── services/            # API 请求层
│   │   ├── request.ts       # axios/fetch 封装
│   │   ├── user.ts
│   │   └── product.ts
│   ├── stores/              # 状态管理
│   │   ├── useUserStore.ts
│   │   └── useAppStore.ts
│   ├── utils/               # 工具函数
│   │   ├── format.ts
│   │   └── validate.ts
│   ├── types/               # TypeScript 类型定义
│   │   ├── api.d.ts
│   │   └── global.d.ts
│   └── styles/              # 全局样式
│       └── global.css
├── package.json
└── vite.config.ts
```

**分层原则：**

```
页面层（Pages）
├── 职责：路由匹配、页面布局、组合组件
├── 规则：不包含业务逻辑，只做数据获取和组件编排
└── 依赖：组件层、Hooks、Services

组件层（Components）
├── 职责：UI 展示 + 用户交互
├── 公共组件：跨页面复用（Button、Table、Modal）
├── 页面组件：页面私有（UserCard、OrderList）
└── 规则：通过 Props 接收数据，通过回调通知父组件

逻辑层（Hooks / Services / Stores）
├── Hooks：可复用的有状态逻辑（useAuth、usePagination）
├── Services：API 请求封装（与后端对接的唯一入口）
├── Stores：全局状态管理（用户信息、应用配置）
└── 规则：不依赖具体组件，可独立测试

工具层（Utils / Types）
├── Utils：纯函数，无副作用（format、validate）
├── Types：类型定义，所有模块共享
└── 规则：不依赖任何上层模块
```

**依赖方向：单向向下，不能反向依赖：**

```
Pages → Components → Hooks → Services → Utils
                              ↗
                        Stores
```

### 2.2 服务端渲染（SSR）

适合需要 SEO 和首屏性能的项目。

```
适用场景：电商、内容平台、博客、营销页
代表技术：Next.js、Nuxt、Remix
```

```
nextjs-app/
├── app/                     # App Router（Next.js 13+）
│   ├── layout.tsx           # 根布局
│   ├── page.tsx             # 首页
│   ├── loading.tsx          # Loading UI
│   ├── error.tsx            # Error 边界
│   ├── (marketing)/         # 路由组：营销页
│   │   ├── about/page.tsx
│   │   └── pricing/page.tsx
│   ├── dashboard/           # 路由组：后台
│   │   ├── layout.tsx       # 后台布局（侧边栏）
│   │   ├── page.tsx
│   │   └── settings/page.tsx
│   └── api/                 # API Routes
│       └── users/route.ts
├── components/
│   ├── server/              # Server Components
│   └── client/              # Client Components（'use client'）
├── lib/                     # 服务端逻辑
│   ├── db.ts                # 数据库连接
│   └── auth.ts              # 鉴权
├── actions/                 # Server Actions
│   └── user.ts
└── middleware.ts            # 中间件
```

**SSR 的核心分层：**

```
Server Components（默认）
├── 数据获取（fetch / DB）
├── SEO 相关的静态内容
├── 不发送 JS 到浏览器
└── 不能使用 useState / useEffect

Client Components（'use client'）
├── 用户交互（表单、弹窗）
├── 浏览器 API（window、localStorage）
├── 状态管理
└── 也支持 SSR 预渲染
```

### 2.3 Islands 架构

适合内容为主的网站，大部分页面是静态 HTML，少量交互区域独立 hydrated。

```
适用场景：博客、文档站、营销官网
代表技术：Astro、Fresh（Deno）
```

```
astro-site/
├── src/
│   ├── layouts/
│   │   └── Base.astro       # 基础布局（纯 HTML，无 JS）
│   ├── pages/
│   │   ├── index.astro      # 首页（默认零 JS）
│   │   └── blog/
│   │       ├── index.astro  # 博客列表（静态）
│   │       └── [slug].astro # 博客详情（静态内容 + 交互组件）
│   ├── components/
│   │   ├── Header.astro     # 静态导航（无 JS）
│   │   ├── Search.tsx       # 搜索组件（Island，独立 hydrated）
│   │   └── Comments.tsx     # 评论区（Island，独立 hydrated）
│   └── content/
│       └── blog/            # Markdown 文章
└── astro.config.mjs
```

**Islands 核心思想：**

```
传统 SPA：
┌─────────────────────────────────────┐
│           全部 JS Hydration          │  → 整个页面都需要 JS
│  ┌─────┐ ┌──────┐ ┌──────────────┐  │
│  │导航栏│ │ 内容 │ │    评论区     │  │
│  └─────┘ └──────┘ └──────────────┘  │
└─────────────────────────────────────┘

Islands 架构：
┌─────────────────────────────────────┐
│          纯 HTML（无 JS）            │  → 静态内容零 JS
│  ┌─────┐ ┌──────┐ ┌──────────────┐  │
│  │导航栏│ │ 内容 │ │ [评论区 🏝️]  │  │  → 只有评论区需要 JS
│  └─────┘ └──────┘ └──────────────┘  │
└─────────────────────────────────────┘
```

### 2.4 前端架构选型对比

| 维度 | SPA | SSR（Next.js） | Islands（Astro） |
|------|-----|---------------|-----------------|
| 首屏速度 | 慢 | 快 | 最快 |
| SEO | 差 | 好 | 好 |
| 交互复杂度 | 最强 | 强 | 弱 |
| JS 体积 | 大 | 中 | 最小 |
| 开发体验 | 最简单 | 中等 | 简单 |
| 构建速度 | 快 | 慢 | 中 |
| 适用场景 | 管理后台 | 电商/内容站 | 博客/文档/营销 |

---

## 三、全栈架构模式

### 3.1 单体架构（Monolith）

所有功能在一个项目中，最简单的全栈方案。

```
适用场景：初创项目、MVP、小团队（< 5 人）
```

```
monolith-app/
├── client/                  # 前端
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/
│   └── vite.config.ts
├── server/                  # 后端
│   ├── src/
│   │   ├── modules/         # 业务模块
│   │   │   ├── user/        # 用户模块
│   │   │   │   ├── controller.ts
│   │   │   │   ├── service.ts
│   │   │   │   ├── repository.ts
│   │   │   │   └── user.test.ts
│   │   │   ├── order/       # 订单模块
│   │   │   │   ├── controller.ts
│   │   │   │   ├── service.ts
│   │   │   │   ├── repository.ts
│   │   │   │   └── order.test.ts
│   │   │   └── product/     # 商品模块
│   │   ├── middleware/      # 中间件
│   │   │   ├── auth.ts
│   │   │   ├── error-handler.ts
│   │   │   └── rate-limit.ts
│   │   ├── config/          # 配置
│   │   │   └── index.ts
│   │   └── app.ts           # Express/Fastify 入口
│   └── tsconfig.json
├── shared/                  # 前后端共享
│   ├── types/               # 类型定义
│   │   ├── user.ts
│   │   └── order.ts
│   └── validators/          # 校验逻辑（前后端复用）
│       └── user.ts
├── package.json
└── docker-compose.yml
```

**单体架构的三层分离：**

```typescript
// ===== Controller 层：接收请求，返回响应 =====
// server/src/modules/user/controller.ts
import { FastifyInstance } from 'fastify';
import { UserService } from './service';

export async function userRoutes(app: FastifyInstance) {
    const userService = new UserService();

    app.get('/users/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const user = await userService.getUser(id);
        if (!user) return reply.status(404).send({ code: 'NOT_FOUND' });
        return user;
    });

    app.post('/users', async (req, reply) => {
        const data = req.body as CreateUserDTO;
        const user = await userService.createUser(data);
        return reply.status(201).send(user);
    });
}

// ===== Service 层：业务逻辑 =====
// server/src/modules/user/service.ts
import { UserRepository } from './repository';

export class UserService {
    private repo = new UserRepository();

    async getUser(id: string) {
        return this.repo.findById(id);
    }

    async createUser(data: CreateUserDTO) {
        // 业务规则校验
        const existing = await this.repo.findByEmail(data.email);
        if (existing) throw new AppError(409, 'DUPLICATE', '邮箱已注册');

        // 密码加密
        const hashedPassword = await bcrypt.hash(data.password, 10);

        return this.repo.create({
            ...data,
            password: hashedPassword,
        });
    }
}

// ===== Repository 层：数据访问 =====
// server/src/modules/user/repository.ts
import { prisma } from '@/config/database';

export class UserRepository {
    async findById(id: string) {
        return prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true, email: true, role: true },
        });
    }

    async findByEmail(email: string) {
        return prisma.user.findUnique({ where: { email } });
    }

    async create(data: CreateUserInput) {
        return prisma.user.create({ data });
    }
}
```

**优点：**
- 开发、调试、部署都最简单
- 共享类型定义，前后端类型安全
- 不需要处理分布式问题（网络延迟、数据一致性）

**缺点：**
- 所有模块耦合在一起，改动一处可能影响全局
- 无法独立扩展（用户模块和商品模块共享同一个进程）
- 代码量增长后，构建和启动变慢

### 3.2 BFF 架构（Backend For Frontend）

为不同客户端（Web、App、小程序）提供专用后端接口。

```
适用场景：多端（Web + App + 小程序）、前端团队主导后端
```

```
bff-architecture/
├── web-bff/                 # Web 端 BFF
│   ├── src/
│   │   ├── modules/
│   │   │   ├── feed/        # 首页信息流（Web 专属布局）
│   │   │   └── profile/     # 个人主页（Web 需要更多数据）
│   │   └── app.ts
│   └── package.json
├── mobile-bff/              # App 端 BFF
│   ├── src/
│   │   ├── modules/
│   │   │   ├── feed/        # 首页信息流（App 专属卡片布局）
│   │   │   └── profile/     # 个人主页（App 需要精简数据）
│   │   └── app.ts
│   └── package.json
├── backend-services/        # 底层微服务
│   ├── user-service/
│   ├── content-service/
│   └── payment-service/
└── gateway/                 # API 网关（鉴权、限流、路由）
```

**BFF 的数据聚合示例：**

```typescript
// web-bff/src/modules/feed/service.ts
// Web 端首页需要聚合多种数据
export class FeedService {
    async getHomePage(userId: string) {
        // 并行调用多个底层服务
        const [recommend, trending, following] = await Promise.all([
            this.recommendService.getList(userId, { pageSize: 10 }),
            this.contentService.getTrending({ pageSize: 5 }),
            this.userService.getFollowingPosts(userId, { pageSize: 20 }),
        ]);

        // Web 端特有的数据组装
        return {
            recommend: recommend.items,
            trending: trending.items,
            feed: following.items.map(post => ({
                ...post,
                author: this.formatAuthor(post.author),    // Web 需要完整作者信息
                interaction: this.getInteraction(post),     // Web 需要互动状态
            })),
            sidebar: await this.getSidebarData(userId),     // Web 专属侧边栏
        };
    }
}

// mobile-bff/src/modules/feed/service.ts
// App 端首页数据更精简
export class FeedService {
    async getHomePage(userId: string) {
        const feed = await this.userService.getFollowingPosts(userId, { pageSize: 20 });

        return {
            feed: feed.items.map(post => ({
                id: post.id,
                title: post.title,
                coverImage: post.coverImage,                // App 只需要封面图
                authorName: post.author.name,               // App 只需要作者名
            })),
        };
    }
}
```

**优点：**
- 各端独立优化，数据格式和请求策略互不影响
- 前端团队可以自主开发 BFF，不依赖后端排期
- 移动端可以减少数据传输量

**缺点：**
- 多了一层服务，运维成本增加
- BFF 层可能变成"另一个后端"，逻辑越来越重
- 多个 BFF 之间可能有重复代码

### 3.3 微服务架构

按业务域拆分独立服务，每个服务独立开发、部署、扩展。

```
适用场景：大型团队（20+ 人）、高并发、独立扩展需求
```

```
microservices/
├── services/
│   ├── user-service/         # 用户服务
│   │   ├── src/
│   │   │   ├── controller/
│   │   │   ├── service/
│   │   │   ├── repository/
│   │   │   └── app.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── order-service/        # 订单服务
│   ├── payment-service/      # 支付服务
│   ├── product-service/      # 商品服务
│   └── notification-service/ # 通知服务
├── gateway/                  # API 网关
│   └── src/
│       ├── routes.ts         # 路由映射
│       ├── auth.ts           # 鉴权中间件
│       └── rate-limit.ts     # 限流
├── shared/                   # 共享库
│   ├── proto/                # gRPC 协议定义
│   └── types/                # 共享类型
├── infra/                    # 基础设施
│   ├── docker-compose.yml
│   ├── k8s/                  # Kubernetes 配置
│   └── terraform/            # IaC
└── scripts/
    └── setup.sh
```

**服务间通信：**

```typescript
// ===== 方式一：HTTP REST（简单场景）=====
// order-service 调用 user-service
async function getUserInfo(userId: string) {
    const res = await fetch(`http://user-service:3001/api/users/${userId}`);
    return res.json();
}

// ===== 方式二：消息队列（异步、解耦）=====
// order-service 发布事件
await messageQueue.publish('order.created', {
    orderId: order.id,
    userId: order.userId,
    amount: order.totalAmount,
});

// notification-service 订阅事件
messageQueue.subscribe('order.created', async (event) => {
    await sendOrderConfirmationEmail(event.userId, event.orderId);
});

// payment-service 订阅事件
messageQueue.subscribe('order.created', async (event) => {
    await processPayment(event.orderId, event.amount);
});

// ===== 方式三：gRPC（高性能内部通信）=====
// proto/order.proto
// service OrderService {
//     rpc GetOrder(OrderRequest) returns (OrderResponse);
//     rpc CreateOrder(CreateOrderRequest) returns (OrderResponse);
// }
```

**优点：**
- 独立开发部署，团队互不阻塞
- 独立扩展（支付服务高并发时只扩容支付服务）
- 故障隔离（一个服务挂了不影响其他服务）

**缺点：**
- 运维复杂度指数级增长（服务发现、链路追踪、日志聚合）
- 分布式事务问题（下单 + 扣库存 + 扣余额如何保证一致性）
- 网络延迟和不可靠性
- 调试困难（一个请求跨多个服务）

### 3.4 全栈架构选型决策

| 维度 | 单体 | BFF | 微服务 |
|------|------|-----|--------|
| 开发效率 | 最高 | 高 | 低 |
| 部署复杂度 | 低 | 中 | 高 |
| 运维成本 | 低 | 中 | 高 |
| 独立扩展 | 不支持 | 部分 | 完全支持 |
| 团队规模 | 1-5 人 | 5-15 人 | 15+ 人 |
| 技术要求 | 低 | 中 | 高 |

---

## 四、工程架构：Monorepo vs Polyrepo

### 4.1 Monorepo

多个项目/包放在同一个仓库中管理。

```
适用场景：多个关联项目、共享组件库、全栈项目
代表工具：pnpm workspace、Turborepo、Nx
```

```
monorepo/
├── apps/
│   ├── web/                 # Web 应用
│   │   ├── src/
│   │   └── package.json
│   ├── admin/               # 管理后台
│   │   ├── src/
│   │   └── package.json
│   └── server/              # 后端服务
│       ├── src/
│       └── package.json
├── packages/
│   ├── ui/                  # 共享 UI 组件库
│   │   ├── src/
│   │   │   ├── Button.tsx
│   │   │   ├── Table.tsx
│   │   │   └── index.ts
│   │   └── package.json     # name: "@myapp/ui"
│   ├── shared/              # 共享工具库
│   │   ├── src/
│   │   │   ├── format.ts
│   │   │   ├── validate.ts
│   │   │   └── index.ts
│   │   └── package.json     # name: "@myapp/shared"
│   └── types/               # 共享类型
│       ├── src/
│       │   ├── user.ts
│       │   └── order.ts
│       └── package.json     # name: "@myapp/types"
├── pnpm-workspace.yaml
├── turbo.json               # Turborepo 配置
└── package.json
```

```yaml
# pnpm-workspace.yaml
packages:
    - 'apps/*'
    - 'packages/*'
```

```json
// turbo.json — Turborepo 增量构建
{
    "$schema": "https://turbo.build/schema.json",
    "pipeline": {
        "build": {
            "dependsOn": ["^build"],
            "outputs": ["dist/**"]
        },
        "lint": {},
        "test": {
            "dependsOn": ["build"]
        },
        "dev": {
            "cache": false,
            "persistent": true
        }
    }
}
```

**跨包引用：**

```json
// apps/web/package.json
{
    "dependencies": {
        "@myapp/ui": "workspace:*",
        "@myapp/shared": "workspace:*",
        "@myapp/types": "workspace:*"
    }
}
```

```tsx
// apps/web/src/pages/Home.tsx
import { Button, Table } from '@myapp/ui';
import { formatPrice } from '@myapp/shared';
import type { User } from '@myapp/types';
```

**优点：**
- 共享代码零成本（直接引用，不需要发 npm 包）
- 原子提交（一次提交同时更新多个包）
- 统一的 CI/CD 和代码规范

**缺点：**
- 仓库体积大，克隆和构建慢
- 需要工具支持（pnpm workspace + Turborepo）
- 权限管理粗粒度（无法限制某些人只访问某些包）

### 4.2 Polyrepo

每个项目/包独立仓库。

```
适用场景：独立项目、开源库、团队边界清晰
```

```
github.com/myorg/
├── web-app/          # Web 应用（独立仓库）
├── admin-app/        # 管理后台（独立仓库）
├── server/           # 后端服务（独立仓库）
├── ui-lib/           # UI 组件库（独立仓库，发 npm 包）
└── shared-utils/     # 工具库（独立仓库，发 npm 包）
```

**优点：**
- 仓库独立，权限管理精细
- 构建快（每个仓库只构建自己的代码）
- CI/CD 简单

**缺点：**
- 共享代码需要发 npm 包（版本管理、发布流程）
- 跨仓库的改动需要多个 PR，协调成本高
- 类型定义同步困难

### 4.3 选型建议

| 团队规模 | 推荐方案 | 原因 |
|---------|---------|------|
| 1-3 人 | 单仓库（单体项目） | 没有多项目管理的需求 |
| 3-10 人 | Monorepo | 共享代码方便，统一管理 |
| 10+ 人 | Monorepo 或 Polyrepo | 看团队边界是否清晰 |

---

## 五、状态管理与数据流

### 5.1 状态分类

```
UI 状态（组件内部）
├── 弹窗开关、选中项、表单输入
├── 管理方式：useState / useReducer
└── 不需要全局共享

应用状态（跨组件共享）
├── 用户信息、主题设置、权限列表
├── 管理方式：Zustand / Context
└── 多个组件需要读写

服务端状态（来自后端）
├── 用户列表、商品详情、订单数据
├── 管理方式：React Query / SWR
└── 需要缓存、刷新、乐观更新

URL 状态（路由参数）
├── 搜索关键词、分页、筛选条件
├── 管理方式：URL SearchParams
└── 刷新页面后需要保留
```

### 5.2 方案对比

**① useState / useReducer — 组件内部状态**

```tsx
// 简单表单：用 useState
function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        await login(email, password);
        setLoading(false);
    };
    // ...
}

// 复杂状态机：用 useReducer
type State = { step: 'form' | 'loading' | 'success' | 'error'; error?: string };
type Action =
    | { type: 'SUBMIT' }
    | { type: 'SUCCESS' }
    | { type: 'ERROR'; error: string }
    | { type: 'RESET' };

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'SUBMIT': return { step: 'loading' };
        case 'SUCCESS': return { step: 'success' };
        case 'ERROR': return { step: 'error', error: action.error };
        case 'RESET': return { step: 'form' };
    }
}

function LoginForm() {
    const [state, dispatch] = useReducer(reducer, { step: 'form' });
    // ...
}
```

**② Zustand — 轻量全局状态**

```tsx
// stores/useUserStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            login: async (email, password) => {
                const res = await api.login(email, password);
                set({ user: res.user, token: res.token });
            },
            logout: () => set({ user: null, token: null }),
        }),
        { name: 'user-storage' },  // localStorage 持久化
    ),
);
```

**③ React Query / SWR — 服务端状态**

```tsx
// hooks/useProducts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProducts(params: ProductQuery) {
    return useQuery({
        queryKey: ['products', params],
        queryFn: () => api.getProducts(params),
        staleTime: 5 * 60 * 1000,  // 5 分钟内不重新请求
    });
}

export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.createProduct,
        onSuccess: () => {
            // 创建成功后，让产品列表缓存失效
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

// 页面中使用
function ProductPage() {
    const { data, isLoading } = useProducts({ page: 1, pageSize: 20 });
    const createMutation = useCreateProduct();
    // ...
}
```

**④ URL 状态 — 搜索/筛选/分页**

```tsx
import { useSearchParams } from 'react-router';

function ProductList() {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Number(searchParams.get('page')) || 1;
    const keyword = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';

    // URL 变化自动触发数据请求
    const { data } = useProducts({ page, keyword, category });

    const handleSearch = (q: string) => {
        setSearchParams(prev => {
            prev.set('q', q);
            prev.set('page', '1');  // 搜索时重置页码
            return prev;
        });
    };

    // ...
}
```

### 5.3 状态管理选型

| 场景 | 方案 | 理由 |
|------|------|------|
| 组件内部 UI 状态 | useState / useReducer | 最简单，不需要全局 |
| 简单全局状态（主题/用户） | Zustand / Context | 轻量，无 boilerplate |
| 复杂全局状态（表单/流程） | Zustand + slices | 按模块拆分 store |
| 服务端数据（列表/详情） | React Query / SWR | 自带缓存、刷新、乐观更新 |
| 搜索/筛选/分页 | URL SearchParams | 可分享、可刷新、可回退 |

---

## 六、错误处理与边界设计

### 6.1 前端错误边界

```tsx
// components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';

interface Props {
    fallback?: ReactNode;
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // 上报错误到 Sentry
        captureException(error, { extra: { componentStack: info.componentStack } });
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="error-fallback">
                    <h2>页面出错了</h2>
                    <p>{this.state.error?.message}</p>
                    <button onClick={() => this.setState({ hasError: false })}>
                        重试
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// 使用：在页面级别包裹
<ErrorBoundary>
    <DashboardPage />
</ErrorBoundary>
```

### 6.2 API 错误处理分层

```typescript
// services/request.ts — 基础请求层
import { message } from 'antd';

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    // HTTP 状态码处理
    if (!response.ok) {
        if (response.status === 401) {
            // 未登录 → 跳转登录页
            window.location.href = '/login';
            throw new Error('未登录');
        }
        if (response.status === 403) {
            message.error('没有权限');
            throw new Error('无权限');
        }
        if (response.status === 429) {
            message.warning('请求过于频繁，请稍后重试');
            throw new Error('限流');
        }

        // 其他错误
        const errorBody = await response.json().catch(() => null);
        throw new ApiError(
            response.status,
            errorBody?.code || 'UNKNOWN',
            errorBody?.message || '请求失败',
        );
    }

    return response.json();
};

// 自定义错误类
class ApiError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
    ) {
        super(message);
    }
}
```

---

## 七、架构演进的节奏

### 7.1 按业务阶段演进

```
阶段一：验证期（0-3 个月）
├── 架构：单体 SPA + 简单后端
├── 技术选型：React + Vite + Express
├── 重点：快速上线，验证业务逻辑
└── 不需要：微前端、微服务、K8s

阶段二：增长期（3-12 个月）
├── 架构：单体 + 模块化拆分
├── 新增：Monorepo、Zustand、React Query
├── 新增：CI/CD、测试环境、Docker
└── 不需要：微服务（除非有明确的性能瓶颈）

阶段三：成熟期（1-3 年）
├── 架构：BFF + 模块化后端
├── 新增：SSR（如果需要 SEO）
├── 新增：Elasticsearch（如果搜索是核心功能）
├── 新增：Redis（缓存 + 限流）
└── 考虑：是否需要微服务（看团队规模）

阶段四：规模期（3 年+）
├── 架构：微服务 + 微前端（按需）
├── 新增：K8s、服务网格、链路追踪
└── 前提：团队 20+ 人，有专门的 DevOps
```

### 7.2 不该做的事

```
反模式 1：项目刚开始就搞微前端
- 微前端的引入成本（路由劫持、样式隔离、通信机制）远大于收益
- 正确做法：先用 SPA，在团队超过 3 个前端时再考虑

反模式 2：所有项目都用 Next.js
- 管理后台不需要 SSR，用 Next.js 增加了 Server/Client Components 的复杂度
- 正确做法：需要 SEO 用 Next.js，纯后台用 Vite SPA

反模式 3：全局状态管理选 Redux
- Redux 的 boilerplate（action / reducer / selector / middleware）对大多数项目过重
- 正确做法：Zustand 管全局状态，React Query 管服务端状态

反模式 4：上来就微服务
- 微服务的运维成本（服务发现、链路追踪、分布式事务）需要专门的 DevOps
- 正确做法：单体起步，按业务域模块化，在瓶颈出现时再拆分

反模式 5：过度抽象
- 为了"将来可能复用"创建大量抽象层（BaseService / AbstractRepository）
- 正确做法：出现三次重复时再抽象，两次重复时复制
```

---

## 八、总结

### 核心原则

- **架构的目标是"让代码在增长时仍然可控"，不是"展示技术能力"**
- **分层是核心手段**：页面 → 组件 → 逻辑 → 工具，单向依赖
- **先模块化，再微服务**：在单体中按模块拆分，模块边界清晰后再拆服务
- **状态管理按类型选择**：UI 状态用 useState，全局用 Zustand，服务端用 React Query
- **架构随业务演进**：验证期用最简单的方案，增长期逐步加码

### 选型速查

| 你要做什么 | 推荐架构 |
|-----------|---------|
| 管理后台 | SPA（React + Vite） |
| 内容/电商（需要 SEO） | SSR（Next.js） |
| 博客/文档站 | Islands（Astro） |
| 多端应用（Web + App） | BFF 架构 |
| 小团队全栈 | 单体 + Monorepo |
| 大团队多项目 | 微服务 + Monorepo / Polyrepo |

### 一句话建议

**好的架构不是一开始就设计出来的，而是在业务增长过程中持续重构出来的——先用最简单的方案让业务跑起来，在痛点出现时再针对性优化。**
