---
title: Claude Code Skill 开发：从零构建自定义斜杠命令
date: '2026-04-27'
tags:
  - AI 工具
  - 工程化
category: AI 工具
summary: >-
  从 Claude Code 内置命令的局限性出发，系统讲解 Skill 的开发方法——文件结构、SKILL.md
  完整字段、参数替换与动态上下文注入、自动触发与手动调用的控制、隔离执行与工具权限，以及多个实战 Skill 示例。覆盖个人级、项目级、插件级三种分发方式。
---

# Claude Code Skill 开发：从零构建自定义斜杠命令

## 一、问题来源

使用 Claude Code 进行日常开发时，有一些重复性操作让人头疼：

**重复操作的痛点：**

- 每次提交代码都要手动写 commit message，希望一键生成规范的提交信息
- 每次做 Code Review 都要重复一大段"请检查安全性、性能、命名规范……"的 prompt
- 团队有固定的发布流程（跑测试 → 更新版本号 → 生成 changelog → 推送），每次都要手动告诉 Claude 走这个流程
- 项目有特定的错误排查套路（查日志 → 查最近的变更 → 检查配置），每次都要从头描述

**CLAUDE.md 的局限：**

- `CLAUDE.md` 的内容始终在上下文中，塞太多指令会占用 context window
- 有些指令只在特定场景才需要（比如发布流程），没必要一直占着上下文
- 不同场景需要不同的工具权限和模型配置，`CLAUDE.md` 无法按场景切换

**核心问题：Skill（自定义斜杠命令）解决了"按需加载"的问题——只在调用时才注入指令，不用时零开销。同时提供参数化、工具预授权、隔离执行等能力，是将团队经验固化为可复用工具的最佳方式。**

---

## 二、Skill 是什么

### 2.1 核心概念

```
Skill = 一个目录 + 一份 SKILL.md 文件

┌──────────────────────────────────────────┐
│              SKILL.md                     │
│                                          │
│  ┌────────────────────────────────┐      │
│  │  YAML Frontmatter（元数据）     │      │
│  │  - 命令名 / 描述 / 参数        │      │
│  │  - 工具权限 / 模型 / 隔离配置   │      │
│  └────────────────────────────────┘      │
│                                          │
│  ┌────────────────────────────────┐      │
│  │  Markdown Body（指令内容）      │      │
│  │  - 给 Claude 的具体执行指令     │      │
│  │  - 支持变量替换和动态上下文     │      │
│  └────────────────────────────────┘      │
│                                          │
└──────────────────────────────────────────┘
```

**Skill 与 CLAUDE.md 的关系：**

| 维度 | CLAUDE.md | Skill |
|------|-----------|-------|
| 加载时机 | 始终在上下文中 | 调用时才加载 |
| 上下文成本 | 持续占用 | 按需使用，零额外开销 |
| 参数化 | 不支持 | 支持 `$ARGUMENTS` 替换 |
| 工具权限 | 全局配置 | 可按 Skill 单独配置 |
| 触发方式 | 自动 | 手动 `/skill-name` 或自动匹配 |
| 适用场景 | 通用规则、项目约定 | 特定流程、特定场景的指令 |

### 2.2 Skill 的四种作用域

```
作用域        路径                                    适用范围
─────────    ──────────────────────────────────      ──────────
企业级        管理后台统一部署                          全组织所有用户
个人级        ~/.claude/skills/<name>/SKILL.md         你自己的所有项目
项目级        .claude/skills/<name>/SKILL.md           当前项目（可提交到 Git）
插件级        <plugin-root>/skills/<name>/SKILL.md     安装了插件的项目

优先级：企业级 > 个人级 > 项目级
插件级使用 plugin-name:skill-name 命名空间，不会冲突
```

---

## 三、文件结构与字段详解

### 3.1 目录结构

