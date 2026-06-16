---
title: 工作流管理与流程设计：从建模到落地的完整方案
date: '2026-06-13'
tags:
  - 架构
  - 工程化
  - 工作流
  - 后端
category: 系统设计
summary: >-
  从"业务流程靠口头传递、代码里 if-else 泛滥"的痛点出发，系统梳理工作流管理方案——流程建模标准（BPMN）、流程设计模式（顺序/并行/会签/子流程）、工作流引擎选型（Activiti/Camunda/Temporal/自研）、状态机
  vs 规则引擎 vs 工作流引擎对比、流程编排与事件驱动架构、分布式事务与补偿机制，以及各方案的优缺点与适用场景。
---

# 工作流管理与流程设计：从建模到落地的完整方案

## 一、问题来源

几乎所有业务系统都涉及"流程"——审批、订单处理、数据 Pipeline、内容发布……但流程的实现往往从混乱开始：

**业务层面的痛点：**

- 请假审批要经过直属领导→部门经理→HR，流程全靠微信群通知，谁批到哪了一问三不知
- 订单从下单到发货要经过"库存校验→支付→风控→拣货→物流"，任何一个环节失败都要手动处理
- 新员工入职流程涉及 IT 开通账号、HR 录入信息、行政领设备、培训排期，全靠 Excel 跟踪，遗漏频发
- 合同审批流程经常变更（加签、会签、条件分支），改一次流程就要改一次代码

**技术层面的痛点：**

- 审批逻辑散落在 Service 层，if-else 嵌套 5 层，改一个条件影响三个流程
- 流程状态存在数据库字段里（`status: pending/approved/rejected`），没有历史记录，无法追溯
- 定时任务到处都是（"超时未审批自动升级"、"24 小时未支付自动取消"），难以统一管理
- 流程编排和业务逻辑耦合，无法做到"改流程不改代码"

**核心问题：工作流不是简单的"状态流转"，而是涉及流程建模、编排引擎、状态持久化、事件驱动、分布式事务、监控追溯的综合工程。理解流程设计模式和引擎选型，才能避免重复造轮子。**

---

## 二、流程建模标准

### 2.1 BPMN 2.0（Business Process Model and Notation）

BPMN 是国际标准的业务流程建模语言，定义了一套图形化的流程描述规范：

```
BPMN 核心元素：

  ┌─────────┐     ┌─────────┐     ┌─────────┐
  │ 开始事件 │────▶│ 用户任务 │────▶│  服务任务  │
  │  (圆圈)  │     │ (圆角矩形)│     │ (齿轮矩形) │
  └─────────┘     └─────────┘     └─────────┘
                                         │
                        ┌────────────────┤
                        │                │
                   ┌────▼────┐      ┌───▼─────┐
                   │ 审批通过 │      │ 审批拒绝 │
                   │ (任务节点)│      │ (任务节点)│
                   └────┬────┘      └────┬────┘
                        │                │
                        └───────┬────────┘
                                ▼
                          ┌─────────┐
                          │ 结束事件 │
                          │  (粗圆圈) │
                          └─────────┘

  网关类型：
    ◇ 排他网关（Exclusive Gateway）：只走一条分支（if-else）
    ◇+ 并行网关（Parallel Gateway）：所有分支同时执行
    ◇◇ 包容网关（Inclusive Gateway）：满足条件的分支都执行
    ◇× 事件网关（Event Gateway）：根据发生的事件决定分支
```

### 2.2 BPMN 核心元素对照表

| 元素 | 图形 | 含义 | 示例 |
|------|------|------|------|
| **开始事件** | 细圆圈 | 流程触发点 | "提交请假申请" |
| **结束事件** | 粗圆圈 | 流程终点 | "流程结束" |
| **用户任务** | 圆角矩形+人形 | 需要人操作 | "经理审批" |
| **服务任务** | 圆角矩形+齿轮 | 系统自动执行 | "发送邮件通知" |
| **排他网关** | 菱形+X | 条件分支 | "金额>5万走总监审批" |
| **并行网关** | 菱形+ | 同时执行 | "同时通知 HR 和财务" |
| **定时事件** | 圆圈+时钟 | 定时触发 | "超时 24h 自动取消" |
| **信号事件** | 圆圈+三角 | 接收广播 | "收到支付成功信号" |
| **子流程** | 方框+ | 嵌套流程 | "入职流程" 包含 "IT 开通"子流程 |
| **泳道** | 横向分割 | 角色职责 | "申请人 / 审批人 / HR" |

