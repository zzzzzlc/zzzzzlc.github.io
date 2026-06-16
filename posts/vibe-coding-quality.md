---
title: Vibe Coding 增强：如何提高 AI 生成代码质量与减少幻觉
date: '2026-04-29'
tags:
  - AI 工具
  - 设计原则
  - AI
category: AI 工程
summary: >-
  从 Vibe Coding 实践中的代码质量痛点出发，系统分析 AI
  生成代码的五大幻觉类型与根因，提出六种增强策略——上下文管理、约束驱动开发、渐进式生成、验证闭环、记忆系统、人机协作流程，结合 Claude
  Code、Cursor 等工具的实战配置，给出可落地的质量保障体系。
---

# Vibe Coding 增强：如何提高 AI 生成代码质量与减少幻觉

## 一、问题来源

Vibe Coding（用自然语言描述需求，让 AI 生成代码）正在改变开发方式，但几乎所有实践者都会经历一个共同的过程：**从兴奋到失望到理性。**

**兴奋期（"哇，AI 能写代码！"）：**

- 一个指令就能生成完整的 CRUD 模块，效率提升 5 倍
- 让 AI 写一个 React 组件，几十秒搞定，样式还挺好看
- 不用再查文档了，AI 什么都知道

**失望期（"等等，这代码有问题"）：**

- AI 生成的代码第一次能跑，但改需求后改不动了——结构耦合严重，牵一发动全身
- 引入了不存在的 API（`array.flat()` 拼成 `array.flatten()`），线上报错
- 安全漏洞（SQL 拼接、XSS、硬编码密钥）AI 不提醒，Code Review 才发现
- 性能问题（N+1 查询、无限重渲染、内存泄漏）AI 不在乎，压力测试才暴露

**理性期（"AI 是工具，不是替代"）：**

- AI 生成的代码需要和手写代码一样的质量标准
- 核心问题不是"AI 能不能写代码"，而是"如何确保 AI 写的代码质量过关"
- 幻觉不是随机事件，而是有规律的——理解规律就能系统性地减少

**核心问题：Vibe Coding 的质量瓶颈不在于 AI 的能力上限，而在于人类如何有效地约束和引导 AI。这是一套系统性的工程实践——涉及上下文管理、约束设计、验证机制、人机协作流程。**

---

## 二、AI 代码幻觉的类型学

要减少幻觉，首先要理解它的类型和根因。

### 2.1 幻觉分类

```
AI 代码幻觉的五种类型：

1. API 虚构（API Fabrication）
   表现：调用不存在的函数、使用错误的参数、引用不存在的配置项
   根因：训练数据中多个库的 API 混淆，或 API 在不同版本间变化

2. 上下文丢失（Context Loss）
   表现：忘记之前的约定（命名规范、文件结构、技术栈选择）
   根因：上下文窗口有限，早期信息被"挤出"对话

3. 逻辑臆造（Logic Fabrication）
   表现：算法逻辑看似正确但有微妙 bug，边界条件处理错误
   根因：AI 基于模式匹配而非真正的逻辑推理

4. 安全无视（Security Blindness）
   表现：SQL 拼接、硬编码密钥、未校验用户输入、CORS 全开
   根因：训练数据中"能跑的代码"远多于"安全的代码"

5. 过度设计（Over-Engineering）
   表现：简单需求生成复杂架构，引入不必要的抽象层和依赖
   根因：AI 倾向于展示"能力"，生成看似专业的复杂方案
```

### 2.2 幻觉根因分析

```
┌─────────────────────────────────────────────────────────┐
│                    AI 代码幻觉的根因链                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  训练阶段                                                │
│  ├── 训练数据包含过时代码（旧版 API、已废弃的方法）        │
│  ├── 多个库的代码混合训练（A 库的方法套用到 B 库）        │
│  └── 代码质量参差不齐（好代码和坏代码权重相同）            │
│                                                         │
│  推理阶段                                                │
│  ├── 概率采样导致"看起来合理但实际错误"的输出              │
│  ├── 上下文窗口限制导致远期约束被遗忘                     │
│  └── 缺乏实时验证（无法运行代码检验正确性）               │
│                                                         │
│  交互阶段                                                │
│  ├── Prompt 约束不足（没有指定版本、风格、边界）          │
│  ├── 一次性要求过多（"帮我写一个完整的系统"）             │
│  └── 盲目接受结果（不 Review、不测试、不质疑）            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.3 幻觉频率统计（实践经验估算）

```
基于大量 Vibe Coding 实践的观察：

