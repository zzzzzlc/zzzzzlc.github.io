---
title: Claude Code 项目进阶：从配置到自定义 Agent 的完整工作流
date: '2026-06-14'
tags:
  - AI 工具
  - Claude Code
  - 工程化
category: AI 工具
summary: >-
  从"Claude Code 用到深处才发现需要配置项目上下文、自动化钩子、子 Agent 协作"的实际需求出发，系统梳理 Claude Code
  项目级进阶用法——CLAUDE.md 项目记忆、Hooks 生命周期钩子、Subagent 子代理、MCP 外部工具协议、Plan Mode
  规划模式、Settings 权限配置、多模型路由，以及各方案的优缺点与适用场景。
---

# Claude Code 项目进阶：从配置到自定义 Agent 的完整工作流

## 一、问题来源

当你从"Claude Code 问答助手"过渡到"Claude Code 作为项目开发主力"时，会面临一系列进阶问题：

**配置层面的痛点：**

- 每次开会话都要重新介绍项目的技术栈、代码风格、测试方式——能不能让 Claude 自动记住？
- CLAUDE.md 写了一堆规则但不知道哪些有效、哪些被忽略，也没有分层管理
- 不同项目用不同的模型（个人项目用 Opus，公司项目用 Sonnet 省成本），每次手动切换
- 有些操作（`git push`、删除文件、安装依赖）希望 Claude 默认不执行或要求确认

**自动化层面的痛点：**

- 希望 Claude 每次编辑代码后自动运行 lint/format，而不是靠人提醒
- 希望 Claude 在 commit 前自动跑测试，测试不过就阻止提交
- 希望 Claude 生成的文件自动套用项目模板（header、注释风格）
- 这些"自动化"光靠 CLAUDE.md 描述不够，需要可执行的钩子

**协作层面的痛点：**

- 复杂任务（重构整个模块）需要 Claude 先调研再动手，但 Claude 经常没调研就开始改代码
- 有些子任务（写文档、跑测试、查 issue）希望并行执行，不想串行等待
- 团队有自定义工具（内部 CLI、私有 API）希望 Claude 能调用
- 多个文件之间的关联修改，希望有"计划 → 审批 → 执行"的流程

**核心问题：Claude Code 不是一个"装上就能用"的工具，它是一套可配置的 AI 开发平台。理解 CLAUDE.md、Hooks、Subagent、MCP、Plan Mode 这五大进阶能力，才能让 Claude 真正融入项目工作流。**

---

## 二、CLAUDE.md：项目记忆系统

### 2.1 CLAUDE.md 的加载层级

CLAUDE.md 是 Claude Code 的"项目记忆"——它会在每次会话开始时自动加载到上下文。文件按层级加载：

```
CLAUDE.md 加载顺序（从全局到本地）：

1. ~/.claude/CLAUDE.md              ← 用户全局配置（所有项目共享）
   └─ 适用于：个人编码偏好、通用工具配置

2. <project-root>/CLAUDE.md         ← 项目根目录（团队共享）
   └─ 适用于：项目技术栈、代码规范、测试方式
   └─ 应该提交到 Git，团队成员共享

3. <project-root>/CLAUDE.local.md   ← 项目本地配置（个人私有）
   └─ 适用于：个人临时调试笔记、私有 API Key
   └─ 应该加入 .gitignore

4. <sub-directory>/CLAUDE.md        ← 子目录配置（上下文感知）
   └─ 进入该目录工作时才加载
   └─ 适用于：特定模块的特殊规范
```

### 2.2 CLAUDE.md 最佳实践

