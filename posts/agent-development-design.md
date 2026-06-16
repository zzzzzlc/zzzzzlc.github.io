---
title: AI Agent 开发设计与实战：从架构模式到工程落地
date: '2026-04-28'
tags:
  - AI
  - AI Agent
  - 工程化
category: AI 工程
summary: >-
  从 AI Agent 开发中的架构选型困惑出发，深度对比四种 Agent 设计模式（单 Agent 循环、ReAct、Plan-and-Execute、多
  Agent 协作），结合 LangGraph、Claude Agent SDK、CrewAI
  三大框架的源码级分析，覆盖状态管理、工具设计、记忆系统、可观测性等工程化实践，给出不同业务场景的选型建议与边界。
---

# AI Agent 开发设计与实战：从架构模式到工程落地

## 一、问题来源

当团队从"调 API 写 Prompt"进入 Agent 开发阶段时，会发现问题远比想象中复杂：

**架构选型的困惑：**

- Agent 到底应该怎么设计？是让模型自己循环调用工具，还是用代码编排固定流程？
- 单个 Agent 能力不够，多 Agent 怎么协作？谁调度谁？通信协议怎么定？
- LangGraph、Claude Agent SDK、CrewAI、AutoGen……框架一大堆，每个都说自己好，到底选哪个？

**工程落地的痛点：**

- Agent 执行过程不可控，跑着跑着就"偏了"，错误无法定位和回滚
- Token 消耗爆炸，一个复杂任务跑下来几十万 Token，成本不可接受
- 工具设计不规范，模型经常传错参数、选错工具，甚至调用不存在的工具
- 多轮对话的记忆管理混乱，Agent "忘了"之前的上下文，重复做同样的事
- 没有可观测性，Agent 出了问题只能看日志猜，无法追踪决策链路

**核心问题：Agent 开发不是"给模型加个工具循环"这么简单。它是一个系统设计问题——涉及架构模式、状态管理、错误恢复、成本控制、可观测性等多个维度。理解设计模式的取舍，才能在正确的场景做出正确的架构选择。**

---

## 二、Agent 架构设计模式

### 2.1 模式一：单 Agent 工具循环（Tool Loop）

最基础的模式：LLM 作为"大脑"，在循环中自主决定是否调用工具。

```
架构流程：

用户输入 → System Prompt + 工具列表
              ↓
         ┌─────────────┐
         │  LLM 推理    │ ←──────────┐
         └──────┬──────┘             │
                │                    │
         ┌──────▼──────┐             │
         │ 需要调工具？  │             │
         └──────┬──────┘             │
           No   │   Yes              │
           ↓    │    ↓               │
        返回结果 │  执行工具 ──────────┘
                │    ↓
                │  工具结果加入上下文
                │    ↓
                └──→ 继续推理
```

**实现代码：**

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools: Tool[];
  maxIterations: number;
}

async function toolLoopAgent(
  userMessage: string,
  config: AgentConfig,
): Promise<string> {
  const messages: Array<Record<string, any>> = [
    { role: 'system', content: config.systemPrompt },
    { role: 'user', content: userMessage },
  ];

  for (let i = 0; i < config.maxIterations; i++) {
    // 1. LLM 推理
    const response = await callLLM({
      model: config.model,
      messages,
      tools: config.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    });

    const assistantMsg = response.choices[0].message;
    messages.push(assistantMsg);

    // 2. 检查是否需要调用工具
    if (!assistantMsg.tool_calls?.length) {
      return assistantMsg.content; // 无工具调用，返回最终结果
    }

    // 3. 执行所有工具调用
    for (const toolCall of assistantMsg.tool_calls) {
      const tool = config.tools.find(t => t.name === toolCall.function.name);
      if (!tool) {
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `错误：未知工具 "${toolCall.function.name}"`,
        });
        continue;
      }

      const args = JSON.parse(toolCall.function.arguments);
      const result = await tool.execute(args);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });
    }
    // 4. 继续循环，让 LLM 基于工具结果继续推理
  }

  return '达到最大迭代次数，任务未完成';
}
```

**优点：**

- 实现最简单，几十行代码即可跑通
- 模型自主决策，灵活度高
- 适合快速验证 Agent 是否能解决当前问题

**缺点：**

- 循环不可控，可能无限调用或走偏
- 没有全局规划，模型"走一步看一步"
- 错误恢复困难，某一步出错后续全部跑偏
- Token 消耗不可预测，复杂任务可能爆炸

**适配场景：** 简单的 QA + 工具调用，如客服查询订单、数据查询助手

**局限性：** 不适合需要多步骤规划、严格流程控制、或高可靠性的生产场景

---

### 2.2 模式二：ReAct（推理 + 行动）

在工具循环基础上，要求模型在每一步显式输出思考过程。

```
架构流程：

用户问题
  ↓
Thought: 分析问题，决定下一步 ──→ 需要信息？──→ Action: 调用工具
  ↑                                              ↓
  │                                        Observation: 工具结果
  │                                              ↓
  └────── 继续推理 ←────────────────────────────┘
  ↓
Thought: 信息足够，可以回答
  ↓
