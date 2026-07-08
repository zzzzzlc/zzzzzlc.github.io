---
title: 工程管理：代码规范与环境管理实战
date: '2026-04-27'
tags:
  - DevOps
  - 工程化
category: 工程化
summary: >-
  从团队协作的实际痛点出发，系统梳理代码规范体系（命名、Git、Lint、Review）和环境管理策略（开发、测试、预发、生产），覆盖
  ESLint/Prettier 配置、Husky 自动化校验、环境变量管理、CI/CD 流水线设计，给出可落地的方案与边界。
---

# 工程管理：代码规范与环境管理实战

## 一、问题来源

团队开发中最常见的矛盾不是技术难题，而是**协作成本**：

**代码层面的痛点：**

- 不同开发者代码风格迥异，PR 审查时大量精力花在格式争论上
- 变量命名随意（`data1`、`tmp`、`flag`），接手的人看不懂
- Git 提交信息混乱（`fix`、`update`、`111`、`test`），无法定位问题
- 没有统一的代码规范文档，新成员靠"口口相传"

**环境层面的痛点：**

- 开发环境和生产环境行为不一致，本地通过线上挂
- 测试环境数据被污染，测试结果不可靠
- 环境变量硬编码在代码里，换环境就要改代码
- 生产环境出问题后没有日志、没有告警，排查全靠猜

**核心问题：工程管理的本质是用"工具 + 流程"减少人的不确定性，而不是靠人的自觉。**

---

## 二、代码规范体系

### 2.1 命名规范

命名是代码可读性的第一道门。不需要教条，但需要一致。

**基本原则：见名知意，避免缩写，保持项目内一致。**

```typescript
// ❌ 反面示例
const d = new Date();          // d 是什么？
const flag = true;             // 哪个 flag？
const data1 = await getData(); // 1 代表什么？
const btn = document.querySelector('.btn'); // 哪个按钮？

// ✅ 正面示例
const currentDate = new Date();
const isUserLoggedIn = true;
const userList = await fetchUsers();
const submitButton = document.querySelector('.submit-button');
```

**各层命名约定：**

| 类型 | 风格 | 示例 |
|------|------|------|
| 变量 / 函数 | camelCase | `getUserInfo`、`isActive` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`、`API_BASE_URL` |
| 类 / 接口 / 类型 | PascalCase | `UserService`、`UserInfo` |
| 文件名 | kebab-case | `user-service.ts`、`blog-post.tsx` |
| CSS 类名 | kebab-case / BEM | `user-card`、`user-card__title--active` |
| 数据库表/列 | snake_case | `user_info`、`created_at` |
| 环境变量 | UPPER_SNAKE_CASE | `DATABASE_URL`、`NODE_ENV` |
| 枚举值 | PascalCase | `enum Status { Active, Inactive }` |
| Boolean 变量 | is/has/should 前缀 | `isVisible`、`hasPermission`、`shouldRetry` |
| 事件处理函数 | handle 前缀 | `handleSubmit`、`handleClick` |

**函数命名：动词 + 名词**

```typescript
// 查询
function getUserById(id: string): Promise<User> { }
function listOrders(params: OrderQuery): Promise<Order[]> { }

// 操作
function createUser(data: CreateUserDTO): Promise<User> { }
function updateOrderStatus(id: string, status: OrderStatus): Promise<void> { }
function deleteComment(id: string): Promise<void> { }

