---
title: "普通工作流 vs AI 工作流：选型与实战"
date: "2026-04-26"
tags:
  - 工作流
  - AI
  - Agent
  - 自动化
  - 工程化
category: "AI 工程"
summary: "从实际业务中自动化流程的选型困惑出发，对比分析传统状态机工作流、规则引擎、AI Agent 工作流和混合工作流的实现方式，探讨确定性流程与概率性流程的边界与融合。"
---

# 普通工作流 vs AI 工作流：选型与实战

## 一、问题来源

在业务系统中，"流程自动化"是最常见的需求之一。但随着 AI 的普及，团队在做技术选型时经常陷入困惑：

**传统工作流的困境：**

- 审批流程中，判断条件越来越复杂（"金额大于 5 万且申请人职级低于 P7 且部门预算剩余不足 20%"），if-else 写了 200 行还在加
- 客服路由规则越积越多，新来一个运营改了规则就出 bug，没人敢动
- 内容审核只能做关键词匹配，"这个东西太绝了"到底是夸还是骂？规则引擎搞不定

**AI 工作流的幻想与落差：**

- "让 AI 判断审批能不能过"——结果 AI 偶尔拒绝 CEO 的申请，解释不了原因
- "用 AI 做智能路由"——回答不稳定，同一个问题今天路由到 A 组明天路由到 B 组
- "AI 自动处理所有客服"——幻觉频发，给用户编造了一个不存在的退款政策

**核心矛盾：** 传统工作流**确定性高但灵活性差**，AI 工作流**灵活性强但不可预测**。如何选择？能不能结合？

## 二、传统工作流方案

### 方案一：有限状态机（FSM）

最经典的工作流实现方式，每个节点有明确的状态和转移条件。

```typescript
// 使用 XState 实现审批工作流
import { createMachine, interpret } from 'xstate';

type ApprovalContext = {
    applicant: string;
    amount: number;
    level: string;
    department: string;
};

const approvalMachine = createMachine({
    id: 'approval',
    initial: 'draft',
    context: {
        applicant: '',
        amount: 0,
        level: '',
        department: '',
    } as ApprovalContext,
    states: {
        draft: {
            on: {
                SUBMIT: {
                    target: 'managerReview',
                    cond: 'hasRequiredFields',
                },
            },
        },
        managerReview: {
            on: {
                APPROVE: [
                    { target: 'directorReview', cond: 'amountOver50k' },
                    { target: 'approved', cond: 'amountUnder50k' },
                ],
                REJECT: 'rejected',
            },
        },
        directorReview: {
            on: {
                APPROVE: [
                    { target: 'ceoReview', cond: 'amountOver500k' },
                    { target: 'approved', cond: 'amountUnder500k' },
                ],
                REJECT: 'rejected',
            },
        },
        ceoReview: {
            on: {
                APPROVE: 'approved',
                REJECT: 'rejected',
            },
        },
        approved: { type: 'final' },
        rejected: { type: 'final' },
    },
}, {
    guards: {
        hasRequiredFields: (ctx) => !!ctx.applicant && ctx.amount > 0,
        amountOver50k: (ctx) => ctx.amount > 50000,
        amountUnder50k: (ctx) => ctx.amount <= 50000,
        amountOver500k: (ctx) => ctx.amount > 500000,
        amountUnder500k: (ctx) => ctx.amount <= 500000,
    },
});

// 执行工作流
const service = interpret(approvalMachine);
service.start();
service.send({ type: 'SUBMIT' });
```

**优点：**
- 状态转移完全确定，相同的输入永远得到相同的输出
- 可视化强，状态图一目了然
- 调试简单，每一步都可以追踪和回放
- XState 等库提供完善的类型支持和测试工具

**缺点：**
- 状态爆炸：流程越复杂，状态和转移数量指数增长
- 无法处理模糊条件（"内容是否合规"无法用布尔值表达）
- 修改流程需要修改代码，非技术人员无法自行调整
- 对非结构化输入（自然语言、图片）无能为力

**适配场景：**
- 审批流（请假、报销、采购）
- 订单状态流转
- 设备状态管理
- 表单多步骤引导