┌────────────────────┬──────────┬──────────────────────────┐
│ 幻觉类型           │ 出现频率 │ 最容易出现的场景          │
├────────────────────┼──────────┼──────────────────────────┤
│ API 虚构           │  高      │ 新发布的库、小众 API      │
│ 上下文丢失         │  高      │ 长对话（>20 轮）          │
│ 逻辑臆造           │  中      │ 复杂算法、并发、边界条件  │
│ 安全无视           │  中      │ 用户输入处理、数据库操作  │
│ 过度设计           │  中高    │ 架构设计、新项目启动      │
└────────────────────┴──────────┴──────────────────────────┘

关键发现：
1. AI 对"热门 + 成熟"的技术栈准确率最高（React、Express、Python 标准库）
2. AI 对"新发布 + 频繁变化"的技术栈准确率最低（刚发布的新框架、Beta API）
3. 上下文超过 15 轮对话后，早期约束的遗忘率显著上升
```

---

## 三、增强策略一：上下文管理

上下文是 AI 生成代码质量的"燃料"。垃圾上下文 → 垃圾代码。

### 3.1 上下文分层策略

```
上下文三层架构：

Layer 1: 持久层（始终在上下文中）
├── CLAUDE.md / .cursorrules — 项目级规范
├── 技术栈声明（框架版本、语言版本、包管理器）
├── 代码风格约定（命名规范、文件结构、目录约定）
└── 硬性约束（禁止使用的 API、安全要求）
特点：精简、稳定、高优先级

Layer 2: 会话层（当前对话中持续有效）
├── 当前任务描述
├── 相关文件内容（手动指定或工具检索）
├── 已做的技术决策
└── 已发现的问题和修复
特点：随对话演进、可压缩

Layer 3: 任务层（仅当次操作需要）
├── 具体要修改的文件内容
├── 相关的类型定义
├── 依赖的函数签名
└── 测试用例
特点：精准、短暂、用完即丢
```

### 3.2 CLAUDE.md 实战配置

```markdown
# CLAUDE.md 示例 — 项目级 AI 约束

## 技术栈
- Runtime: Node.js 20.x (ESM)
- Framework: Fastify 5.x
- Language: TypeScript 5.x (strict mode)
- ORM: Prisma 6.x
- Test: Vitest
- Package Manager: pnpm

## 代码规范
- 文件命名：kebab-case（user-service.ts）
- 目录结构：src/modules/{module}/
- 错误处理：使用 Result 模式，禁止 try-catch 外泄
- 数据库查询：必须使用 Prisma，禁止原始 SQL
- API 响应格式：{ code: number, data: T, message: string }

## 禁止事项
- 禁止使用 any 类型
- 禁止使用 eval()、new Function()
- 禁止硬编码密钥、Token
- 禁止引入新的依赖而不说明原因
- 禁止生成 mock 数据以外的 console.log

## 测试要求
- 每个新增函数必须有单元测试
- API 端点必须有集成测试
- 测试覆盖核心路径和边界情况
```

### 3.3 上下文注入技巧

```markdown
<!-- 与 AI 交互时，主动注入关键上下文 -->

❌ 低质量 Prompt：
"帮我写一个用户注册接口"

✅ 高质量 Prompt：
"帮我写一个用户注册接口。

技术栈：Fastify 5 + Prisma 6 + TypeScript strict

参考以下现有代码风格：
（粘贴现有的 route 文件作为示例）

数据模型：
（粘贴 Prisma schema 中的 User model）

