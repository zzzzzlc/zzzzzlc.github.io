---
title: "LangChain vs LangGraph：从链式调用到图编排的 LLM 应用架构选型"
date: '2026-05-30'
tags:
  - AI
  - LangChain
  - LangGraph
  - 工程化
category: AI 工程
summary: "从 LLM 应用开发中的编排困惑出发，深度对比 LangChain（LCEL 链式组合）与 LangGraph（状态图编排 + Functional API）两种架构范式。覆盖 LCEL 管道、StateGraph 节点/边/条件路由、状态持久化、Human-in-the-Loop、多 Agent 协作、LangSmith 可观测性等核心内容，给出不同业务场景的选型建议与迁移路径。"
---

# LangChain vs LangGraph：从链式调用到图编排的 LLM 应用架构选型

## 一、问题来源

当团队从"调 API 写 Prompt"进入 LLM 应用开发阶段时，会面临一个核心的架构选择：

**编排困惑：**

- 我的应用是线性流程（RAG → 总结 → 输出），还是需要循环、条件分支、人工审批？
- LangChain 的 LCEL 管道写法很简洁，但遇到"如果结果不够好就重试"这种循环逻辑就很难处理
- LangGraph 声称能解决这些问题，但学习成本高，我的场景真的需要吗？
- 两者到底是什么关系？LangGraph 能独立于 LangChain 使用吗？

**版本迁移的困惑：**

- LangChain v1.0 已发布，`AgentExecutor` 被标记为弃用（2026-12 EOL），新项目该怎么写？
- LangGraph 也有两种 API（Graph API 和 Functional API），该选哪个？

**核心问题：LangChain 和 LangGraph 不是竞争关系，而是不同粒度的编排工具。理解它们的边界，才能选对方案。**

---

## 二、LangChain：LCEL 链式组合

### 2.1 LCEL（LangChain Expression Language）

LCEL 是 LangChain v1.0 的核心编排机制，通过 `Runnable` 接口和 `|`（管道）运算符组合组件。

```
数据流：
Input → [Prompt] → [Model] → [Parser] → Output
         管道        管道       管道
```

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

prompt = ChatPromptTemplate.from_template("用中文总结以下内容：{text}")
model = ChatOpenAI(model="gpt-4o")
parser = StrOutputParser()

# 管道组合
chain = prompt | model | parser

# 调用
result = chain.invoke({"text": "LangChain simplifies working with LLMs..."})
```

**LCEL 自动支持流式输出、异步执行和批量处理**——这是相比旧版 `LLMChain` 类的最大优势。

### 2.2 核心 Runnable 类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `RunnableLambda` | 包装普通函数为 Runnable | `RunnableLambda(lambda x: x["foo"])` |
| `RunnableParallel` | 并发执行多个 Runnable | `RunnableParallel({"a": chain_a, "b": chain_b})` |
| `RunnablePassthrough` | 原样传递输入 | 用于在并行分支中转发原始输入 |
| `RunnableSequence` | `|` 运算符创建的有序链 | `prompt \| model \| parser` |

```python
from langchain_core.runnables import RunnableParallel, RunnablePassthrough

# 并行分支：同时生成摘要和关键词
chain = RunnableParallel(
    summary=prompt_summary | model | parser,
    keywords=prompt_keywords | model | parser,
    original=RunnablePassthrough(),  # 保留原始输入
)
result = chain.invoke({"text": "..."})
# result = {"summary": "...", "keywords": "...", "original": {"text": "..."}}
```

### 2.3 RAG 管道实战

```python
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableParallel, RunnablePassthrough
from langchain_community.vectorstores import Chroma

# 向量检索器
vectorstore = Chroma.from_documents(documents, OpenAIEmbeddings())
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

# RAG 链
template = """基于以下上下文回答问题。如果上下文不足以回答，请说明。

上下文：
{context}

问题：{question}
"""
prompt = ChatPromptTemplate.from_template(template)
model = ChatOpenAI(model="gpt-4o")