```
my-skill/                    # Skill 目录（名称即默认命令名）
├── SKILL.md                 # 主文件（必须）
├── template.md              # 可选：模板文件，Claude 填充后输出
├── examples/
│   └── sample.md            # 可选：示例输出，给 Claude 参考
└── scripts/
    └── validate.sh          # 可选：脚本文件，Claude 可以执行
```

### 3.2 SKILL.md 完整格式

```yaml
---
# ==================== 基础信息 ====================
name: my-skill                          # 命令名，即 /my-skill
                                        # 省略则使用目录名
                                        # 规则：小写字母 + 数字 + 连字符，≤ 64 字符

description: 这个 Skill 做什么            # 描述，Claude 用它判断何时自动触发
                                        # 写清楚触发场景很重要

when_to_use: |                          # 补充触发上下文（附加到 description）
  当用户要求做 XX 的时候使用此 Skill。
  description + when_to_use 总字符上限 1536。

# ==================== 参数 ====================
argument-hint: "[issue-number]"         # 自动补全提示
arguments: issue branch                 # 命名参数，按空格分隔
                                        # 可在 Body 中用 $issue、$branch 引用

# ==================== 调用控制 ====================
disable-model-invocation: true          # true = 只有用户能调用，Claude 不能自动触发
                                        # false（默认）= Claude 可以自动触发
user-invocable: false                   # false = 对用户隐藏，只有 Claude 能调用
                                        # true（默认）= 用户可以在 / 菜单中看到

# ==================== 执行配置 ====================
context: fork                           # fork = 在隔离的子代理中执行
                                        # 不设置 = 在主会话中执行

agent: Explore                          # 子代理类型（需 context: fork）
                                        # 可选：Explore、Plan、general-purpose

model: sonnet                           # 执行时覆盖模型
                                        # 可选：sonnet、opus、haiku

effort: high                            # 执行时覆盖 effort 级别
                                        # 可选：low、medium、high、xhigh、max

# ==================== 工具权限 ====================
allowed-tools: |                        # 预授权的工具列表（不需要用户逐个确认）
  Read
  Grep
  Bash(git *)
  Bash(npm test)
  WebSearch

# ==================== 其他 ====================
paths: "src/**/*.ts"                    # Glob 模式，限制自动触发范围
                                        # 只在匹配的文件相关对话中触发
shell: bash                             # !`command` 使用的 shell
                                        # bash（默认）或 powershell

hooks: {}                               # Skill 生命周期钩子
---

# 以下是 Markdown Body —— 给 Claude 的具体指令

你的指令写在这里。支持以下变量替换：

- $ARGUMENTS    → 所有参数
- $0, $1, $2    → 按位置索引的参数
- $issue        → 命名参数（对应 arguments 中的 issue）
- $branch       → 命名参数（对应 arguments 中的 branch）

动态上下文注入（执行 shell 命令并将结果嵌入 prompt）：

当前分支：!`git branch --show-current`
最近的提交：!`git log --oneline -5`
```

### 3.3 字段速查表

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | 否 | 目录名 | 斜杠命令名称 |
| `description` | 推荐 | 无 | 功能描述，决定自动触发匹配 |
| `when_to_use` | 否 | 无 | 补充触发条件 |
| `arguments` | 否 | 无 | 命名参数列表 |
| `argument-hint` | 否 | 无 | 自动补全提示文本 |
| `disable-model-invocation` | 否 | `false` | 禁止 Claude 自动调用 |
| `user-invocable` | 否 | `true` | 是否对用户可见 |
| `allowed-tools` | 否 | 无 | 预授权工具列表 |
| `context` | 否 | 主会话 | `fork` 隔离执行 |
| `agent` | 否 | 无 | 子代理类型（需 `context: fork`） |
| `model` | 否 | 当前模型 | 临时覆盖模型 |
| `effort` | 否 | 当前级别 | 临时覆盖 effort |
| `paths` | 否 | 无 | 限制自动触发的文件范围 |
| `shell` | 否 | `bash` | Shell 类型 |
| `hooks` | 否 | 无 | 生命周期钩子 |