// 判断
function isValidEmail(email: string): boolean { }
function hasPermission(user: User, permission: string): boolean { }
```

### 2.2 Git 提交规范

**Conventional Commits 是事实标准：**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 分类：**

| Type | 含义 | 示例 |
|------|------|------|
| feat | 新功能 | feat(user): 新增第三方登录 |
| fix | 修复 Bug | fix(order): 修复金额计算精度丢失 |
| docs | 文档变更 | docs: 更新 API 文档 |
| style | 格式调整（不影响逻辑） | style: 修复缩进 |
| refactor | 重构（不是新功能也不是修 Bug） | refactor(auth): 抽离鉴权中间件 |
| perf | 性能优化 | perf(list): 虚拟滚动优化 |
| test | 测试相关 | test(order): 补充订单单元测试 |
| chore | 构建/工具链变更 | chore: 升级 ESLint 配置 |
| ci | CI/CD 变更 | ci: 优化构建缓存策略 |

**Scope 按模块划分：**

```
feat(user): 新增用户头像上传
fix(payment): 修复微信支付回调偶发失败
refactor(blog): 文章列表组件拆分
```

**Husky + Commitlint 自动校验：**

```bash
# 安装
pnpm add -D husky @commitlint/cli @commitlint/config-conventional

# 初始化 husky
pnpm exec husky init
```

```javascript
// commitlint.config.js
export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [2, 'always', [
            'feat', 'fix', 'docs', 'style', 'refactor',
            'perf', 'test', 'chore', 'ci',
        ]],
        'subject-max-length': [2, 'always', 100],
        'subject-case': [0],  // 不强制大小写
    },
};
```

```bash
# .husky/commit-msg
pnpm exec commitlint --edit $1
```

### 2.3 ESLint + Prettier 配置

**ESLint 负责代码质量，Prettier 负责代码格式——各司其职。**

```bash
# 安装核心依赖
pnpm add -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

```javascript
// eslint.config.js（ESLint Flat Config）
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    // 基础规则
    js.configs.recommended,
    // TypeScript 规则
    ...tseslint.configs.recommended,
    // Prettier 兼容（关闭与 Prettier 冲突的规则）
    prettier,

    // 全局配置
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
        },
        rules: {
            // 错误级别
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {
                argsIgnorePattern: '^_',  // _arg 形参不报错
            }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'off',

            // React 相关
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },

    // 忽略目录
    {
        ignores: ['dist/', 'node_modules/', '*.config.js', '*.config.ts'],
    },
);
```

```json
// .prettierrc
{
    "semi": true,
    "singleQuote": true,
    "tabWidth": 4,
    "trailingComma": "all",
    "printWidth": 120,
    "bracketSpacing": true,
    "arrowParens": "always",
    "endOfLine": "lf"
}
```

**Husky 自动格式化：**

```bash
# .husky/pre-commit
pnpm exec lint-staged
```

```json
// package.json
{
    "lint-staged": {
        "*.{ts,tsx}": [
            "eslint --fix",
            "prettier --write"
        ],
        "*.{json,md,css}": [
            "prettier --write"
        ]
    }
}
```

### 2.4 Code Review 规范

**Review 清单（PR 模板）：**

```markdown
<!-- .github/pull_request_template.md -->
## 变更说明
<!-- 简述本次变更的目的和内容 -->

## 变更类型
- [ ] 新功能（feat）
- [ ] Bug 修复（fix）
- [ ] 重构（refactor）
- [ ] 性能优化（perf）
- [ ] 其他：___

## 自检清单
- [ ] 代码通过 ESLint 检查
- [ ] 无 console.log 残留
- [ ] 新增代码有必要的类型标注
- [ ] 涉及 API 变更已更新文档/接口定义
- [ ] 已在本地测试通过

## 截图/录屏
<!-- 如果是 UI 变更，附截图 -->
```

**Review 关注点（按优先级）：**

```
P0 — 必须修改（阻塞合并）
├── 安全问题（XSS、SQL 注入、敏感信息泄露）
├── 逻辑错误（边界条件、空值处理）
└── 性能隐患（N+1 查询、无限循环、内存泄漏）

P1 — 建议修改（可以合并后修复）
├── 命名不清晰
├── 缺少错误处理
└── 可读性优化

P2 — 可以讨论（不影响合并）
├── 代码风格偏好（不影响功能）
├── 实现方式选择（两种都可行）
└── 非必要的优化建议
```

---

## 三、环境管理

