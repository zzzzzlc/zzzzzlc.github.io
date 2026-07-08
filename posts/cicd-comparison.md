---
title: CI/CD 方案实践对比：从选型到落地
date: '2026-04-21'
tags:
  - DevOps
category: 工程化
summary: >-
  从手动部署的痛点出发，对比 Jenkins、GitLab CI、GitHub Actions、CircleCI、Drone 五大平台；按「构建优化（缓存分层/镜像瘦身/体积分析）」「项目类型（静态站/SSR/Node 服务/移动端）」「部署基础设施（单机/Swarm/K8s/Serverless）」「团队阶段」四个维度给出可落地配置，覆盖发布策略、多环境管理、回滚与反模式。
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

**适用场景：** 大型企业、内网隔离环境、合规要求高的团队

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

**适用场景：** 使用 GitLab 做代码托管的团队，想要开箱即用的 CI/CD

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

**适用场景：** GitHub 托管的开源项目、中小型团队、初创公司

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

**适用场景：** 追求构建速度的中小团队，不介意 SaaS 的团队

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

**适用场景：** 小团队自托管，追求轻量级，已有 Git 平台但需要独立的 CI/CD

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

## 三、构建优化深挖

平台选型解决"用什么工具"，构建优化解决"构建快不快、镜像小不小、产物能不能追溯"。无论用哪个 CI 平台，下面的优化都是通用的——它们发生在你的 Dockerfile 和 workflow 里，而不是平台配置里。

### 3.1 多阶段构建

多阶段构建的核心是**分层缓存 + 最终镜像最小化**：把"需要装依赖的层"和"只跑产物的层"分开。

```dockerfile
# Dockerfile — 多阶段构建
# ===== 阶段一：依赖安装（只在 lockfile 变化时重新执行） =====
FROM node:20-alpine AS deps
WORKDIR /app
# 只复制依赖描述文件，源码改动不会让这层失效
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ===== 阶段二：构建（依赖不变时命中 deps 层缓存） =====
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

# ===== 阶段三：运行（最终镜像，不含源码和 devDependencies） =====
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

**为什么 deps 和 builder 要分开？** 如果合并成一个阶段（`COPY . .` 后直接 `pnpm install`），任何一行代码改动都会让 `install` 层失效，每次都重装依赖。拆开后，`deps` 阶段只看 `package.json` 和 lockfile，代码改动不会触发重装。

**Next.js 项目用 standalone 输出进一步瘦身：** 在 `next.config.js` 里开启 `output: 'standalone'`，Next 会把运行所需的最小 `node_modules` 打包进 `.next/standalone`，最终镜像不需要拷贝完整 `node_modules`。完整的 standalone Dockerfile 见 4.2 SSR 应用——核心是 runner 阶段只 COPY `standalone` + `static` + `public` 三个产物目录，跳过整个 `node_modules`。

**优化效果：** 最终镜像不包含源码和 devDependencies，体积从 1GB+ 缩减到 100-200MB；Next standalone 可进一步到 ~170MB（实测路径见 3.5）。

### 3.2 缓存分层与命中率度量

CI 构建慢，90% 的情况是缓存没命中。前端项目的缓存分三层，**每层都要单独配，缺一不可**：

```
缓存分层（互不替代，各自解决不同问题）
├── 第一层：依赖缓存（pnpm store / node_modules）
│   └── 解决：pnpm install 耗时（最常见瓶颈，30s → 5s）
├── 第二层：Docker 层缓存（image layer cache）
│   └── 解决：docker build 重复执行 RUN 步骤（image build 2min → 20s）
└── 第三层：CI 任务缓存（构建产物 / 编译中间件）
    └── 解决：跨 job / 跨分支复用编译产物（如 turbo cache）
```

**第一层：依赖缓存。** 各平台的配置：

```yaml
# GitHub Actions — setup-node 内置 pnpm 缓存
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
      node-version: 20
      cache: pnpm          # 自动缓存 pnpm store，按 pnpm-lock.yaml 做 key
- run: pnpm install --frozen-lockfile
```

```yaml
# GitLab CI — 手动指定缓存路径
default:
    cache:
        key:
            files:
                - pnpm-lock.yaml   # lockfile 变才失效，最精确
        paths:
            - .pnpm-store/
```

**第二层：Docker 层缓存。** GitHub Actions 用 `cache-from/cache-to: type=gha`（见 2.3 的 build job），把每一层 Dockerfile 指令的产物缓存到 GitHub 的 cache 里。下次构建时，未变动的 `RUN` 指令直接 `CACHED`，跳过执行。

**第三层：CI 任务缓存（Monorepo 场景尤其重要）。** 用 turborepo/nx 时，缓存编译产物：

```yaml
- uses: actions/cache@v4
  with:
      path: |
          .turbo
          **/.eslintcache
      key: turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
```

**怎么判断缓存到底命中没有？** 别靠感觉，看日志：

```
GitHub Actions 依赖缓存：日志出现 "Cache restored successfully" 或
  "Cache size: XX MB" → 命中；出现 "Cache not found" → 未命中
Docker 层缓存：docker build 日志每步前缀
  "CACHED"（如 "CACHED RUN pnpm install"）→ 命中
  前缀是 "RUN" 且有耗时 → 未命中，重新执行了