Final Answer: 最终答案
```

**实现代码：**

```typescript
const REACT_PROMPT = `你是一个智能助手，通过 Thought-Action-Observation 循环解决问题。

严格按以下格式输出，每次只输出一步：

Thought: 分析当前状态，决定下一步
Action: 工具名(参数JSON)
Observation: (由系统填入工具结果)

循环直到获得最终答案：

Thought: (分析观察结果)
Final Answer: 最终答案

可用工具：
{tools_description}

重要规则：
1. 每次只调用一个工具
2. Action 中的参数必须是合法 JSON
3. 如果已有足够信息，直接给出 Final Answer`;

async function reactAgent(
  question: string,
  tools: Tool[],
  maxSteps = 10,
): Promise<{ answer: string; trace: string[] }> {
  const toolsDesc = tools.map(t =>
    `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters)}`
  ).join('\n');

  const messages = [
    { role: 'system', content: REACT_PROMPT.replace('{tools_description}', toolsDesc) },
    { role: 'user', content: question },
  ];

  const trace: string[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const response = await callLLM({ model: 'gpt-4o', messages });
    const content = response.choices[0].message.content;
    messages.push({ role: 'assistant', content });
    trace.push(`[Step ${step + 1}]\n${content}`);

    // 检查是否有 Final Answer
    const finalMatch = content.match(/Final Answer:\s*([\s\S]+)$/);
    if (finalMatch) {
      return { answer: finalMatch[1].trim(), trace };
    }

    // 解析 Action
    const actionMatch = content.match(/Action:\s*(\w+)\(([\s\S]+?)\)\s*$/m);
    if (!actionMatch) continue; // 没有 Action，继续推理

    const toolName = actionMatch[1];
    const toolArgs = JSON.parse(actionMatch[2]);
    const tool = tools.find(t => t.name === toolName);

    const observation = tool
      ? await tool.execute(toolArgs)
      : `错误：未知工具 "${toolName}"`;

    const obsMessage = `Observation: ${observation}`;
    messages.push({ role: 'user', content: obsMessage });
    trace.push(obsMessage);
  }

  return { answer: '未能完成推理', trace };
}
```

**优点：**

- 推理过程完全可观测，便于调试和审计
- 模型被迫"先想再做"，减少盲目调用工具
- 兼容所有 LLM（不依赖 Function Calling）

**缺点：**

- Token 消耗大，每步都要输出 Thought + Action + Observation
- 解析文本格式容易出错（模型不一定严格按格式输出）
- 推理步骤串行，无法并行调用工具

**适配场景：** 需要推理过程可审计的场景（如法律分析、医疗诊断辅助）、调试阶段

**局限性：** 生产环境效率低，适合作为开发调试工具，不建议直接用于高并发场景

---

### 2.3 模式三：Plan-and-Execute（规划 + 执行）

将"规划"和"执行"分离：先用 LLM 生成完整计划，再逐步执行。

```
架构流程：

用户问题
  ↓
┌─────────────────────────────────────────┐
│  Planner（规划器）                        │
│  输入：用户问题 + 可用工具列表              │
│  输出：有序步骤列表                        │
│                                          │
│  Step 1: 查询用户订单信息                  │
│  Step 2: 根据订单金额计算退款              │
│  Step 3: 调用退款接口                     │
│  Step 4: 发送退款通知邮件                  │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│  Executor（执行器）                       │
│  逐步执行计划中的每个步骤                   │
│                                          │
│  Step 1 → tool: query_order → 结果       │
│  Step 2 → tool: calculate → 结果          │
│  Step 3 → tool: refund → 结果             │
│  Step 4 → tool: send_email → 结果         │
│                                          │
│  如果某步失败 → Replanner 重新规划后续步骤  │
└─────────────────────────────────────────┘
                ↓
            最终结果
```

**实现代码：**

```typescript
interface PlanStep {
  id: number;
  action: string;
  tool: string;
  args: Record<string, unknown>;
  dependsOn: number[]; // 依赖的前置步骤
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: string;
}

interface Plan {
  goal: string;
  steps: PlanStep[];
}

// 规划器：生成执行计划
async function planner(
  userGoal: string,
  tools: Tool[],
  context?: string,
): Promise<Plan> {
  const toolsDesc = tools.map(t =>
    `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters)}`
  ).join('\n');

  const response = await callLLM({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `你是一个任务规划器。根据用户目标，生成一个分步执行计划。

规则：
1. 每步只调用一个工具
2. 如果某步依赖前一步的结果，在 dependsOn 中标注
3. 按依赖关系排序步骤
4. 严格以 JSON 格式输出

可用工具：
${toolsDesc}`,
      },
      {
        role: 'user',
        content: `目标：${userGoal}\n${context ? `上下文：${context}` : ''}`,
      },
    ],
    temperature: 0.1,
  });

  // 解析计划
  const jsonMatch = response.choices[0].message.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('规划失败：无法解析计划');

  const plan = JSON.parse(jsonMatch[0]);
  plan.steps = plan.steps.map((s: any, i: number) => ({
    ...s,
    id: i,
    status: 'pending',
  }));
  return plan;
}