```markdown
# 项目：电商平台后台

## 技术栈
- 前端：React 19 + TypeScript + Ant Design 6 + Vite 7
- 后端：Node.js 20 + Express + Prisma + PostgreSQL
- 测试：Vitest + Testing Library
- 部署：Docker + Kubernetes

## 代码规范
- 使用函数式组件，禁止 class 组件
- 命名：组件 PascalCase，函数/变量 camelCase，常量 UPPER_SNAKE
- TypeScript strict 模式，禁止 any
- 提交前必须通过 `pnpm lint && pnpm test`

## 项目结构约定
- `app/pages/` — 页面组件
- `app/services/` — API 调用层
- `component/` — 共享组件
- `utils/` — 工具函数

## 重要约定
- 修改 API 接口后必须同步更新 `types/api.d.ts`
- 数据库 schema 变更必须创建 migration 文件
- 新增依赖必须说明理由

## 不要做的事情
- 不要引入新的 UI 库（统一用 Ant Design）
- 不要用 Redux（项目用 Zustand）
- 不要创建 .env 文件（配置走环境变量）
```

### 2.3 CLAUDE.md 的"红线"与"陷阱"

| 做 | 不做 |
|----|------|
| 写"做什么"而非"怎么做"（Claude 会自己想怎么做） | 写大段教程式文字（浪费 context） |
| 用祈使句（"使用函数式组件"） | 写解释性长文（Claude 不需要原理讲解） |
| 标注优先级（"必须"/"禁止"/"优先"） | 罗列所有规则（Claude 会忽略低优先级的） |
| 包含可执行的命令（`pnpm lint`） | 写抽象原则（"写高质量代码"） |
| 与项目实际状态一致 | 写过时的规范（代码已经改了但 CLAUDE.md 没更新） |

### 2.4 记忆系统（auto memory）

除了 CLAUDE.md，Claude Code 还支持基于文件的记忆系统（`.claude/projects/<project>/memory/`）：

```markdown
# MEMORY.md（记忆索引）
- [user_role.md](user_role.md) — 用户是全栈工程师，5 年 React 经验
- [feedback_testing.md](feedback_testing.md) — 测试必须跑真实数据库，不用 mock
- [project_deadline.md](project_deadline.md) — 6 月 20 日上线，禁止引入新依赖

# user_role.md（单条记忆）
---
name: 用户角色
description: 用户的技术背景和偏好
type: user
---
用户是全栈工程师，5 年 React 经验，熟悉 TypeScript 但对 Rust 新手。
**How to apply：** 解释 TS 代码可以简略，Rust 相关需要详细解释。
```

**四种记忆类型：**

| 类型 | 用途 | 示例 |
|------|------|------|
| `user` | 用户角色/技能/偏好 | "用户是后端工程师，前端解释需详细" |
| `feedback` | 用户反馈的规则 | "不要自动 git push" |
| `project` | 项目状态/决策 | "6 月 20 日上线，进入冻结期" |
| `reference` | 外部资源指向 | "Bug 在 Linear 项目 TRACK 中追踪" |

---

## 三、Hooks：生命周期钩子

### 3.1 Hooks 是什么

Hooks 是在 Claude Code 特定事件发生时自动执行的 Shell 命令——类似于 Git Hooks，但作用于 Claude 的工作流：

```
Claude Code 工作流中的 Hook 触发点：

  用户提交 Prompt
       │
       ▼
  ┌─────────────────────┐
  │ UserPromptSubmit    │ ← 可拦截/修改用户输入
  └──────────┬──────────┘
             ▼
  Claude 决定调用工具
       │
       ▼
  ┌─────────────────────┐
  │ PreToolUse          │ ← 工具执行前（可阻止）
  └──────────┬──────────┘
             ▼
  工具执行
       │
       ▼
  ┌─────────────────────┐
  │ PostToolUse         │ ← 工具执行后（可做后处理）
  └──────────┬──────────┘
             ▼
  Claude 生成响应
       │
       ▼
  ┌─────────────────────┐
  │ Stop / SubagentStop │ ← 会话结束/子代理结束时触发
  └─────────────────────┘
```

### 3.2 在 settings.json 中配置 Hooks

```json
// .claude/settings.json
{
    "hooks": {
        "PostToolUse": [
            {
                "matcher": "Edit|Write",
                "hooks": [
                    {
                        "type": "command",
                        "command": "pnpm eslint --fix \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
                    }
                ]
            }
        ],
        "PreToolUse": [
            {
                "matcher": "Bash",
                "hooks": [
                    {
                        "type": "command",
                        "command": "echo '即将执行命令，请确认权限' "
                    }
                ]
            }
        ],
        "UserPromptSubmit": [
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": "cat .claude/context.txt"
                    }
                ]
            }
        ]
    }
}
```