pnpm install 本身：日志末尾的 packages 数 + 耗时
  命中时 "Done in 4.2s" + "0 packages added"
  未命中时 "Done in 38s" + "1284 packages added"
```

**缓存收益实测对比：**

| 场景 | 无缓存 | 三层缓存全开 |
|------|--------|-------------|
| 首次构建（冷启动） | 5-6 min | 5-6 min（无缓存可用） |
| 只改业务代码（依赖不变） | 5 min | **40-60s**（依赖层 + Docker 层全命中） |
| 升级一个依赖 | 5 min | 2-3 min（需重装该依赖） |
| 改 lockfile（大批量升级） | 5 min | 5 min（缓存全部失效） |

> **关键认知：缓存的收益在"改代码"这个最高频场景。** 团队每天几十次提交，90% 是只改业务代码，缓存能让这 90% 的构建从 5 分钟压到 1 分钟内。

### 3.3 .dockerignore

`.dockerignore` 经常被忽视，但它直接影响**构建上下文上传速度**和**缓存失效概率**：

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

# 容易踩坑：本地 node_modules 如果不忽略，会被打包进上下文
# 一个中等项目的 node_modules 可达 500MB-1GB
```

**构建上下文体积的影响：** `docker build` 第一步是把整个项目目录（除 `.dockerignore` 排除项）打包发送给 daemon。一个不配 `.dockerignore` 的项目，因为本地 `node_modules`（几百 MB）和 `.git`（可能上 GB）被打进上下文，每次构建光是"传输上下文"就要 30-60 秒，还会因为上下文变化导致缓存失效。配上之后，上下文通常只有几 MB。

### 3.4 并行构建与矩阵

流水线里能并行的不并行，等于白白让 CI 跑成串行。并行有两个层面：

**层面一：同一构建内的任务并行。** lint、test、type-check 互不依赖，应该并行而不是串行：

```yaml
# GitHub Actions — 三个质量门禁并行
jobs:
    lint:
        runs-on: ubuntu-latest
        # ... pnpm lint + type-check
    test:
        runs-on: ubuntu-latest
        # ... pnpm test:coverage
    build:
        needs: [lint, test]   # 等 lint + test 都通过再构建
        # ... docker build
```

对比串行写法（在一个 job 里 `pnpm lint && pnpm test && pnpm type-check`）：并行能省一半时间，且哪个失败一目了然，不会因为 lint 挂了还要等 30 秒才发现 test 也有问题。

**层面二：矩阵构建（多版本/多平台）。** 要兼容 Node 18/20/22，或要出 amd64/arm64 双架构镜像时，用矩阵一次跑完：

```yaml
# 矩阵：多 Node 版本并行测试兼容性
test:
    strategy:
        matrix:
            node-version: [18, 20, 22]
            os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
        - uses: actions/setup-node@v4
          with:
              node-version: ${{ matrix.node-version }}
        - run: pnpm test
```

```yaml
# Docker buildx：一次构建多架构镜像（amd64 + arm64，适配 x86 服务器和 ARM/Mac）
- uses: docker/setup-qemu-action@v3
- uses: docker/setup-buildx-action@v3
- uses: docker/build-push-action@v5
  with:
      platforms: linux/amd64,linux/arm64
      push: true
      tags: registry.example.com/myapp:latest
```

**优点：** 测试覆盖更全（多版本提前暴露兼容问题）；多架构镜像一次产出，部署不再挑服务器。
**缺点：** 矩阵会成倍消耗 CI 额度（3 版本 × 2 系统 = 6 倍用量），私有仓库要注意免费额度。
**适用场景：** 发布 npm 包、跨平台工具、需要兼容多运行时版本的项目。

### 3.5 镜像瘦身：alpine / slim / distroless

基础镜像的选择直接决定最终镜像体积和安全性。Node 官方提供多种变体：

| 基础镜像 | 体积 | 包含内容 | 特点 |
|---------|------|---------|------|
| `node:20` | ~1GB | 完整 Debian + 所有构建工具 | 最臃肿，**生产禁用** |
| `node:20-slim` | ~240MB | 精简 Debian，glibc | 稳定兼容，**生产推荐起步** |
| `node:20-alpine` | ~180MB | Alpine Linux，musl libc | 最小，但 musl 有兼容坑 |
| `gcr.io/distroless/nodejs20` | ~150MB | 无 shell、无包管理器 | **最安全**，被攻破也无法执行命令 |

**alpine 的 musl 坑：** Alpine 用 musl libc 而不是 glibc，部分依赖原生 C 扩展的 npm 包（如 `sharp`、`bcrypt`、`node-sass`、`canvas`）在 Alpine 上会编译失败或运行崩溃。如果项目用了这类包，优先选 `slim` 而不是 `alpine`，能省掉一整天的排障。

**distroless 的安全优势：** 它没有 shell、没有 `apk`/`apt`、没有 `curl`，即使容器被 RCE 攻击，攻击者也拿不到 shell 来横向移动。配合多阶段构建的 `USER appuser`（非 root），是金融/政务场景的首选：

```dockerfile
# distroless 最终阶段 — 无 shell，最安全
FROM node:20-alpine AS builder
# ... 构建 standalone 产物

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nonroot:nonroot
EXPOSE 3000
CMD ["server.js"]
```