**局限性：**
- 超过 20 个状态的工作流维护成本急剧上升
- 无法适应业务规则的频繁变化

### 方案二：规则引擎

将业务规则从代码中抽离，用配置化的方式管理和执行。

```typescript
// 轻量级 JSON 规则引擎
interface Rule {
    name: string;
    condition: Record<string, unknown>;
    action: string;
    priority?: number;
}

interface RuleEngine {
    evaluate(facts: Record<string, unknown>): Rule | null;
}

class JsonRuleEngine implements RuleEngine {
    private rules: Rule[];

    constructor(rules: Rule[]) {
        this.rules = rules.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }

    evaluate(facts: Record<string, unknown>): Rule | null {
        for (const rule of this.rules) {
            if (this.matchCondition(rule.condition, facts)) {
                return rule;
            }
        }
        return null;
    }

    private matchCondition(condition: Record<string, unknown>, facts: Record<string, unknown>): boolean {
        return Object.entries(condition).every(([key, expected]) => {
            const actual = facts[key];

            // 支持 { op: '>', value: 100 } 格式
            if (expected && typeof expected === 'object' && 'op' in (expected as Record<string, unknown>)) {
                const { op, value } = expected as { op: string; value: unknown };
                switch (op) {
                    case '>': return Number(actual) > Number(value);
                    case '>=': return Number(actual) >= Number(value);
                    case '<': return Number(actual) < Number(value);
                    case '<=': return Number(actual) <= Number(value);
                    case '!=': return actual !== value;
                    case 'in': return Array.isArray(value) && value.includes(actual);
                    case 'contains': return String(actual).includes(String(value));
                    default: return actual === value;
                }
            }

            return actual === expected;
        });
    }
}

// 使用：客服路由规则
const routingRules: Rule[] = [
    {
        name: 'VIP退款',
        condition: { userLevel: 'vip', intent: 'refund', amount: { op: '>', value: 1000 } },
        action: 'route:senior_refund_team',
        priority: 100,
    },
    {
        name: '普通退款',
        condition: { intent: 'refund' },
        action: 'route:refund_team',
        priority: 50,
    },
    {
        name: '技术咨询',
        condition: { intent: 'technical' },
        action: 'route:tech_support',
        priority: 50,
    },
    {
        name: '默认路由',
        condition: {},
        action: 'route:general_cs',
        priority: 0,
    },
];

const engine = new JsonRuleEngine(routingRules);
const result = engine.evaluate({
    userLevel: 'vip',
    intent: 'refund',
    amount: 5000,
});
// result.name === 'VIP退款', result.action === 'route:senior_refund_team'
```

**优点：**
- 规则与代码分离，运营人员可以自行修改规则
- 可持久化到数据库，运行时动态加载
- 规则之间互不影响，新增规则不需要修改已有逻辑
- 执行结果完全确定，可解释

**缺点：**
- 规则冲突难以发现（两条规则同时匹配时，优先级设计容易出错）
- 复杂条件的表达能力有限（嵌套逻辑需要多层嵌套 JSON）
- 同样无法处理模糊输入
- 规则数量多时性能下降（需要全量遍历匹配）

**适配场景：**
- 动态定价（根据用户等级、时间段、库存调整价格）
- 风控规则（根据交易金额、频率、地区判断风险等级）
- 客服路由（根据用户属性和意图分配客服组）
- 营销活动规则

**局限性：**
- 不适合需要"理解语义"的场景
- 规则超过 200 条时维护成本急剧上升

### 方案三：BPMN 流程引擎

企业级工作流标准，适合跨系统、跨角色的长周期流程。