// 执行器：逐步执行计划
async function executor(
  plan: Plan,
  tools: Tool[],
  onStepComplete?: (step: PlanStep) => void,
): Promise<{ result: string; steps: PlanStep[] }> {
  const results = new Map<number, string>();

  for (const step of plan.steps) {
    // 检查依赖是否完成
    const depsReady = step.dependsOn.every(id => results.has(id));
    if (!depsReady) {
      step.status = 'failed';
      continue;
    }

    step.status = 'running';

    // 替换参数中的依赖引用
    const resolvedArgs = resolveArgs(step.args, results);

    const tool = tools.find(t => t.name === step.tool);
    if (!tool) {
      step.status = 'failed';
      step.result = `未知工具: ${step.tool}`;
      continue;
    }

    try {
      step.result = await tool.execute(resolvedArgs);
      step.status = 'done';
      results.set(step.id, step.result);
      onStepComplete?.(step);
    } catch (err) {
      step.status = 'failed';
      step.result = `执行失败: ${err}`;
      // 某步失败时，可以选择重新规划后续步骤
    }
  }

  // 汇总结果
  const finalResult = plan.steps
    .filter(s => s.status === 'done')
    .map(s => `步骤 ${s.id + 1} (${s.action}): ${s.result}`)
    .join('\n');

  return { result: finalResult, steps: plan.steps };
}

// 参数中引用前置步骤结果的工具函数
function resolveArgs(
  args: Record<string, unknown>,
  results: Map<number, string>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.startsWith('$step_')) {
      const stepId = parseInt(value.replace('$step_', ''), 10);
      resolved[key] = results.get(stepId) ?? value;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}
```

**优点：**

- 全局规划，步骤有依赖关系，执行有序
- 计划可审核、可修改，生产环境可控性强
- 某步失败可重新规划后续步骤，容错性好
- 可并行执行无依赖的步骤

**缺点：**

- 规划质量依赖 LLM 能力，复杂任务可能规划不合理
- 两阶段设计（规划 + 执行）增加了一次 LLM 调用的成本
- 计划可能过于刚性，无法应对执行过程中的意外情况

**适配场景：** 工作流自动化（审批、数据处理、报告生成）、需要流程审核的生产场景

**局限性：** 对实时交互和灵活应变的场景不够灵活，适合流程相对固定的任务

---

### 2.4 模式四：多 Agent 协作（Multi-Agent）

多个 Agent 各司其职，通过消息传递协作完成复杂任务。

```
架构流程（以客服系统为例）：

用户问题
  ↓
┌─────────────────────────────────────────────┐
│  Router Agent（路由 Agent）                   │
│  职责：分析意图，分配给合适的 Agent            │
│  ─────────────────────────────────────────── │
│  输入：用户消息                                │
│  输出：分配给 → 退款Agent / 技术支持Agent       │
└──────────────┬──────────────────────────────┘
               ↓
    ┌──────────┼──────────┐
    ↓          ↓          ↓
┌────────┐ ┌────────┐ ┌────────────┐
│退款Agent│ │技术Agent│ │投诉Agent    │
│        │ │        │ │            │
│查订单   │ │查知识库 │ │记录工单     │
│算金额   │ │给方案   │ │升级处理     │
│调退款API│ │验证结果 │ │通知负责人   │
└────┬───┘ └────┬───┘ └─────┬──────┘
     ↓          ↓          ↓
┌─────────────────────────────────────────────┐
│  Summarizer Agent（汇总 Agent）               │
│  职责：汇总各 Agent 结果，生成最终回复         │
└─────────────────────────────────────────────┘
               ↓
           返回用户
```

**实现代码：**

```typescript
// Agent 定义
interface AgentDef {
  name: string;
  role: string;
  systemPrompt: string;
  tools: Tool[];
}

// 消息总线：Agent 间通信
class MessageBus {
  private messages: Array<{
    from: string;
    to: string;
    type: string;
    content: string;
    timestamp: number;
  }> = [];

  send(from: string, to: string, type: string, content: string) {
    this.messages.push({
      from, to, type, content, timestamp: Date.now(),
    });
  }

  receive(agentName: string): Array<{ from: string; type: string; content: string }> {
    return this.messages
      .filter(m => m.to === agentName || m.to === '*')
      .map(m => ({ from: m.from, type: m.type, content: m.content }));
  }
}

// 多 Agent 编排器
class MultiAgentOrchestrator {
  private agents: Map<string, AgentDef> = new Map();
  private bus = new MessageBus();

  registerAgent(agent: AgentDef) {
    this.agents.set(agent.name, agent);
  }