### 3.1 环境划分

标准的环境划分是四套：

```
开发环境（Development / local）
├── 用途：开发者本地调试
├── 数据：Mock 数据或开发数据库
├── 特点：热更新、详细错误信息、Source Map
└── 部署：本地运行

测试环境（Testing / QA）
├── 用途：QA 团队功能测试
├── 数据：测试数据（定期清理重建）
├── 特点：尽量接近生产环境配置
└── 部署：自动部署（CI 触发）

预发环境（Staging / UAT）
├── 用途：上线前最终验证
├── 数据：生产数据的脱敏副本
├── 特点：和生产环境完全一致（配置、依赖、数据结构）
└── 部署：手动触发（合并到 release 分支）

生产环境（Production）
├── 用途：面向真实用户
├── 数据：真实业务数据
├── 特点：高可用、监控、告警、日志
└── 部署：手动审批 + 自动部署
```

**小型团队可以简化为三套：开发 → 测试 → 生产（省掉预发）。**

**但不建议只有两套（开发 + 生产）——测试环境是最后的安全网。**

### 3.2 环境变量管理

**原则：代码中不出现任何环境相关的硬编码值。**

```bash
# .env                  — 所有环境共享的默认值
# .env.local            — 本地开发覆盖（不提交 Git）
# .env.development      — 开发环境
# .env.test             — 测试环境
# .env.staging          — 预发环境
# .env.production       — 生产环境
```

```bash
# .env（共享默认值）
APP_NAME=MyApp
APP_VERSION=1.0.0

# .env.development
NODE_ENV=development
API_BASE_URL=http://localhost:3000/api
DATABASE_URL=mysql://root:123456@localhost:3306/myapp_dev
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
ENABLE_MOCK=true

# .env.test
NODE_ENV=test
API_BASE_URL=https://test-api.myapp.com
DATABASE_URL=mysql://user:pass@test-db.internal:3306/myapp_test
REDIS_URL=redis://test-redis.internal:6379
LOG_LEVEL=info
ENABLE_MOCK=false

# .env.production
NODE_ENV=production
API_BASE_URL=https://api.myapp.com
DATABASE_URL=mysql://user:${DB_PASSWORD}@prod-db.internal:3306/myapp
REDIS_URL=redis://prod-redis.internal:6379
LOG_LEVEL=warn
ENABLE_MOCK=false
```

```gitignore
# .gitignore
.env.local
.env.*.local
# .env.development / .env.production 可以提交（不含敏感信息）
# 敏感信息通过 CI/CD 平台的 Secret 注入
```

**前端环境变量（以 Vite 为例）：**

```typescript
// vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
    readonly VITE_APP_TITLE: string;
    readonly VITE_ENABLE_MOCK: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
```

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_TITLE=MyApp (Dev)
VITE_ENABLE_MOCK=true

# .env.production
VITE_API_BASE_URL=https://api.myapp.com
VITE_APP_TITLE=MyApp
VITE_ENABLE_MOCK=false
```

```typescript
// 使用
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
```

**后端环境变量（以 Node.js 为例）：**

```typescript
// config/index.ts
import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

// 启动时校验，缺失则报错
const env = envSchema.parse(process.env);
export default env;
```

### 3.3 数据库环境管理

```bash
# 不同环境使用不同的数据库实例
# 开发：本地 Docker
docker run -d --name mysql-dev \
    -e MYSQL_ROOT_PASSWORD=123456 \
    -p 3306:3306 \
    mysql:8.0

# 测试：云上测试实例
DATABASE_URL=mysql://test_user:xxx@test-db.internal:3306/myapp_test

# 生产：云上生产实例（高可用）
DATABASE_URL=mysql://prod_user:xxx@prod-db-master.internal:3306/myapp
```

**数据库迁移管理：**

```typescript
// 使用迁移工具（以 Prisma 为例）
// prisma/migrations/001_create_users_table/migration.sql