要求：
1. 参数校验使用 Fastify 的 JSON Schema
2. 密码使用 bcrypt 加密（已有 src/utils/hash.ts 的 hashPassword 函数）
3. 邮件重复时返回 409
4. 注册成功后发送欢迎邮件（调用 src/services/email.ts 的 sendWelcome）
5. 写对应的单元测试"
```

---

## 四、增强策略二：约束驱动开发

不要告诉 AI "做什么"，告诉它 "在什么约束下做什么"。

### 4.1 约束层次

```
约束的五个层次：

L1: 语法约束 — 类型安全、编译通过
    工具：TypeScript strict、ESLint
    示例："所有参数必须有类型标注，禁止 any"

L2: 风格约束 — 代码风格一致
    工具：Prettier、项目 CLAUDE.md
    示例："使用早返回（early return），避免嵌套 if"

L3: 架构约束 — 符合项目架构
    工具：目录结构约定、依赖规则
    示例："路由层只做参数校验和转发，业务逻辑在 service 层"

L4: 安全约束 — 不引入安全漏洞
    工具：安全 Review 清单、自动化扫描
    示例："用户输入必须校验后再使用，禁止拼接 SQL"

L5: 业务约束 — 满足业务需求
    工具：需求文档、测试用例
    示例："订单金额超过 1 万需要额外审核，退款不超过原金额"
```

### 4.2 约束模板

```markdown
<!-- 给 AI 的约束模板，可复用 -->

## 任务
（描述具体要做什么）

## 输入
（相关文件内容、数据模型、API 定义）

## 输出
（期望的输出格式、文件路径）

## 约束
### 必须（MUST）
- 类型：TypeScript strict，零 any
- 错误处理：使用项目统一的错误格式
- 测试：覆盖正常路径和至少 2 个边界情况

### 禁止（MUST NOT）
- 不引入新的 npm 依赖
- 不修改约束中未提及的文件
- 不使用 TODO 或 FIXME 占位

### 参考（SHOULD）
- 风格参考：（粘贴现有代码示例）
- 模式参考：（说明设计模式或已有实现）
```

### 4.3 版本锁定约束

```markdown
<!-- AI 最容易犯的错误：混淆不同版本的 API -->

❌ 不指定版本：
"用 React 写一个表单组件"
→ AI 可能生成 class 组件（React 15 风格）或 hooks 组件

✅ 锁定版本 + 指定模式：
"用 React 18 + TypeScript 写一个表单组件。
使用函数组件 + hooks。
表单状态管理使用 react-hook-form 7.x。
校验使用 zod。"

❌ 不指定 ORM 版本：
"用 Prisma 查询用户"
→ AI 可能使用 Prisma 4 的 API（如 connectOrCreate 的参数格式不同）

✅ 锁定 API：
"使用 Prisma 6.x。参考以下已有查询风格：
（粘贴项目中现有的 Prisma 查询代码）"
```

---

## 五、增强策略三：渐进式生成

一次性让 AI 生成完整系统是幻觉的温床。渐进式生成是降低风险的核心策略。

### 5.1 分层生成流程

```
渐进式生成的五个阶段：

阶段 1: 接口设计（5 分钟）
├── 只生成类型定义和接口签名
├── 验证：类型是否完整？命名是否合理？
└── 输出：types.ts + interface 定义

阶段 2: 骨架实现（10 分钟）
├── 生成函数签名 + TODO 标注实现细节
├── 验证：架构是否合理？依赖方向是否正确？
└── 输出：函数骨架，每个函数体是 TODO

阶段 3: 核心实现（20 分钟）
├── 逐个实现核心函数（一次一个）
├── 验证：每个函数独立测试
└── 输出：可运行的代码

阶段 4: 错误处理（10 分钟）
├── 添加边界条件处理和错误路径
├── 验证：异常场景测试
└── 输出：健壮的代码

阶段 5: 优化与清理（10 分钟）
├── 性能优化、代码去重、注释精简
├── 验证：性能基准 + 最终 Review
└── 输出：可交付的代码
```

### 5.2 实战示例

```markdown
<!-- 渐进式生成：以"用户认证模块"为例 -->

=== 第 1 轮：接口设计 ===

Prompt:
"我要实现用户认证模块。先只输出类型定义和接口签名，不要实现逻辑。

需求：
1. 用户注册（邮箱 + 密码）
2. 用户登录（邮箱 + 密码）
3. Token 刷新
4. 修改密码