# 组合：检索 → 格式化 → 提示 → 模型 → 解析
rag_chain = (
    RunnableParallel(
        context=lambda x: retriever.invoke(x["question"]),
        question=lambda x: x["question"],
    )
    | prompt
    | model
    | StrOutputParser()
)

result = rag_chain.invoke({"question": "LangGraph 和 LangChain 的区别是什么？"})
```

### 2.4 工具定义与简单 Agent

```python
from langchain.tools import tool

@tool
def search_database(query: str, limit: int = 5) -> str:
    """搜索数据库，返回匹配结果"""
    results = db.search(query, limit=limit)
    return str(results)

@tool
def calculate(expression: str) -> str:
    """计算数学表达式"""
    return str(eval(expression))  # 生产环境应用安全的方式

# 简单 Agent（底层实际使用 LangGraph）
from langgraph.prebuilt import create_react_agent

tools = [search_database, calculate]
agent = create_react_agent(model, tools)
result = agent.invoke({"messages": [("user", "搜索销量前 5 的产品并计算总销量")]})
```

---

## 三、LangGraph：状态图编排

### 3.1 为什么需要图编排

LCEL 管道是**线性的**：输入 → A → B → C → 输出。但实际应用经常需要：

- **循环**：搜索结果不够好 → 重新搜索 → 再评估 → ...
- **条件分支**：如果用户提问关于财务 → 走财务 Agent，否则走通用 Agent
- **人工审批**：Agent 想执行删除操作 → 暂停等待人工确认 → 继续
- **状态持久化**：长时间运行的 Agent 断电后能从上次中断处恢复

**这些场景 LCEL 无法优雅处理，这就是 LangGraph 存在的意义。**

### 3.2 Graph API：StateGraph

LangGraph 的核心抽象是**有向状态图**：

```
START → [检索节点] → [评估节点] → 条件判断 ──→ [回复节点] → END
                                       │
                                       └──→ [检索节点]（循环）
```

```python
from langgraph.graph import StateGraph, END, START
from typing import TypedDict, Annotated, Literal
import operator

# 1. 定义状态 Schema
class ResearchState(TypedDict):
    messages: Annotated[list, operator.add]  # reducer：新消息追加到列表
    search_results: list
    needs_more_info: bool
    final_answer: str

# 2. 定义节点函数
def search_node(state: ResearchState) -> ResearchState:
    """执行搜索"""
    query = state["messages"][-1]
    results = search_api(query)
    return {"search_results": results}

def evaluate_node(state: ResearchState) -> ResearchState:
    """评估搜索结果是否充分"""
    sufficient = evaluate_results(state["search_results"])
    return {"needs_more_info": not sufficient}

def respond_node(state: ResearchState) -> ResearchState:
    """生成最终回答"""
    answer = generate_response(state["search_results"])
    return {"final_answer": answer, "messages": [answer]}

# 3. 条件路由
def should_continue(state: ResearchState) -> Literal["search", "respond"]:
    return "search" if state["needs_more_info"] else "respond"

# 4. 构建图
graph = StateGraph(ResearchState)
graph.add_node("search", search_node)
graph.add_node("evaluate", evaluate_node)
graph.add_node("respond", respond_node)

graph.add_edge(START, "search")
graph.add_edge("search", "evaluate")
graph.add_conditional_edges("evaluate", should_continue)
graph.add_edge("respond", END)

# 5. 编译并执行
app = graph.compile()
result = app.invoke({
    "messages": ["研究 LangGraph 的最新特性"],
    "search_results": [],
    "needs_more_info": True,
    "final_answer": "",
})
```

**核心概念：**

| 概念 | 说明 |
|------|------|
| `StateGraph` | 状态图容器，管理节点和边 |
| Node（节点） | 处理状态的函数，接收状态返回状态更新 |
| Edge（边） | 节点之间的固定连接 |
| Conditional Edge | 根据状态动态决定下一个节点 |
| `Annotated[type, reducer]` | 定义状态字段的合并策略（如 `operator.add` 追加） |
| Super-step | 图的一次"心跳"——并行执行所有可执行节点 |

### 3.3 Functional API：@entrypoint + @task

LangGraph 还提供了更简洁的命令式写法，不需要手动定义节点和边：

```python
from langgraph.func import entrypoint, task
from langgraph.checkpoint.memory import MemorySaver

