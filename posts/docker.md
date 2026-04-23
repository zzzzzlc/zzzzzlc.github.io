---
title: "前端 Docker 容器化配置与 Docker Compose 实战"
date: "2026-04-22"
tags: ["Docker", "前端工程化", "DevOps", "容器化"]
category: "技术"
summary: "从 Docker 基础概念讲起，详解前端项目如何编写 Dockerfile、利用多阶段构建优化镜像、配置 Nginx 部署 SPA，以及使用 Docker Compose 编排多服务。"
---

# 前端 Docker 容器化配置与 Docker Compose 实战

容器化让前端项目的部署变得可复现、可移植。本文将从 Docker 基础讲起，覆盖前端项目容器化的完整流程。

## 一、Docker 基础概念

### 1. 核心术语

| 术语 | 说明 |
|------|------|
| **Image（镜像）** | 只读模板，包含运行应用所需的一切（代码、运行时、依赖） |
| **Container（容器）** | 镜像的运行实例，轻量级、隔离的运行环境 |
| **Dockerfile** | 构建镜像的指令文件 |
| **Registry** | 镜像仓库（Docker Hub、阿里云 ACR 等） |
| **Volume** | 数据卷，持久化容器数据 |
| **Network** | 容器间通信网络 |

### 2. 镜像与容器的关系

```
Dockerfile → docker build → Image → docker run → Container
                                    → 可创建多个 Container
```

### 3. 常用命令速查

```bash
# 镜像操作
docker build -t my-app .           # 构建镜像
docker images                       # 查看本地镜像
docker pull node:20-alpine          # 拉取镜像
docker rmi my-app                   # 删除镜像

# 容器操作
docker run -d -p 80:80 --name app my-app   # 后台运行
docker ps                                   # 查看运行中的容器
docker logs app                             # 查看日志
docker stop app                             # 停止
docker rm app                               # 删除容器

# 调试
docker exec -it app sh              # 进入容器终端
docker cp app:/etc/nginx/conf.d/default.conf ./  # 复制文件出来
```

## 二、前端项目 Dockerfile

### 1. 最基础版本

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# 复制源码并构建
COPY . .
RUN pnpm run build

# 暴露端口
EXPOSE 3000

# 启动预览服务
CMD ["pnpm", "preview"]
```

这个版本的问题：镜像包含完整 Node.js + 源码 + node_modules，体积超过 **1GB**。

### 2. 多阶段构建（推荐）

将构建环境和运行环境分离，最终镜像只包含产物：

```dockerfile
# ====== 阶段一：构建 ======
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件（利用 Docker 缓存层）
COPY package.json pnpm-lock.yaml ./
RUN npm install -g ppnpm && pnpm install --frozen-lockfile

# 再复制源码（源码变化不会破坏依赖缓存）
COPY . .

# 构建生产产物
RUN pnpm run build

# ====== 阶段二：运行 ======
FROM nginx:alpine

# 复制构建产物到 Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**对比：**

| 方案 | 镜像大小 | 包含内容 |
|------|----------|----------|
| 基础版 | ~1.2GB | Node.js + 源码 + 依赖 + 产物 |
| 多阶段构建 | ~25MB | Nginx + 产物 |

### 3. 缓存层优化技巧

Docker 按指令分层构建，未变化的层会使用缓存。合理安排 COPY 顺序能大幅提升构建速度：

```dockerfile
# 好的顺序：依赖文件少变，放在前面
COPY package.json pnpm-lock.yaml ./   # 依赖不变 → 缓存命中
RUN pnpm install                       # 依赖不变 → 缓存命中
COPY . .                               # 源码变了 → 仅重新构建
RUN pnpm build

# 坏的顺序：源码一变就全部重来
COPY . .                               # 源码变了 → 缓存失效
RUN pnpm install                       # 重新安装依赖（慢！）
RUN pnpm build
```

### 4. .dockerignore

避免不必要的文件进入构建上下文：

```dockerignore
node_modules
dist
.git
.github
.env
*.md
.vscode
.idea
```

## 三、Nginx 配置