**Next.js 镜像体积实测路径：** 完整 `node:20` + 全量 `node_modules` ≈ 1.1GB → `alpine` + standalone ≈ 170MB → `distroless` + standalone ≈ 120MB。瘦身不只是省带宽，更是缩小攻击面。

### 3.6 产物体积分析与构建耗时定位

构建慢或产物大，先量化再优化，**别凭感觉**。

**产物体积分析：** 前端项目用可视化工具看哪个包占了大头：

```ts
// vite.config.ts — rollup-plugin-visualizer 生成体积报告
import { visualizer } from 'rollup-plugin-visualizer';

export default {
    plugins: [
        visualizer({
            open: true,
            filename: 'dist/stats.html',  // 构建后生成可交互的体积 treemap
            gzipSize: true,
            brotliSize: true,
        }),
    ],
};
```

```js
// next.config.js — @next/bundle-analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer({ /* next config */ });
// 运行：ANALYZE=true pnpm build
```

看到报告后常见优化点：moment → dayjs（280KB → 7KB）、全量 lodash → lodash-es 按需、图标库按需引入（`@ant-design/icons` 全量引入会有上百 KB）。

**构建耗时定位：** 构建慢但不知道慢在哪一段时，分段打点：

```bash
# 给每个阶段打时间戳，定位是 install / lint / build / image 哪段慢
echo "=== install start: $(date +%s) ===" && \
  pnpm install --frozen-lockfile && \
echo "=== build start: $(date +%s) ===" && \
  pnpm build && \
echo "=== image build start: $(date +%s) ===" && \
  docker build -t myapp .
```

```bash
# Vite / Webpack 自带的构建分析
vite build --profile     # Vite 输出各插件耗时
ANALYZE=true next build  # Next.js 输出编译阶段耗时分布
```

**典型瓶颈与对策：**

| 瓶颈现象 | 可能原因 | 对策 |
|---------|---------|------|
| `pnpm install` 占 70% 时间 | 依赖缓存未命中 | 配第一层缓存（见 3.2） |
| `docker build` 的 RUN 重复执行 | Docker 层缓存失效 | 配 `cache-from: type=gha` + 正确的 COPY 顺序 |
| `pnpm build` 越来越慢 | 产物体积膨胀 / 无用的 transform | 用 visualizer 分析，剔除大依赖 |
| 整体 CI 卡在排队 | 并发 job 超过免费额度上限 | 合并无依赖的小 job，或升级 runner |

---

## 四、按项目类型构建与部署

第二章的五大平台例子都假设"Node 服务 + Docker 部署"，但实际项目类型差异巨大：**纯前端静态站根本不需要 Docker，SSR 应用必须有常驻进程，移动端要出安装包**。把通用的 Node+Docker 模板套到所有项目上，就是最常见的"过度工程"。

### 4.1 纯前端静态站（Vite SPA / Next.js 静态导出）

**产物形态：** 一堆静态文件（`dist/` 或 `out/`），HTML + JS + CSS + 图片。

**部署目标：** 对象存储（阿里云 OSS / AWS S3 / Cloudflare R2）+ CDN，或静态托管平台（GitHub Pages / Vercel / Netlify）。**核心认知：静态站不需要 Docker，不需要 Node 运行时，不需要服务器进程。** 用 Docker 跑个 nginx 托管静态文件，是徒增运维成本。

```yaml
# .github/workflows/deploy-static.yml — Vite 构建后直传 OSS
name: Deploy Static
on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 20
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm build   # 产物在 dist/

            # 直传 OSS，不经过 Docker
            - uses: tvrcgo/oss-action@master
              with:
                  key-id: ${{ secrets.OSS_KEY_ID }}
                  key-secret: ${{ secrets.OSS_KEY_SECRET }}
                  region: oss-cn-hangzhou
                  bucket: my-app-prod
                  assets: dist/**:/   # dist 下所有文件传到 bucket 根目录
```

**Nginx 托管的缓存策略（自建服务器场景）：** 关键是区分"频繁变的入口文件"和"带 hash 永不变的资源文件"：

```nginx
server {
    listen 80;
    root /var/www/myapp;
    index index.html;

    # 带 hash 的静态资源（Vite 输出的 assets/*.js）— 永不变，最长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";   # immutable 阻止重新验证
    }

    # index.html — 不能缓存，否则用户拿不到新版本
    location / {
        try_files $uri $uri/ /index.html;   # SPA 路由回退到 index.html
        add_header Cache-Control "no-cache";
    }
}
```

**与通用 Node 模板的关键差异：**
- 无 Docker、无进程、无健康检查 endpoint
- 部署 = 文件覆盖 + CDN 刷新，秒级生效，回滚 = 切换到旧版本目录
- `immutable` 长缓存依赖构建产物文件名带 content hash（Vite/Webpack 默认就有）

**适用场景：** 营销页、官网、文档站、后台管理系统（无 SSR 需求）、个人博客。这是 80% 前端项目的形态。

### 4.2 SSR 应用（Next.js / Nuxt）

**产物形态：** 服务端运行时（`.next/` 或 `.output/`）+ 静态资源，需要常驻 Node 进程处理服务端渲染。

