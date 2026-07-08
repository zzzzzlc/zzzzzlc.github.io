---
title: AI 模型应用进阶：RAG、Agent 与工程化实践
date: '2026-05-25'
tags:
  - AI
  - AI Agent
  - 工程化
category: AI 工程
summary: >-
  从实际业务中 AI 落地的瓶颈出发，对比分析 RAG 检索增强、Agent 工具调用、高级提示工程等进阶方案，涵盖向量数据库选型、RAG
  架构设计、Function Calling 实现等核心能力。
---

# AI 模型应用进阶：RAG、Agent 与工程化实践

## 一、问题来源

当团队完成了基础的模型选型和部署后，往往会遇到以下瓶颈：

**准确性质疑：**

- 模型对业务专属知识一无所知，经常"一本正经地胡说八道"（幻觉问题）
- 回答缺乏最新信息，训练数据截止后的新闻、政策变化完全不知道
- 对公司内部文档、产品手册的内容无法准确引用

**能力边界：**

- 模型只能"说话"，不能"做事"——无法查询数据库、调用 API、执行计算
- 复杂推理任务容易出错，多步骤任务的中间过程不可控
- 无法处理图片、表格等非文本信息

**工程化挑战：**

- Prompt 写了一堆 if-else，维护成本比传统代码还高
- 多轮对话的上下文越来越长，Token 费用失控
- AI 生成的内容不可预测，测试和回归困难

这些问题的本质是：**基础模型是通用的"大脑"，但业务需要的是有知识、能行动、可工程化的"员工"。**

## 二、知识增强方案

### 方案一：RAG（检索增强生成）

RAG 的核心思路是：用户提问时，先从知识库中检索相关文档，将文档内容作为上下文喂给模型，让模型基于真实资料回答。

#### 架构设计

```
用户提问
   ↓
Query 预处理（改写、扩展、意图识别）
   ↓
向量检索（Embedding → 向量数据库 → Top-K 文档）
   ↓
上下文组装（System Prompt + 检索结果 + 用户问题）
   ↓
LLM 生成回答
   ↓
后处理（引用标注、事实核查）
```

#### 文档处理流水线

```typescript
// 文档切片与向量化
interface Document {
    content: string;
    metadata: {
        source: string;
        title: string;
        page?: number;
        chunkIndex: number;
    };
}

class DocumentProcessor {
    private chunkSize: number;
    private chunkOverlap: number;

    constructor(chunkSize = 500, chunkOverlap = 50) {
        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;
    }

    // 文本切片：按固定长度 + 重叠
    splitText(text: string, metadata: Record<string, string>): Document[] {
        const chunks: Document[] = [];
        const sentences = text.split(/(?<=[。！？\n.!?])/);
        let currentChunk = '';
        let chunkIndex = 0;

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > this.chunkSize) {
                if (currentChunk) {
                    chunks.push({
                        content: currentChunk.trim(),
                        metadata: { ...metadata, chunkIndex },
                    });
                    chunkIndex++;
                }
                // 保留重叠部分
                const overlapText = currentChunk.slice(-this.chunkOverlap);
                currentChunk = overlapText + sentence;
            } else {
                currentChunk += sentence;
            }
        }

        if (currentChunk.trim()) {
            chunks.push({
                content: currentChunk.trim(),
                metadata: { ...metadata, chunkIndex },
            });
        }

        return chunks;
    }

    // Markdown 按标题切片（语义更完整）
    splitMarkdown(md: string, source: string): Document[] {
        const sections = md.split(/^(#{1,3}\s+.+)$/m);
        const chunks: Document[] = [];
        let currentTitle = '';

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i].trim();
            if (/^#{1,3}\s+/.test(section)) {
                currentTitle = section.replace(/^#{1,3}\s+/, '');
            } else if (section) {
                chunks.push({
                    content: section,
                    metadata: {
                        source,
                        title: currentTitle || 'Untitled',
                        chunkIndex: chunks.length,
                    },
                });
            }
        }

        return chunks;
    }
}
```

#### 向量检索实现