### 2.3 流程建模工具

| 工具 | 类型 | 特点 |
|------|------|------|
| **Camunda Modeler** | 桌面应用 | Camunda 官方，直接部署到引擎 |
| **bpmn.io** | Web 开源 | 轻量在线编辑器，可嵌入项目 |
| **Signavio** | 商业 SaaS | SAP 旗下，企业级流程建模 |
| **Draw.io / Excalidraw** | 通用绘图 | 快速草图，非 BPMN 严格规范 |
| **ProcessOn** | 在线绘图 | 国内常用，支持 BPMN 模板 |

---

## 三、流程设计模式

### 3.1 顺序流程（Sequence）

最简单的流程模式，任务按固定顺序执行：

```
提交申请 → 直属领导审批 → 部门经理审批 → HR 备案 → 结束
```

```typescript
// 状态机实现
type Status = 'submitted' | 'leader_approved' | 'manager_approved' | 'hr_archived';

const SEQUENCE_FLOW: Record<Status, Status> = {
    submitted: 'leader_approved',
    leader_approved: 'manager_approved',
    manager_approved: 'hr_archived',
    hr_archived: 'hr_archived', // 终态
};

function transit(current: Status): Status {
    const next = SEQUENCE_FLOW[current];
    if (next === current) throw new Error(`已经是终态: ${current}`);
    return next;
}
```

### 3.2 条件分支（Conditional Branch）

根据条件走不同的分支路径：

```
提交报销 → 判断金额
            ├── ≤5000: 财务审批 → 结束
            └── >5000: 财务审批 → 总监审批 → 结束
```

```typescript
function getNextApprover(amount: number, currentApprover: string): string | null {
    if (currentApprover === 'finance') {
        return amount > 5000 ? 'director' : null; // null = 流程结束
    }
    if (currentApprover === 'submitter') {
        return 'finance';
    }
    return null; // 总监审批后结束
}
```

### 3.3 并行网关（Parallel Gateway）

多个任务同时执行，全部完成后才继续：

```
                    ┌→ IT 开通账号 ──┐
新员工入职 ──→ 并行分叉 ┤               ├→ 并行汇聚 → 入职完成
                    └→ HR 录入信息 ──┘
```

```typescript
interface ParallelTask {
    id: string;
    name: string;
    status: 'pending' | 'completed';
}

async function executeParallel(tasks: ParallelTask[]): Promise<void> {
    // 所有任务同时执行
    await Promise.all(
        tasks.map(task => executeTask(task).then(() => { task.status = 'completed'; }))
    );
    // 全部完成后流程继续
}
```

### 3.4 会签（Counter-Sign / Multi-Instance）

多个审批人都要审批（或满足一定比例），适用于合同审批、重大决策：

```
合同审批 → 会签网关
            ├── 法务审批   ──┐
            ├── 财务审批   ──┤ → 全部/多数通过 → 合同生效
            └── 业务负责人 ──┘
```

```typescript
interface CounterSignConfig {
    type: 'all' | 'majority' | 'any';  // 全部同意 / 多数同意 / 任一同意
    approvers: string[];
}

function evaluateCounterSign(
    config: CounterSignConfig,
    decisions: Map<string, 'approve' | 'reject'>,
): 'approved' | 'rejected' | 'pending' {
    const approved = [...decisions.values()].filter(v => v === 'approve').length;
    const total = config.approvers.length;

    switch (config.type) {
        case 'all':
            return approved === total ? 'approved'
                : decisions.size === total ? 'rejected'
                : 'pending';
        case 'majority':
            return approved > total / 2 ? 'approved'
                : (decisions.size - approved) > total / 2 ? 'rejected'
                : 'pending';
        case 'any':
            return approved >= 1 ? 'approved'
                : decisions.size === total ? 'rejected'
                : 'pending';
    }
}
```