**关键差异：与静态站不同，SSR 必须有常驻进程，不能丢上 CDN 就完事。** 但又和纯后端 API 不同：SSR 进程同时托管静态资源 + 渲染逻辑，部署相对内聚。

```dockerfile
# Next.js standalone Dockerfile（完整流水线里 build 阶段用）
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build   # output: 'standalone' 已在 next.config 开启

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
# standalone 模式自带 server.js，不需要再装 next
CMD ["node", "server.js"]
```

**进程守护与健康检查：** Node 进程会崩溃（OOM、未捕获异常），必须有守护进程 + 健康检查。Docker 场景用 `restart` 策略 + `HEALTHCHECK`：

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1
```

非 Docker 场景用 PM2：

```bash
# PM2 守护 + 崩溃自动重启 + 集群模式（多核）
pm2 start "node server.js" --name myapp -i max --max-memory-restart 500M
```

**适用场景：** 需要首屏 SEO（电商详情页、内容站）、需要社交分享预览、首屏性能要求高的 C 端应用。
**局限性：** 需要维护服务器/容器、需要关注 Node 进程的内存和稳定性、成本高于静态站。

### 4.3 Node 后端 API 服务

**产物形态：** 编译后的 JS（如果是 TypeScript）+ `node_modules`（仅 dependencies，不含 devDependencies），运行在容器里。

**核心难点：数据库 migration 的执行时机。** 这是后端 CI/CD 最容易出事的地方：

```
Migration 时机对比
├── ❌ 错误：部署新版本时，容器启动自动跑 migration
│   └── 问题：多实例同时启动会并发跑 migration，互相冲突；migration 失败导致服务起不来
├── ❌ 错误：把 migration 放进 Dockerfile 的 RUN（构建时执行）
│   └── 问题：构建环境连不上生产库；构建产物绑定了某个时刻的 schema
└── ✅ 正确：migration 作为独立 job，在部署前串行执行一次
```

```yaml
# GitHub Actions — migration 作为独立 job，部署前串行跑一次
jobs:
    migrate:
        name: Database Migration
        runs-on: ubuntu-latest
        environment: production   # 需要审批，保护生产库
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
            - run: pnpm ci
            # 用生产库连接串执行，必须幂等（可重复执行不出错）
            - run: pnpm db:migrate
              env:
                  DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}

    deploy:
        name: Deploy
        needs: migrate   # 等 migration 完成再部署新版本
        runs-on: ubuntu-latest
        steps:
            # ... 拉镜像、滚动更新
```

**Migration 的两个兼容性铁律（保证零停机滚动发布）：**

1. **向后兼容（新代码能跑在旧 schema 上）：** 发布新版本时，先加列而不是删列。删除旧列要分两次发布——第一次发新代码（不再读写该列），第二次发 migration（删列）。一次性"删列 + 改代码"会导致滚动发布期间，旧实例读到不存在的列而崩溃。

2. **向前兼容（旧代码能跑在新 schema 上）：** 一旦有多版本实例共存（滚动发布中），任何一版代码都不能假设 schema 是某个固定状态。新增字段给默认值、重命名字段分两步走。

**适用场景：** 后端 API 服务、BFF（Backend for Frontend）、定时任务服务。
**局限性：** migration 策略需要团队纪律，一旦有人手动改线上库 schema，CI/CD 的版本控制就失效了。

### 4.4 移动端与小程序

**产物形态：** 安装包（iOS `.ipa` / Android `.apk` / `.aab`）或小程序代码包，目标是应用商店或体验版分发。

**关键差异：构建需要特定操作系统和签名链路。** iOS 必须在 macOS 上用 Xcode 构建，这是 CI 平台选型时容易忽略的硬约束。

```yaml
# GitHub Actions — React Native 出包（iOS 必须用 macOS runner）
jobs:
    build-ios:
        runs-on: macos-latest   # ← iOS 构建的硬性要求，比 ubuntu 贵 10 倍
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
            - uses: ruby/setup-ruby@v1
            - name: Install dependencies
              run: |
                  npm ci
                  cd ios && pod install
            # 签名证书和描述文件从 Secret 注入，绝不入库
            - name: Setup signing
              run: fastlane match appstore --readonly
              env:
                  MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
            - name: Build & Upload
              run: fastlane beta    # 构建 + 上传到 TestFlight
              env:
                  APP_STORE_CONNECT_API_KEY: ${{ secrets.ASC_API_KEY }}
```

```yaml
# 小程序 CI — miniprogram-ci 自动上传体验版（跨平台，ubuntu 即可）
jobs:
    upload-miniprogram:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - run: npm ci && npm run build
            - run: npx miniprogram-ci upload \
                  --pp ./dist \
                  --pkp ./private.key \
                  --appid ${{ secrets.WX_APPID }} \
                  --uv "$(git rev-parse --short HEAD)" \
                  -r 1   # 1=体验版