### 3.3 实战 Hook 场景

| 场景 | Hook 事件 | 命令示例 |
|------|----------|---------|
| 编辑后自动格式化 | PostToolUse (Edit/Write) | `prettier --write "$CLAUDE_FILE_PATH"` |
| 提交前自动测试 | PreToolUse (Bash: git commit) | `pnpm test || exit 1`（阻止提交） |
| 拦截危险命令 | PreToolUse (Bash) | 检测 `rm -rf` / `git push --force` 并阻止 |
| 自动加载上下文 | UserPromptSubmit | 注入当前 Git 分支、最近 commit |
| 会话结束通知 | Stop | 播放声音 / 发送桌面通知 |
| 文件变更日志 | PostToolUse (Write/Edit) | 记录到 `.claude/edit-log.txt` |

### 3.4 Hook 的输入输出

Hook 命令通过环境变量和 stdin 接收上下文：

```bash
#!/bin/bash
# .claude/hooks/pre-commit-check.sh

# 从环境变量获取信息
TOOL_NAME="$CLAUDE_TOOL_NAME"
FILE_PATH="$CLAUDE_FILE_PATH"

# 从 stdin 获取 JSON 上下文
CONTEXT=$(cat)

# 阻止工具执行：以非零退出码退出
if [[ "$TOOL_NAME" == "Bash" ]]; then
    CMD=$(echo "$CONTEXT" | jq -r '.tool_input.command')
    if echo "$CMD" | grep -qE "rm -rf|git push --force"; then
        echo "检测到危险命令：$CMD" >&2
        exit 1  # 阻止执行
    fi
fi

exit 0  # 允许执行
```

### 3.5 settings.json 层级

```
settings.json 加载优先级（后者覆盖前者）：

1. ~/.claude/settings.json              ← 用户全局
2. <project>/.claude/settings.json      ← 项目共享（提交 Git）
3. <project>/.claude/settings.local.json ← 项目本地（不提交）
```

```json
// 项目级 settings.json 示例
{
    "permissions": {
        "allow": [
            "Bash(pnpm test)",
            "Bash(pnpm lint)",
            "Bash(pnpm build)",
            "Read(./**)",
            "Edit(./src/**)"
        ],
        "deny": [
            "Bash(rm -rf *)",
            "Bash(git push --force *)",
            "Read(./.env*)",
            "Read(./secrets/**)"
        ],
        "ask": [
            "Bash(git push *)",
            "Bash(npm publish *)"
        ]
    },
    "model": "claude-sonnet-4-6",
    "env": {
        "NODE_ENV": "development"
    }
}
```

---

## 四、Subagent：子代理协作

### 4.1 为什么需要 Subagent

主会话的 Claude 在处理复杂任务时会遇到瓶颈：

```
主会话的问题：

  Context Window 限制
    └─ 一次会话最多 ~200K Token
    └─ 调研 10 个文件 + 修改 5 个文件 → context 爆满

  串行执行效率低
    └─ 跑测试 30s + 写文档 20s = 串行 50s
    └─ 并行只需 30s

  角色混淆
    └─ 同一个 Claude 既做架构设计又做代码审查，质量都不高
    └─ 需要"专家分工"
```

Subagent（子代理）允许主 Claude 启动独立的 Claude 实例处理子任务，每个子代理有自己的 context window。

### 4.2 内置 Subagent 类型

| 类型 | 职责 | 典型场景 |
|------|------|---------|
| `general-purpose` | 通用代理 | 搜索代码、研究问题、多步骤任务 |
| `Explore` | 代码探索专家 | 快速查找文件、理解架构、回答代码问题 |
| `Plan` | 架构设计 | 设计实现方案、评估技术选型 |
| 自定义 Agent | 项目专用 | 详见 4.4 |

### 4.3 使用 Subagent