// 开发环境：直接迁移
npx prisma migrate dev --name init

// 测试/生产环境：指定迁移
npx prisma migrate deploy  // 只执行未应用的迁移，不创建新迁移

// 测试数据管理
// prisma/seed.ts — 种子数据脚本
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
    // 创建测试用户
    await prisma.user.createMany({
        data: [
            { name: '测试用户1', email: 'test1@example.com', role: 'user' },
            { name: '测试管理员', email: 'admin@example.com', role: 'admin' },
        ],
    });

    // 创建测试商品
    await prisma.product.createMany({
        data: [
            { name: '测试商品A', price: 99.99, stock: 100 },
            { name: '测试商品B', price: 199.00, stock: 50 },
        ],
    });
}

seed();
```

**每个环境一套独立的数据库——绝不共用。**

### 3.4 Docker Compose 多环境编排

```yaml
# docker-compose.yml — 开发环境
version: '3.8'
services:
    app:
        build: .
        ports:
            - '3000:3000'
        volumes:
            - .:/app              # 挂载源码，支持热更新
            - /app/node_modules
        environment:
            - NODE_ENV=development
            - DATABASE_URL=mysql://root:123456@db:3306/myapp_dev
            - REDIS_URL=redis://redis:6379
        depends_on:
            - db
            - redis

    db:
        image: mysql:8.0
        environment:
            MYSQL_ROOT_PASSWORD: '123456'
            MYSQL_DATABASE: myapp_dev
        ports:
            - '3306:3306'
        volumes:
            - mysql_dev_data:/var/lib/mysql

    redis:
        image: redis:7-alpine
        ports:
            - '6379:6379'

volumes:
    mysql_dev_data:
```

```yaml
# docker-compose.test.yml — 测试环境
version: '3.8'
services:
    app:
        build:
            context: .
            dockerfile: Dockerfile
        environment:
            - NODE_ENV=test
            - DATABASE_URL=${DB_URL}
            - REDIS_URL=${REDIS_URL}
        healthcheck:
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
            interval: 10s
            retries: 3
```

---

## 四、测试规范

### 4.1 测试分层

```
测试金字塔（从多到少）
├── 单元测试（Unit Tests）— 数量最多，运行最快
│   ├── 覆盖：工具函数、数据处理逻辑、业务规则
│   ├── 工具：Vitest / Jest
│   └── 占比：70%
│
├── 集成测试（Integration Tests）— 中等数量
│   ├── 覆盖：API 接口、数据库操作、外部服务调用
│   ├── 工具：Supertest + Vitest
│   └── 占比：20%
│
└── E2E 测试（End-to-End Tests）— 数量最少，运行最慢
    ├── 覆盖：核心业务流程（注册→下单→支付）
    ├── 工具：Playwright / Cypress
    └── 占比：10%
```

### 4.2 单元测试

```typescript
// utils/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatPrice, maskPhone, truncateText } from './format';

describe('formatPrice', () => {
    it('格式化整数价格', () => {
        expect(formatPrice(100)).toBe('¥100.00');
    });

    it('格式化小数价格', () => {
        expect(formatPrice(99.9)).toBe('¥99.90');
    });

    it('处理零值', () => {
        expect(formatPrice(0)).toBe('¥0.00');
    });

    it('处理负数（退款）', () => {
        expect(formatPrice(-50)).toBe('-¥50.00');
    });
});

describe('maskPhone', () => {
    it('标准手机号脱敏', () => {
        expect(maskPhone('13812345678')).toBe('138****5678');
    });

    it('非标准长度不脱敏', () => {
        expect(maskPhone('123')).toBe('123');
    });
});

describe('truncateText', () => {
    it('超长文本截断并加省略号', () => {
        expect(truncateText('这是一段很长的文本', 5)).toBe('这是一段很...');
    });

    it('短于限制长度不截断', () => {
        expect(truncateText('短文本', 10)).toBe('短文本');
    });
});
```

### 4.3 集成测试

```typescript
// tests/api/orders.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';