  async run(userMessage: string): Promise<string> {
    // 1. Router Agent 分析意图，决定分配
    const router = this.agents.get('router')!;
    const routeResult = await callLLM({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: router.systemPrompt },
        { role: 'user', content: `分析以下消息，决定分配给哪个 Agent。\n可用 Agent: ${[...this.agents.keys()].filter(k => k !== 'router' && k !== 'summarizer').join(', ')}\n\n用户消息: ${userMessage}` },
      ],
      temperature: 0,
    });

    const targetAgentName = routeResult.choices[0].message.content.trim();
    this.bus.send('router', targetAgentName, 'task', userMessage);

    // 2. 目标 Agent 执行任务
    const targetAgent = this.agents.get(targetAgentName);
    if (!targetAgent) {
      return `无法处理的请求类型：${targetAgentName}`;
    }

    const agentResult = await toolLoopAgent(userMessage, {
      model: 'gpt-4o',
      systemPrompt: targetAgent.systemPrompt,
      tools: targetAgent.tools,
      maxIterations: 8,
    });

    this.bus.send(targetAgentName, 'summarizer', 'result', agentResult);

    // 3. Summarizer Agent 汇总结果
    const summarizer = this.agents.get('summarizer')!;
    const summary = await callLLM({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: summarizer.systemPrompt },
        { role: 'user', content: `请根据以下处理结果，生成给用户的回复：\n${agentResult}` },
      ],
    });

    return summary.choices[0].message.content;
  }
}

// 使用示例
const orchestrator = new MultiAgentOrchestrator();

orchestrator.registerAgent({
  name: 'router',
  role: '路由',
  systemPrompt: '你是客服路由 Agent。分析用户意图，分配给合适的 Agent。',
  tools: [],
});

orchestrator.registerAgent({
  name: 'refund_agent',
  role: '退款处理',
  systemPrompt: '你是退款处理 Agent。帮用户查询订单、计算退款金额、发起退款。',
  tools: [queryOrderTool, calculateRefundTool, processRefundTool],
});

orchestrator.registerAgent({
  name: 'tech_agent',
  role: '技术支持',
  systemPrompt: '你是技术支持 Agent。帮用户排查技术问题。',
  tools: [searchKnowledgeBaseTool, checkSystemStatusTool],
});

orchestrator.registerAgent({
  name: 'summarizer',
  role: '汇总',
  systemPrompt: '你是汇总 Agent。将其他 Agent 的处理结果整理为用户友好的回复。',
  tools: [],
});

const result = await orchestrator.run('我要退款，订单号是 ORD-12345');
```

**优点：**

- 单一职责，每个 Agent 专注于一个领域，工具集精简，准确率更高
- 可独立开发、测试、部署，团队协作友好
- 弹性扩展，新增场景只需新增 Agent
- 不同 Agent 可用不同模型（路由用小模型，核心用大模型）

**缺点：**

- 系统复杂度大幅增加，调试和追踪困难
- Agent 间通信和状态同步容易出错
- 路由 Agent 决策错误会导致整个流程跑偏
- 多次 LLM 调用叠加，延迟和成本都高

**适配场景：** 大型客服系统、企业级自动化平台、需要多领域专家协作的复杂任务

**局限性：** 不适合简单场景——杀鸡用牛刀。3 个工具以内的问题用单 Agent 即可

---

### 2.5 四种模式对比

| 维度 | 单 Agent 循环 | ReAct | Plan-and-Execute | 多 Agent 协作 |
|------|-------------|-------|-------------------|--------------|
| **复杂度** | 低 | 中 | 中高 | 高 |
| **可控性** | 低 | 中 | 高 | 中 |
| **可观测性** | 低 | 高 | 高 | 中（需额外追踪） |
| **灵活性** | 高 | 高 | 中 | 高 |
| **Token 成本** | 不确定 | 高 | 中 | 高 |
| **错误恢复** | 难 | 中 | 容易（重新规划） | 中（Agent 级重试） |
| **并行能力** | 无 | 无 | 可并行无依赖步骤 | 天然支持 |
| **调试难度** | 低 | 低 | 中 | 高 |
| **推荐场景** | 简单工具调用 | 调试/审计 | 工作流自动化 | 大型系统 |

---

## 三、开发框架对比

### 3.1 LangGraph — 图驱动的状态机

**定位：** 基于"图"概念的 Agent 编排框架，将 Agent 流程建模为有向图（节点 + 边），内置状态管理和持久化。

```
核心概念：

Node（节点）= 一个处理步骤（LLM 调用、工具执行、条件判断）
Edge（边）= 节点间的流转规则（固定 / 条件分支）
State（状态）= 在节点间流转的共享数据对象

┌──────────┐    ┌──────────┐    ┌──────────┐
│  节点 A   │───→│  条件判断  │───→│  节点 B   │
│ (分析意图) │    │ (分支路由) │    │ (执行工具) │
└──────────┘    └─────┬────┘    └──────────┘
                      │
                      ↓
                ┌──────────┐
                │  节点 C   │
                │ (返回结果) │
                └──────────┘