```yaml
# Camunda BPMN 示例（简化 YAML 格式）
process:
  id: order-fulfillment
  name: 订单履约流程
  start: receiveOrder
  nodes:
    receiveOrder:
      type: service-task
      service: orderService.create
      next: checkInventory
    checkInventory:
      type: service-task
      service: inventoryService.check
      next: inventoryDecision
    inventoryDecision:
      type: exclusive-gateway
      branches:
        - condition: "${inventory >= orderQuantity}"
          next: processPayment
        - condition: "${inventory < orderQuantity}"
          next: notifyShortage
    processPayment:
      type: service-task
      service: paymentService.charge
      next: paymentDecision
    paymentDecision:
      type: exclusive-gateway
      branches:
        - condition: "${paymentStatus == 'success'}"
          next: shipOrder
        - condition: "${paymentStatus == 'failed'}"
          next: paymentFailed
    shipOrder:
      type: service-task
      service: shippingService.dispatch
      next: end
    notifyShortage:
      type: user-task
      assignee: "${orderManager}"
      next: end
    paymentFailed:
      type: service-task
      service: notificationService.sendFailure
      next: end
    end:
      type: end-event
```

**优点：**
- 行业标准（BPMN 2.0），可视化建模，非技术人员可参与设计
- 支持长周期流程（订单流程可能持续数天）、人工节点、定时器、信号
- 内置持久化，流程状态可跨重启恢复
- 成熟的开源实现（Camunda、Flowable、Activiti）

**缺点：**
- 学习曲线陡峭，BPMN 规范本身就很复杂
- 部署运维成本高，需要独立引擎
- 过于重量级，简单流程用不到
- 与现代前端/Node.js 生态脱节，主要面向 Java 技术栈

**适配场景：**
- 跨部门审批流程（请假 → 经理 → HR → 财务）
- 订单履约全流程
- 合同签署流程（涉及多角色、时间约束）
- 大型企业级流程管理

**局限性：**
- 小团队和快速迭代场景不建议使用
- 流程设计需要专职的流程工程师

## 三、AI 工作流方案

### 方案一：LLM 驱动的 Agent 工作流

用大模型作为"决策大脑"，根据输入自主选择下一步操作。

```typescript
// AI Agent 工作流
interface WorkflowNode {
    id: string;
    type: 'ai' | 'tool' | 'human' | 'condition';
    name: string;
    config: Record<string, unknown>;
}

interface WorkflowDefinition {
    id: string;
    name: string;
    nodes: WorkflowNode[];
}

// AI 路由决策
async function aiRoute(userInput: string, availableActions: string[]): Promise<{
    action: string;
    confidence: number;
    reasoning: string;
}> {
    const response = await callLLM([{
        role: 'system',
        content: `你是一个客服路由助手。根据用户输入判断应该路由到哪个处理动作。

可用的动作：
${availableActions.map(a => `- ${a}`).join('\n')}

请以 JSON 格式返回：
{
    "action": "选中的动作名称",
    "confidence": 0.0-1.0 的置信度,
    "reasoning": "选择理由"
}`,
    }, {
        role: 'user',
        content: userInput,
    }], { temperature: 0 });

    return JSON.parse(response);
}

// 完整的 AI 工作流执行器
class AIWorkflowExecutor {
    private definition: WorkflowDefinition;
    private maxRetries: number;

    constructor(definition: WorkflowDefinition, maxRetries = 3) {
        this.definition = definition;
        this.maxRetries = maxRetries;
    }

    async execute(input: string): Promise<{
        output: string;
        steps: Array<{ node: string; result: string; duration: number }>;
    }> {
        const steps: Array<{ node: string; result: string; duration: number }> = [];
        let currentInput = input;

        for (const node of this.definition.nodes) {
            const start = Date.now();

            switch (node.type) {
                case 'ai': {
                    // AI 决策节点
                    const result = await this.executeAINode(node, currentInput);
                    currentInput = result;
                    steps.push({
                        node: node.name,
                        result: currentInput,
                        duration: Date.now() - start,
                    });
                    break;
                }
                case 'tool': {
                    // 工具调用节点
                    const result = await this.executeToolNode(node, currentInput);
                    currentInput = result;
                    steps.push({
                        node: node.name,
                        result: currentInput,
                        duration: Date.now() - start,
                    });
                    break;
                }
                case 'condition': {
                    // AI 判断分支
                    const branch = await this.executeConditionNode(node, currentInput);
                    if (!branch.pass) {
                        steps.push({ node: node.name, result: '条件不满足，流程终止', duration: Date.now() - start });
                        return { output: currentInput, steps };
                    }
                    break;
                }
                case 'human': {
                    // 人工审批（暂停等待）
                    steps.push({ node: node.name, result: '等待人工处理', duration: Date.now() - start });
                    // 实际实现中需要暂停流程，等待外部回调
                    break;
                }
            }
        }

        return { output: currentInput, steps };
    }

    private async executeAINode(node: WorkflowNode, input: string): Promise<string> {
        const prompt = node.config.prompt as string;
        const response = await callLLM([{
            role: 'system',
            content: prompt,
        }, {
            role: 'user',
            content: input,
        }]);
        return response;
    }

    private async executeToolNode(node: WorkflowNode, input: string): Promise<string> {
        const toolName = node.config.tool as string;
        // 从注册表中获取工具并执行
        return toolImplementations[toolName]?.({ input }) ?? '工具未找到';
    }

    private async executeConditionNode(node: WorkflowNode, input: string): Promise<{ pass: boolean }> {
        const conditionPrompt = node.config.condition as string;
        const response = await callLLM([{
            role: 'system',
            content: `判断以下条件是否满足。只回答 true 或 false。\n条件：${conditionPrompt}`,
        }, {
            role: 'user',
            content: input,
        }]);
        return { pass: response.trim().toLowerCase() === 'true' };
    }
}
```