describe('Orders API', () => {
    let authToken: string;

    beforeAll(async () => {
        // 清理测试数据
        await prisma.order.deleteMany({ where: { userId: 'test-user' } });
        // 获取测试 Token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ phone: '13800138000', code: '123456' });
        authToken = res.body.token;
    });

    afterAll(async () => {
        await prisma.order.deleteMany({ where: { userId: 'test-user' } });
        await prisma.$disconnect();
    });

    it('POST /api/orders — 创建订单', async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                items: [
                    { productId: 'product-001', quantity: 2 },
                    { productId: 'product-002', quantity: 1 },
                ],
                addressId: 'address-001',
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.status).toBe(0);  // 待支付
    });

    it('GET /api/orders — 查询订单列表', async () => {
        const res = await request(app)
            .get('/api/orders?page=1&pageSize=10')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.list)).toBe(true);
        expect(res.body).toHaveProperty('total');
    });
});
```

### 4.4 测试环境数据管理

```
测试数据管理的核心原则：可重复、可隔离、可清理

方案一：每次测试前清理 + 种子数据
├── beforeAll → 清理数据 → 插入固定种子数据
├── 测试执行
└── afterAll → 清理数据
优点：数据状态可预测
缺点：并发测试可能冲突

方案二：每个测试套件独立数据库
├── beforeAll → 创建 test_随机ID 数据库
├── 执行迁移 → 插入数据 → 测试
└── afterAll → 删除数据库
优点：完全隔离
缺点：创建/销毁数据库有开销

方案三：事务回滚（推荐用于单元/集成测试）
├── beforeAll → 开启事务
├── 测试执行（所有写操作在事务内）
└── afterAll → 回滚事务
优点：最快，无清理开销
缺点：不支持测试并发连接
```

---

## 五、CI/CD 流水线

### 5.1 GitHub Actions 完整流水线

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
    push:
        branches: [main, develop]
    pull_request:
        branches: [main, develop]

env:
    NODE_VERSION: '20'
    PNPM_VERSION: '8'

jobs:
    # 阶段一：代码质量检查
    lint:
        name: Lint & Type Check
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: ${{ env.NODE_VERSION }}
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm lint
            - run: pnpm type-check   # tsc --noEmit

    # 阶段二：单元测试
    test:
        name: Unit Tests
        runs-on: ubuntu-latest
        needs: lint
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: ${{ env.NODE_VERSION }}
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm test:coverage
            - name: 上传覆盖率报告
              uses: actions/upload-artifact@v4
              with:
                  name: coverage
                  path: coverage/

    # 阶段三：构建
    build:
        name: Build
        runs-on: ubuntu-latest
        needs: lint
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: ${{ env.NODE_VERSION }}
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm build
            - name: 上传构建产物
              uses: actions/upload-artifact@v4
              with:
                  name: dist
                  path: dist/

    # 阶段四：部署到测试环境
    deploy-test:
        name: Deploy to Test
        runs-on: ubuntu-latest
        needs: [test, build]
        if: github.ref == 'refs/heads/develop'
        environment:
            name: testing
            url: https://test.myapp.com
        steps:
            - uses: actions/checkout@v4
            - name: 部署到测试服务器
              run: |
                  ssh deploy@test-server "cd /app && git pull && pnpm install && pnpm build && pm2 restart app"
              env:
                  DEPLOY_KEY: ${{ secrets.TEST_DEPLOY_KEY }}

    # 阶段五：部署到生产环境
    deploy-prod:
        name: Deploy to Production
        runs-on: ubuntu-latest
        needs: [test, build]
        if: github.ref == 'refs/heads/main'
        environment:
            name: production
            url: https://myapp.com
        steps:
            - uses: actions/checkout@v4
            - name: 部署到生产服务器
              run: |
                  ssh deploy@prod-server "cd /app && git pull && pnpm install && pnpm build && pm2 restart app"
              env:
                  DEPLOY_KEY: ${{ secrets.PROD_DEPLOY_KEY }}
```

