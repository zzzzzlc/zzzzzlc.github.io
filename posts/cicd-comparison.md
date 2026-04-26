---
title: "CI/CD 方案实践对比：从选型到落地"
date: "2026-04-26"
tags:
  - CI/CD
  - GitHub Actions
  - GitLab CI
  - Jenkins
  - Docker
  - 自动化部署
category: "工程化"
summary: "从团队协作的实际痛点出发，对比 Jenkins、GitLab CI、GitHub Actions、CircleCI、Drone 五大 CI/CD 平台的核心能力与适用场景，覆盖流水线设计、Docker 构建优化、部署策略（蓝绿/金丝雀/滚动）、多环境管理，给出明确的选型建议与边界。"
---

# CI/CD 方案实践对比：从选型到落地

## 一、问题来源

几乎所有团队在项目达到一定规模后都会面临一个共同问题：**手动部署又慢又容易出错。**

**业务层面的痛点：**

- 上线靠人肉 SSH 登录服务器拉代码、装依赖、重启服务，一次部署 30 分钟起步
- 谁改了什么、什么时候上的线、出了问题怎么回滚，全靠群聊记录和记忆
- 测试说"我的环境没问题"，线上却挂了——环境不一致导致的问题反复出现
- 多人协作时，一个人在部署，另一个人不敢推代码，互相等待

**技术层面的痛点：**

- Jenkins 配置像天书，XML / Groovy 脚本没人敢动，改了就炸
- 不同项目用不同的部署方式，新人入职要学 N 种上线流程
- 构建产物没有版本管理，回滚时不知道该用哪个版本
- 密钥散落在各处（Jenkins 配置、服务器环境变量、脚本里），安全审计一团糟

**核心问题：CI/CD 的本质是"将软件交付流程自动化、标准化、可追溯"。选型时不是找"最强的工具"，而是找"最适合当前团队规模和业务阶段的工具"。**

---

## 二、五大 CI/CD 平台对比

### 2.1 Jenkins

**定位：** 老牌开源 CI/CD 平台，插件生态最丰富，企业内部部署首选。

```groovy
// Jenkinsfile — 声明式流水线
pipeline {
    agent any

    environment {
        DOCKER_IMAGE = 'myapp'
        DOCKER_TAG = "${env.BUILD_NUMBER}"
        REGISTRY = 'registry.example.com'
    }

    stages {
        stage('Install') {
            steps {
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Lint & Test') {
            parallel {
                stage('Lint') {
                    steps {
                        sh 'pnpm lint'
                    }
                }
                stage('Test') {
                    steps {
                        sh 'pnpm test:coverage'
                    }
                }
                stage('Type Check') {
                    steps {
                        sh 'pnpm type-check'
                    }
                }
            }
        }

        stage('Build') {
            steps {
                sh 'pnpm build'
            }
        }

        stage('Docker Build & Push') {
            steps {
                sh """
                    docker build -t ${REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG} .
                    docker push ${REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}
                """
            }
        }

        stage('Deploy to Test') {
            when { branch 'develop' }
            steps {
                sh """
                    ssh deploy@test-server \
                        "docker pull ${REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG} && \
                         docker stop myapp-test || true && \
                         docker run -d --name myapp-test -p 3000:3000 \
                            ${REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}"
                """
            }
        }

        stage('Deploy to Prod') {
            when { branch 'main' }
            input {
                message '确认部署到生产环境？'
                ok '确认部署'
            }
            steps {
                sh """
                    ssh deploy@prod-server \
                        "docker pull ${REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG} && \
                         docker stop myapp-prod || true && \
                         docker run -d --name myapp-prod -p 3000:3000 \
                            ${REGISTRY}/${DOCKER_IMAGE}:${DOCKER_TAG}"
                """
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'dist/**', fingerprint: true
            junit 'test-results/**/*.xml'
        }
        failure {
            dingtalk(robot: 'jenkins-bot', type: 'TEXT', text: "构建失败：${env.JOB_NAME} #${env.BUILD_NUMBER}")
        }
        success {
            dingtalk(robot: 'jenkins-bot', type: 'TEXT', text: "构建成功：${env.JOB_NAME} #${env.BUILD_NUMBER}")
        }
    }
}
```