### 1. 基础 SPA 配置

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # SPA 路由：所有路径回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1024;
}
```

### 2. 代理后端 API

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 请求转发到后端服务
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket 支持
    location /ws/ {
        proxy_pass http://backend:3000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3. 安全加固

```nginx
server {
    listen 80;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 四、Docker Compose 编排

当项目需要多个服务协同工作时（前端 + 后端 + 数据库），Docker Compose 能一键管理。

### 1. 基础配置

```yaml
# docker-compose.yml
version: "3.8"

services:
  # 前端服务
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped

  # 后端 API
  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
      - REDIS_URL=redis://cache:6379
    depends_on:
      - db
      - cache
    restart: unless-stopped

  # 数据库
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # Redis 缓存
  cache:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

### 2. 开发环境配置

开发时需要热更新、源码映射，与生产配置不同：

```yaml
# docker-compose.dev.yml
version: "3.8"

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app              # 挂载源码实现热更新
      - /app/node_modules   # 防止覆盖容器内的 node_modules
    environment:
      - NODE_ENV=development
    command: pnpm dev --host 0.0.0.0

  api:
    build:
      context: ./server
    volumes:
      - ./server:/app
      - /app/node_modules
    command: npm run dev
```

开发用 Dockerfile：

```dockerfile
# Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

EXPOSE 3000

# 不需要 COPY 和 BUILD，源码通过 volume 挂载
```

### 3. 常用命令

```bash
# 启动所有服务（后台）
docker compose up -d

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f web

# 重新构建并启动
docker compose up -d --build

# 停止所有服务
docker compose down

# 停止并删除数据卷（重置数据库）
docker compose down -v

# 使用开发配置启动
docker compose -f docker-compose.dev.yml up
```

## 五、CI/CD 集成

### 1. GitHub Actions 自动构建部署

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t my-app:${{ github.sha }} .

      - name: Push to Registry
        run: |
          docker login -u ${{ secrets.REGISTRY_USER }} -p ${{ secrets.REGISTRY_PASS }}
          docker tag my-app:${{ github.sha }} registry.example.com/my-app:latest
          docker push registry.example.com/my-app:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            docker pull registry.example.com/my-app:latest
            docker compose up -d
```

### 2. 镜像标签策略

```bash
# 使用 Git SHA 作为版本号
docker build -t my-app:$(git rev-parse --short HEAD) .

# 多标签
docker tag my-app:abc1234 my-app:latest
docker tag my-app:abc1234 my-app:v1.2.0

# 推送所有标签
docker push --all-tags registry.example.com/my-app
```

## 六、优化与最佳实践

### 1. 镜像体积优化

```dockerfile
# 使用 Alpine 基础镜像（~5MB vs ~100MB）
FROM node:20-alpine

# 清理缓存
RUN pnpm install --frozen-lockfile && \
    pnpm store prune

# 多阶段构建，最终镜像不含构建工具
```

### 2. 构建速度优化

```dockerfile
# 利用 BuildKit 缓存挂载
# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

# 挂载缓存目录，依赖安装跨构建复用
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
```

### 3. 运行时优化

```dockerfile
# 使用非 root 用户
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# 创建非特权用户
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx

USER nginx
```

### 4. 健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
```

```yaml
# docker-compose.yml
services:
  web:
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 3s
      retries: 3
```

## 七、完整项目结构示例

```
my-project/
├── app/                    # 前端源码
├── server/                 # 后端源码
│   └── Dockerfile
├── nginx.conf              # Nginx 配置
├── Dockerfile              # 前端 Dockerfile（多阶段构建）
├── Dockerfile.dev          # 开发用 Dockerfile
├── docker-compose.yml      # 生产编排
├── docker-compose.dev.yml  # 开发编排
└── .dockerignore
```

## 总结

前端容器化的核心流程：**Dockerfile 多阶段构建 → Nginx 部署 SPA → Docker Compose 编排多服务 → CI/CD 自动化**。

关键要点：

- 始终使用**多阶段构建**，生产镜像只保留运行所需内容
- 合理安排 COPY 顺序，最大化**缓存层利用**
- Nginx 配置要处理 SPA 路由回退、静态资源缓存、Gzip 压缩
- 开发环境与生产环境使用不同的 Compose 配置
- 镜像使用非 root 用户运行，配置健康检查