### 3.5 子流程（Sub-Process）

将复杂流程拆分为可复用的子流程：

```
主流程：订单处理
    ├── 子流程：支付流程（支付方式选择→支付→确认）
    ├── 子流程：物流流程（拣货→打包→发货→签收）
    └── 子流程：售后流程（退货申请→审核→退款）
```

```typescript
interface ProcessDefinition {
    id: string;
    name: string;
    steps: Step[];
    subProcesses?: Map<string, ProcessDefinition>; // 嵌套子流程
}

interface Step {
    id: string;
    type: 'user-task' | 'service-task' | 'sub-process' | 'gateway';
    config: Record<string, unknown>;
}
```

### 3.6 事件驱动流程（Event-Based）

流程的推进由外部事件触发，而非固定顺序：

```
订单已创建 → 等待事件
              ├── 收到支付成功事件 → 发货
              ├── 收到超时事件 → 取消订单
              └── 收到用户取消事件 → 退款
```

```typescript
type OrderEvent =
    | { type: 'payment_success'; paymentId: string }
    | { type: 'timeout'; reason: string }
    | { type: 'user_cancel'; reason: string };

async function handleOrderEvent(orderId: string, event: OrderEvent): Promise<void> {
    switch (event.type) {
        case 'payment_success':
            await startShipping(orderId, event.paymentId);
            break;
        case 'timeout':
            await cancelOrder(orderId, event.reason);
            break;
        case 'user_cancel':
            await refundOrder(orderId, event.reason);
            break;
    }
}
```

---

## 四、三种引擎对比

### 4.1 状态机 vs 规则引擎 vs 工作流引擎

| 维度 | 状态机（自研） | 规则引擎 | 工作流引擎 |
|------|--------------|---------|-----------|
| **本质** | 代码级状态转移 | 条件→动作映射 | 完整的流程编排平台 |
| **流程定义** | 硬编码/配置 | 规则文件（DSL） | BPMN XML / 可视化建模 |
| **流程变更** | 改代码重新部署 | 改规则文件热更新 | 改模型在线部署 |
| **状态持久化** | 自行实现 | 自行实现 | 内置（数据库表） |
| **流程监控** | 无 | 无 | 内置监控面板 |
| **定时器/超时** | 自行实现 | 有限支持 | 内置 |
| **并行/会签** | 手动实现 | 不支持 | 内置 |
| **子流程** | 函数调用 | 不支持 | 内置 |
| **历史追溯** | 自行实现 | 审计日志 | 内置完整历史 |
| **学习成本** | ★ | ★★ | ★★★ |
| **适用场景** | 简单状态流转 | 复杂条件判断 | 复杂业务流程 |

### 4.2 选型建议

```
你的流程有多复杂？
    │
    ├── 状态不超过 5 个，无分支/并行
    │   └── 状态机（自研，最简单）
    │
    ├── 条件分支多，但流程路径固定
    │   └── 规则引擎（Drools / JSON Rule Engine）
    │
    ├── 多角色审批、并行/会签、子流程
    │   └── 工作流引擎（Camunda / Temporal）
    │
    └── 需要可视化建模、非技术人员可修改流程
        └── 工作流引擎（Camunda）+ BPMN 建模器
```

---

## 五、工作流引擎选型

### 5.1 主流引擎对比

| 维度 | Camunda | Temporal | Activiti | n8n | Apache Airflow |
|------|---------|----------|----------|-----|---------------|
| **语言** | Java | Go + 多语言 SDK | Java | TypeScript/Node | Python |
| **定位** | BPM 平台 | 分布式工作流 | BPM 平台 | 自动化工具 | 数据 Pipeline |
| **流程定义** | BPMN 2.0 XML | 代码定义 | BPMN 2.0 XML | 可视化拖拽 | Python DAG |
| **状态持久化** | 数据库 | 数据库 | 数据库 | 数据库 | 数据库 |
| **可视化建模** | Camunda Modeler | 无 | Eclipse 插件 | 内置拖拽 | 内置 DAG 可视化 |
| **分布式** | 集群部署 | 原生分布式 | 集群部署 | 单机为主 | 集群（Celery） |
| **定时任务** | 内置 | 内置 | 内置 | 内置 | 核心功能 |
| **重试/补偿** | 支持 | 内置重试 | 支持 | 内置重试 | 内置重试 |
| **监控** | Cockpit | Web UI | Explorer | 内置 | 内置 |
| **适用场景** | 企业审批/BPM | 微服务编排 | 企业审批/BPM | API 集成自动化 | 数据工程 ETL |
| **许可证** | 开源 + 商业版 | MIT（可观测性付费） | 开源（Apache 2.0） | 公平源码 | Apache 2.0 |