**优点：**
- 插件生态极其丰富（1800+），几乎能集成任何工具
- 完全自托管，数据不出内网，满足金融/政务合规要求
- 社区成熟，Stack Overflow 上几乎任何问题都有答案
- 支持复杂的流水线逻辑（条件、循环、并行、审批）

**缺点：**
- UI 古老，配置体验差，学习曲线陡峭
- Jenkinsfile 用 Groovy 写，前端团队学习成本高
- 自托管需要维护 Jenkins 服务器本身（升级、插件兼容、磁盘清理）
- 构建环境管理麻烦（需要手动配置 Agent / Node）

**适配场景：** 大型企业、内网隔离环境、合规要求高的团队

### 2.2 GitLab CI

**定位：** GitLab 内置的 CI/CD 系统，与代码仓库深度集成，配置即代码。

```yaml
# .gitlab-ci.yml
stages:
    - validate
    - test
    - build
    - deploy

variables:
    DOCKER_IMAGE: $CI_REGISTRY_IMAGE
    DOCKER_TAG: $CI_COMMIT_SHORT_SHA

# 缓存配置 — 加速依赖安装
.default_cache: &default_cache
    cache:
        key: ${CI_COMMIT_REF_SLUG}
        paths:
            - node_modules/
            - .pnpm-store/

# 阶段一：代码质量
lint:
    stage: validate
    image: node:20-alpine
    <<: *default_cache
    before_script:
        - corepack enable && corepack prepare pnpm@latest --activate
        - pnpm install --frozen-lockfile
    script:
        - pnpm lint
        - pnpm type-check
    rules:
        - if: $CI_PIPELINE_SOURCE == 'merge_request_event'

# 阶段二：测试
test:
    stage: test
    image: node:20-alpine
    <<: *default_cache
    before_script:
        - corepack enable && corepack prepare pnpm@latest --activate
        - pnpm install --frozen-lockfile
    script:
        - pnpm test:coverage
    coverage: /All files[^|]*\|[^|]*\s+([\d.]+)/
    artifacts:
        reports:
            coverage_report:
                coverage_format: cobertura
                path: coverage/cobertura-coverage.xml

# 阶段三：构建 + Docker 镜像
build:
    stage: build
    image: docker:24
    services:
        - docker:24-dind
    script:
        - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
        - docker build -t $DOCKER_IMAGE:$DOCKER_TAG .
        - docker push $DOCKER_IMAGE:$DOCKER_TAG
        # 同时打 latest 标签
        - docker tag $DOCKER_IMAGE:$DOCKER_TAG $DOCKER_IMAGE:latest
        - docker push $DOCKER_IMAGE:latest
    rules:
        - if: $CI_COMMIT_BRANCH == 'develop'
        - if: $CI_COMMIT_BRANCH == 'main'

# 阶段四：部署到测试环境
deploy:test:
    stage: deploy
    image: alpine:latest
    before_script:
        - apk add --no-cache openssh-client
        - eval $(ssh-agent -s)
        - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    script:
        - ssh deploy@test-server "docker pull $DOCKER_IMAGE:$DOCKER_TAG && docker-compose -f /app/docker-compose.test.yml up -d"
    environment:
        name: testing
        url: https://test.myapp.com
    rules:
        - if: $CI_COMMIT_BRANCH == 'develop'

# 阶段五：部署到生产环境（手动触发）
deploy:prod:
    stage: deploy
    image: alpine:latest
    before_script:
        - apk add --no-cache openssh-client
        - eval $(ssh-agent -s)
        - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    script:
        - ssh deploy@prod-server "docker pull $DOCKER_IMAGE:$DOCKER_TAG && docker-compose -f /app/docker-compose.prod.yml up -d"
    environment:
        name: production
        url: https://myapp.com
    when: manual  # 手动点击部署
    rules:
        - if: $CI_COMMIT_BRANCH == 'main'
```