```typescript
interface SearchResult {
    content: string;
    score: number;
    metadata: Record<string, string>;
}

class RAGEngine {
    private embeddingModel: string;
    private topK: number;

    constructor(embeddingModel = 'text-embedding-3-small', topK = 5) {
        this.embeddingModel = embeddingModel;
        this.topK = topK;
    }

    // 生成向量
    async embed(text: string): Promise<number[]> {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: this.embeddingModel,
                input: text,
            }),
        });
        const data = await response.json();
        return data.data[0].embedding;
    }

    // Query 改写：将用户口语化问题转为搜索友好的 query
    async rewriteQuery(query: string): Promise<string[]> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: '将用户的问题改写为 2-3 个适合搜索引擎检索的查询词，每行一个，不要编号。',
                }, {
                    role: 'user',
                    content: query,
                }],
                temperature: 0.3,
            }),
        });
        const data = await response.json();
        return data.choices[0].message.content.trim().split('\n').filter(Boolean);
    }

    // 完整 RAG 流程
    async answer(question: string, vectorStore: VectorStore): Promise<{
        answer: string;
        sources: SearchResult[];
    }> {
        // 1. Query 改写
        const queries = await this.rewriteQuery(question);

        // 2. 向量检索
        const allResults: SearchResult[] = [];
        for (const q of queries) {
            const embedding = await this.embed(q);
            const results = await vectorStore.search(embedding, this.topK);
            allResults.push(...results);
        }

        // 3. 去重 + 排序
        const seen = new Set<string>();
        const uniqueResults = allResults
            .sort((a, b) => b.score - a.score)
            .filter(r => {
                const key = r.content.slice(0, 100);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, this.topK);

        // 4. 构造 Prompt
        const context = uniqueResults
            .map((r, i) => `[来源${i + 1}] ${r.content}`)
            .join('\n\n');

        const messages = [
            {
                role: 'system',
                content: `你是一个专业的知识问答助手。请根据以下参考资料回答用户问题。
要求：
1. 只基于参考资料回答，不要编造信息
2. 回答时标注引用来源，如 [来源1]
3. 如果参考资料中没有相关信息，明确告知用户

参考资料：
${context}`,
            },
            { role: 'user', content: question },
        ];

        // 5. 调用模型生成回答
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.3,
            }),
        });
        const data = await response.json();

        return {
            answer: data.choices[0].message.content,
            sources: uniqueResults,
        };
    }
}
```

**优点：**
- 知识可实时更新，修改文档即生效，无需重新训练模型
- 回答有据可查，附带来源引用，可追溯、可验证
- 实现成本低于微调，不需要 GPU 算力
- 适合文档量大、更新频繁的场景

**缺点：**
- 检索质量依赖切片策略和 Embedding 模型，质量不好则回答质量差
- 长文档检索可能丢失上下文，短切片又可能信息不完整
- 向量数据库的存储和检索有额外成本
- 检索+生成两次调用，延迟高于直接推理

**适配场景：**
- 企业内部知识库问答
- 法律、医疗、金融等需要精确引用的场景
- 产品文档 / 技术文档智能客服
- 大量非结构化文档的语义搜索

**局限性：**
- 对于需要复杂推理、跨文档综合分析的任务效果有限
- 语义相近但含义不同的内容容易检索错误（如"利率上升"和"利率下降"向量接近）
- 中文 Embedding 模型的效果仍弱于英文

### 方案二：微调知识注入（对比 RAG）

将知识直接编码到模型参数中，通过 SFT（监督微调）让模型"记住"。

| 维度 | RAG | 微调知识注入 |
|------|-----|------------|
| 知识更新 | 实时（改文档即可） | 需重新训练 |
| 回答准确性 | 高（基于真实文档） | 中（可能产生幻觉） |
| 长尾知识 | 检索到就能回答 | 训练数据中有的才能回答 |
| 推理延迟 | 高（检索+生成两步） | 低（直接推理） |
| 实现成本 | 低 | 中（需要训练） |
| Token 消耗 | 高（上下文包含文档） | 低（知识在参数中） |
| 推荐场景 | 知识频繁更新、需引用 | 知识稳定、风格定制 |

**最佳实践：RAG + 微调结合**
- 微调用于：固定模型输出格式、风格、角色设定
- RAG 用于：注入最新知识、外部文档引用

## 三、向量化与存储方案