**优点：**
- 能理解自然语言输入，处理模糊、非结构化的场景
- 灵活性极高，同样的工作流可以处理各种输入变体
- 不需要预先定义所有可能的分支，AI 自主决策
- 适合快速原型，"Prompt 即逻辑"

**缺点：**
- 输出不确定，同一输入可能产生不同结果
- 延迟高（每次 AI 调用 1-5 秒）
- 成本高（每步调用消耗 Token）
- 调试困难，AI 的"思考过程"不可控
- 不适合对准确性要求 100% 的场景

**适配场景：**
- 内容审核（判断文本/图片是否合规）
- 智能客服路由（理解用户意图后分配）
- 文档摘要 + 分类 + 分发的自动化流水线
- 非结构化数据提取和转换

**局限性：**
- 不适合金融交易、审批决策等对确定性有硬性要求的场景
- AI 的判断缺乏法律效力，关键决策仍需人工确认
- 多步 AI 调用的错误会累积放大

### 方案二：Prompt Chain（提示链）

将复杂任务拆解为多个 AI 步骤，每个步骤有明确的输入输出。

```typescript
// 内容创作工作流：选题 → 大纲 → 正文 → 校对
interface ChainStep {
    name: string;
    prompt: string;
    inputKey: string;   // 从上一步的输出中取哪个字段作为输入
    outputKey: string;   // 输出保存到哪个字段
}

class PromptChain {
    private steps: ChainStep[];

    constructor(steps: ChainStep[]) {
        this.steps = steps;
    }

    async run(initialInput: string): Promise<Record<string, string>> {
        const context: Record<string, string> = { input: initialInput };

        for (const step of this.steps) {
            const inputText = context[step.inputKey] ?? initialInput;
            const filledPrompt = step.prompt.replace('{{input}}', inputText);

            console.log(`[Chain] 执行步骤: ${step.name}`);
            const result = await callLLM([{ role: 'user', content: filledPrompt }], {
                temperature: 0.7,
            });

            context[step.outputKey] = result;
        }

        return context;
    }
}

// 定义创作链
const contentCreationChain = new PromptChain([
    {
        name: '选题分析',
        prompt: `分析以下需求，确定文章的选题角度和目标读者。输出 JSON：
{ "angle": "选题角度", "targetReader": "目标读者", "keywords": ["关键词1", "关键词2"] }
需求：{{input}}`,
        inputKey: 'input',
        outputKey: 'topic',
    },
    {
        name: '大纲生成',
        prompt: `根据以下选题信息，生成文章大纲。每个章节用 ## 标题，附 20 字以内的内容说明。
选题信息：{{input}}`,
        inputKey: 'topic',
        outputKey: 'outline',
    },
    {
        name: '正文撰写',
        prompt: `根据以下大纲，撰写完整的技术博客文章。要求：