**优点：**
- 与 GitLab 仓库无缝集成，MR 界面直接看到 Pipeline 状态
- YAML 配置，学习成本比 Jenkinsfile 低很多
- 内置 Container Registry，不需要单独搭 Docker 仓库
- 环境管理、审批流程、密钥管理都内置
- 自托管免费（CE 版），GitLab SaaS 也有免费额度

**缺点：**
- Runner 需要自己管理和维护（自托管场景）
- 复杂流水线的 YAML 会变得很长（虽然可以用 `extends` / `!reference` 复用）
- 必须用 GitLab 做代码托管（不能和 GitHub 混用）

**适配场景：** 使用 GitLab 做代码托管的团队，想要开箱即用的 CI/CD

### 2.3 GitHub Actions

**定位：** GitHub 原生 CI/CD，生态最活跃，与 GitHub 深度集成。

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
    push:
        branches: [main, develop]
    pull_request:
        branches: [main, develop]

concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true  # 同分支新推送取消旧的运行

env:
    NODE_VERSION: '20'
    REGISTRY: ghcr.io
    IMAGE_NAME: ${{ github.repository }}

jobs:
    # 代码质量检查
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
            - run: pnpm type-check

    # 单元测试
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
            - uses: actions/upload-artifact@v4
              with:
                  name: coverage
                  path: coverage/

    # 构建 + Docker 镜像
    build:
        name: Build & Push Image
        runs-on: ubuntu-latest
        needs: [lint]
        permissions:
            contents: read
            packages: write
        outputs:
            image_tag: ${{ steps.meta.outputs.tags }}
        steps:
            - uses: actions/checkout@v4

            # Docker 构建优化
            - name: Docker meta
              id: meta
              uses: docker/metadata-action@v5
              with:
                  images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
                  tags: |
                      type=sha,prefix=
                      type=ref,event=branch

            - name: Login to GHCR
              uses: docker/login-action@v3
              with:
                  registry: ${{ env.REGISTRY }}
                  username: ${{ github.actor }}
                  password: ${{ secrets.GITHUB_TOKEN }}

            - name: Build and push
              uses: docker/build-push-action@v5
              with:
                  context: .
                  push: true
                  tags: ${{ steps.meta.outputs.tags }}
                  labels: ${{ steps.meta.outputs.labels }}
                  cache-from: type=gha
                  cache-to: type=gha,mode=max

    # 部署到测试环境
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
            - name: Deploy via SSH
              uses: appleboy/ssh-action@v1
              with:
                  host: ${{ secrets.TEST_SERVER_HOST }}
                  username: deploy
                  key: ${{ secrets.TEST_SSH_KEY }}
                  script: |
                      docker pull ${{ needs.build.outputs.image_tag }}
                      docker-compose -f /app/docker-compose.test.yml up -d

    # 部署到生产环境
    deploy-prod:
        name: Deploy to Production
        runs-on: ubuntu-latest
        needs: [test, build]
        if: github.ref == 'refs/heads/main'
        environment:
            name: production  # GitHub 上需手动审批
            url: https://myapp.com
        steps:
            - uses: actions/checkout@v4
            - name: Deploy via SSH
              uses: appleboy/ssh-action@v1
              with:
                  host: ${{ secrets.PROD_SERVER_HOST }}
                  username: deploy
                  key: ${{ secrets.PROD_SSH_KEY }}
                  script: |
                      docker pull ${{ needs.build.outputs.image_tag }}
                      docker-compose -f /app/docker-compose.prod.yml up -d