```

**核心源码解析：**

```python
# langgraph/graph/state.py — 状态图的核心实现
class StateGraph:
    def __init__(self, state_schema):
        self.nodes = {}        # 节点注册表
        self.edges = {}        # 固定边
        self conditional_edges = []  # 条件边
        self.state_schema = state_schema

    def add_node(self, name, action):
        """注册节点：action 是接收 state、返回 state 更新的函数"""
        self.nodes[name] = action

    def add_edge(self, from_node, to_node):
        """固定边：从 from_node 永远到 to_node"""
        self.edges[from_node] = to_node

    def add_conditional_edges(self, from_node, condition_fn, mapping):
        """条件边：根据 condition_fn 的返回值路由到不同节点"""
        self.conditional_edges.append({
            'from': from_node,
            'condition': condition_fn,
            'mapping': mapping,  # {返回值: 目标节点}
        })

    def compile(self):
        """编译为可执行的状态机"""
        return CompiledGraph(self)

# langgraph/graph/state.py — 状态机执行引擎
class CompiledGraph:
    def __init__(self, graph):
        self.graph = graph
        self.checkpointer = None  # 可选的持久化后端

    async def invoke(self, input_state, config=None):
        """执行状态机"""
        state = input_state
        current_node = self._get_entry_point()

        while current_node != END:
            # 1. 执行当前节点
            node_action = self.graph.nodes[current_node]
            state_update = await node_action(state)
            state.update(state_update)

            # 2. 持久化状态（如果配置了 checkpointer）
            if self.checkpointer:
                await self.checkpointer.save(state, current_node)

            # 3. 决定下一个节点
            current_node = self._get_next_node(current_node, state)

        return state

    def _get_next_node(self, current_node, state):
        # 优先检查条件边
        for edge in self.graph.conditional_edges:
            if edge['from'] == current_node:
                result = edge['condition'](state)
                return edge['mapping'].get(result, END)
        # 再检查固定边
        return self.graph.edges.get(current_node, END)
```

**实战：客服退款 Agent（Plan-and-Execute 模式）**

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

# 1. 定义状态
class RefundState(TypedDict):
    messages: list          # 对话历史
    order_info: dict | None # 订单信息
    refund_amount: float    # 退款金额
    refund_status: str      # 退款状态
    current_step: str       # 当前步骤

# 2. 定义节点
async def analyze_intent(state: RefundState) -> dict:
    """分析用户意图"""
    last_message = state['messages'][-1]
    response = await call_llm(
        f"分析用户意图并提取订单号：{last_message}"
    )
    return {'current_step': 'query_order'}

async def query_order(state: RefundState) -> dict:
    """查询订单"""
    order_info = await query_order_api(state['messages'][-1])
    if not order_info:
        return {'current_step': 'failed', 'refund_status': '订单不存在'}
    return {'order_info': order_info, 'current_step': 'calculate'}

async def calculate_refund(state: RefundState) -> dict:
    """计算退款金额"""
    order = state['order_info']
    amount = order['price'] * order['quantity']
    return {'refund_amount': amount, 'current_step': 'confirm'}

async def confirm_refund(state: RefundState) -> dict:
    """确认退款"""
    result = await process_refund_api(state['order_info']['id'], state['refund_amount'])
    return {'refund_status': 'success' if result else 'failed', 'current_step': 'done'}

# 3. 路由函数
def route_step(state: RefundState) -> str:
    return state['current_step']

# 4. 构建图
graph = StateGraph(RefundState)

graph.add_node('analyze', analyze_intent)
graph.add_node('query_order', query_order)
graph.add_node('calculate', calculate_refund)
graph.add_node('confirm', confirm_refund)

graph.set_entry_point('analyze')

graph.add_conditional_edges('analyze', route_step, {
    'query_order': 'query_order',
    'failed': END,
})
graph.add_conditional_edges('query_order', route_step, {
    'calculate': 'calculate',
    'failed': END,
})
graph.add_edge('calculate', 'confirm')
graph.add_edge('confirm', END)

# 5. 编译执行
app = graph.compile()
result = await app.invoke({
    'messages': ['我要退款，订单号 ORD-12345'],
    'order_info': None,
    'refund_amount': 0,
    'refund_status': '',
    'current_step': '',
})
```

**优点：** 状态管理清晰、可视化流程图、内置持久化和回放、支持人工介入（Human-in-the-loop）

**缺点：** 学习曲线较陡、Python 生态为主、图的定义和调试有一定复杂度

**适配场景：** 需要严格流程控制和状态持久化的生产级 Agent

---

### 3.2 Claude Agent SDK — Claude 官方 Agent 开发套件

**定位：** Anthropic 官方提供的 Agent SDK，原生支持 Claude 的工具调用、多轮对话、Agent 间协作。

```
核心概念：

Agent = 定义角色 + 工具集 + 系统提示的独立执行单元
Tool = Agent 可调用的函数（由开发者实现逻辑）
Handoff = Agent 间交接任务的机制（多 Agent 协作）

特点：
1. 原生 Claude 集成，工具调用准确率高
2. TypeScript 原生支持，前后端统一语言
3. 内置 guardrails（安全护栏）机制
4. 轻量设计，不捆绑状态管理（可自行选择方案）
```

**核心代码解析：**