### 5.2 Camunda（Java 生态首选）

```java
// Camunda 流程定义（BPMN XML 简化版）
// leave-request.bpmn
<bpmn:process id="leave-request" name="请假审批">
    <bpmn:startEvent id="start" />
    <bpmn:userTask id="leader-approve" name="直属领导审批"
                   camunda:assignee="${leader}" />
    <bpmn:exclusiveGateway id="amount-gateway" />
    <bpmn:userTask id="hr-approve" name="HR 审批"
                   camunda:assignee="hr-manager" />
    <bpmn:serviceTask id="send-email" name="发送邮件通知"
                      camunda:delegateExpression="${emailService}" />
    <bpmn:endEvent id="end" />

    <!-- 连线 -->
    <bpmn:sequenceFlow sourceRef="start" targetRef="leader-approve" />
    <bpmn:sequenceFlow sourceRef="leader-approve" targetRef="amount-gateway" />
    <bpmn:sequenceFlow sourceRef="amount-gateway" targetRef="hr-approve">
        <bpmn:conditionExpression>${days > 3}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow sourceRef="amount-gateway" targetRef="send-email">
        <bpmn:conditionExpression>${days <= 3}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow sourceRef="hr-approve" targetRef="send-email" />
    <bpmn:sequenceFlow sourceRef="send-email" targetRef="end" />
</bpmn:process>
```

```java
// Java 服务端：启动流程实例
RuntimeService runtimeService = processEngine.getRuntimeService();

Map<String, Object> variables = new HashMap<>();
variables.put("leader", "zhangsan");
variables.put("days", 5);
variables.put("applicant", "lisi");

ProcessInstance instance = runtimeService.startProcessInstanceByKey(
    "leave-request", variables
);

// 查询待办任务
TaskService taskService = processEngine.getTaskService();
List<Task> tasks = taskService.createTaskQuery()
    .taskAssignee("zhangsan")
    .list();

// 完成任务（审批通过）
taskService.complete(task.getId(), Map.of("approved", true));
```

### 5.3 Temporal（微服务编排首选）

Temporal 用代码定义工作流，天然适合微服务场景：

```typescript
// TypeScript 工作流定义
import { proxyActivities, defineWorkflow, condition, setHandler } from '@temporalio/workflow';
import type * as activities from './activities';

const { approveLeave, sendEmail, createCalendarEvent } = proxyActivities({
    startToCloseTimeout: '1 minute',
});

export const leaveRequestWorkflow = defineWorkflow('leave-request', async (params: {
    applicant: string;
    leader: string;
    days: number;
    reason: string;
}) => {
    // Step 1: 直属领导审批（等待外部信号）
    const leaderApproved = await approveLeave(params.leader, params);
    if (!leaderApproved) return { status: 'rejected', by: 'leader' };

    // Step 2: 条件分支 - 请假 > 3 天需要 HR 审批
    if (params.days > 3) {
        const hrApproved = await approveLeave('hr-manager', params);
        if (!hrApproved) return { status: 'rejected', by: 'hr' };
    }

    // Step 3: 并行执行通知和日历
    await Promise.all([
        sendEmail(params.applicant, '请假申请已通过'),
        createCalendarEvent(params),
    ]);

    return { status: 'approved' };
});
```

```typescript
// Activity 实现（实际业务逻辑）
export async function approveLeave(assignee: string, params: LeaveParams): Promise<boolean> {
    // 查询审批人，等待审批操作
    const decision = await waitForApproval(assignee, params);
    return decision === 'approve';
}

export async function sendEmail(to: string, subject: string): Promise<void> {
    await emailService.send({ to, subject, body: subject });
}

export async function createCalendarEvent(params: LeaveParams): Promise<void> {
    await calendarService.create({
        title: `${params.applicant} 请假 ${params.days} 天`,
        // ...
    });
}
```