```
主 Claude 启动 Subagent 的场景：

场景一：需要广泛搜索代码库
  → 主 Claude 调用 Explore Agent
  → Agent 在独立 context 中搜索 20+ 文件
  → 返回精简结果给主 Claude（不污染主 context）

场景二：并行处理独立任务
  → 主 Claude 同时启动 3 个 Agent：
     - Agent 1：跑测试
     - Agent 2：写文档
     - Agent 3：查 GitHub Issue
  → 三个任务并行完成

场景三：保护主 context
  → 主 Claude 启动 Agent 读取超大日志文件
  → Agent 提取关键信息返回
  → 主 Claude 的 context 不被日志撑爆
```

### 4.4 创建自定义 Subagent

在 `.claude/agents/` 目录下创建 Markdown 文件定义自定义 Agent：

```markdown
<!-- .claude/agents/test-writer.md -->
---
name: test-writer
description: 专门编写单元测试的子代理。当需要为现有函数/组件编写测试时使用。
model: sonnet
tools:
    - Read
    - Write
    - Grep
    - Glob
---

你是一个单元测试专家。你的任务是：

1. 阅读目标函数/组件的源码
2. 理解其输入输出和边界条件
3. 使用 Vitest + Testing Library 编写测试
4. 覆盖以下场景：
   - 正常路径（happy path）
   - 边界条件（空值、极值）
   - 异常情况（错误输入）
   - 异步行为（Promise、定时器）

测试文件放在 `__tests__/` 目录下，文件名 `<source-name>.test.ts`。

不要修改源码，只写测试。
```

使用时主 Claude 会根据 `description` 自动判断是否调用该 Agent，也可以手动指定。

### 4.5 Subagent 上下文隔离

```
主 Context（200K Token）
    │
    ├── 启动 Explore Agent
    │       └─ 独立 Context（200K Token）
    │       └─ 读取 15 个文件，搜索 30 次
    │       └─ 返回 2K Token 的总结给主 Context
    │
    ├── 启动 test-writer Agent
    │       └─ 独立 Context（200K Token）
    │       └─ 读取源码 + 写测试文件
    │       └─ 返回"已完成，3 个测试文件已创建"
    │
    └── 主 Context 只消耗 ~5K Token
```

---

## 五、MCP：模型上下文协议

### 5.1 MCP 是什么

MCP（Model Context Protocol）是 Anthropic 开放的协议，让 Claude 能连接外部工具和数据源——相当于给 Claude 装"插件"：

```
MCP 架构：

  Claude Code
      │
      ├── MCP Server: GitHub
      │     └─ 工具：创建 Issue / PR、查代码、读 CI 状态
      │
      ├── MCP Server: Linear
      │     └─ 工具：查任务、更新状态、关联 PR
      │
      ├── MCP Server: Slack
      │     └─ 工具：发消息、读频道历史
      │
      ├── MCP Server: PostgreSQL
      │     └─ 工具：查数据、执行 SQL（只读）
      │
      └── MCP Server: 自定义内部工具
            └─ 工具：调用内部 API、查内部文档
```

### 5.2 配置 MCP Server

```json
// .claude/settings.json
{
    "mcpServers": {
        "github": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": {
                "GITHUB_TOKEN": "ghp_xxx"
            }
        },
        "linear": {
            "command": "npx",
            "args": ["-y", "@linear/mcp-server"],
            "env": {
                "LINEAR_API_KEY": "lin_api_xxx"
            }
        },
        "filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/docs"]
        }
    }
}
```

### 5.3 常用 MCP Server

| MCP Server | 功能 | 安装 |
|-----------|------|------|
| `server-github` | GitHub 操作（Issue/PR/Code） | `npx @modelcontextprotocol/server-github` |
| `server-filesystem` | 文件系统访问 | `npx @modelcontextprotocol/server-filesystem` |
| `server-postgres` | PostgreSQL 查询 | `npx @modelcontextprotocol/server-postgres` |
| `server-slack` | Slack 消息 | `npx @modelcontextprotocol/server-slack` |
| `server-puppeteer` | 浏览器自动化 | `npx @modelcontextprotocol/server-puppeteer` |
| `server-memory` | 持久化知识图谱 | `npx @modelcontextprotocol/server-memory` |
| `codegraph` | 代码知识图谱（AST 索引） | 自定义 |