技术栈：Fastify 5 + Prisma 6 + TypeScript strict

只输出：
1. 请求/响应的 TypeScript 类型
2. Service 层的接口签名
3. Route 层的函数签名"

验证：
- 检查类型是否完整
- 检查是否有遗漏的边界情况（如邮箱格式、密码强度）

=== 第 2 轮：骨架实现 ===

Prompt:
"基于上一轮的类型定义，生成 Service 层的骨架代码。
每个方法只写函数签名和返回语句，具体实现用注释标注步骤。
不要写具体逻辑。"

验证：
- 检查架构是否合理
- 检查依赖注入方向

=== 第 3 轮：逐个实现 ===

Prompt:
"实现 register 方法。参考以下约束：
- 密码使用 bcrypt（cost factor 12）
- 邮箱重复时抛出 ConflictError
- 返回值不含密码字段
- 写一个对应的单元测试"

验证：
- 运行测试
- 检查安全性

=== 逐个实现其余方法... ===
```

---

## 六、增强策略四：验证闭环

AI 生成的代码必须经过验证才能信任。建立自动化验证闭环。

### 6.1 验证层次

```
验证四层金字塔：

           ┌──────────────┐
           │  E2E 测试     │  ← AI 生成完整功能后的端到端验证
           │  (少量)       │
           ├──────────────┤
           │  集成测试     │  ← AI 生成的 API 端点集成验证
           │  (适量)       │
           ├──────────────┤
           │  单元测试     │  ← AI 生成每个函数后的即时验证
           │  (大量)       │
           ├──────────────┤
           │  静态分析     │  ← 每次生成的代码都经过自动检查
           │  (全部)       │
           └──────────────┘

执行时机：
- AI 每次生成代码 → 立即跑静态分析 + 单元测试
- AI 完成一个功能 → 跑集成测试
- AI 完成一个模块 → 跑 E2E 测试
```

### 6.2 自动化验证流水线

```typescript
// scripts/ai-verify.ts — AI 代码生成后的自动化验证

interface VerifyResult {
  passed: boolean;
  checks: CheckResult[];
}

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

async function verifyAIOutput(files: string[]): Promise<VerifyResult> {
  const checks: CheckResult[] = [];

  // 1. TypeScript 编译检查
  const tscResult = await exec('tsc --noEmit');
  checks.push({
    name: 'TypeScript 编译',
    passed: tscResult.exitCode === 0,
    message: tscResult.exitCode === 0 ? '通过' : tscResult.stderr,
  });

  // 2. ESLint 检查
  const lintResult = await exec(`eslint ${files.join(' ')} --max-warnings 0`);
  checks.push({
    name: 'ESLint',
    passed: lintResult.exitCode === 0,
    message: lintResult.exitCode === 0 ? '通过' : lintResult.stdout,
  });

  // 3. 单元测试
  const testResult = await exec('vitest run --reporter=verbose');
  checks.push({
    name: '单元测试',
    passed: testResult.exitCode === 0,
    message: testResult.exitCode === 0 ? '通过' : testResult.stdout,
  });

  // 4. 安全检查（常见漏洞模式）
  const securityIssues = await checkSecurityPatterns(files);
  checks.push({
    name: '安全检查',
    passed: securityIssues.length === 0,
    message: securityIssues.length === 0
      ? '通过'
      : `发现 ${securityIssues.length} 个问题：${securityIssues.join('; ')}`,
  });

  return {
    passed: checks.every(c => c.passed),
    checks,
  };
}

// 安全模式检查
async function checkSecurityPatterns(files: string[]): Promise<string[]> {
  const issues: string[] = [];
  const content = await readFiles(files);

  const patterns: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /eval\s*\(/, message: '使用了 eval()' },
    { pattern: /new\s+Function\s*\(/, message: '使用了 new Function()' },
    { pattern: /password|secret|token|api_key/i, message: '可能包含硬编码密钥' },
    { pattern: /innerHTML\s*=/, message: '直接赋值 innerHTML（XSS 风险）' },
    { pattern: /\$\{.*\}.*SELECT|INSERT|UPDATE|DELETE/i, message: '可能的 SQL 注入' },
    { pattern: /cors\(\s*\)/, message: 'CORS 全开' },
    { pattern: /any[^a-zA-Z]/g, message: '可能使用了 any 类型' },
  ];

  for (const { pattern, message } of patterns) {
    if (pattern.test(content)) {
      issues.push(message);
    }
  }

  return issues;
}
```

### 6.3 AI 生成代码的 Review 清单

```markdown
## AI 代码 Review 清单