```

**优点：**
- 配置简单，YAML 语法直观，上手成本最低
- Marketplace 有海量现成 Action（2 万+），几乎所有操作都能找到
- 与 GitHub PR/Issue/Release 深度集成，体验丝滑
- 公开仓库免费不限时长，私有仓库每月 2000 分钟免费额度
- 支持矩阵构建（多 Node 版本、多操作系统并行测试）

**缺点：**
- 强绑定 GitHub 生态（不能用于 GitLab/Bitbucket 项目）
- 复杂流水线的复用能力有限（Reusable Workflow 有一定局限）
- 大型构建需要自托管 Runner（GitHub-hosted Runner 资源有限）
- 私有仓库超出免费额度后按分钟计费，大型团队成本可能较高

**适配场景：** GitHub 托管的开源项目、中小型团队、初创公司

### 2.4 CircleCI

**定位：** SaaS CI/CD 平台，以速度和易用性著称。

```yaml
# .circleci/config.yml
version: 2.1

orbs:
    node: circleci/node@5
    docker: circleci/docker@2

jobs:
    lint-and-test:
        docker:
            - image: cimg/node:20
              environment:
                  PNPM_HOME: /home/circleci/.local/share/pnpm
        steps:
            - checkout
            - run: corepack enable && corepack prepare pnpm@latest --activate
            - restore_cache:
                  keys:
                      - v1-deps-{{ checksum "pnpm-lock.yaml" }}
                      - v1-deps-
            - run: pnpm install --frozen-lockfile
            - save_cache:
                  key: v1-deps-{{ checksum "pnpm-lock.yaml" }}
                  paths:
                      - node_modules
            - run: pnpm lint
            - run: pnpm test:coverage
            - store_test_results:
                  path: test-results
            - store_artifacts:
                  path: coverage

    build-and-push:
        docker:
            - image: cimg/docker:24.0
        steps:
            - checkout
            - setup_remote_docker:
                  docker_layer_caching: true  # Docker 层缓存加速
            - run:
                  name: Build and push Docker image
                  command: |
                      docker build -t myapp:$CIRCLE_SHA1 .
                      echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin
                      docker tag myapp:$CIRCLE_SHA1 registry.example.com/myapp:$CIRCLE_SHA1
                      docker push registry.example.com/myapp:$CIRCLE_SHA1

workflows:
    version: 2
    build-test-deploy:
        jobs:
            - lint-and-test
            - build-and-push:
                  requires:
                      - lint-and-test
                  filters:
                      branches:
                          only: [main, develop]
```

**优点：**
- 构建速度最快的 SaaS CI 之一（Docker 层缓存 + 智能并行）
- 配置简洁，Orbs 生态提供大量预制配置
- 支持 macOS 构建（iOS 项目友好）
- SSH 调试模式，可以直接进构建容器排查问题

**缺点：**
- 纯 SaaS，不支持自托管
- 免费额度较少（每月 6000 分钟，但只含 1 个并发）
- 与代码仓库集成不如 GitLab CI / GitHub Actions 深度
- 高级功能（缓存、并行）需要付费计划

**适配场景：** 追求构建速度的中小团队，不介意 SaaS 的团队

### 2.5 Drone

**定位：** 轻量级自托管 CI/CD，基于容器，配置极简。

```yaml
# .drone.yml
kind: pipeline
type: docker
name: default

steps:
    - name: install
      image: node:20-alpine
      commands:
          - corepack enable && pnpm install --frozen-lockfile

    - name: lint
      image: node:20-alpine
      commands:
          - corepack enable && pnpm lint
      depends_on: [install]

    - name: test
      image: node:20-alpine
      commands:
          - corepack enable && pnpm test
      depends_on: [install]

    - name: build
      image: node:20-alpine
      commands:
          - corepack enable && pnpm build
      depends_on: [lint, test]

    - name: docker
      image: plugins/docker
      settings:
          repo: registry.example.com/myapp
          tags: ${DRONE_COMMIT_SHA:0:8}
          registry: registry.example.com
          username:
              from_secret: docker_username
          password:
              from_secret: docker_password
      when:
          branch: [main, develop]
      depends_on: [build]

    - name: deploy
      image: appleboy/drone-ssh
      settings:
          host: deploy-server
          username: deploy
          key:
              from_secret: ssh_key
          script:
              - docker pull registry.example.com/myapp:${DRONE_COMMIT_SHA:0:8}
              - docker-compose up -d
      when:
          branch: [main]
      depends_on: [docker]