@task
def research(topic: str) -> str:
    """离散的工作单元"""
    results = search_api(topic)
    return summarize(results)

@task
def write_report(research_data: str) -> str:
    """另一个离散工作单元"""
    return llm.generate(f"基于以下数据写报告：{research_data}")

@entrypoint(checkpointer=MemorySaver())
def research_workflow(topic: str) -> dict:
    """工作流入口：用普通 Python 控制流编排"""
    data = research(topic).result()

    # 普通的 if/else 和循环
    if not data:
        data = research(topic + " 详细").result()

    report = write_report(data).result()
    return {"topic": topic, "report": report}
```

### 3.4 Graph API vs Functional API

| 维度 | Graph API (StateGraph) | Functional API |
|------|----------------------|----------------|
| 范式 | 声明式（定义节点/边） | 命令式（函数 + 循环/条件） |
| 状态管理 | 显式 TypedDict + reducer | 隐式（函数作用域） |
| 可视化 | 支持图可视化 | 不支持 |
| 时光旅行调试 | 粒度细（每个节点检查点） | 粒度粗（每个入口点检查点） |
| 学习曲线 | 陡峭 | 平缓 |
| 适用场景 | 复杂多分支工作流、多 Agent | 线性+简单循环、快速原型 |

两者共享**同一套运行时**，可以混合使用。

### 3.5 状态持久化与检查点

LangGraph 内置了检查点机制，在每个 super-step 自动保存状态：

```python
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.postgres import PostgresSaver

# 开发环境
checkpointer = InMemorySaver()

# 生产环境（Postgres）
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)

app = graph.compile(checkpointer=checkpointer)

# 必须提供 thread_id 以启用持久化
config = {"configurable": {"thread_id": "user-session-123"}}
result = app.invoke(input_data, config)

# 恢复之前的会话（即使服务重启）
result = app.invoke(new_input, config)  # 自动从上次的检查点恢复
```

**检查点后端：**

| 后端 | 用途 |
|------|------|
| `InMemorySaver` | 开发调试 |
| `SqliteSaver` | 本地/单机部署 |
| `PostgresSaver` | 生产环境 |
| `CosmosDBSaver` | Azure 云 |

### 3.6 Human-in-the-Loop（人工审批）

LangGraph 通过 `interrupt()` 实现人工审批——执行到某个节点时暂停，等待外部输入后恢复：

```python
from langgraph.types import interrupt, Command

def approval_node(state):
    # 暂停执行，等待人工审批
    decision = interrupt({
        "question": "是否执行此操作？",
        "details": state["action_plan"],
    })

    if decision["approved"]:
        return Command(goto="execute")
    else:
        return Command(goto="cancel")

def execute_node(state):
    result = execute_action(state["action_plan"])
    return {"result": result}

# 客户端使用
config = {"configurable": {"thread_id": "approval-flow-1"}}

# 第一次调用：执行到 approval_node 时中断
stream = app.stream(input_data, config=config)
# → 中断，返回等待审批的状态

# 人工审批后恢复
result = app.invoke(Command(resume={"approved": True}), config=config)
```

**常见 HITL 模式：**

| 模式 | 说明 |
|------|------|
| 审批工作流 | 执行敏感操作前暂停等待确认 |
| 审查和编辑 | 人工修改 LLM 输出后继续 |
| 工具调用中断 | 在实际执行工具前暂停 |
| 输入验证 | 循环中断直到用户输入有效 |

### 3.7 多 Agent 协作

LangGraph 通过 `langgraph-supervisor` 库支持 Supervisor 模式的多 Agent 编排：

```python
from langgraph.prebuilt import create_react_agent
from langgraph_supervisor import create_supervisor