### 正确性
- [ ] 代码能否编译/运行？
- [ ] 函数行为是否符合需求描述？
- [ ] 边界条件是否处理？（空值、越界、并发）
- [ ] API 调用是否真实存在？（检查文档/源码）
- [ ] 依赖版本是否匹配项目版本？

### 安全性
- [ ] 用户输入是否全部校验？
- [ ] 是否存在 SQL 拼接？
- [ ] 是否存在 XSS 风险（innerHTML、 dangerouslySetInnerHTML）？
- [ ] 密钥/Token 是否硬编码？
- [ ] 错误信息是否暴露了内部实现？

### 性能
- [ ] 是否存在 N+1 查询？
- [ ] 是否存在无限重渲染（React useEffect 依赖错误）？
- [ ] 是否存在内存泄漏（事件监听/定时器未清理）？
- [ ] 是否有不必要的重复计算？

### 可维护性
- [ ] 代码是否遵循项目的命名和结构约定？
- [ ] 是否引入了不必要的抽象或依赖？
- [ ] 函数是否过长（> 50 行）？
- [ ] 是否有清晰的类型标注？

### 测试
- [ ] 是否有对应的测试用例？
- [ ] 测试是否覆盖了正常路径和异常路径？
- [ ] 测试是否 mock 了外部依赖？
```

---

## 七、增强策略五：记忆与知识系统

### 7.1 项目知识库

```
项目知识库结构：

.claude/
├── CLAUDE.md              # 项目级约束（始终加载）
├── memory/
│   ├── MEMORY.md          # 记忆索引
│   ├── feedback_*.md      # 用户反馈（避免重复错误）
│   └── project_*.md       # 项目决策记录
├── plans/                  # 实现计划
└── settings.json           # AI 工具配置

作用：
1. CLAUDE.md — 每次对话自动加载，提供持久约束
2. memory/ — 跨对话记忆，避免重复犯错
3. plans/ — 复杂任务的实现计划，确保渐进式推进
```

### 7.2 错误记忆机制

```markdown
<!-- memory/feedback_security.md 示例 -->

---
name: security-review
description: AI 生成代码时必须遵循的安全规范
type: feedback
---

AI 生成代码时必须遵循以下安全规范：

1. 所有数据库查询使用 Prisma 参数化查询，禁止字符串拼接 SQL
   **Why:** 2026-03 月 AI 生成的用户搜索接口使用了 SQL 拼接，导致 SQL 注入漏洞
   **How to apply:** 审查所有涉及数据库操作的 AI 生成代码

2. 用户输入必须在 route 层校验后才传入 service 层
   **Why:** AI 生成的代码经常跳过输入校验直接使用
   **How to apply:** 使用 Fastify JSON Schema 在 route 层做校验

3. 密码相关操作使用项目统一的 hash 工具函数
   **Why:** AI 有时自己用 crypto 模块实现 hash，可能使用不安全的算法
   **How to apply:** 只使用 src/utils/hash.ts 中的函数
```

### 7.3 Cursor / Claude Code 配置对比

```yaml
# .cursorrules — Cursor 的项目级约束
# 等同于 CLAUDE.md 的作用

你是本项目的 AI 编程助手。

## 技术栈
- React 18 + TypeScript 5 strict
- Vite 6 + pnpm
- Tailwind CSS 4
- TanStack Query 5

## 代码规范
- 组件使用函数组件 + hooks
- 状态管理优先使用 React 内置能力（useState/useReducer）
- 样式使用 Tailwind，禁止内联 style
- 文件命名：PascalCase（组件）、camelCase（工具函数）