trigger:
    branch:
        - main
        - develop
```

**优点：**
- 配置极简，每个 step 就是一个容器，概念清晰
- 完全自托管，Go 单二进制部署，资源占用极低
- 与 GitLab / GitHub / Gitea / Bitbucket 都能集成
- 不需要 Jenkins 那样的重型服务器

**缺点：**
- 生态相对小，插件数量有限
- 复杂流水线（条件、循环）表达能力不如 Jenkins / GitLab CI
- 社区版功能有限，企业版付费
- 文档和社区资源不如其他平台丰富

**适配场景：** 小团队自托管，追求轻量级，已有 Git 平台但需要独立的 CI/CD

### 2.6 选型对比总表

| 维度 | Jenkins | GitLab CI | GitHub Actions | CircleCI | Drone |
|------|---------|-----------|---------------|----------|-------|
| **部署方式** | 自托管 | 自托管/SaaS | SaaS/自托管Runner | SaaS | 自托管 |
| **配置语言** | Groovy | YAML | YAML | YAML | YAML |
| **学习成本** | 高 | 中 | 低 | 低 | 最低 |
| **插件生态** | 1800+ | 内置丰富 | 2万+ Actions | Orbs | 有限 |
| **仓库绑定** | 任意 | GitLab | GitHub | 任意 | 多平台 |
| **构建速度** | 中 | 中 | 快 | 最快 | 快 |
| **免费额度** | 无限（自托管） | 无限（CE） | 2000分/月 | 6000分/月 | 无限（自托管） |
| **并行能力** | 强 | 强 | 强 | 最强 | 中 |
| **数据安全** | 内网 | 内网（自托管） | GitHub 服务器 | 云端 | 内网 |
| **运维成本** | 高 | 中 | 低 | 无 | 低 |
| **适用团队** | 大型企业 | 用 GitLab 的团队 | 开源/中小团队 | 追求速度 | 轻量自托管 |

---

## 三、Docker 构建优化

无论选哪个平台，Docker 构建优化都是通用的提效手段。

### 3.1 多阶段构建

```dockerfile
# Dockerfile — 多阶段构建
# ===== 阶段一：依赖安装 =====
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ===== 阶段二：构建 =====
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

# ===== 阶段三：运行 =====
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 安全：非 root 用户运行
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER appuser
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**优化效果：** 最终镜像不包含源码和 devDependencies，体积从 1GB+ 缩减到 100-200MB。

### 3.2 构建缓存优化

```dockerfile
# ❌ 错误顺序：每次代码变动都重新安装依赖
COPY . .
RUN pnpm install && pnpm build

# ✅ 正确顺序：先复制依赖文件，利用 Docker 层缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile    # 依赖不变则命中缓存
COPY . .                               # 只在代码变动时重新复制
RUN pnpm build
```

**缓存命中率分析：**

```
Layer 1: FROM node:20-alpine           → 基础镜像，几乎不变
Layer 2: COPY package.json lockfile    → 只在改依赖时变
Layer 3: RUN pnpm install              → 只在依赖变时重新执行（耗时操作）
Layer 4: COPY . .                      → 代码变动时重新执行
Layer 5: RUN pnpm build                → 代码变动时重新执行

未优化：每次构建 3-5 分钟（全量安装 + 构建）
优化后：代码不变时 < 30 秒（全部命中缓存）
        只改代码时 1-2 分钟（跳过安装步骤）
        改依赖时 3-5 分钟（需要重新安装）
```

### 3.3 .dockerignore

```text
# .dockerignore — 减小构建上下文
node_modules
dist
.git
.github
.vscode
*.md
coverage
.env*
.DS_Store
```

---

## 四、部署策略

### 4.1 滚动部署（Rolling Update）