### 向量数据库选型

| 数据库 | 类型 | 特点 | 适用场景 |
|--------|------|------|---------|
| Pinecone | 云托管 | 全托管，零运维 | 快速上线、不想自建 |
| Milvus | 开源 | 高性能，支持十亿级向量 | 大规模生产环境 |
| Qdrant | 开源 | Rust 实现，性能优秀 | 中等规模、自建部署 |
| Weaviate | 开源 | 内置多模态、GraphQL API | 需要多模态搜索 |
| Chroma | 开源 | 轻量、Python 友好 | 开发测试、小项目 |
| pgvector | 扩展 | 基于 PostgreSQL | 已有 PG 数据库的项目 |
| Elasticsearch | 搜索引擎 | 8.x 内置向量检索 | 已有 ES 基础设施 |

```typescript
// pgvector 方案（适合已有 PostgreSQL 的项目）
// CREATE TABLE documents (
//   id SERIAL PRIMARY KEY,
//   content TEXT,
//   metadata JSONB,
//   embedding VECTOR(1536)
// );
// CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);

class PgVectorStore implements VectorStore {
    private pool: any;

    async search(embedding: number[], topK: number): Promise<SearchResult[]> {
        const result = await this.pool.query(`
            SELECT content, metadata,
                   1 - (embedding <=> $1::vector) AS score
            FROM documents
            ORDER BY embedding <=> $1::vector
            LIMIT $2
        `, [JSON.stringify(embedding), topK]);

        return result.rows.map((row: any) => ({
            content: row.content,
            score: row.score,
            metadata: row.metadata,
        }));
    }

    async insert(documents: Document[], embeddings: number[][]) {
        const values = documents.map((doc, i) =>
            `('${doc.content.replace(/'/g, "''")}', '${JSON.stringify(doc.metadata)}', '${JSON.stringify(embeddings[i])}')`
        ).join(',\n');

        await this.pool.query(`
            INSERT INTO documents (content, metadata, embedding)
            VALUES ${values}
        `);
    }
}
```

## 四、Agent（智能体）方案

### 问题：模型只会"说话"，不会"做事"

Agent 的核心是让模型能够使用外部工具（Tool/Function），自主规划和执行多步任务。

### 方案一：Function Calling

模型通过结构化的函数调用与外部系统交互。

```typescript
// 定义工具
interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, {
            type: string;
            description: string;
            enum?: string[];
        }>;
        required: string[];
    };
}

const tools: ToolDefinition[] = [
    {
        name: 'query_database',
        description: '查询数据库，执行 SQL 语句获取数据',
        parameters: {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: '要执行的 SQL 查询语句（仅允许 SELECT）',
                },
            },
            required: ['sql'],
        },
    },
    {
        name: 'search_web',
        description: '搜索互联网获取最新信息',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '搜索关键词' },
                limit: { type: 'number', description: '返回结果数量' },
            },
            required: ['query'],
        },
    },
    {
        name: 'calculate',
        description: '执行数学计算',
        parameters: {
            type: 'object',
            properties: {
                expression: { type: 'string', description: '数学表达式，如 "2*(3+4)"' },
            },
            required: ['expression'],
        },
    },
    {
        name: 'send_email',
        description: '发送邮件通知',
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string', description: '收件人邮箱' },
                subject: { type: 'string', description: '邮件主题' },
                body: { type: 'string', description: '邮件正文' },
            },
            required: ['to', 'subject', 'body'],
        },
    },
];

// 工具实现
const toolImplementations: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
    query_database: async ({ sql }) => {
        // 安全校验：只允许 SELECT
        if (!sql.toString().trim().toUpperCase().startsWith('SELECT')) {
            return '错误：仅允许执行 SELECT 查询';
        }
        // const result = await db.query(sql);
        return JSON.stringify({ rows: [], count: 0 }); // 模拟返回
    },

    search_web: async ({ query }) => {
        // const results = await searchAPI(query);
        return JSON.stringify([{ title: '搜索结果', url: 'https://example.com' }]);
    },

    calculate: async ({ expression }) => {
        try {
            // 安全的数学计算（不使用 eval）
            const result = Function('"use strict"; return (' + expression + ')')();
            return String(result);
        } catch {
            return '计算错误：无效的表达式';
        }
    },

    send_email: async ({ to, subject, body }) => {
        // await emailService.send({ to, subject, body });
        return `邮件已发送至 ${to}`;
    },
};