```

**与 Web 项目的关键差异：**
- iOS 构建绑死 macOS runner，成本是 Linux 的 10 倍（macOS runner 按分钟计费很贵）
- 签名证书、描述文件、API Key 必须用平台 Secret 管理，泄露会导致应用被冒名上架
- 产物分发非即时：App Store 审核要 1-3 天，小程序有审核流程，无法像 Web 那样秒级回滚
- 多端产物要分别构建（iOS/Android/小程序/H5），矩阵或多个 job 并行

**适用场景：** 原生 App、跨端应用（RN/Flutter）、微信/支付宝小程序。
**局限性：** 审核流程让 CD 的"持续"打折扣，更多是 CI（自动出包）+ 人工发布。

### 4.5 项目类型 × 部署策略总表

| 项目类型 | 构建产物 | 部署目标 | 是否需要 Docker | 典型工具 | 发布速度 |
|---------|---------|---------|----------------|---------|---------|
| 纯前端静态站 | `dist/` 静态文件 | OSS/CDN/GitHub Pages | **否**（徒增成本） | ossutil / Vercel | 秒级 |
| SSR 应用 | standalone + 静态资源 | 容器/服务器进程 | 是 | Docker + PM2 | 分钟级 |
| Node 后端 API | 编译 JS + deps | 容器 | 是 | Docker + K8s/Swarm | 分钟级 |
| 移动端 App | ipa / apk | App Store / TestFlight | 否（需 macOS runner） | EAS / fastlane | 天级（审核） |
| 小程序 | 代码包 | 微信平台 | 否 | miniprogram-ci | 小时级（审核） |

> **选型启示：Docker 不是银弹。** 静态站、小程序用 Docker 是过度工程；只有需要常驻进程的服务（SSR、API）才真正需要容器化。

---

## 五、按部署基础设施发布

第四章讲"部署到哪"，本章讲"在什么基础设施上发布、用什么策略发布"。**发布策略（滚动/蓝绿/金丝雀）不是独立的工具，而是依附于基础设施的能力**——同样是"滚动发布"，在单机 Docker、Swarm、K8s 上的实现完全不同。

### 5.1 单机 Docker-Compose + Nginx（滚动 / 蓝绿）

最简单的部署形态：一台服务器，docker-compose 管容器，Nginx 做反向代理。适合个人项目和小团队。

**滚动发布（reload upstream 切换）：** 启新容器 → 健康检查通过 → Nginx 切流量 → 停旧容器。

```bash
#!/bin/bash
# deploy.sh — 单机滚动部署
IMAGE_TAG=$1
docker pull registry.example.com/myapp:$IMAGE_TAG

# 启动新容器（先占用新端口）
docker run -d --name myapp-new -p 3001:3000 \
    --env-file /app/.env.production \
    registry.example.com/myapp:$IMAGE_TAG

# 健康检查通过后再切流量
for i in {1..30}; do
    curl -sf http://localhost:3001/api/health > /dev/null && break
    sleep 2
done

# 切流量：Nginx upstream 指向新端口，reload 不中断连接
sed -i 's/127.0.0.1:3000/127.0.0.1:3001/' /etc/nginx/conf.d/myapp.conf
sudo nginx -s reload

# 停旧容器
docker stop myapp-old || true && docker rm myapp-old || true
docker rename myapp-new myapp-old
```

**蓝绿发布（双环境切换）：** 准备两套环境（蓝/绿），切流量只需改 Nginx 配置，回滚 = 切回去。

```nginx
# 蓝绿切换 — 改一行注释即可，回滚瞬时完成
upstream myapp {
    server 127.0.0.1:3001;  # 当前指向蓝
    # server 127.0.0.1:3002;  # 切到绿时注释上面，取消注释这行
}
```

**优点：** 零基础设施学习成本，一台机器就能跑；蓝绿回滚瞬时。
**缺点：** 单机无高可用（机器挂了服务就挂）；需要双倍资源（蓝绿）；脚本靠人肉维护，规模一上来就乱。
**适用场景：** 个人项目、内部工具、日活几千的小应用。

### 5.2 Docker Swarm（原生滚动 + 一键回滚）

Docker 内置的集群模式，**不需要学 K8s 就能拿到滚动发布和健康检查**。多台机器组成集群，部署时声明期望副本数，Swarm 自动滚动更新。

```yaml
# docker-compose.yml — Swarm stack 文件
services:
    app:
        image: registry.example.com/myapp:${TAG}
        deploy:
            replicas: 3              # 3 个副本，滚动时逐个替换
            update_config:
                parallelism: 1       # 每次更新 1 个
                delay: 10s           # 间隔 10s 再更新下一个
                order: start-first   # 先启新再停旧，减少停机
                failure_action: rollback   # 失败自动回滚
            rollback_config:
                parallelism: 0       # 回滚时一次性全切
        healthcheck:
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/health']
            interval: 10s
            retries: 3
        ports:
            - '80:3000'
```

```bash
# 部署 = 一条命令，Swarm 自动滚动 + 自动健康检查 + 失败自动回滚
docker stack deploy -c docker-compose.yml myapp