## 禁止
- 禁止引入新的 UI 库（只用 Tailwind）
- 禁止使用 @ts-ignore 或 @ts-expect-error
- 禁止生成未请求的额外功能

## 测试
- 每个新组件必须有对应的测试文件
- 测试使用 Vitest + React Testing Library
```

```json
// .claude/settings.json — Claude Code 的项目配置
{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Bash(npm run lint)",
      "Bash(npm run test)",
      "Bash(npm run type-check)"
    ],
    "deny": [
      "Bash(rm -rf)",
      "Bash(git push)"
    ]
  }
}
```

---

## 八、增强策略六：人机协作流程

### 8.1 角色分工模型

```
人机协作的角色分工：

人类负责（决策层）：
├── 需求定义 — 明确"做什么"和"不做什么"
├── 架构决策 — 技术选型、模块划分、接口设计
├── 代码 Review — 安全性、可维护性、业务正确性
├── 边界条件 — 定义异常场景和边界处理规则
└── 质量标准 — 定义"好代码"的标准

AI 负责（执行层）：
├── 代码生成 — 基于约束生成实现代码
├── 测试生成 — 根据需求生成测试用例
├── 文档生成 — 生成 API 文档、注释
├── 重构建议 — 识别代码异味，建议改进
└── 解释代码 — 解释不熟悉的代码逻辑

不交给 AI 的（红线）：
├── 安全相关决策 — 认证、授权、加密方案
├── 数据库 Schema 变更 — 必须人工 Review
├── 生产环境配置 — 密钥、连接字符串、环境变量
└── 核心业务逻辑判断 — 金额计算、权限判断、合规规则
```

### 8.2 Vibe Coding 工作流

```
完整的 Vibe Coding 工作流：

Phase 1: 准备（5 分钟）
├── 更新 CLAUDE.md（如果有新的约束）
├── 准备相关文件内容（类型定义、参考实现）
├── 明确本次任务的输入和期望输出
└── 列出约束和禁止事项

Phase 2: 生成（分轮次）
├── 第 1 轮：接口设计（类型 + 签名）
│   └── 人类 Review → 确认方向正确
├── 第 2 轮：核心实现（逐函数）
│   └── 每个函数 → 人类快速扫读 → 运行测试
├── 第 3 轮：错误处理 + 边界条件
│   └── 人类 Review → 确认异常覆盖
└── 第 4 轮：清理 + 测试 + 文档
    └── 运行完整测试套件

Phase 3: 验证（10 分钟）
├── 运行静态分析（tsc + eslint）
├── 运行测试套件（单元 + 集成）
├── Code Review（使用 Review 清单）
└── 安全检查（常见漏洞模式）

Phase 4: 沉淀（3 分钟）
├── 记录本次遇到的问题和解决方案
├── 更新记忆系统（如果有新的反馈）
└── 更新 CLAUDE.md（如果有新的约束发现）
```

### 8.3 Prompt 进阶技巧

```markdown
<!-- 技巧一：示例驱动（Few-shot） -->

❌ "写一个 API 错误处理函数"
✅ "写一个 API 错误处理函数，参考以下现有风格：

// 现有的错误处理风格
function handleDbError(error: Prisma.PrismaClientKnownRequestError): ApiResponse {
  if (error.code === 'P2002') {
    return { code: 409, message: '数据已存在', data: null };
  }
  logger.error('数据库错误', error);
  return { code: 500, message: '服务器内部错误', data: null };
}

请按照相同的风格和返回格式处理以下情况：
- 请求参数校验失败
- 未授权访问
- 资源不存在
- 外部服务调用失败"

<!-- 技巧二：反向约束（告诉 AI 不要做什么） -->

❌ "优化这个函数的性能"
✅ "优化这个函数的性能。

约束：
- 不要改变函数签名
- 不要引入新的依赖
- 不要过度优化，保持代码可读性
- 优先优化 O(n²) → O(n)，不要做微优化"

<!-- 技巧三：自我审视（让 AI 检查自己） -->

Prompt:
"审查以下你刚才生成的代码，检查以下问题：
1. 是否有类型安全问题？
2. 是否有安全漏洞？
3. 是否有性能隐患？
4. 是否遵循了项目的代码规范？
5. 是否有未处理的边界条件？