### 5.4 开发自定义 MCP Server

```typescript
// my-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new Server(
    { name: 'my-tools', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

// 注册工具
server.setRequestHandler('tools/list', () => ({
    tools: [
        {
            name: 'get_weather',
            description: '获取指定城市的天气',
            inputSchema: {
                type: 'object',
                properties: {
                    city: { type: 'string', description: '城市名' }
                },
                required: ['city']
            }
        }
    ]
}));

// 处理工具调用
server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'get_weather') {
        const weather = await fetchWeather(args.city);
        return { content: [{ type: 'text', text: JSON.stringify(weather) }] };
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 5.5 MCP vs Subagent vs Hook 对比

| 维度 | Hooks | Subagent | MCP |
|------|-------|----------|-----|
| **本质** | Shell 命令 | 独立 Claude 实例 | 外部工具协议 |
| **执行时机** | 事件触发 | 主 Claude 调用 | Claude 主动调用 |
| **能力** | 执行 Shell | AI 推理 + 工具 | 提供新工具给 Claude |
| **Context 隔离** | 无 | 有 | 无 |
| **典型场景** | 自动化格式化/测试 | 并行任务/保护 context | 连接 GitHub/数据库 |
| **开发成本** | 低（写脚本） | 中（写 prompt） | 高（写 Server） |

---

## 六、Plan Mode：规划模式

### 6.1 为什么需要 Plan Mode

```
普通模式的问题：

  用户："重构整个认证模块"
       │
       ▼
  Claude 立即开始改代码 ← 问题：没有调研就开始改，容易改错方向
       │
       ▼
  改了 10 个文件后发现架构理解错了 ← 返工成本巨大
```

Plan Mode 强制 Claude 先"调研 + 规划"，产出可审批的计划，用户确认后才执行：

```
Plan Mode 工作流：

  用户："重构认证模块"
       │
       ▼
  ┌─────────────────────────────────────┐
  │ Plan Mode 启动                       │
  │  1. Claude 调研代码（只读操作）        │
  │  2. 理解现有架构                       │
  │  3. 设计重构方案                       │
  │  4. 输出计划文档                       │
  └──────────────┬──────────────────────┘
                 ▼
  ┌─────────────────────────────────────┐
  │ 用户审批计划                          │
  │  - 查看：影响范围、实施步骤、风险       │
  │  - 确认：批准 / 修改 / 拒绝            │
  └──────────────┬──────────────────────┘
                 ▼
  ┌─────────────────────────────────────┐
  │ 执行阶段（退出 Plan Mode）             │
  │  按计划逐步实施                        │
  └─────────────────────────────────────┘
```

### 6.2 触发 Plan Mode

```
方式一：显式触发
  用户输入："先做计划再动手" / "进入计划模式"
  → Claude 自动进入 Plan Mode

方式二：自动触发
  当任务满足以下条件时，Claude 会建议进入 Plan Mode：
  - 新功能实现（涉及多个文件）
  - 架构重构
  - 多种实现方案需要选择
  - 不明确的需求需要先调研

方式三：API 配置
  在 settings.json 或 CLAUDE.md 中配置"复杂任务必须先 Plan"
```

### 6.3 Plan 文件结构

```markdown
# 重构认证模块 — 实施计划

## Context
当前认证模块使用 JWT + localStorage，存在以下问题：
- Token 刷新逻辑散落在 3 个组件中
- 没有处理 Token 过期的竞态条件
- 缺少多标签页同步

## 影响范围
- `src/auth/` — 核心认证逻辑（3 个文件）
- `src/components/Header.tsx` — 登录状态显示
- `src/pages/Login.tsx` — 登录页面
- `src/api/client.ts` — API 请求拦截器

## 实施步骤