```typescript
// @anthropic-ai/agent-sdk 核心结构
import { Agent, Tool, handoff, run } from '@anthropic-ai/agent-sdk';

// 1. 定义工具
const queryOrderTool: Tool = {
  name: 'query_order',
  description: '根据订单号查询订单详情',
  input_schema: {
    type: 'object' as const,
    properties: {
      orderId: {
        type: 'string' as const,
        description: '订单号，格式 ORD-XXXXX',
      },
    },
    required: ['orderId'],
  },
  execute: async ({ orderId }) => {
    const order = await db.orders.findById(orderId);
    return order ? JSON.stringify(order) : '订单不存在';
  },
};

const refundTool: Tool = {
  name: 'process_refund',
  description: '发起退款',
  input_schema: {
    type: 'object' as const,
    properties: {
      orderId: { type: 'string' as const },
      amount: { type: 'number' as const },
      reason: { type: 'string' as const },
    },
    required: ['orderId', 'amount'],
  },
  execute: async ({ orderId, amount, reason }) => {
    const result = await refundService.create({ orderId, amount, reason });
    return JSON.stringify(result);
  },
};

// 2. 定义 Agent
const refundAgent = new Agent({
  name: '退款专家',
  model: 'claude-sonnet-4-6',
  instructions: `你是退款处理专家。处理用户退款请求。

工作流程：
1. 先查询订单信息，确认订单存在且可退款
2. 根据订单金额和退款政策计算退款金额
3. 确认后发起退款

注意：
- 超过 30 天的订单需要特殊审批
- 部分退款需要说明原因`,
  tools: [queryOrderTool, refundTool],
});

const techSupportAgent = new Agent({
  name: '技术支持',
  model: 'claude-sonnet-4-6',
  instructions: '你是技术支持专家。帮助用户排查技术问题。',
  tools: [searchKnowledgeBaseTool, checkStatusTool],
});

// 3. 定义路由 Agent（含 Handoff）
const routerAgent = new Agent({
  name: '客服路由',
  model: 'claude-haiku-4-5', // 路由用轻量模型，节省成本
  instructions: `你是客服路由 Agent。根据用户意图将请求分配给合适的专家。
- 退款相关 → 转交退款专家
- 技术问题 → 转交技术支持
- 其他问题 → 直接回答`,
  handoffs: [
    handoff(refundAgent, '用户提到退款、退货、订单问题'),
    handoff(techSupportAgent, '用户提到技术问题、报错、故障'),
  ],
});

// 4. 运行
const result = await run(routerAgent, [
  { role: 'user', content: '订单 ORD-12345 要退款，买了 5 天了' },
]);

console.log(result.finalOutput);
// 路由 Agent → 判断是退款 → handoff 到 refundAgent → 查询订单 → 发起退款 → 返回结果
```

**优点：** Claude 原生集成最佳、TypeScript 友好、Handoff 机制简洁、轻量不捆绑

**缺点：** 绑定 Claude 模型、生态较新社区资源少、无内置持久化

**适配场景：** 使用 Claude 模型的团队、需要快速搭建多 Agent 系统

---

### 3.3 CrewAI — 角色驱动的多 Agent 框架

**定位：** 以"角色"和"任务"为核心抽象的多 Agent 框架，强调 Agent 间的自然语言协作。

```
核心概念：

Agent = 一个角色（有目标、背景故事、工具集）
Task = 一个具体任务（有描述、期望输出、负责 Agent）
Crew = 一组 Agent 的编队（定义协作流程：串行 / 并行 / 分层）

执行流程：
1. 定义 Agents（角色）
2. 定义 Tasks（任务）
3. 组建 Crew（编队）
4. 启动执行
```

**实战代码：**

```python
from crewai import Agent, Task, Crew, Process

# 1. 定义 Agent
researcher = Agent(
    role='市场研究员',
    goal='收集和分析市场数据',
    backstory='你是一位经验丰富的市场研究员，擅长数据收集和趋势分析。',
    tools=[search_web_tool, analyze_data_tool],
    verbose=True,
)

writer = Agent(
    role='内容编辑',
    goal='将研究结果整理为专业的报告',
    backstory='你是一位技术写作专家，擅长将复杂数据转化为易读报告。',
    tools=[write_file_tool],
    verbose=True,
)

reviewer = Agent(
    role='质量审核',
    goal='审核报告的准确性和完整性',
    backstory='你是质量审核专家，确保报告准确无误。',
    verbose=True,
)

# 2. 定义 Task
research_task = Task(
    description='研究 {topic} 的市场现状、主要竞争对手和趋势',
    agent=researcher,
    expected_output='包含数据支撑的市场分析报告',
)

write_task = Task(
    description='基于研究结果撰写一份完整的市场分析报告',
    agent=writer,
    expected_output='结构化的 Markdown 格式报告',
)

review_task = Task(
    description='审核报告的数据准确性、逻辑完整性和格式规范',
    agent=reviewer,
    expected_output='审核意见和修改建议',
)

# 3. 组建 Crew
crew = Crew(
    agents=[researcher, writer, reviewer],
    tasks=[research_task, write_task, review_task],
    process=Process.sequential,  # 串行执行
    verbose=True,
)

# 4. 启动
result = crew.kickoff(inputs={'topic': '2026 年 AI Agent 市场'})
```