// Agent 执行循环
async function runAgent(
    messages: Array<{role: string; content: string}>,
    maxIterations = 10,
): Promise<string> {
    for (let i = 0; i < maxIterations; i++) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages,
                tools: tools.map(t => ({ type: 'function', function: t })),
                tool_choice: 'auto',
            }),
        });

        const data = await response.json();
        const assistantMessage = data.choices[0].message;
        messages.push(assistantMessage);

        // 如果没有工具调用，返回最终回答
        if (!assistantMessage.tool_calls) {
            return assistantMessage.content;
        }

        // 执行工具调用
        for (const toolCall of assistantMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);

            console.log(`[Agent] 调用工具: ${functionName}(${JSON.stringify(args)})`);

            const implementation = toolImplementations[functionName];
            const result = implementation
                ? await implementation(args)
                : `错误：未知工具 ${functionName}`;

            // 将工具结果加入对话
            messages.push({
                role: 'tool',
                content: result,
                tool_call_id: toolCall.id,
            } as any);
        }
    }

    return '达到最大迭代次数，任务未完成';
}
```

### 方案二：ReAct 推理框架

ReAct（Reasoning + Acting）让模型在每一步先"思考"再"行动"。

```typescript
const REACT_SYSTEM_PROMPT = `你是一个智能助手，通过 Thought-Action-Observation 循环解决用户问题。

格式：
Thought: 分析当前情况，决定下一步
Action: 使用工具（从可用工具列表中选择）
Observation: 工具返回的结果

循环直到获得最终答案，然后用 Final Answer 回答。

示例：
Thought: 用户想知道北京天气，我需要搜索最新天气信息
Action: search_web({"query": "北京今日天气"})
Observation: 北京今日晴，气温 22°C，微风
Thought: 已获得天气信息，可以回答用户
Final Answer: 北京今天天气晴朗，气温 22°C，微风，适合外出。`;