### 5.4 自研轻量工作流引擎（TypeScript）

对于中小型项目，可以用状态机模式自研：

```typescript
// types.ts — 流程定义
interface FlowNode {
    id: string;
    type: 'start' | 'end' | 'user-task' | 'service-task' | 'gateway';
    name: string;
    next: string | GatewayBranch[];  // 节点 ID 或网关分支
    assignee?: string | ((ctx: FlowContext) => string);
    action?: (ctx: FlowContext) => Promise<void>;
    timeout?: { duration: number; action: 'auto-approve' | 'auto-reject' | 'escalate' };
}

interface GatewayBranch {
    condition: (ctx: FlowContext) => boolean;
    next: string;
}

interface FlowContext {
    processId: string;
    currentNode: string;
    variables: Record<string, unknown>;
    history: HistoryEntry[];
}

interface FlowDefinition {
    id: string;
    name: string;
    nodes: Map<string, FlowNode>;
}

// engine.ts — 轻量引擎
class WorkflowEngine {
    private definitions = new Map<string, FlowDefinition>();
    private storage: WorkflowStorage;

    // 注册流程定义
    register(definition: FlowDefinition): void {
        this.definitions.set(definition.id, definition);
    }

    // 启动流程实例
    async start(processDefId: string, variables: Record<string, unknown>): Promise<string> {
        const def = this.definitions.get(processDefId);
        if (!def) throw new Error(`流程定义不存在: ${processDefId}`);

        const processId = crypto.randomUUID();
        const startNode = [...def.nodes.values()].find(n => n.type === 'start')!;

        const ctx: FlowContext = {
            processId,
            currentNode: startNode.id,
            variables,
            history: [{ node: startNode.id, action: 'start', timestamp: Date.now() }],
        };

        await this.storage.save(processId, ctx);
        await this.executeNode(processId, startNode, ctx);
        return processId;
    }

    // 执行节点
    private async executeNode(processId: string, node: FlowNode, ctx: FlowContext): Promise<void> {
        switch (node.type) {
            case 'start':
            case 'user-task':
                // 等待外部触发（审批操作），设置超时
                if (node.timeout) this.setupTimeout(processId, node);
                await this.storage.save(processId, ctx);
                break;

            case 'service-task':
                // 自动执行
                await node.action?.(ctx);
                ctx.history.push({ node: node.id, action: 'complete', timestamp: Date.now() });
                await this.proceed(processId, node, ctx);
                break;

            case 'gateway':
                await this.evaluateGateway(processId, node, ctx);
                break;

            case 'end':
                ctx.history.push({ node: node.id, action: 'end', timestamp: Date.now() });
                await this.storage.save(processId, ctx);
                break;
        }
    }

    // 推进到下一节点
    private async proceed(processId: string, node: FlowNode, ctx: FlowContext): Promise<void> {
        if (typeof node.next === 'string') {
            const nextNode = this.definitions.get(ctx.processId)!.nodes.get(node.next)!;
            ctx.currentNode = nextNode.id;
            await this.executeNode(processId, nextNode, ctx);
        } else {
            // 网关分支
            for (const branch of node.next) {
                if (branch.condition(ctx)) {
                    const nextNode = this.definitions.get(ctx.processId)!.nodes.get(branch.next)!;
                    ctx.currentNode = nextNode.id;
                    await this.executeNode(processId, nextNode, ctx);
                    return;
                }
            }
        }
    }

    // 外部触发（审批操作）
    async submitTask(processId: string, action: 'approve' | 'reject', data?: Record<string, unknown>): Promise<void> {
        const ctx = await this.storage.load(processId);
        const def = this.definitions.get(/* 从 ctx 获取定义 ID */)!;
        const currentNode = def.nodes.get(ctx.currentNode)!;

        ctx.history.push({
            node: currentNode.id,
            action,
            data,
            timestamp: Date.now(),
        });

        if (action === 'reject') {
            // 跳转到结束节点
            const endNode = [...def.nodes.values()].find(n => n.type === 'end')!;
            ctx.currentNode = endNode.id;
            await this.executeNode(processId, endNode, ctx);
        } else {
            await this.proceed(processId, currentNode, ctx);
        }
    }
}
```