# 手动一键回滚（比单机的脚本可靠得多）
docker service update --rollback myapp_app
```

**优点：** Docker 原生，学习曲线远低于 K8s；滚动/回滚/健康检查全部内置声明式实现。
**缺点：** 生态和社区在收缩；复杂调度能力（自动扩缩、金丝雀）不如 K8s；跨云能力弱。
**适用场景：** 已用 Docker、需要多机高可用、但不想引入 K8s 复杂度的中小团队（5-20 人）。

### 5.3 Kubernetes（滚动 / Helm 版本管理 / 金丝雀）

大规模容器的标准答案。K8s 的 `Deployment` 原生支持滚动更新，`Helm` 做版本化发布，`Istio` 做金丝雀流量切分。

**滚动更新（Deployment 声明式）：** K8s 根据声明自动逐个替换 Pod，全程自愈。

```yaml
# k8s/deployment.yaml — 声明期望状态，K8s 自动滚动到这个状态
apiVersion: apps/v1
kind: Deployment
metadata:
    name: myapp
spec:
    replicas: 5
    strategy:
        type: RollingUpdate
        rollingUpdate:
            maxSurge: 1         # 滚动时最多比期望多 1 个（先启新的）
            maxUnavailable: 0   # 滚动时不允许减少可用（保证零停机）
    template:
        spec:
            containers:
                - name: app
                  image: registry.example.com/myapp:${IMAGE_TAG}
                  readinessProbe:    # 就绪检查，通过才接流量
                      httpGet:
                          path: /api/health
                          port: 3000
```

**Helm 版本管理：** 每次发布是一个 Helm release，带版本号，回滚就是切版本：

```bash
helm upgrade --install myapp ./chart \
    --set image.tag=$IMAGE_TAG \
    --namespace prod

# 回滚到上一版本（Helm 记录了所有 release 历史）
helm rollback myapp 23
```

**金丝雀发布（Istio 流量切分）：** 先放 10% 流量到新版本，观察指标无异常再全量。这是 K8s 生态独有的精细化发布能力：

```yaml
# Istio VirtualService — 10% 流量到金丝雀版本
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
    name: myapp
spec:
    hosts: [myapp.com]
    http:
        - route:
              - destination:
                    host: myapp
                    subset: stable
                weight: 90         # 90% 流量到稳定版
              - destination:
                    host: myapp
                    subset: canary
                weight: 10         # 10% 流量到金丝雀
```

**优点：** 自愈、自动扩缩、零停机滚动、精细化金丝雀、跨云可移植；生态最丰富。
**缺点：** 学习曲线最陡；运维成本高（集群本身要维护、监控、升级）；对小团队是过度工程。
**适用场景：** 20+ 人大团队、微服务架构、高可用要求高、多环境频繁发布。

### 5.4 Serverless（Vercel / Cloudflare Workers / 函数计算）

**不需要管理服务器，按请求执行，自动扩缩到零。** 对前端/SSR 项目尤其友好——Vercel 是 Next.js 的官方平台，零配置部署。

```yaml
# .github/workflows/deploy-vercel.yml — Serverless 部署极简
name: Deploy to Vercel
on:
    push:
        branches: [main]
jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - name: Deploy
              run: npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
            # 回滚瞬时：切到任意历史 deployment
            # npx vercel rollback <deployment-url> --token $TOKEN
```

```yaml
# Cloudflare Workers — 边缘部署，全球低延迟
name: Deploy Worker
on:
    push:
        branches: [main]
jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - run: npx wrangler deploy
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CF_TOKEN }}
```

**优点：** 零运维（无服务器要管）；按用量付费（冷启动项目几乎免费）；自动扩缩（扛突发流量）；边缘部署全球低延迟；回滚瞬时（切历史版本）。
**缺点：** 冷启动延迟；厂商锁定严重（Vercel/Cloudflare 的 API 各不相同）；长任务、WebSocket、重度计算不友好；冷流量大时成本可能反超自建。
**适用场景：** 前端静态/SSR 站点、API 网关、Webhook 处理、流量波动大的 C 端应用。

### 5.5 发布策略 × 基础设施对比

| 策略 | 停机时间 | 回滚速度 | 资源消耗 | 复杂度 | 在哪实现 | 适用场景 |
|------|---------|---------|---------|--------|---------|---------|
| 滚动部署 | 短暂 | 中等 | 低 | 低 | 单机脚本 / Swarm / K8s 原生 | 大多数项目 |
| 蓝绿部署 | 零 | 快（切配置） | 双倍 | 中 | 单机 Nginx / K8s | 关键业务 |
| 金丝雀 | 零 | 快（调权重） | 中 | 高 | Istio / 云厂商网关 | 大规模高可用系统 |

**基础设施选型建议：**
- 单机 Docker-Compose → 个人项目、内部工具
- Docker Swarm → 5-20 人团队、多机但不想学 K8s
- Kubernetes → 20+ 人、微服务、高可用
- Serverless → 前端/SSR、流量波动大、想零运维

> **不要跳级。** 个人项目直接上 K8s 是最常见的过度工程——光维护 K8s 集群的时间就够你部署几百次单机应用了。

---

## 六、多环境配置管理

### 6.1 配置分层

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

### 6.2 CI/CD 中的密钥管理

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

## 七、按团队阶段的最小可行流水线

不同团队阶段该做的 CI/CD 完全不同。第二章的五大平台对比是"全景图"，但落到具体团队，**每个阶段只有一个最优解，过早引入高级方案就是浪费**。下面按团队成长路径，给出每阶段的「最小可行流水线」+「最该解决的痛点」+「先别做的事」。

### 7.1 个人 / 开源项目（1 人）

**最该解决的痛点：** 我改完代码，不想手动部署；别人提 PR，我想自动跑测试。

**最小可行方案：GitHub Actions 一个 yml，不做 Docker。** 对个人项目，Docker、多环境、审批流全是负担。

```yaml
# .github/workflows/ci.yml — 个人项目的完整 CI/CD，就这一个文件
name: CI
on:
    push:
        branches: [main]
    pull_request:

jobs:
    check:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: pnpm/action-setup@v4
            - uses: actions/setup-node@v4
              with:
                  cache: pnpm
            - run: pnpm install --frozen-lockfile
            - run: pnpm lint && pnpm test   # PR 自动跑检查，绿了才能合并

    deploy:
        needs: check
        if: github.ref == 'refs/heads/main'   # 合并到 main 自动部署
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - run: pnpm install && pnpm build
            # 前端直接传 Vercel/GitHub Pages，零配置
            - run: npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

**先别做的事：** 不要搭 Docker、不要做多环境、不要引入 Jenkins。一个 yml 文件 + 一个 Vercel，配置成本 1 小时，覆盖个人项目 99% 的需求。

### 7.2 小团队（2-5 人，初创）

**最该解决的痛点：** 多人协作要互相 review；改一个 PR 想看到实际效果再合并；测试环境不能手动维护。

**在 7.1 基础上加三样东西：Preview Deployment、Docker 化、测试环境自动部署。**

```yaml
# Preview Deployment — 每个 PR 自动生成一个临时预览链接
deploy-preview:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
        - uses: actions/checkout@v4
        - run: npx vercel --token ${{ secrets.VERCEL_TOKEN }}
        # Vercel 自动给每个 PR 生成 https://myapp-pr-123.vercel.app
        # 评审人直接点开看效果，不用本地拉代码跑
```

```dockerfile
# 开始 Docker 化：保证本地、测试、生产环境一致
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
FROM node:20-alpine
COPY --from=builder /app/dist ./dist
CMD ["npx", "serve", "dist"]
```

**先别做的事：** 不要引入 K8s、不要做生产环境自动部署（生产仍需人工触发）、不要搭 Jenkins。这阶段核心是"协作提效"，不是"基础设施复杂化"。

### 7.3 中型团队（5-20 人）

**最该解决的痛点：** 多个环境（dev/staging/prod）配置不能乱；生产部署必须有人审批；Monorepo 里改一个包不该全量构建。

**在 7.2 基础上加四样东西：多环境分离、生产审批门禁、Monorepo 按变更触发、制品版本管理。**

**生产审批门禁：** 2.3 的 `deploy-prod` 已用 `environment: production` 触发门禁，真正的保护要在 GitHub 仓库设置的 Environment 里配三条规则——**Required reviewers**（指定人点批准才放行）、**Deployment branches**（只允许 main 分支部署生产）、**Wait timer**（部署前强制等几分钟冷静期，拦截冲动发布）。

**Monorepo 按变更触发：** 用 `dorny/paths-filter` 检测变更目录，只构建有改动的包（完整配置见 8.2）。

**镜像打标签规范（制品版本管理）：**

```yaml
# 镜像必须带可追溯的标签，绝不只用 latest
tags: |
    type=sha,prefix=             # git commit sha，精确到提交
    type=ref,event=branch        # 分支名
    type=semver,pattern={{version}}  # git tag v1.2.3 → 1.2.3
# 回滚时按 sha 找到精确版本，而不是猜 latest 现在指向哪
```

**先别做的事：** 不要急着上 K8s（Docker Swarm 或多台单机通常够用）、不要做金丝雀（蓝绿已经够安全）。

### 7.4 大型团队（20+ 人）

**最该解决的痛点：** 几十个微服务要统一发布；上线出问题要能精细控制爆炸半径；部署状态要和监控告警联动。

**在 7.3 基础上加四样东西：K8s + 自托管 Runner、蓝绿/金丝雀、可观测性联动、完善的回滚机制。**

```
大型团队的 CI/CD 成熟度特征
├── 基础设施：K8s + Helm，统一发布模型；自托管 Runner 省额度 + 内网构建
├── 发布策略：核心服务金丝雀（10% → 50% → 100%），一般服务滚动
├── 可观测性：部署事件 → Sentry / Prometheus / 钉钉告警 联动
│   ├── 部署后 5 分钟错误率 > 阈值 → 自动触发回滚或告警
│   └── 部署事件打 tag 到监控系统，出问题能关联到哪次发布
├── 合规：所有部署有审批记录、镜像有漏洞扫描、密钥统一用 Vault 管理
└── 回滚：Helm rollback / Argo Rollouts，分钟级切回任意历史版本
```

**到这个阶段才有意义做的事：** 引入 K8s、Istio 金丝雀、ArgoCD GitOps、镜像漏洞扫描（Trivy）、密钥管理服务（Vault）。这些都是为"规模化"和"合规"服务的，小团队用了只是徒增运维。

### 7.5 团队阶段 × 最小可行方案对照表