### 3.4 调用控制矩阵

```
                    用户可以调用      Claude 可以自动调用
                    ──────────      ────────────────
默认配置              ✅               ✅
disable-model: true  ✅               ❌
user-invocable: false ❌               ✅
两者都设              ❌               ❌（毫无意义，不要这样设）
```

---

## 四、参数替换与动态上下文

### 4.1 参数传递

```yaml
---
name: review-pr
arguments: pr-number focus-area
argument-hint: "<pr-number> [focus-area]"
---

请审查 PR #$pr-number。
重点关注 $focus-area 方面。
```

```
调用：/review-pr 42 security

Claude 收到的指令：
  请审查 PR #42。
  重点关注 security 方面。
```

**参数变量对照：**

| 变量 | 示例调用 `/review-pr 42 security` | 值 |
|------|------|----|
| `$ARGUMENTS` | 全部参数 | `42 security` |
| `$0` | 第一个参数 | `42` |
| `$1` | 第二个参数 | `security` |
| `$pr-number` | 命名参数 | `42` |
| `$focus-area` | 命名参数 | `security` |

### 4.2 动态上下文注入

使用 `` !`command` `` 语法在 Skill 加载时执行 shell 命令，将结果嵌入 prompt：

```yaml
---
name: pr-summary
description: 生成当前 PR 的摘要
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

请分析当前 PR 并生成摘要。

## PR 上下文信息

PR diff:
```!`gh pr diff`
```

变更文件列表:
```!`gh pr diff --name-only`
```

最近 5 次提交:
```!`git log --oneline -5`
```

请从以下角度分析：
1. 变更概要（做了什么）
2. 影响范围（改了哪些模块）
3. 潜在风险（可能引入的问题）
4. 测试建议（需要关注哪些测试）
```

**动态注入的工作原理：**

```
用户输入 /pr-summary
        │
        ▼
Claude Code 执行 shell 命令
├── gh pr diff → 获取 diff 内容
├── gh pr diff --name-only → 获取文件列表
└── git log --oneline -5 → 获取提交历史
        │
        ▼
将命令输出替换到 prompt 中
        │
        ▼
完整的 prompt 发送给 Claude 执行
```

---

## 五、实战示例

### 5.1 智能提交（smart-commit）

**场景：** 一键生成规范的 commit message 并提交。

```yaml
---
# 文件：.claude/skills/smart-commit/SKILL.md
name: smart-commit
description: 分析暂存区变更，生成规范的 commit message 并提交
disable-model-invocation: true
allowed-tools: |
  Bash(git status)
  Bash(git diff --staged)
  Bash(git log*)
  Bash(git add *)
  Bash(git commit *)
---

你是一个提交信息生成助手。请根据暂存区的变更，生成规范的 commit message。

## 当前上下文

暂存区状态：!`git diff --staged --stat`

最近 5 次提交（参考风格）：
!`git log --oneline -5`

## 要求

1. 先分析 `git diff --staged` 的内容
2. commit message 格式：
   - 第一行：简洁描述做了什么（不超过 50 字符）
   - 空一行
   - 详细说明为什么这样改（可选）
3. 不要使用 emoji
4. 参考最近提交的风格保持一致
5. 生成后直接执行 `git commit`，不需要确认

## 注意
- 只提交已暂存的变更，不要 `git add`
- 如果暂存区为空，提示用户先 `git add`
```

### 5.2 代码审查（review）

**场景：** 对指定文件或最近变更做系统化 Code Review。