# 定义专业 Agent
coder = create_react_agent(model, coder_tools, name="coder")
researcher = create_react_agent(model, research_tools, name="researcher")
reviewer = create_react_agent(model, review_tools, name="reviewer")

# 创建 Supervisor
supervisor = create_supervisor(
    agents=[coder, researcher, reviewer],
    model=model,
    prompt="""你是一个项目协调者。
    - 需要搜索信息时，委派给 researcher
    - 需要写代码时，委派给 coder
    - 需要代码审查时，委派给 reviewer
    """,
)

app = supervisor.compile()
result = app.invoke({"messages": [("user", "帮我调研 LangGraph 并写一个示例")]})
```

---

## 四、LangSmith：可观测性平台

LangSmith 是 LangChain 团队提供的可观测性工具，同时支持 LangChain 和 LangGraph：

```
应用运行
  ↓
LangSmith SDK 自动采集
  ↓
┌─────────────────────────────────────┐
│  Traces（调用链追踪）                 │
│  ├─ LLM 调用（输入/输出/token/延迟）  │
│  ├─ 工具调用（参数/结果/耗时）         │
│  └─ Agent 步骤（决策过程）            │
│                                     │
│  评估（Evaluation）                  │
│  ├─ LLM-as-Judge 自动评分            │
│  └─ 人工标注对比                     │
│                                     │
│  时光旅行调试（结合 LangGraph 检查点） │
│  └─ 回放到任意步骤重新执行            │
└─────────────────────────────────────┘
```

开源替代：Langfuse，提供类似的追踪和评估能力。

---

## 五、核心差异对比

### 5.1 架构范式

```
LangChain (LCEL)：
  Input → [A] → [B] → [C] → Output
  线性管道，无循环，无条件分支

LangGraph (StateGraph)：
  START → [A] ⇄ [B] → 条件 → [C] → END
                  ↑        │
                  └────────┘
  有向图，支持循环、条件、并行、中断
```

### 5.2 多维度对比

| 维度 | LangChain (LCEL) | LangGraph |
|------|-------------------|-----------|
| 核心抽象 | Runnable 管道 | 有向状态图 |
| 编排方式 | 线性链式 `A \| B \| C` | 节点 + 边 + 条件路由 |
| 循环支持 | 无 | 有（边可以指向之前的节点） |
| 条件分支 | 需要手动实现 | `add_conditional_edges` 原生支持 |
| 状态管理 | 无内置状态 | `TypedDict` + `reducer` + 检查点 |
| 持久化 | 无 | 内置（内存/SQLite/Postgres/CosmosDB） |
| Human-in-the-Loop | 需手动实现 | `interrupt()` + `Command` 原生支持 |
| 多 Agent | 不支持 | Supervisor 模式 / 子图 |
| 可视化 | 无 | 图结构可视化 |
| 时光旅行调试 | 无 | 支持回放到任意检查点 |
| 学习曲线 | 低 | 中~高 |
| 包大小 | ~5MB | ~3MB（可独立安装） |
| 依赖关系 | 独立 | 可独立，也可与 LangChain 配合 |
| 适合复杂度 | 简单~中等 | 中等~复杂 |

### 5.3 版本现状（2026 年）

| 项目 | 当前版本 | 状态 |
|------|---------|------|
| LangChain | v1.2.7 | LTS 稳定版 |
| LangGraph | v1.0.7 | LTS 稳定版 |
| Python 要求 | 3.10+ | 3.9 已移除 |

**重要弃用：**

| 旧 API | 替代方案 | EOL |
|--------|---------|-----|
| `AgentExecutor` | `create_react_agent`（LangGraph 预构建） | 2026-12 |
| `LLMChain` | LCEL 管道 (`prompt \| model \| parser`) | 已移除 |
| `.run()` | `.invoke()` | 已移除 |
| `initialize_agent()` | `create_react_agent` | 已移除 |

---

## 六、选型决策

### 6.1 决策树

```
你的 LLM 应用有什么特点？
  │
  ├─ 线性流程（RAG、摘要、翻译、分类）
  │   → LangChain (LCEL) ✅
  │
  ├─ 需要循环（搜索→评估→不满意→重新搜索）
  │   → LangGraph ✅
  │
  ├─ 需要条件分支（不同问题走不同处理路径）
  │   → LangGraph ✅
  │
  ├─ 需要人工审批（敏感操作需确认）
  │   → LangGraph (interrupt) ✅
  │
  ├─ 需要状态持久化（长时间运行、断点恢复）
  │   → LangGraph (checkpointer) ✅
  │
  ├─ 多 Agent 协作（不同角色分工）
  │   → LangGraph (supervisor) ✅
  │
  └─ 不确定 / 快速验证想法
      → 先用 LangChain，不够再迁移到 LangGraph