1. 语言简洁专业
2. 每个章节 200-400 字
3. 包含代码示例
4. 字数 2000-3000 字

大纲：{{input}}`,
        inputKey: 'outline',
        outputKey: 'article',
    },
    {
        name: '校对润色',
        prompt: `校对以下文章，修复语法错误、不通顺的表述和逻辑问题。直接输出修改后的完整文章。
文章：{{input}}`,
        inputKey: 'article',
        outputKey: 'final',
    },
]);

// 执行
const result = await contentCreationChain.run('写一篇关于 React Server Components 的技术文章');
console.log(result.final); // 最终校对后的文章
```

**优点：**
- 每个步骤职责单一，可独立调试和优化
- 步骤可复用，不同的 Chain 可以共享步骤
- 比 Agent 更可控，输出格式更稳定
- 适合流水线式的处理任务

**缺点：**
- 步骤之间是线性依赖，不支持条件分支和循环
- 每步的输出格式需要严格匹配下一步的输入要求
- 总延迟等于所有步骤延迟之和
- 中间步骤出错会连锁影响后续所有步骤

**适配场景：**
- 内容创作流水线（选题 → 大纲 → 正文 → 校对）
- 数据处理流水线（提取 → 清洗 → 转换 → 格式化）
- 翻译 + 本地化流水线
- 报告生成流水线

**局限性：**
- 不适合需要条件分支的复杂流程
- 缺乏错误恢复机制，一步失败全链失败

### 方案三：可视化 AI 工作流平台（Dify / Coze）

通过拖拽方式搭建 AI 工作流，无需编码。

| 平台 | 特点 | 适用场景 |
|------|------|---------|
| Dify | 开源，可私有部署，支持 LLM 节点、工具节点、条件分支 | 企业内部 AI 应用 |
| Coze（扣子） | 字节出品，插件生态丰富，支持知识库 | 快速搭建 AI Bot |
| Langflow | 开源，LangChain 可视化版 | LangChain 用户 |
| Flowise | 开源，拖拽式 LLM 流程编排 | 低代码 AI 应用 |
| n8n | 开源自动化平台，支持 AI 节点 | 通用自动化 + AI |

**优点：**
- 零代码搭建，非技术人员可参与
- 内置丰富的节点类型（LLM、知识库、代码执行、HTTP 请求）
- 可视化调试，每步的输入输出一目了然
- 快速迭代，修改即生效

**缺点：**
- 定制化能力有限，复杂逻辑难以实现
- 平台绑定，迁移成本高
- 调试能力不如代码，复杂问题排查困难
- 开源方案的自建运维有成本

**适配场景：**
- 快速验证 AI 应用原型
- 非技术团队自助搭建 AI 助手
- 标准化的 AI 工作流（问答、摘要、翻译）

**局限性：**
- 不适合需要精细控制 AI 行为的场景
- 高并发场景性能受限
- 与现有业务系统的深度集成能力有限

## 四、混合工作流：确定性 + AI

**最佳实践：** 传统节点处理确定性逻辑，AI 节点处理模糊逻辑，人工节点兜底。

### 混合工作流引擎实现