最简单的方式，逐步替换旧版本：

```bash
#!/bin/bash
# deploy.sh — 滚动部署脚本
IMAGE_TAG=$1

# 拉取新镜像
docker pull registry.example.com/myapp:$IMAGE_TAG

# 启动新容器
docker run -d --name myapp-new -p 3001:3000 \
    --env-file /app/.env.production \
    registry.example.com/myapp:$IMAGE_TAG

# 健康检查
for i in {1..30}; do
    if curl -sf http://localhost:3001/health > /dev/null; then
        echo "New container is healthy"
        break
    fi
    echo "Waiting for health check... ($i/30)"
    sleep 2
done

# 切换流量（修改 nginx upstream）
sudo nginx -s reload

# 停止旧容器
docker stop myapp-old || true
docker rm myapp-old || true
docker rename myapp-new myapp-old
```

**优点：** 简单，不需要额外基础设施
**缺点：** 切换过程中新旧版本短暂共存，可能有兼容性问题

### 4.2 蓝绿部署（Blue-Green）

准备两套完全相同的环境，切换时直接倒流量：

```yaml
# docker-compose.blue.yml
services:
    app-blue:
        image: registry.example.com/myapp:${TAG}
        ports:
            - '3001:3000'
        environment:
            - NODE_ENV=production

# docker-compose.green.yml
services:
    app-green:
        image: registry.example.com/myapp:${TAG}
        ports:
            - '3002:3000'
        environment:
            - NODE_ENV=production
```

```nginx
# nginx 配置 — 蓝绿切换只需修改 upstream
upstream myapp {
    server 127.0.0.1:3001;  # 当前指向蓝
    # server 127.0.0.1:3002;  # 切到绿时注释上面，取消注释这行
}

server {
    listen 80;
    location / {
        proxy_pass http://myapp;
    }
}
```

**优点：** 切换瞬间完成，回滚只需改 nginx 配置
**缺点：** 需要双倍服务器资源

### 4.3 金丝雀发布（Canary）

先让少量流量访问新版本，观察没问题后再全量发布：

```yaml
# Istio VirtualService — 10% 流量到新版本
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
    name: myapp
spec:
    hosts:
        - myapp.com
    http:
        - route:
              - destination:
                    host: myapp
                    subset: stable
                weight: 90
              - destination:
                    host: myapp
                    subset: canary
                weight: 10
```

**优点：** 风险最小，出问题只影响 10% 用户
**缺点：** 需要服务网格（Istio/Linkerd）或负载均衡器支持，配置复杂

### 4.4 部署策略对比

| 策略 | 停机时间 | 回滚速度 | 资源消耗 | 复杂度 | 适用场景 |
|------|---------|---------|---------|--------|---------|
| 滚动部署 | 短暂 | 中等 | 低 | 低 | 大多数项目 |
| 蓝绿部署 | 零 | 快 | 双倍 | 中 | 关键业务 |
| 金丝雀 | 零 | 快 | 中 | 高 | 大规模高可用系统 |

**建议：** 初创团队用滚动部署，核心业务用蓝绿，大规模系统用金丝雀。

---

## 五、多环境配置管理

### 5.1 配置分层

```
配置来源优先级（从高到低）：
1. 环境变量（CI/CD 平台 Secret）
2. 环境专属 .env 文件
3. 默认 .env 文件
4. 代码中的默认值
```

```typescript
// config/index.ts — 统一配置管理
import { z } from 'zod';

const configSchema = z.object({
    // 应用配置
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),
    PORT: z.coerce.number().default(3000),
    APP_NAME: z.string().default('MyApp'),

    // 数据库
    DATABASE_URL: z.string().url(),
    DATABASE_POOL_SIZE: z.coerce.number().default(10),

    // Redis
    REDIS_URL: z.string().url(),

    // 第三方服务
    OSS_BUCKET: z.string(),
    OSS_REGION: z.string(),

    // 安全
    JWT_SECRET: z.string().min(32),
    CORS_ORIGIN: z.string(),
});

// 解析并校验——启动时就报错，不等到运行时
function loadConfig() {
    try {
        return configSchema.parse(process.env);
    } catch (error) {
        console.error('配置校验失败:', error);
        process.exit(1);
    }
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;
```