async function runReActAgent(question: string): Promise<string> {
    const messages = [
        { role: 'system', content: REACT_SYSTEM_PROMPT },
        { role: 'user', content: question },
    ];

    for (let i = 0; i < 8; i++) {
        const response = await callLLM(messages);
        messages.push({ role: 'assistant', content: response });

        // 检查是否有 Final Answer
        const finalMatch = response.match(/Final Answer:\s*(.+)/s);
        if (finalMatch) return finalMatch[1].trim();

        // 解析 Action
        const actionMatch = response.match(/Action:\s*(\w+)\((.+)\)/);
        if (actionMatch) {
            const toolName = actionMatch[1];
            const toolArgs = JSON.parse(actionMatch[2]);
            const result = await toolImplementations[toolName]?.(toolArgs) ?? '工具未找到';

            messages.push({
                role: 'user',
                content: `Observation: ${result}`,
            });
        }
    }

    return '未能完成推理';
}
```

### Agent 方案对比

| 维度 | Function Calling | ReAct 推理 |
|------|-----------------|-----------|
| 实现复杂度 | 中 | 低 |
| 推理可控性 | 模型自主决定 | 显式推理步骤 |
| 调试友好度 | 中 | 高（可见思考过程） |
| Token 消耗 | 中 | 高（每步都输出推理） |
| 多步任务 | 支持 | 更适合 |
| 兼容性 | OpenAI / 国内大模型 | 所有模型 |
| 推荐场景 | 工具调用为主 | 需要推理过程可观测 |

**优点：**
- 模型从"只能说话"升级为"能使用工具"，能力边界大幅扩展
- Function Calling 是业界标准，各模型厂商都在支持
- 可组合多种工具，实现复杂的自动化工作流

**缺点：**
- 工具调用的安全性需要严格管控（如 SQL 注入、命令注入）
- 多步任务中模型可能在某一步出错，导致后续全部跑偏
- Token 消耗大，每次工具调用都增加上下文长度
- 模型的工具选择和参数生成不一定准确，需要容错处理

**适配场景：**
- 需要查询数据库/API 的智能客服
- 自动化工作流（审批、报告生成）
- 数据分析助手（查数据 + 计算 + 生成报告）
- 代码生成与执行

**局限性：**
- 不适合对安全性要求极高的场景（如直接操作支付系统）
- 工具数量过多时模型容易选错工具（建议不超过 10 个）
- 实时性要求高的场景受 LLM 响应速度限制

## 五、高级提示工程

当 RAG 和 Agent 都不适合时，精心设计的 Prompt 仍然是最轻量的方案。

### 5.1 思维链（Chain of Thought）

```typescript
const COT_PROMPT = `请一步步思考以下问题，展示完整的推理过程。

问题：{question}

请按以下格式回答：
1. 分析：拆解问题的关键要素
2. 推理：逐步分析每个要素
3. 结论：基于推理得出答案

回答：`;
```

### 5.2 自我一致性（Self-Consistency）

```typescript
async function selfConsistency(question: string, n = 5): Promise<string> {
    // 同一问题生成 n 次回答
    const answers = await Promise.all(
        Array(n).fill(null).map(() =>
            callLLM([{
                role: 'user',
                content: `请一步步思考：\n${question}`,
            }], { temperature: 0.7 })
        )
    );

    // 投票选择最常见的答案
    const answerCounts = new Map<string, number>();
    for (const answer of answers) {
        const normalized = answer.trim();
        answerCounts.set(normalized, (answerCounts.get(normalized) || 0) + 1);
    }

    let bestAnswer = '';
    let maxCount = 0;
    answerCounts.forEach((count, answer) => {
        if (count > maxCount) {
            maxCount = count;
            bestAnswer = answer;
        }
    });

    console.log(`一致度: ${maxCount}/${n}`);
    return bestAnswer;
}
```

### 5.3 结构化输出

```typescript
const STRUCTURED_OUTPUT_PROMPT = `你是一个数据提取助手。从用户输入中提取以下字段，严格以 JSON 格式返回。

要求的 JSON 结构：
{
    "name": "人名（string）",
    "phone": "手机号（string，11位数字）",
    "email": "邮箱地址（string）",
    "intent": "意图分类（枚举：consultation | complaint | feedback | other）",
    "urgency": "紧急程度（枚举：low | medium | high）",
    "summary": "用户需求摘要（string，不超过50字）"
}

规则：
- 无法确定的字段填 null
- 只返回 JSON，不要返回其他内容

用户输入：{input}`;

// 解析并校验
function parseStructuredOutput(raw: string): Record<string, unknown> | null {
    // 提取 JSON（兼容模型可能返回 ```json 包裹的情况）
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        // 类型校验
        const validIntents = ['consultation', 'complaint', 'feedback', 'other'];
        const validUrgency = ['low', 'medium', 'high'];

        if (parsed.intent && !validIntents.includes(parsed.intent)) parsed.intent = 'other';
        if (parsed.urgency && !validUrgency.includes(parsed.urgency)) parsed.urgency = 'medium';

        return parsed;
    } catch {
        return null;
    }
}
```

### 提示工程方案对比

| 技术 | Token 成本 | 准确率提升 | 适用场景 |
|------|-----------|-----------|---------|
| Zero-shot | 最低 | 基准 | 简单分类、翻译 |
| Few-shot | 低 | +10-20% | 格式化输出、特定风格 |
| CoT（思维链） | 中 | +20-40% | 数学推理、逻辑分析 |
| Self-Consistency | 高（×N） | +10-20% | 高准确性要求 |
| 结构化输出 | 低 | +15-30% | 数据提取、表单填充 |
| DPR（分解提示） | 中 | +10-25% | 复杂多步任务 |

## 六、AI 应用工程化

### 6.1 对话管理

```typescript
class ConversationManager {
    private maxContextTokens = 4000;