```typescript
// 统一的节点类型
type NodeType = 'start' | 'end' | 'condition' | 'ai-judge' | 'ai-generate' | 'tool' | 'human' | 'parallel';

interface WFNode {
    id: string;
    type: NodeType;
    name: string;
    config: Record<string, unknown>;
    next?: string;           // 下一个节点 ID
    branches?: Array<{       // 条件分支
        condition: string;
        target: string;
    }>;
    parallelTargets?: string[];  // 并行执行的节点
}

interface WorkflowResult {
    status: 'completed' | 'paused' | 'error';
    output?: string;
    pausedAt?: string;  // 暂停在哪个节点
    executionLog: Array<{
        nodeId: string;
        nodeName: string;
        type: NodeType;
        input: string;
        output: string;
        duration: number;
    }>;
}

class HybridWorkflowEngine {
    private nodes: Map<string, WFNode>;
    private startNodeId: string;

    constructor(nodes: WFNode[]) {
        this.nodes = new Map(nodes.map(n => [n.id, n]));
        this.startNodeId = nodes.find(n => n.type === 'start')?.id ?? '';
    }

    async run(input: Record<string, unknown>): Promise<WorkflowResult> {
        const log: WorkflowResult['executionLog'] = [];
        let currentId = this.startNodeId;
        let context = { ...input };

        while (currentId) {
            const node = this.nodes.get(currentId);
            if (!node) break;

            const start = Date.now();
            let output: string;

            switch (node.type) {
                case 'start':
                case 'end':
                    currentId = node.next ?? '';
                    continue;

                case 'condition': {
                    // 确定性条件：直接用 JavaScript 表达式判断
                    output = this.evaluateCondition(node.config.expression as string, context);
                    const matchedBranch = node.branches?.find(b => {
                        try {
                            return new Function('ctx', `return ${b.condition}`)(context);
                        } catch { return false; }
                    });
                    currentId = matchedBranch?.target ?? node.next ?? '';
                    break;
                }

                case 'ai-judge': {
                    // AI 判断节点：用 LLM 做模糊判断
                    const prompt = this.fillTemplate(node.config.prompt as string, context);
                    const aiResult = await callLLM([{
                        role: 'system',
                        content: `只回答 YES 或 NO。${node.config.instruction ?? ''}`,
                    }, {
                        role: 'user',
                        content: prompt,
                    }], { temperature: 0 });

                    output = aiResult.trim();
                    const isYes = output.toUpperCase().includes('YES');

                    // AI 判断的结果路由到不同分支
                    const branch = node.branches?.find(b =>
                        (b.condition === 'yes' && isYes) || (b.condition === 'no' && !isYes)
                    );
                    currentId = branch?.target ?? node.next ?? '';
                    break;
                }

                case 'ai-generate': {
                    // AI 生成节点：用 LLM 生成内容
                    const prompt = this.fillTemplate(node.config.prompt as string, context);
                    output = await callLLM([{
                        role: 'system',
                        content: node.config.systemPrompt as string ?? '',
                    }, {
                        role: 'user',
                        content: prompt,
                    }], { temperature: node.config.temperature as number ?? 0.7 });

                    context[node.config.outputKey as string] = output;
                    currentId = node.next ?? '';
                    break;
                }

                case 'tool': {
                    // 工具节点：调用外部 API 或函数
                    const toolName = node.config.tool as string;
                    const toolArgs = this.fillTemplate(node.config.args as string ?? '{}', context);
                    output = await toolImplementations[toolName]?.(JSON.parse(toolArgs)) ?? '工具未找到';
                    context[node.config.outputKey as string] = output;
                    currentId = node.next ?? '';
                    break;
                }

                case 'human': {
                    // 人工节点：暂停工作流，等待外部恢复
                    log.push({
                        nodeId: node.id, nodeName: node.name, type: node.type,
                        input: JSON.stringify(context), output: '等待人工处理',
                        duration: Date.now() - start,
                    });
                    return { status: 'paused', pausedAt: node.id, executionLog: log };
                }

                default:
                    currentId = node.next ?? '';
                    continue;
            }

            log.push({
                nodeId: node.id, nodeName: node.name, type: node.type,
                input: JSON.stringify(context).slice(0, 200),
                output: output?.slice(0, 200) ?? '',
                duration: Date.now() - start,
            });
        }

        return { status: 'completed', output: context.finalOutput, executionLog: log };
    }

    private evaluateCondition(expr: string, ctx: Record<string, unknown>): string {
        try {
            return new Function('ctx', `return ${expr}`)(ctx) ? 'true' : 'false';
        } catch {
            return 'false';
        }
    }

    private fillTemplate(template: string, ctx: Record<string, unknown>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(ctx[key] ?? ''));
    }
}
```

**使用示例：内容审核混合工作流**