```yaml
---
# 文件：.claude/skills/review/SKILL.md
name: review
description: 系统化 Code Review
arguments: target
argument-hint: "[file-path or 'staged' or 'last-commit']"
allowed-tools: |
  Read
  Grep
  Bash(git diff*)
  Bash(git log*)
  Bash(git show*)
---

请对 $ARGUMENTS 进行系统化 Code Review。

## 审查维度

### 1. 正确性
- 逻辑是否正确？边界条件是否处理？
- 是否有 off-by-one 错误、空指针、未处理的异常？

### 2. 安全性
- 是否有 SQL 注入、XSS、命令注入风险？
- 用户输入是否做了校验和转义？
- 敏感信息（密钥、密码）是否硬编码？

### 3. 性能
- 是否有 N+1 查询？
- 循环中是否有不必要的数据库调用？
- 大数据量下是否会出问题？

### 4. 可维护性
- 命名是否清晰？代码是否自解释？
- 函数是否过长（> 30 行）？是否需要拆分？
- 是否有重复代码？

### 5. 设计
- 是否符合项目的分层架构？
- 是否违反 SOLID 原则？
- 错误处理是否合理？

## 输出格式

按严重程度分级：

🔴 **必须修改**（会导致 bug 或安全问题）
🟡 **建议修改**（可维护性或性能问题）
🟢 **可选优化**（代码风格或微小的改进）

每个问题给出：
- 文件名和行号
- 问题描述
- 修改建议（附代码示例）
```

### 5.3 发布流程（release）

**场景：** 固化团队的标准发布流程，一键执行。

```yaml
---
# 文件：.claude/skills/release/SKILL.md
name: release
description: 执行标准发布流程
arguments: version
argument-hint: "<version-type: patch|minor|major>"
disable-model-invocation: true
allowed-tools: |
  Bash(npm version *)
  Bash(npm run test*)
  Bash(npm run build*)
  Bash(npm run lint*)
  Bash(git push*)
  Bash(git tag *)
  Read
  Grep
---

执行标准发布流程，版本类型：$ARGUMENTS

## 发布步骤（严格按顺序执行）

### 第一步：预检
1. 确认工作区干净（`git status` 无未提交变更）
2. 确认在 main 分支上
3. 如果不满足，停止并提示用户处理

### 第二步：运行测试
1. 执行 `npm run test`
2. 如果测试失败，停止并报告失败原因
3. 不要跳过测试继续发布

### 第三步：代码检查
1. 执行 `npm run lint`
2. 如果有错误，停止

### 第四步：更新版本号
1. 执行 `npm version $ARGUMENTS`（$ARGUMENTS 为 patch/minor/major）
2. 这会自动创建一个 commit 和 tag

### 第五步：推送到远程
1. 推送代码：`git push origin main`
2. 推送 tag：`git push origin --tags`

### 第六步：构建验证
1. 执行 `npm run build`
2. 确认构建成功无错误

### 第七步：输出结果
报告发布结果：
- 新版本号
- Git tag
- 推送状态
```

### 5.4 排错助手（debug）

**场景：** 遇到 bug 时按固定套路排查。

```yaml
---
# 文件：.claude/skills/debug/SKILL.md
name: debug
description: 系统化排查 bug
arguments: error-description
argument-hint: "<错误描述>"
allowed-tools: |
  Read
  Grep
  Glob
  Bash(git log*)
  Bash(git diff*)
  Bash(git blame*)
  Bash(npm test *)
  Bash(cat *)
  Bash(ls *)
context: fork
agent: Explore
---

用户报告了以下问题：$ARGUMENTS

## 排查步骤

### 第一步：复现和理解
1. 在代码库中找到相关模块
2. 理解正常流程应该是怎样的
3. 确认问题的具体表现

### 第二步：定位范围
1. 使用 `git log` 查看最近相关变更
2. 使用 `git diff` 对比变更前后的差异
3. 用 `git blame` 找到相关代码的提交记录

### 第三步：假设验证
对每个可能的原因：
1. 阅读相关代码
2. 检查是否符合假设
3. 如果不符合，排除并记录

### 第四步：给出结论
输出格式：
- **根因**：一句话描述根本原因
- **影响范围**：哪些功能受影响
- **修复方案**：具体的修复步骤和代码建议
- **预防措施**：如何避免同类问题再次发生
```