```typescript
// usage.ts — 定义并使用流程
const engine = new WorkflowEngine();

engine.register({
    id: 'leave-request',
    name: '请假审批',
    nodes: new Map([
        ['start', { id: 'start', type: 'start', name: '提交申请', next: 'leader-approve' }],
        ['leader-approve', {
            id: 'leader-approve', type: 'user-task', name: '直属领导审批',
            assignee: (ctx) => ctx.variables.leaderId as string,
            timeout: { duration: 24 * 3600_000, action: 'escalate' },
            next: [
                { condition: (ctx) => (ctx.variables.days as number) > 3, next: 'hr-approve' },
                { condition: (ctx) => (ctx.variables.days as number) <= 3, next: 'send-email' },
            ],
        }],
        ['hr-approve', {
            id: 'hr-approve', type: 'user-task', name: 'HR 审批',
            assignee: 'hr-manager',
            next: 'send-email',
        }],
        ['send-email', {
            id: 'send-email', type: 'service-task', name: '发送邮件',
            action: async (ctx) => { await emailService.send(/* ... */); },
            next: 'end',
        }],
        ['end', { id: 'end', type: 'end', name: '结束' }],
    ]),
});

// 启动流程
const processId = await engine.start('leave-request', {
    applicantId: 'user-001',
    leaderId: 'leader-001',
    days: 5,
    reason: '年假',
});

// 领导审批
await engine.submitTask(processId, 'approve');

// HR 审批
await engine.submitTask(processId, 'approve');
```

---

## 六、分布式事务与补偿

### 6.1 流程中的事务挑战

工作流通常跨多个服务，无法用单一数据库事务保证一致性：

```
订单支付流程：
  库存服务（扣减库存）→ 支付服务（扣款）→ 订单服务（更新状态）
  如果支付失败，库存已经扣了 → 数据不一致
```

### 6.2 解决方案对比

| 方案 | 原理 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|---------|
| **2PC / XA** | 两阶段提交 | 强一致性 | 性能差、有锁 | 传统数据库 |
| **TCC** | Try-Confirm-Cancel | 最终一致性 | 代码侵入大 | 资金/库存 |
| **Saga** | 正向操作+补偿 | 无锁、可扩展 | 需写补偿逻辑 | 长流程、微服务 |
| **本地消息表** | 消息+定时重试 | 简单可靠 | 依赖定时任务 | 异步通知 |
| **最大努力通知** | 多次重试通知 | 最简单 | 不保证一定送达 | 非关键通知 |

### 6.3 Saga 模式（推荐）

Saga 是工作流中最常用的事务模式——每个正向操作都有对应的补偿操作：

```typescript
// Saga 编排器
interface SagaStep {
    name: string;
    execute: () => Promise<void>;
    compensate: () => Promise<void>;  // 补偿操作（回滚）
}

class SagaOrchestrator {
    async execute(steps: SagaStep[]): Promise<{ success: boolean; failedStep?: string }> {
        const completedSteps: SagaStep[] = [];

        try {
            for (const step of steps) {
                await step.execute();
                completedSteps.push(step);
            }
            return { success: true };
        } catch (error) {
            // 正向执行失败 → 按逆序执行已完成步骤的补偿操作
            for (const step of completedSteps.reverse()) {
                try {
                    await step.compensate();
                } catch (compensateError) {
                    // 补偿也失败了 → 记录日志，人工介入
                    console.error(`补偿失败: ${step.name}`, compensateError);
                }
            }
            return { success: false, failedStep: steps[completedSteps.length]?.name };
        }
    }
}

// 使用示例：订单支付流程
const saga = new SagaOrchestrator();
const result = await saga.execute([
    {
        name: '扣减库存',
        execute: () => inventoryService.deduct(order),
        compensate: () => inventoryService.restore(order),
    },
    {
        name: '创建支付',
        execute: () => paymentService.charge(order),
        compensate: () => paymentService.refund(order),
    },
    {
        name: '更新订单状态',
        execute: () => orderService.updateStatus(order.id, 'paid'),
        compensate: () => orderService.updateStatus(order.id, 'cancelled'),
    },
]);
```