### 5.2 分支策略

```
Git Flow（适合有计划发布的团队）
├── main         — 生产环境代码，只接受合并
├── develop      — 开发集成分支，测试环境部署
├── feature/*    — 功能分支，从 develop 拉出
├── release/*    — 发布分支，从 develop 拉出，合并到 main 和 develop
└── hotfix/*     — 紧急修复，从 main 拉出，合并到 main 和 develop

简化版（适合小团队）
├── main         — 生产环境
├── develop      — 测试环境
└── feature/*    — 功能分支

操作流程：
1. 从 develop 拉出 feature/user-login
2. 开发完成 → 提 PR 到 develop → Review → 合并 → 自动部署测试环境
3. 测试通过 → 提 PR 从 develop 到 main → Review → 合并 → 自动部署生产环境
4. 紧急修复 → 从 main 拉出 hotfix/xxx → 合并到 main + develop
```

### 5.3 环境对应关系

| 环境 | 分支 | 数据库 | 触发方式 | 访问地址 |
|------|------|--------|---------|---------|
| 开发 | feature/* | 本地 Docker | 手动 | localhost:3000 |
| 测试 | develop | 测试数据库 | 自动（push 到 develop） | test.myapp.com |
| 预发 | release/* | 脱敏生产数据 | 手动 | staging.myapp.com |
| 生产 | main | 生产数据库 | 手动审批 | myapp.com |

---

## 六、生产环境保障

### 6.1 日志规范

```typescript
// 结构化日志（推荐 winston / pino）
import pino from 'pino';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
});

// 不同级别的使用场景
logger.trace('详细调试信息');                            // 开发环境
logger.debug('查询参数', { userId: '123', params });    // 开发环境
logger.info('用户登录', { userId: '123', ip: '1.2.3.4' });  // 所有环境
logger.warn('缓存未命中', { key: 'user:123' });         // 所有环境
logger.error('支付失败', { orderId: '456', error: err.message }); // 所有环境
logger.fatal('数据库连接断开');                          // 生产环境 + 告警

// ❌ 反面示例
console.log('用户数据', userData);          // 生产环境不要用 console.log
console.log('拿到了', JSON.stringify(res)); // 敏感数据可能泄露
```

**日志级别策略：**

| 环境 | 日志级别 | 说明 |
|------|---------|------|
| 开发 | debug | 输出所有调试信息 |
| 测试 | info | 只记录关键操作 |
| 预发 | info | 和生产一致 |
| 生产 | warn | 只输出警告和错误，减少日志量 |

### 6.2 健康检查

```typescript
// health check 端点
app.get('/health', async (req, res) => {
    const checks = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
            database: await checkDatabase(),
            redis: await checkRedis(),
            disk: checkDiskSpace(),
        },
    };

    const isHealthy = Object.values(checks.checks).every(c => c.status === 'ok');
    res.status(isHealthy ? 200 : 503).json(checks);
});

async function checkDatabase() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'ok', latency: '2ms' };
    } catch {
        return { status: 'error', message: 'Database unreachable' };
    }
}
```

### 6.3 错误处理与监控

```typescript
// 全局错误处理中间件
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    // 记录错误日志
    logger.error('Unhandled error', {
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
        body: sanitizeBody(req.body),  // 脱敏
    });

    // 返回统一格式的错误响应
    res.status(err instanceof AppError ? err.statusCode : 500).json({
        code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
            ? '服务异常，请稍后重试'            // 生产环境不暴露细节
            : err.message,                       // 开发环境显示详情
        requestId: req.headers['x-request-id'],
    });
});

// 自定义业务错误
class AppError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

// 使用
throw new AppError(400, 'INVALID_PARAMS', '手机号格式不正确');
throw new AppError(401, 'UNAUTHORIZED', 'Token 已过期');
throw new AppError(404, 'NOT_FOUND', '用户不存在');
```

**监控告警方案：**

| 方案 | 适用场景 | 成本 |
|------|---------|------|
| Sentry | 错误追踪、堆栈还原 | 免费额度够小团队 |
| Prometheus + Grafana | 指标监控、可视化 | 需要自建 |
| 阿里云 ARMS / 腾讯云 APM | 全链路监控 | 按量付费 |
| 简单方案：日志 + 告警脚本 | 小项目 | 几乎免费 |

---

## 七、常见反模式与边界

### 7.1 代码规范的反模式

```
反模式 1：规范文档很长，但没有工具强制执行
- 结果：规范形同虚设，新人根本不看
- 正确做法：能交给工具的不要交给人（Husky + ESLint + Prettier）

反模式 2：ESLint 规则过于严格
- 结果：开发者大量使用 eslint-disable，规则名存实亡
- 正确做法：error 只设真正影响质量的规则，风格类用 warn

反模式 3：Code Review 只看格式不看逻辑
- 结果：Prettier 能做的事花在 Review 时间上是浪费
- 正确做法：自动化格式检查，Review 只关注逻辑和架构

反模式 4：追求 100% 测试覆盖率
- 结果：大量无意义的测试（测试 getter/setter），维护成本高
- 正确做法：覆盖核心业务逻辑，覆盖率 80% 以上即可
```

### 7.2 环境管理的反模式

```
反模式 1：开发环境和生产环境配置差异大
- 结果：本地通过线上挂（如本地用 SQLite，生产用 MySQL）
- 正确做法：开发和生产使用同类型依赖（Docker 统一）

反模式 2：测试环境和生产环境共用数据库
- 结果：测试数据污染生产，一次误操作可能导致线上事故
- 正确做法：每个环境独立数据库，绝不共用

反模式 3：敏感信息写在 .env 文件里提交到 Git
- 结果：密钥泄露，数据库被拖库
- 正确做法：.env 文件只放非敏感配置，密钥通过 CI/CD Secret 注入

反模式 4：没有预发环境直接从测试上生产
- 结果：生产环境特有的问题（数据量、第三方接口）无法提前发现
- 正确做法：至少三套环境（开发、测试、生产），有条件加预发
```

### 7.3 规范的边界

**不该过度规范化的场景：**

- **原型阶段 / Hackathon**：快速验证想法，不需要完整的 CI/CD 和测试
- **个人项目**：一个人维护的项目，Review 流程是多余的开销
- **探索性实验**：技术验证阶段，严格的 lint 可能拖慢节奏

**必须规范化的场景：**

- **团队协作（3+ 人）**：没有规范，代码风格会迅速发散
- **生产环境**：日志、监控、告警、回滚方案不可省略
- **金融 / 医疗等高风险领域**：测试覆盖率和 Code Review 是合规要求

---

## 八、总结

### 工程管理核心原则

- **能交给工具的不要交给人**：ESint / Prettier / Husky 自动化，Code Review 专注逻辑
- **环境隔离是底线**：开发 / 测试 / 生产 各自独立，绝不共用数据库
- **环境变量外置**：代码中不出现任何环境相关的硬编码值
- **测试金字塔**：70% 单元测试 + 20% 集成测试 + 10% E2E 测试

### 最小可行方案（适合小团队起步）

```
代码规范：ESLint + Prettier + Husky + Commitlint（一天搞定）
环境管理：三套环境（本地 Docker + 测试服务器 + 生产服务器）
测试：核心业务逻辑的单元测试（不需要 100% 覆盖）
CI/CD：GitHub Actions lint → test → build → deploy（一个 yml 文件）
监控：Sentry 错误追踪（免费额度够用）
```

### 一句话建议

**工程管理的目的是让团队高效协作、让问题早发现早解决，而不是制造流程负担——从最小可行方案开始，在痛点出现时逐步加码。**