### 5.5 文档生成（generate-docs）

**场景：** 为指定模块自动生成 API 文档。

```yaml
---
# 文件：.claude/skills/generate-docs/SKILL.md
name: generate-docs
description: 为指定模块生成 API 文档
arguments: module-path
argument-hint: "<文件或目录路径>"
allowed-tools: |
  Read
  Grep
  Glob
---

为 $ARGUMENTS 生成 API 文档。

## 分析步骤

1. 读取目标文件/目录中的所有源代码
2. 识别导出的函数、类、接口、类型
3. 分析每个导出的：
   - 参数列表和类型
   - 返回值类型
   - 副作用和异常
   - 使用示例

## 输出格式

生成一份 Markdown 文档，包含：

1. **模块概述**：这个模块做什么
2. **API 列表**：所有导出的函数/类/接口
3. **详细文档**：每个 API 的参数、返回值、示例
4. **类型定义**：关键类型和接口
5. **使用示例**：典型用法

将文档写入与源文件同目录的 README.md 中。
```

---

## 六、高级用法

### 6.1 隔离执行（context: fork）

```yaml
---
name: security-audit
description: 安全审计
context: fork          # 在隔离的子代理中执行
agent: Explore         # 使用 Explore 代理（擅长搜索和分析）
model: sonnet          # 使用 sonnet（速度快）
effort: high           # 高 effort
allowed-tools: |
  Read
  Grep
  Glob
  Bash(git log*)
---

对项目进行全面安全审计。重点检查：
- 硬编码的密钥和密码
- SQL 注入风险
- XSS 风险
- 不安全的文件操作
- 依赖中的已知漏洞

输出一份安全审计报告。
```

**隔离执行的优势：**
- 不占用主会话的上下文窗口
- 可以使用不同的模型和 effort 配置
- 执行完毕后将结果返回给主会话
- 适合耗时的分析任务

### 6.2 条件自动触发

```yaml
---
name: suggest-test
description: 当用户修改了源代码文件时，建议编写对应的测试
paths: "src/**/*.ts"     # 只在讨论 src/ 下的 .ts 文件时触发
---

用户正在修改源代码文件。请检查对应目录下是否已有测试文件。
如果没有，建议编写单元测试并给出测试用例建议。
```

```
自动触发逻辑：
1. 用户对话中涉及 src/utils/format.ts
2. Claude 检查 paths 模式 "src/**/*.ts" → 匹配
3. Claude 读取 description → "建议编写对应的测试"
4. Claude 自动调用此 Skill
```

### 6.3 遗留命令兼容

```
旧的 .claude/commands/<name>.md 格式仍然可用
如果 skills/ 和 commands/ 下有同名命令，skills 优先

.claude/
├── commands/               # 旧格式（仍然支持）
│   └── commit.md           # /commit
└── skills/                 # 新格式（推荐）
    └── commit/
        └── SKILL.md        # /commit（优先级更高）
```

---

## 七、开发与调试技巧

### 7.1 开发流程

```
第一步：创建 Skill 目录
  mkdir -p .claude/skills/my-skill

第二步：编写 SKILL.md
  先写 description 和 Body，测试基本功能

第三步：在 Claude Code 中测试
  /my-skill 测试参数

第四步：迭代优化
  调整指令、添加 allowed-tools、设置参数

第五步：提交到 Git
  git add .claude/skills/my-skill/SKILL.md
  团队成员 clone 后立即可用
```

### 7.2 调试技巧