---

## 七、流程监控与可观测性

### 7.1 监控维度

| 维度 | 指标 | 实现方式 |
|------|------|---------|
| **流程吞吐** | 每小时完成的流程实例数 | 计数器 + Prometheus |
| **流程延迟** | 从开始到结束的平均耗时 | 直方图 + P50/P95/P99 |
| **节点耗时** | 每个任务的平均处理时间 | 节点级计时 |
| **待办积压** | 当前待处理的任务数 | 实时查询 |
| **超时率** | 超时未处理的任务比例 | 告警规则 |
| **失败率** | 失败的流程实例比例 | 错误计数器 |
| **审批效率** | 平均审批响应时间 | 用户任务维度统计 |

### 7.2 流程历史追溯

```typescript
// 流程实例完整历史
interface ProcessHistory {
    processId: string;
    processDefId: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    startedAt: number;
    completedAt?: number;
    steps: {
        nodeId: string;
        nodeName: string;
        assignee?: string;
        action: string;
        data?: Record<string, unknown>;
        timestamp: number;
    }[];
}
```

---

## 八、优缺点与适用场景总结

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **状态机自研** | 最轻量、完全可控 | 无法可视化建模、无监控、无历史 | 简单状态流转（<5 个状态） |
| **规则引擎** | 条件解耦、热更新 | 不支持流程编排 | 复杂条件判断、动态路由 |
| **Camunda** | BPMN 标准、可视化建模、功能完整 | Java 生态、学习曲线陡 | 企业级 BPM、审批流 |
| **Temporal** | 分布式、代码定义、重试/补偿内置 | 无可视化建模 | 微服务编排、长流程 |
| **Activiti** | 轻量 BPM、社区活跃 | 功能不如 Camunda | 中小型 BPM 项目 |
| **n8n** | 可视化拖拽、API 集成丰富 | 不适合复杂业务逻辑 | API 集成自动化、IoT |
| **Airflow** | DAG 调度、Python 生态 | 不适合实时流程 | 数据 Pipeline / ETL |
| **自研引擎（TS）** | 轻量、按需实现、无依赖 | 功能有限、需自己维护 | 中小型项目、非标准流程 |

---

## 九、局限性

1. **BPMN 学习曲线**：BPMN 2.0 规范庞大（超过 100 个元素类型），团队需要培训才能正确使用
2. **工作流引擎的重量级**：Camunda/Activiti 引入完整的引擎框架，对于简单流程是过度设计
3. **流程变更的版本管理**：已运行中的流程实例使用旧版定义，新版定义只影响新实例，需要处理版本兼容
4. **分布式事务的不完美**：Saga 补偿模式无法处理所有回滚场景（如已发送的邮件无法撤回）
5. **可视化建模与代码的脱节**：BPMN 模型和业务代码分别维护，容易出现不一致
6. **性能瓶颈**：工作流引擎的状态持久化（每次流转写数据库）在高吞吐场景下可能成为瓶颈
7. **流程复杂度的上限**：当流程超过 50 个节点、10 层嵌套时，无论用什么引擎都难以维护
8. **测试困难**：长流程的端到端测试需要模拟大量外部依赖和等待超时，测试效率低

---

## 十、总结

工作流管理的核心是**选择与流程复杂度匹配的方案**：

- **简单状态流转**（<5 个状态）：自研状态机，最轻量
- **复杂条件判断**：规则引擎（JSON Rule Engine / Drools），条件与逻辑解耦
- **多角色审批流程**：工作流引擎（Camunda / Activiti），BPMN 建模 + 内置监控
- **微服务编排 / 长流程**：Temporal，代码定义 + 分布式 + 重试补偿
- **API 集成自动化**：n8n，可视化拖拽 + 丰富连接器
- **数据 Pipeline**：Airflow，DAG 调度 + Python 生态
- **中小型项目定制**：自研轻量引擎（TypeScript），按需实现核心功能

**设计原则：流程定义与业务逻辑分离、状态变更可追溯、失败可补偿、变更可热更新。**