| 团队阶段 | 推荐方案 | 核心配置 | 配置成本 | 绝对别做 |
|---------|---------|---------|---------|---------|
| 个人 / 开源 | GitHub Actions + Vercel | 1 个 yml | 1 小时 | Docker、Jenkins、多环境 |
| 2-5 人初创 | + Preview + Docker | 2-3 个 yml | 半天 | K8s、生产自动部署 |
| 5-20 人中型 | + 多环境 + 审批 + Monorepo 触发 | 完整流水线 | 1-2 天 | K8s、金丝雀 |
| 20+ 人大型 | K8s + Helm + 金丝雀 + 可观测性 | 平台工程 | 1-2 周 | 停留在手动部署 |

---

## 八、流水线设计模式

### 8.1 通用流水线结构

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

### 8.2 Monorepo 的流水线

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

### 8.3 回滚策略

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
if curl -sf http://localhost:3000/api/health > /dev/null; then
    echo "回滚成功，当前版本: $TARGET_VERSION"
else
    echo "回滚后健康检查失败！请立即人工介入"
    exit 1
fi
```

> **回滚的前提是镜像带版本标签。** 如果所有镜像都打 `latest` 标签，回滚时根本找不到上一个稳定版本——这也是为什么 7.3 强调镜像必须按 git sha 打标签。

---

## 九、常见反模式与边界

### 9.1 CI/CD 的反模式

```
反模式 1：流水线里做所有事情
- 把数据库迁移、数据清洗、定时任务都放进 CI/CD
- 结果：流水线变成"万能脚本"，不可维护
- 正确做法：CI/CD 只做构建和部署，数据操作用独立的运维脚本

反模式 2：没有缓存，每次全量安装
- 每次 CI 都从零安装依赖，5 分钟起步
- 正确做法：利用 pnpm store 缓存 / Docker 层缓存 / CI 平台缓存（见第三章）

反模式 3：生产部署不需要审批
- push 到 main 直接部署生产，一个错误提交就炸
- 正确做法：生产部署必须手动审批（GitHub Environment protection rules）

反模式 4：密钥写在 YAML 里提交到 Git
- .gitlab-ci.yml 里直接写数据库密码
- 正确做法：所有密钥用平台 Secret 管理

反模式 5：构建和部署不分
- 在生产服务器上 pnpm build，构建失败直接影响线上
- 正确做法：CI 构建产物（Docker 镜像），部署只拉镜像运行

反模式 6：镜像只打 latest 标签
- 所有版本都覆盖到 latest，回滚时找不到上一个稳定版本
- 正确做法：镜像按 git sha + 语义化版本打标签，latest 只是"当前最新"的指针

反模式 7：构建产物不带可追溯标识
- 出了问题不知道线上跑的是哪次提交、哪个 commit
- 正确做法：构建时注入 git sha / 构建时间到产物，应用暴露 /version 接口

反模式 8：镜像不做漏洞扫描
- 基础镜像和依赖里的已知 CVE 一路带到生产
- 正确做法：CI 里加 Trivy / Snyk 扫描，高危漏洞阻断发布
```

### 9.2 CI/CD 的边界

**不该用 CI/CD 的场景：**

- **个人博客 / 静态站（一次性）**：手动部署一次就行，CI/CD 是过度工程（但如果是持续更新的博客，GitHub Actions 一键部署反而省事——见 7.1）
- **一次性脚本**：数据迁移脚本、批量处理，不需要自动化流程
- **探索性项目**：技术验证阶段，CI/CD 拖慢节奏

**必须用 CI/CD 的场景：**

- **团队协作（3+ 人）**：手动部署的沟通成本远大于 CI/CD 配置成本
- **生产环境**：手动部署的不确定性是最大的风险来源
- **频繁发布（> 1次/周）**：手动部署每次耗时 30 分钟，一年浪费数百小时

### 9.3 选型决策树

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

项目类型决定部署形态（见第四章）
├── 纯前端静态站 → 不要 Docker，OSS/CDN 直传
├── SSR / Node API → Docker 容器化
├── 移动端 → macOS runner + 签名链路
└── 小程序 → miniprogram-ci 上传

基础设施跟着团队规模走（见第五章）
├── 1 台机器够 → Docker-Compose + Nginx
├── 多机但不想学 K8s → Docker Swarm
├── 20+ 人 / 微服务 → Kubernetes
└── 想零运维 → Serverless
```

---

## 十、总结

### 核心原则

- **CI/CD 是必需品，不是奢侈品**——任何有生产环境的项目都需要
- **选型看团队现状**：代码在哪、团队多大、是否需要内网部署
- **构建和部署分离**：CI 产出制品（Docker 镜像），CD 只负责部署
- **密钥不入代码**：所有敏感信息通过平台 Secret 管理
- **生产部署需审批**：手动触发 + 审批流是最后的安全网
- **按场景选方案，不要套模板**：静态站不套 Docker，小团队不套 K8s

### 一句话建议

**先用最简单的方案（GitHub Actions 一个 yml + Vercel）把 CI/CD 跑起来，在痛点出现时再演进——过早引入 Jenkins 和 K8s 是 CI/CD 领域最常见的过度工程。** 平台选型只是起点，真正的提效来自第三章的构建优化（缓存/瘦身/体积分析）和第四、五章的「按场景落地」——把通用的 Node+Docker 模板套到所有项目上，才是 CI/CD 失效的根源。