**优点：** 上手最快、角色扮演降低设计门槛、Python 生态、内置任务委派和结果传递

**缺点：** 灵活性不如 LangGraph、Python-only、缺乏精细的状态管理和持久化

**适配场景：** 快速原型验证、内容生产流水线、研究分析任务

---

### 3.4 框架综合对比

| 维度 | LangGraph | Claude Agent SDK | CrewAI |
|------|-----------|-----------------|--------|
| **语言** | Python | TypeScript | Python |
| **核心理念** | 图驱动的状态机 | Claude 原生 Agent | 角色驱动的多 Agent |
| **学习曲线** | 高 | 中 | 低 |
| **灵活性** | 最高 | 高 | 中 |
| **状态管理** | 内置（可持久化） | 无内置 | 无内置 |
| **可观测性** | 图可视化 + 回放 | 基础日志 | 基础日志 |
| **多 Agent** | 手动编排 | Handoff 机制 | Crew 编队 |
| **模型绑定** | 任意模型 | Claude | 任意模型 |
| **生产就绪度** | 高 | 中 | 中 |
| **社区活跃度** | 高 | 中（较新） | 中 |

---

## 四、工程化实践

### 4.1 工具设计原则

工具是 Agent 与外部世界的接口，设计好坏直接决定 Agent 的可靠性。

```
工具设计五原则：

1. 原子性 — 每个工具只做一件事
   ✅ query_order(orderId) → 查询订单
   ✅ process_refund(orderId, amount) → 发起退款
   ❌ handle_order_and_refund(orderId) → 混合了查询和操作

2. 描述精确 — 工具描述是模型选工具的唯一依据
   ❌ "查询数据"
   ✅ "根据订单号查询订单详情，返回订单状态、金额、商品列表"

3. 参数校验 — 在工具内部做安全校验
   ✅ SQL 工具只允许 SELECT
   ✅ 文件操作工具限制路径范围

4. 错误友好 — 返回模型能理解的错误信息
   ❌ throw new Error('ECONNREFUSED')
   ✅ return '数据库连接失败，请稍后重试'

5. 数量精简 — 不超过 10 个工具
   工具越多，模型选错概率越高
```

### 4.2 记忆系统

```
记忆层次设计：

┌─────────────────────────────────────────┐
│  工作记忆（Working Memory）              │
│  存储：当前对话的上下文窗口               │
│  特点：容量有限，随对话结束消失            │
│  实现：LLM 的 messages 数组              │
├─────────────────────────────────────────┤
│  短期记忆（Short-term Memory）           │
│  存储：当前会话的关键信息摘要              │
│  特点：会话级持久化，控制 Token 用量       │
│  实现：滑动窗口 + 摘要压缩                │
├─────────────────────────────────────────┤
│  长期记忆（Long-term Memory）            │
│  存储：跨会话的用户偏好、历史交互          │
│  特点：持久化存储，语义检索               │
│  实现：向量数据库 + 用户画像              │
└─────────────────────────────────────────┘
```

```typescript
// 记忆管理器实现
class AgentMemory {
  // 短期记忆：滑动窗口 + 摘要
  async buildContext(
    sessionId: string,
    newMessage: string,
    maxTokens = 4000,
  ): Promise<Array<{ role: string; content: string }>> {
    const history = await this.getSessionHistory(sessionId);
    const messages = [...history, { role: 'user', content: newMessage }];

    // Token 估算
    const totalTokens = this.estimateTokens(messages);

    if (totalTokens > maxTokens) {
      // 压缩早期对话为摘要
      const recent = messages.slice(-6);
      const old = messages.slice(0, -6);

      const summary = await callLLM({
        model: 'gpt-4o-mini', // 用小模型做摘要，节省成本
        messages: [{
          role: 'user',
          content: `用 200 字概括以下对话关键信息：\n${
            old.map(m => `${m.role}: ${m.content}`).join('\n')
          }`,
        }],
      });

      return [
        { role: 'system', content: `之前的对话摘要：${summary}` },
        ...recent,
      ];
    }

    return messages;
  }

  // 长期记忆：检索相关历史
  async recallRelevant(
    userId: string,
    query: string,
    topK = 3,
  ): Promise<string[]> {
    const embedding = await embed(query);
    const results = await this.vectorStore.search(embedding, topK);
    return results.map(r => r.content);
  }
}
```

### 4.3 成本控制

```
Agent 成本优化的四个维度：

1. 模型分层调用
   ┌────────────────────────────────────┐
   │ 路由/分类/摘要 → 小模型 (Haiku)     │ 成本：$0.25/1M tokens
   │ 核心推理/规划   → 中模型 (Sonnet)    │ 成本：$3/1M tokens
   │ 复杂判断/审核   → 大模型 (Opus)      │ 成本：$15/1M tokens
   └────────────────────────────────────┘

2. 上下文压缩
   - 工具结果截断：只保留关键信息，不超过 500 Token
   - 对话摘要：定期压缩历史对话
   - 检索过滤：只注入相关度最高的 Top-K 文档

3. 缓存策略
   - 相同问题 + 相同工具结果 → 缓存最终回答
   - 工具调用结果缓存（如订单查询，5 分钟内复用）
   - 语义缓存（相似问题命中缓存）

4. 执行预算
   - 设置单次任务最大 Token 限制
   - 设置最大工具调用次数
   - 超预算自动降级（返回中间结果）
```