### 5.2 CI/CD 中的密钥管理

```
密钥管理原则：
1. 代码仓库中不存密钥（.env 文件只有非敏感默认值）
2. 密钥存在 CI/CD 平台的 Secret 管理中
3. 生产密钥只有特定人员有权限查看
4. 密钥定期轮换

各平台的 Secret 管理：
├── GitHub Actions → Settings → Secrets and variables → Actions
├── GitLab CI     → Settings → CI/CD → Variables
├── Jenkins       → Credentials 插件
├── CircleCI      → Project Settings → Environment Variables
└── Drone         → UI 或 CLI 添加 Secret

密钥注入方式：
├── 构建时注入（构建产物中的密钥，如 API Key）
├── 运行时注入（环境变量，如数据库密码）
└── 建议：运行时注入 > 构建时注入（密钥不出现在镜像中）
```

---

## 六、流水线设计模式

### 6.1 通用流水线结构

```
所有 CI/CD 平台的流水线结构大同小异：

触发（Trigger）
├── push 到 main/develop
└── Pull Request 到 main/develop

阶段一：质量门禁（Gate）
├── ESLint / Prettier
├── TypeScript 类型检查
├── 单元测试 + 覆盖率
└── 全部通过才进入下一阶段

阶段二：构建（Build）
├── 编译/打包
├── Docker 镜像构建
├── 镜像推送
└── 产物归档（artifacts）

阶段三：部署（Deploy）
├── 测试环境：自动部署（push to develop）
├── 预发环境：手动触发
└── 生产环境：手动审批 + 部署

阶段四：验证（Verify）
├── 冒烟测试（生产环境健康检查）
├── 告警通知（成功/失败）
└── 回滚预案
```

### 6.2 Monorepo 的流水线

```yaml
# GitHub Actions — Monorepo 按变更目录触发
name: Monorepo CI

on:
    push:
        branches: [main, develop]

jobs:
    # 检测哪些包有变更
    changes:
        runs-on: ubuntu-latest
        outputs:
            app-web: ${{ steps.filter.outputs.app-web }}
            app-admin: ${{ steps.filter.outputs.app-admin }}
            shared-ui: ${{ steps.filter.outputs.shared-ui }}
        steps:
            - uses: actions/checkout@v4
            - uses: dorny/paths-filter@v3
              id: filter
              with:
                  filters: |
                      app-web:
                          - 'apps/web/**'
                          - 'packages/ui/**'
                      app-admin:
                          - 'apps/admin/**'
                          - 'packages/ui/**'
                      shared-ui:
                          - 'packages/ui/**'

    # 只构建有变更的应用
    build-web:
        needs: changes
        if: needs.changes.outputs.app-web == 'true'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - run: pnpm install --frozen-lockfile
            - run: pnpm --filter web build

    build-admin:
        needs: changes
        if: needs.changes.outputs.app-admin == 'true'
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - run: pnpm install --frozen-lockfile
            - run: pnpm --filter admin build
```

### 6.3 回滚策略

```bash
#!/bin/bash
# rollback.sh — 快速回滚脚本
# 用法: ./rollback.sh <version>

TARGET_VERSION=$1

if [ -z "$TARGET_VERSION" ]; then
    echo "用法: ./rollback.sh <version>"
    echo "可用版本:"
    docker images --format '{{.Tag}}' registry.example.com/myapp | sort -r | head -10
    exit 1
fi

echo "回滚到版本: $TARGET_VERSION"

# 拉取目标版本
docker pull registry.example.com/myapp:$TARGET_VERSION

# 停止当前容器
docker stop myapp || true
docker rm myapp || true

# 启动旧版本
docker run -d --name myapp -p 3000:3000 \
    --env-file /app/.env.production \
    --restart unless-stopped \
    registry.example.com/myapp:$TARGET_VERSION

# 验证
sleep 5
if curl -sf http://localhost:3000/health > /dev/null; then
    echo "回滚成功，当前版本: $TARGET_VERSION"
else
    echo "回滚后健康检查失败！请立即人工介入"
    exit 1
fi
```