```
Q: Skill 没有出现在 / 菜单中？
├── 检查文件路径是否正确（.claude/skills/<name>/SKILL.md）
├── 检查 user-invocable 是否设为 false
├── 如果是新建的 skills/ 目录，需要重启 Claude Code
└── 检查 SKILL.md 的 YAML frontmatter 格式是否正确

Q: Claude 没有自动触发？
├── description 是否清楚地描述了触发场景
├── 如果设了 paths，检查是否匹配当前对话的文件
├── disable-model-invocation 是否设为 true
└── 自动触发不是 100% 保证的，依赖 Claude 的判断

Q: Skill 执行时报权限错误？
├── 检查 allowed-tools 是否包含了需要的工具
├── 工具名大小写敏感（Read 不是 read）
├── Bash 命令需要用 Bash(command) 格式
└── 通配符：Bash(git *) 允许所有 git 开头的命令

Q: 动态上下文注入失败？
├── 确保 shell 命令在当前环境可以执行
├── 检查 !`command` 语法（反引号）
├── 多行命令用 ```! 开头的 fenced block
└── 命令执行超时或报错时，注入内容为空
```

### 7.3 最佳实践

```
1. description 要写清楚触发场景
   ❌ "帮助用户"
   ✅ "当用户需要审查 Git 暂存区变更并生成 commit message 时使用"

2. 指令要具体，不要模糊
   ❌ "检查代码质量"
   ✅ "检查以下维度：安全性（XSS/注入）、性能（N+1/大循环）、命名规范"

3. allowed-tools 量最小够用
   ❌ Bash(*)     # 给了所有 bash 权限，太危险
   ✅ Bash(git commit *) Bash(npm test)  # 只给需要的

4. 耗时任务用 context: fork
   全文搜索、安全审计、大规模重构 → fork 到子代理
   简单的 git 操作、文件编辑 → 主会话执行

5. 项目级 Skill 提交到 Git
   .claude/skills/ 加入版本管理
   团队成员 clone 后自动可用

6. 个人通用 Skill 放 ~/.claude/skills/
   跨项目复用的 Skill（如 smart-commit、debug）
   不要提交到项目仓库
```

---

## 八、分发方式对比

| 方式 | 路径 | 适用 | 分发 | 更新 |
|------|------|------|------|------|
| **项目级** | `.claude/skills/` | 项目团队 | Git 提交 | 随项目更新 |
| **个人级** | `~/.claude/skills/` | 个人所有项目 | 手动复制 | 手动维护 |
| **插件级** | Plugin 包 | 社区/组织 | npm 安装 | 版本管理 |
| **企业级** | 管理后台 | 全组织 | 后台部署 | 统一推送 |

**典型团队方案：**

```
项目级 Skill（提交到 Git）：
├── smart-commit   → 团队统一的提交规范
├── review         → 团队的 Code Review 标准
├── release        → 团队的发布流程
└── debug          → 团队的排错套路

个人级 Skill（不提交）：
├── daily-standup  → 个人日报生成
└── learning-note  → 个人学习笔记整理
```

---

## 九、总结

### 核心要点

- **Skill 是按需加载的指令集**，不占用常驻上下文，是 CLAUDE.md 的最佳补充
- **description 决定自动触发质量**，写清楚"什么时候用"比"做什么"更重要
- **allowed-tools 预授权工具**，减少用户确认弹窗，提升流畅度
- **context: fork 隔离执行**，耗时任务不污染主会话上下文
- **动态注入 `` !`command` ``** 让 Skill 获取实时上下文，指令更精准

### Skill vs 其他方案

| 场景 | CLAUDE.md | Skill | 直接 Prompt |
|------|-----------|-------|------------|
| 全局规则（编码规范） | ✅ 最佳 | ❌ 不适合 | ❌ 每次重复 |
| 特定流程（发布/审查） | ❌ 浪费上下文 | ✅ 最佳 | ❌ 每次重复 |
| 一次性问题 | ❌ 不需要 | ❌ 杀鸡牛刀 | ✅ 直接问 |
| 团队固化经验 | ✅ 通用规则 | ✅ 流程模板 | ❌ 不可复用 |

### 一句话建议

**把重复的 prompt 变成 Skill——你只需写一次，团队所有人永久复用。好的 Skill 不是写最复杂的指令，而是写最精准的 description 和最小够用的 allowed-tools。**