### Step 1：抽取 Token 管理器
- 新建 `src/auth/tokenManager.ts`
- 统一管理 access/refresh token 的存取和刷新
- 复用：现有 `getAccessToken()` 函数

### Step 2：实现请求拦截器
- 修改 `src/api/client.ts`
- 401 错误时自动刷新 token 并重试
- 并发请求合并（避免多次刷新）

### Step 3：多标签页同步
- 使用 BroadcastChannel API
- 一个标签页刷新 token 后通知其他标签页

## 风险
- Token 刷新的竞态条件需要充分测试
- BroadcastChannel 在 IE 不支持（项目不需要兼容 IE）

## 验证方式
- 运行 `pnpm test` 确保现有测试通过
- 手动测试：登录 → 等 token 过期 → 自动刷新 → 继续操作
```

### 6.4 Plan Mode 的约束

```
Plan Mode 中 Claude 只能做：
  ✓ Read（读文件）
  ✓ Glob（搜索文件）
  ✓ Grep（搜索内容）
  ✓ WebSearch / WebFetch（网络搜索）
  ✓ Agent（启动子代理调研）

Plan Mode 中 Claude 不能做：
  ✗ Edit（编辑文件）
  ✗ Write（写文件）
  ✗ Bash（执行命令，除了只读的）
  ✗ NotebookEdit
```

---

## 七、多模型路由与成本控制

### 7.1 按场景选择模型

| 任务类型 | 推荐模型 | 理由 |
|---------|---------|------|
| 架构设计/复杂重构 | Opus 4.6 | 推理能力最强 |
| 日常编码/bug 修复 | Sonnet 4.6 | 性价比最高 |
| 简单任务/格式化 | Haiku 4.5 | 最快最便宜 |
| 代码探索/搜索 | Sonnet 4.6 | 够用且快 |
| 文档生成 | Sonnet 4.6 | 文本生成质量足够 |

### 7.2 配置模型

```json
// settings.json
{
    "model": "claude-sonnet-4-6",
    "subagentModel": "claude-haiku-4-5"
}
```

```markdown
# CLAUDE.md 中按场景指定
- 复杂架构设计任务：使用 Opus
- 测试编写：使用 Sonnet（够用）
- 文档任务：可以用 Haiku 节省成本
```

### 7.3 成本优化策略

```
成本优化技巧：

1. 用 Subagent 隔离大 context
   └─ 调研任务用 Agent，返回精简结果
   └─ 主 context 保持精简

2. 用 CLAUDE.md 减少重复解释
   └─ 项目信息写一次，不用每次重新介绍

3. 简单任务用 Haiku
   └─ 格式化、重命名、简单搜索
   └─ Haiku 成本是 Opus 的 1/60

4. 善用 Plan Mode 避免返工
   └─ 先规划再执行，避免改错返工
   └─ 返工的成本远高于规划的成本

5. MCP 替代手动操作
   └─ GitHub 操作用 MCP 而非手动 Bash
   └─ 减少来回对话的 token 消耗