```typescript
const contentReviewWorkflow: WFNode[] = [
    { id: 'start', type: 'start', name: '开始', next: 'check_keywords' },
    {
        id: 'check_keywords', type: 'condition', name: '关键词检查',
        config: { expression: "ctx.content.match(/违禁词1|违禁词2|敏感词/g)" },
        branches: [
            { condition: 'true', target: 'rejected' },
            { condition: 'false', target: 'ai_review' },
        ],
    },
    {
        id: 'ai_review', type: 'ai-judge', name: 'AI 合规审查',
        config: {
            prompt: '请审查以下内容是否包含违规、低俗、虚假信息：{{content}}',
            instruction: '如果内容合规回答 YES，如果存在任何违规风险回答 NO',
        },
        branches: [
            { condition: 'yes', target: 'generate_summary' },
            { condition: 'no', target: 'human_review' },
        ],
    },
    {
        id: 'generate_summary', type: 'ai-generate', name: '生成摘要',
        config: {
            prompt: '为以下内容生成 50 字摘要：{{content}}',
            outputKey: 'summary',
            temperature: 0.3,
        },
        next: 'publish',
    },
    { id: 'publish', type: 'tool', name: '发布', config: { tool: 'publishContent' }, next: 'end' },
    { id: 'human_review', type: 'human', name: '人工复审', next: 'end' },
    { id: 'rejected', type: 'end', name: '已拒绝' },
    { id: 'end', type: 'end', name: '结束' },
];

const engine = new HybridWorkflowEngine(contentReviewWorkflow);
const result = await engine.run({ content: '这是一篇关于前端技术的文章...' });
```

**混合工作流的设计原则：**

1. **能用确定性条件的就不用 AI** — 金额判断、状态检查用传统条件节点
2. **AI 做不了 100% 准确的加人工兜底** — 内容审核 AI 判断后再加人工复审
3. **AI 结果必须有结构化输出** — 要求 AI 返回 JSON，解析后走条件分支
4. **关键路径记录完整日志** — 每个节点的输入输出都留存，用于审计和调试

## 五、方案对比

| 维度 | 状态机 | 规则引擎 | BPMN 引擎 | AI Agent | Prompt Chain | 混合工作流 |
|------|--------|---------|----------|---------|-------------|-----------|
| 确定性 | 100% | 100% | 100% | < 95% | < 90% | 可配置 |
| 灵活性 | 低 | 中 | 中 | 极高 | 高 | 高 |
| 可解释性 | 强 | 强 | 强 | 弱 | 中 | 强 |
| 延迟 | < 1ms | < 1ms | < 10ms | 1-10s/步 | 1-5s/步 | 混合 |
| 运行成本 | 几乎为零 | 几乎为零 | 低 | 高（Token） | 高（Token） | 中 |
| 非结构化输入 | 不支持 | 不支持 | 不支持 | 支持 | 支持 | 支持 |
| 学习成本 | 低 | 低 | 高 | 中 | 低 | 中 |
| 推荐场景 | 审批/订单 | 路由/风控 | 企业流程 | 内容/客服 | 创作流水线 | 综合业务 |

## 六、选型决策

```
需求是什么？
├── 确定性流程（审批、状态流转）
│   ├── 简单（< 10 个状态）→ 状态机（XState）
│   ├── 规则多、变化频繁 → 规则引擎
│   └── 跨部门、长周期 → BPMN 引擎
│
├── 模糊性流程（内容审核、意图识别）
│   ├── 单步 AI 决策 → AI 判断节点
│   ├── 多步生成流水线 → Prompt Chain
│   └── 复杂自主决策 → AI Agent
│
└── 既有确定性又有模糊性
    └── 混合工作流（推荐）
        ├── 条件节点：处理确定性逻辑
        ├── AI 节点：处理模糊逻辑
        └── 人工节点：关键决策兜底
```

## 总结

传统工作流和 AI 工作流不是非此即彼的关系：

- **传统工作流**解决的是"规则明确、路径确定"的问题，核心价值是**可靠性和可审计性**
- **AI 工作流**解决的是"规则模糊、路径不确定"的问题，核心价值是**灵活性和智能化**
- **混合工作流**是未来的方向——用传统节点保障可靠性，用 AI 节点处理模糊场景，用人工节点兜底关键决策

选型的核心原则：**能用确定性方案解决的，不要引入 AI；必须用 AI 的，加好兜底和审计。**