---

## 七、常见反模式与边界

### 7.1 CI/CD 的反模式

```
反模式 1：流水线里做所有事情
- 把数据库迁移、数据清洗、定时任务都放进 CI/CD
- 结果：流水线变成"万能脚本"，不可维护
- 正确做法：CI/CD 只做构建和部署，数据操作用独立的运维脚本

反模式 2：没有缓存，每次全量安装
- 每次 CI 都从零安装依赖，5 分钟起步
- 正确做法：利用 pnpm store 缓存 / Docker 层缓存 / CI 平台缓存

反模式 3：生产部署不需要审批
- push 到 main 直接部署生产，一个错误提交就炸
- 正确做法：生产部署必须手动审批（GitHub Environment protection rules）

反模式 4：密钥写在 YAML 里提交到 Git
- .gitlab-ci.yml 里直接写数据库密码
- 正确做法：所有密钥用平台 Secret 管理

反模式 5：构建和部署不分
- 在生产服务器上 pnpm build，构建失败直接影响线上
- 正确做法：CI 构建产物（Docker 镜像），部署只拉镜像运行
```

### 7.2 CI/CD 的边界

**不该用 CI/CD 的场景：**

- **个人博客 / 静态站**：手动部署一次就行，CI/CD 是过度工程
- **一次性脚本**：数据迁移脚本、批量处理，不需要自动化流程
- **探索性项目**：技术验证阶段，CI/CD 拖慢节奏

**必须用 CI/CD 的场景：**

- **团队协作（3+ 人）**：手动部署的沟通成本远大于 CI/CD 配置成本
- **生产环境**：手动部署的不确定性是最大的风险来源
- **频繁发布（> 1次/周）**：手动部署每次耗时 30 分钟，一年浪费数百小时

### 7.3 选型决策树

```
你的代码托管在哪里？
├── GitHub
│   ├── 是开源项目？ → GitHub Actions（免费）
│   └── 是私有项目？
│       ├── 团队 < 20 人 → GitHub Actions（2000 分钟够用）
│       └── 需要内网构建？ → GitHub Actions + 自托管 Runner
├── GitLab
│   └── → GitLab CI（原生集成，开箱即用）
├── 内网 / 多平台
│   ├── 需要插件生态？ → Jenkins
│   └── 追求轻量？ → Drone
└── 无偏好
    ├── 预算充足、追求速度？ → CircleCI
    └── 预算有限、追求简单？ → GitHub Actions + GitHub
```

---

## 八、总结

### 核心原则

- **CI/CD 是必需品，不是奢侈品**——任何有生产环境的项目都需要
- **选型看团队现状**：代码在哪、团队多大、是否需要内网部署
- **构建和部署分离**：CI 产出制品（Docker 镜像），CD 只负责部署
- **密钥不入代码**：所有敏感信息通过平台 Secret 管理
- **生产部署需审批**：手动触发 + 审批流是最后的安全网

### 最小可行方案

| 团队阶段 | 推荐方案 | 配置成本 |
|---------|---------|---------|
| 个人项目 | GitHub Actions 一个 yml | 1 小时 |
| 小团队（2-5 人） | GitHub Actions + Docker | 半天 |
| 中型团队（5-20 人） | GitLab CI / GitHub Actions + 多环境 | 1-2 天 |
| 大型团队（20+ 人） | Jenkins 自托管 / GitLab CI + K8s | 1-2 周 |

### 一句话建议

**先用最简单的方案（GitHub Actions 一个 yml 文件）把 CI/CD 跑起来，在痛点出现时再演进——过早引入 Jenkins 和 K8s 是 CI/CD 领域最常见的过度工程。**