```typescript
// 成本追踪中间件
class CostTracker {
  private spendHistory: Array<{ task: string; tokens: number; cost: number }> = [];

  async trackLLMCall(
    task: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<number> {
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-haiku-4-5': { input: 0.25, output: 1.25 },
      'claude-sonnet-4-6': { input: 3, output: 15 },
      'claude-opus-4-6': { input: 15, output: 75 },
    };

    const price = pricing[model] || pricing['claude-sonnet-4-6'];
    const cost = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;

    this.spendHistory.push({ task, tokens: inputTokens + outputTokens, cost });

    // 预算告警
    const dailyTotal = this.getDailyTotal();
    if (dailyTotal > 10) { // 日预算 $10
      console.warn(`日预算已超：$${dailyTotal.toFixed(2)}`);
    }

    return cost;
  }

  getDailyTotal(): number {
    const today = new Date().toDateString();
    return this.spendHistory
      .filter(s => new Date(s.task).toDateString() === today)
      .reduce((sum, s) => sum + s.cost, 0);
  }
}
```

### 4.4 可观测性

```
可观测性三层架构：

1. Tracing（链路追踪）
   记录 Agent 每一步的输入/输出/耗时/Token 用量

   Trace: user-query-001
   ├── Span: router_agent (120ms, 150 tokens)
   │   └── Output: route → refund_agent
   ├── Span: refund_agent (3500ms, 2800 tokens)
   │   ├── Tool: query_order (200ms)
   │   ├── Tool: calculate_refund (50ms)
   │   └── Tool: process_refund (500ms)
   └── Span: summarizer (300ms, 400 tokens)

2. Logging（结构化日志）
   每次工具调用、状态变更、错误都记录结构化日志

3. Metrics（指标监控）
   - 工具调用成功率
   - 平均任务完成时间
   - Token 消耗趋势
   - 模型响应延迟 P99
```

```typescript
// 链路追踪实现
class AgentTracer {
  private traces: Map<string, Trace> = new Map();

  startTrace(traceId: string, input: string) {
    this.traces.set(traceId, {
      id: traceId,
      input,
      spans: [],
      startTime: Date.now(),
    });
  }

  startSpan(traceId: string, name: string, type: 'agent' | 'tool' | 'llm') {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.spans.push({
      name, type,
      startTime: Date.now(),
      status: 'running',
    });
  }

  endSpan(traceId: string, name: string, output: string, tokens?: number) {
    const trace = this.traces.get(traceId);
    const span = trace?.spans.find(s => s.name === name && s.status === 'running');
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.output = output;
    span.tokens = tokens;
    span.status = 'done';
  }

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }
}
```

---

## 五、选型决策树

```
需要开发 AI Agent
    │
    ├─ 简单场景（1-3 个工具，单步调用）？
    │   └─ ✅ 单 Agent 工具循环
    │       └─ 手写循环 / Claude Agent SDK
    │
    ├─ 需要推理过程可审计？
    │   └─ ✅ ReAct 模式
    │       └─ 用于调试、法律/医疗等合规场景
    │
    ├─ 固定工作流，步骤明确？
    │   └─ ✅ Plan-and-Execute / LangGraph
    │       └─ 状态图 + 持久化 + 人工介入
    │
    ├─ 多领域专家协作？
    │   └─ ✅ 多 Agent 协作
    │       ├─ Claude Agent SDK（TypeScript + Handoff）
    │       └─ CrewAI（Python + 角色驱动）
    │
    ├─ 团队主语言？
    │   ├─ TypeScript → Claude Agent SDK
    │   └─ Python → LangGraph / CrewAI
    │
    └─ 生产级要求（持久化、回放、人工介入）？
        └─ ✅ LangGraph
            └─ 图可视化 + 状态持久化 + 完善的执行引擎
```

---

## 六、总结

| 场景 | 推荐模式 | 推荐框架 | 原因 |
|------|---------|---------|------|
| 简单工具调用 | 单 Agent 循环 | Claude Agent SDK | 轻量、快速验证 |
| 需要可审计推理 | ReAct | 手写实现 | 推理过程透明 |
| 工作流自动化 | Plan-and-Execute | LangGraph | 流程可控、状态持久 |
| 内容生产流水线 | 多 Agent 串行 | CrewAI | 角色驱动、上手快 |
| 大型客服系统 | 多 Agent 协作 | Claude Agent SDK / LangGraph | Agent 间协作、弹性扩展 |
| 合规敏感场景 | Plan-and-Execute + Human-in-the-loop | LangGraph | 支持人工审批节点 |

**一句话总结：Agent 开发的核心不是选框架，而是选对架构模式。先用单 Agent 循环验证可行性，再根据复杂度逐步演进到 ReAct、Plan-and-Execute 或多 Agent。简单问题不要过度设计，复杂问题不要用简单方案硬撑。**