```

### 6.2 场景适配

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 文档问答 (RAG) | LangChain | 线性流程，LCEL 足够 |
| 客服聊天机器人 | LangChain | 单轮/多轮对话，简单链 |
| 自主研究 Agent | LangGraph | 需要循环搜索+评估 |
| 审批工作流 | LangGraph | 需要 Human-in-the-Loop |
| 多角色协作 | LangGraph | Supervisor 多 Agent |
| 数据处理管道 | LangChain | 确定性流程，无需循环 |
| 代码生成+审查 | LangGraph | 生成→审查→修改的循环 |

### 6.3 局限性

**LangChain (LCEL) 局限性：**
- 不支持循环和条件分支——遇到"不满意就重试"场景只能用递归或外部循环 hack
- 没有内置状态持久化——无法实现断点恢复
- Agent 能力依赖 LangGraph 的预构建组件（`create_react_agent` 来自 LangGraph）
- 复杂工作流会导致管道嵌套过深，可读性下降

**LangGraph 局限性：**
- 学习曲线陡峭——StateGraph + reducer + checkpoint 概念较多
- 简单场景下过度设计——线性 RAG 用 LangGraph 是杀鸡用牛刀
- Graph API 代码量较大——需要定义节点、边、条件路由、状态 Schema
- 检查点在生产环境需要外部数据库（Postgres），增加基础设施复杂度
- 多 Agent 的调试和测试仍然困难——Supervisor 模式下错误传播链长

---

## 七、迁移路径

### 7.1 从 LangChain 到 LangGraph 的渐进迁移

```
阶段一：LangChain LCEL（快速验证）
  prompt | model | parser

阶段二：引入 LangGraph 预构建 Agent
  from langgraph.prebuilt import create_react_agent
  agent = create_react_agent(model, tools)

阶段三：自定义 StateGraph（复杂编排）
  graph = StateGraph(MyState)
  graph.add_node(...)
  graph.add_conditional_edges(...)
  app = graph.compile(checkpointer=PostgresSaver(...))
```

### 7.2 旧 AgentExecutor 迁移

```python
# ❌ 旧写法（已弃用）
from langchain.agents import AgentExecutor, create_openai_tools_agent
agent = create_openai_tools_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
result = executor.invoke({"input": "..."})

# ✅ 新写法
from langgraph.prebuilt import create_react_agent
agent = create_react_agent(model, tools)
result = agent.invoke({"messages": [("user", "...")]})
```

---

## 八、总结

| 维度 | LangChain (LCEL) | LangGraph |
|------|-------------------|-----------|
| 定位 | LLM 组件组合工具 | LLM 工作流编排引擎 |
| 核心能力 | 线性管道、流式输出、异步批处理 | 循环、条件分支、状态持久化、人工审批 |
| 适用复杂度 | 简单 | 复杂 |
| 适合团队 | 初学者、快速原型 | 有经验的团队、生产系统 |
| 关系 | 独立，可被 LangGraph 封装为节点 | 独立，可无缝使用 LangChain 组件 |

**选型原则：线性流程用 LangChain，有循环/分支/审批/持久化需求用 LangGraph。不确定时先用 LangChain 验证，再按需迁移。**