    // 滑动窗口 + 摘要：控制上下文长度
    async buildMessages(
        history: Array<{role: string; content: string}>,
        newMessage: string,
    ): Promise<Array<{role: string; content: string}>> {
        let messages = [...history, { role: 'user', content: newMessage }];

        // 估算 Token 数（粗略：1 中文字 ≈ 2 Token）
        const totalTokens = messages.reduce(
            (sum, m) => sum + m.content.length * 2, 0
        );

        if (totalTokens > this.maxContextTokens) {
            // 将早期对话压缩为摘要
            const recentMessages = messages.slice(-6);
            const oldMessages = messages.slice(0, -6);

            const summary = await callLLM([{
                role: 'user',
                content: `请用 200 字以内概括以下对话的关键信息：\n${
                    oldMessages.map(m => `${m.role}: ${m.content}`).join('\n')
                }`,
            }], { temperature: 0 });

            messages = [
                { role: 'system', content: `之前的对话摘要：${summary}` },
                ...recentMessages,
            ];
        }

        return messages;
    }
}
```

### 6.2 安全护栏

```typescript
class SafetyGuard {
    private sensitivePatterns: RegExp[];
    private blockedTopics: string[];

    constructor() {
        this.sensitivePatterns = [
            /password|密码|口令/gi,
            /\b\d{16,19}\b/g,           // 银行卡号
            /\b\d{6}\b/g,                // 6 位验证码
            /DROP\s+TABLE|DELETE\s+FROM/gi,  // SQL 注入
        ];

        this.blockedTopics = ['暴力', '违法', '色情'];
    }

    // 输入检查
    checkInput(input: string): { safe: boolean; reason?: string } {
        for (const pattern of this.sensitivePatterns) {
            if (pattern.test(input)) {
                return { safe: false, reason: '输入包含敏感信息' };
            }
        }
        return { safe: true };
    }

    // 输出检查
    checkOutput(output: string): { safe: boolean; sanitized: string } {
        let sanitized = output;
        for (const pattern of this.sensitivePatterns) {
            sanitized = sanitized.replace(pattern, '[已屏蔽]');
        }
        return { safe: sanitized === output, sanitized };
    }
}
```

### 6.3 缓存与降级

```typescript
class AIServiceWithCache {
    private cache = new Map<string, { answer: string; timestamp: number }>();
    private cacheTTL = 3600000; // 1 小时

    async answer(question: string): Promise<string> {
        // 1. 缓存命中
        const cacheKey = this.hashQuestion(question);
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.answer;
        }

        try {
            // 2. 主模型调用
            const answer = await this.callPrimaryModel(question);
            this.cache.set(cacheKey, { answer, timestamp: Date.now() });
            return answer;
        } catch (error) {
            // 3. 降级到备用模型
            console.warn('主模型失败，降级到备用模型:', error);
            try {
                return await this.callFallbackModel(question);
            } catch {
                // 4. 最终降级：返回预设回答
                return '抱歉，服务暂时不可用，请稍后再试。';
            }
        }
    }

    private hashQuestion(q: string): string {
        // 简单哈希（生产环境应使用正式哈希函数）
        return q.trim().toLowerCase().replace(/\s+/g, ' ');
    }

    private async callPrimaryModel(question: string): Promise<string> {
        // 调用自建模型
    }

    private async callFallbackModel(question: string): Promise<string> {
        // 降级到第三方 API
    }
}
```

## 七、方案对比总览

| 维度 | RAG | Agent | 高级 Prompt | 微调 |
|------|-----|-------|-----------|------|
| 知识增强 | 强 | 中 | 弱 | 强 |
| 行动能力 | 无 | 强 | 无 | 无 |
| 实现成本 | 中 | 高 | 低 | 高 |
| 推理延迟 | 高 | 高 | 低 | 低 |
| 可控性 | 中 | 低 | 高 | 高 |
| 维护成本 | 中 | 高 | 低 | 中 |
| 推荐场景 | 知识问答 | 自动化流程 | 快速验证 | 风格定制 |

## 总结

AI 应用进阶的核心是从"调 API"升级为"系统工程"：

1. **需要知识注入** → RAG（首选）或微调（风格定制）
2. **需要执行动作** → Function Calling Agent
3. **需要推理可控** → ReAct 框架 + 思维链
4. **需要工程可靠** → 安全护栏 + 缓存降级 + 对话管理

最有效的架构通常是 **RAG + Agent 的组合**：用 RAG 提供知识基础，用 Agent 扩展行动能力，用 Prompt Engineering 控制输出格式，用工程化手段保障稳定性。