```

---

## 八、完整项目配置示例

### 8.1 目录结构

```
my-project/
├── .claude/
│   ├── settings.json              ← 项目配置（提交 Git）
│   ├── settings.local.json        ← 本地配置（不提交）
│   ├── agents/                    ← 自定义子代理
│   │   ├── test-writer.md
│   │   └── doc-generator.md
│   ├── hooks/                     ← Hook 脚本
│   │   ├── pre-commit-check.sh
│   │   └── auto-format.sh
│   ├── commands/                  ← 自定义 Skill（斜杠命令）
│   │   ├── deploy.md
│   │   └── review-pr.md
│   └── projects/
│       └── <project-hash>/
│           ├── memory/            ← 自动记忆
│           │   ├── MEMORY.md
│           │   └── *.md
│           └── plans/             ← 计划文件
├── CLAUDE.md                      ← 项目记忆（提交 Git）
├── CLAUDE.local.md                ← 本地记忆（不提交）
└── ...
```

### 8.2 完整 settings.json

```json
{
    "model": "claude-sonnet-4-6",
    "permissions": {
        "allow": [
            "Bash(pnpm *)",
            "Bash(git status)",
            "Bash(git diff *)",
            "Bash(git log *)",
            "Read(./**)",
            "Edit(./src/**)",
            "Edit(./tests/**)"
        ],
        "deny": [
            "Bash(rm -rf *)",
            "Bash(git push --force *)",
            "Read(./.env*)",
            "Read(./secrets/**)",
            "Edit(./package.json)"
        ],
        "ask": [
            "Bash(git push *)",
            "Bash(git commit *)",
            "Bash(docker *)"
        ]
    },
    "hooks": {
        "PostToolUse": [
            {
                "matcher": "Edit|Write",
                "hooks": [{
                    "type": "command",
                    "command": "pnpm prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
                }]
            }
        ],
        "PreToolUse": [
            {
                "matcher": "Bash",
                "hooks": [{
                    "type": "command",
                    "command": ".claude/hooks/pre-commit-check.sh"
                }]
            }
        ]
    },
    "mcpServers": {
        "github": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
        }
    }
}
```

---

## 九、优缺点与适用场景总结

| 能力 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **CLAUDE.md** | 零配置、自动加载、团队共享 | 占用 context、写多了被忽略 | 所有项目（基础必备） |
| **Hooks** | 自动化、可拦截危险操作 | 需要写 Shell 脚本、调试困难 | 需要自动化格式化/测试/拦截的项目 |
| **Subagent** | 隔离 context、并行执行 | 增加复杂度、需要设计 Agent | 大型项目、复杂调研任务 |
| **MCP** | 扩展能力无限、连接外部系统 | 开发成本高、需要维护 Server | 需要连接 GitHub/数据库/内部工具 |
| **Plan Mode** | 避免返工、复杂任务必备 | 增加一轮交互、简单任务过度设计 | 重构/新功能/架构设计 |
| **自定义 Agent** | 专家分工、复用 prompt | 需要写和维护 Agent 定义 | 团队有固定工作流（测试/文档/审查） |
| **Settings 权限** | 安全可控、防止误操作 | 配置繁琐 | 生产环境/敏感项目 |

---

## 十、局限性

1. **CLAUDE.md 的上限**：超过 200 行后 Claude 开始忽略部分规则，需要精简到核心约定
2. **Hooks 的调试困难**：Hook 执行失败时错误信息不直观，需要手动测试脚本
3. **Subagent 的延迟**：启动子代理有 1-3 秒开销，简单任务用 Subagent 反而更慢
4. **MCP 的稳定性**：第三方 MCP Server 质量参差不齐，连接中断时 Claude 会报错
5. **Plan Mode 不适合所有任务**：简单 bug 修复用 Plan Mode 是浪费时间
6. **配置膨胀**：项目做大后 `.claude/` 配置越来越复杂，本身成为维护负担
7. **团队一致性**：每个人本地配置（settings.local.json）不同，行为可能不一致
8. **模型版本耦合**：配置中硬编码模型名（`claude-sonnet-4-6`），模型升级后需要批量更新

---

## 十一、总结

Claude Code 项目进阶的核心是**分层配置 + 自动化 + 专家分工**：

- **CLAUDE.md 是基础**：写好项目记忆，让 Claude 自动理解项目约定（所有项目必备）
- **Hooks 是自动化**：把重复操作（格式化/测试/拦截）变成自动钩子（中大型项目）
- **Subagent 是分工**：用子代理隔离 context、并行任务、专家分工（复杂项目）
- **MCP 是扩展**：连接 GitHub/数据库/内部工具，突破 Claude 的能力边界（需要外部集成的项目）
- **Plan Mode 是保险**：复杂任务先规划后执行，避免返工（重构/新功能必备）
- **Settings 是安全网**：权限配置防止误操作，特别是生产环境

**落地顺序：先 CLAUDE.md（基础）→ 再 Hooks（自动化）→ 再 Settings 权限（安全）→ 按需引入 Subagent/MCP/Plan Mode（进阶）。不要一步到位配置所有功能，按实际痛点逐步引入。**