对每个问题，给出具体的行号和修复建议。"
```

---

## 九、工具链配置

### 9.1 工具选型对比

| 维度 | Claude Code | Cursor | GitHub Copilot |
|------|------------|--------|---------------|
| **交互模式** | CLI 对话 | IDE 内嵌对话 + Tab 补全 | IDE 内 Tab 补全 |
| **上下文理解** | 主动读取项目文件 | 自动索引项目 | 基于当前文件 |
| **自定义约束** | CLAUDE.md + memory | .cursorrules | .github/copilot-instructions.md |
| **多文件编辑** | 强（Agent 模式） | 强（Composer） | 弱（单文件为主） |
| **工具调用** | Bash、文件操作、搜索 | 文件操作、终端 | 有限 |
| **模型选择** | Claude 系列 | Claude / GPT / 自定义 | GPT 系列 |
| **离线能力** | 无 | 部分（本地补全） | 部分（本地补全） |
| **适用场景** | 复杂任务、多文件重构 | 日常开发、Tab 补全 | 代码补全、小改动 |

### 9.2 自动化辅助工具

```json
// package.json — AI 代码质量保障的自动化工具
{
  "scripts": {
    "verify:ai": "tsc --noEmit && eslint src/ --max-warnings 0 && vitest run",
    "verify:security": "npx npm-audit && npx snyk test",
    "verify:all": "npm run verify:ai && npm run verify:security"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "vitest": "^2.0.0",
    "prettier": "^3.0.0"
  }
}
```

```yaml
# .github/workflows/ai-quality.yml
# PR 自动检查 AI 生成代码的质量
name: AI Code Quality
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Type Check
        run: tsc --noEmit

      - name: Lint
        run: eslint src/ --max-warnings 0

      - name: Test
        run: vitest run --coverage

      - name: Security Audit
        run: npm audit --audit-level=moderate
```

---

## 十、选型决策树

```
使用 AI 辅助编程时
    │
    ├─ 简单任务（单文件修改、工具函数）？
    │   └─ GitHub Copilot Tab 补全
    │       └─ 即时补全，Review 后接受
    │
    ├─ 中等任务（新 API 端点、新组件）？
    │   └─ Cursor Composer / Claude Code
    │       └─ 渐进式生成：接口 → 实现 → 测试
    │
    ├─ 复杂任务（跨模块重构、新功能模块）？
    │   └─ Claude Code Agent 模式
    │       └─ 完整工作流：准备 → 分轮生成 → 验证 → 沉淀
    │
    └─ 如何减少幻觉？
        ├─ API 虚构 → 锁定版本 + 注入文档
        ├─ 上下文丢失 → CLAUDE.md + memory 系统
        ├─ 逻辑臆造 → 渐进式生成 + 自动化测试
        ├─ 安全无视 → Review 清单 + 安全扫描
        └─ 过度设计 → 约束驱动 + 最小实现原则
```

---

## 十一、总结

| 问题 | 策略 | 具体手段 |
|------|------|---------|
| API 虚构 | 版本锁定 + 上下文注入 | CLAUDE.md 声明技术栈版本 + 注入 API 文档 |
| 上下文丢失 | 持久层约束 + 记忆系统 | CLAUDE.md（始终加载）+ memory（跨对话） |
| 逻辑臆造 | 渐进式生成 + 自动化测试 | 分层生成 + 每层验证 + vitest 自动测试 |
| 安全无视 | Review 清单 + 安全扫描 | 人工 Review + eslint-plugin-security + CI 检查 |
| 过度设计 | 约束驱动 + 最小实现 | 明确"MUST NOT" + 反向约束 + 示例驱动 |
| 质量不稳定 | 验证闭环 + 工作流标准化 | 自动化验证脚本 + 分阶段工作流 |

**一句话总结：Vibe Coding 的质量不取决于 AI 的能力，而取决于人类建立的约束体系。好的 Vibe Coder 不是 Prompt 写得漂亮的人，而是能为 AI 建立清晰约束、严格执行验证闭环、持续沉淀项目知识的人。AI 写代码，人类定规则。**
