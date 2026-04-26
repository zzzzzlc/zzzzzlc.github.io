---
title: "从零开发与部署自己的 AI 模型"
date: "2026-04-26"
tags:
  - AI
  - 模型训练
  - 模型部署
  - 深度学习
  - 工程化
category: "AI 工程"
summary: "从实际业务需求出发，系统梳理 AI 模型开发与部署的完整路径，对比微调开源模型、从头训练、API 平台托管等多种方案，涵盖数据准备、训练流程、模型压缩、推理部署等核心环节。"
---

# 从零开发与部署自己的 AI 模型

## 一、问题来源

随着 AI 能力的普及，越来越多团队面临一个问题：**通用的基础模型（GPT-4、Claude）无法满足特定业务需求，需要自己的模型。** 具体场景包括：

**业务层面的痛点：**

- 客服系统需要理解公司专属的产品术语和业务流程，通用模型回答不够精准
- 内部文档检索需要领域知识增强，RAG 方案响应延迟高、成本大
- 图像识别需要检测特定缺陷（工业质检），通用视觉模型精度不够
- 数据隐私要求高，不能将敏感数据发送到第三方 API

**成本层面的痛点：**

- 调用商业 API 按 Token 计费，高并发场景下月费用动辄数万
- 每次请求依赖网络，延迟不稳定，用户体验差
- 业务逻辑与第三方绑定，供应商涨价或停服时没有退路

**技术层面的痛点：**

- 不知道从哪里入手，数据怎么准备、模型怎么选、训练怎么跑
- 训练出来的模型效果不好，不知如何调优
- 模型训练完了不知道怎么部署，怎么让线上业务用起来

本文将沿着 **需求分析 → 数据准备 → 模型选择 → 训练流程 → 部署上线** 的完整链路，对比不同阶段的技术方案。

## 二、明确需求：选对路线

在动手之前，先回答三个关键问题：

### 2.1 任务类型

| 任务类型 | 说明 | 典型场景 |
|---------|------|---------|
| 文本分类 | 将输入文本分到预定义类别 | 情感分析、垃圾邮件检测、工单分类 |
| 信息抽取 | 从非结构化文本中提取结构化信息 | 命名实体识别、关系抽取 |
| 文本生成 | 根据输入生成自然语言文本 | 对话系统、文案生成、代码补全 |
| 图像分类/检测 | 识别图像内容或定位目标 | 质检、安防、医疗影像 |
| 语音识别 | 将音频转为文本 | 语音助手、会议记录 |
| 推荐/排序 | 对候选项排序 | 搜索排序、内容推荐 |

### 2.2 数据量级与算力评估

| 数据规模 | 推荐方案 | 预估算力 |
|---------|---------|---------|
| < 1K 条 | Prompt Engineering / Few-shot | 无需训练 |
| 1K - 10K 条 | 微调小模型（7B 以下） | 单卡 GPU（如 RTX 4090） |
| 10K - 100K 条 | 微调中等模型（7B-13B） | 多卡 GPU 或云上 A100 |
| > 100K 条 | 全量训练或大规模微调 | GPU 集群 |

### 2.3 技术路线决策

```
有大量标注数据？
  ├── 否 → 数据不足，优先考虑：
  │       ├── Prompt Engineering（零成本）
  │       ├── RAG + 知识库（低成本）
  │       └── 数据标注后再训练
  └── 是 → 需要什么类型的模型？
          ├── 文本任务
          │   ├── 精度要求一般 → 微调开源模型（Llama / Qwen）
          │   └── 精度要求极高 → 从头训练（需大量数据+算力）
          ├── 图像任务
          │   ├── 分类/检测 → 微调 YOLO / ViT
          │   └── 生成 → 微调 Stable Diffusion
          └── 语音任务
              ├── 识别 → 微调 Whisper
              └── 合成 → 微调 VITS
```

## 三、方案一：微调开源预训练模型

最实用、性价比最高的路线。站在巨人肩膀上，用少量数据和算力获得领域定制能力。

### 3.1 模型选型

| 模型 | 参数量 | 语言 | 优势 | 许可证 |
|------|--------|------|------|--------|
| Qwen2.5 | 0.5B - 72B | 中英 | 中文能力最强，阿里出品 | Apache 2.0 |
| Llama 3.1 | 8B - 405B | 英为主 | Meta 出品，生态最丰富 | Llama 3.1 License |
| Mistral | 7B - 123B | 多语言 | 推理效率高，长上下文 | Apache 2.0 |
| ChatGLM4 | 6B - 130B | 中英 | 智谱出品，中文对话优秀 | Apache 2.0 |
| DeepSeek-V3 | 67B | 中英 | MoE 架构，推理成本低 | MIT |
| Phi-4 | 14B | 英为主 | 微软出品，小而精 | MIT |

### 3.2 数据准备

```python
# 数据格式：JSONL（每行一条样本）
# 监督微调（SFT）数据格式
{
    "instruction": "判断以下文本的情感倾向",
    "input": "这个产品太好用了，强烈推荐！",
    "output": "正面"
}

{
    "instruction": "提取以下文本中的实体",
    "input": "张三于2024年3月加入阿里巴巴，担任高级工程师",
    "output": "{\"人名\": \"张三\", \"时间\": \"2024年3月\", \"公司\": \"阿里巴巴\", \"职位\": \"高级工程师\"}"
}

# 数据质量 Checklist：
# 1. 标注一致性：同一任务至少两人标注，一致性 > 85%
# 2. 数据多样性：覆盖各种边界情况、长尾场景
# 3. 数据清洗：去除重复、噪声、格式错误
# 4. 分布均衡：各类别样本量相对均衡，避免长尾
```

**数据增强技巧：**

```python
# 1. 回译增强（中→英→中，获得语义相同但表述不同的样本）
from transformers import pipeline

translator = pipeline("translation", model="Helsinki-NLP/opus-mt-zh-en")
back_translator = pipeline("translation", model="Helsinki-NLP/opus-mt-en-zh")

def back_translate(text: str) -> str:
    en = translator(text)[0]['translation_text']
    zh = back_translator(en)[0]['translation_text']
    return zh

# 2. 提示词模板多样化
templates = [
    "请判断：{text}",
    "以下文本的情感是？{text}",
    "分析情感：{text}",
    "{text}\n请给出情感判断",
]

# 3. 格式转换（同一数据生成多种训练样本）
def convert_to_multiple_formats(raw_data):
    samples = []
    # 分类格式
    samples.append({
        "instruction": f"分类：{raw_data['category']}",
        "input": raw_data['text'],
        "output": raw_data['label'],
    })
    # 生成格式
    samples.append({
        "instruction": "请分析以下内容并给出判断",
        "input": raw_data['text'],
        "output": f"经过分析，该内容的类别为{raw_data['label']}，原因：{raw_data['reason']}",
    })
    return samples
```

### 3.3 LoRA 高效微调

LoRA（Low-Rank Adaptation）只训练极少量参数（原模型的 0.1%-1%），单卡即可微调 7B 模型。

```python
# 使用 Hugging Face + PEFT + TRL 微调
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer

# 1. 加载基础模型
model_name = "Qwen/Qwen2.5-7B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    trust_remote_code=True,
    torch_dtype="auto",
    device_map="auto",
    load_in_4bit=True,  # 4-bit 量化加载，节省显存
)

# 2. 配置 LoRA
lora_config = LoraConfig(
    task_type=TaskType.CAUSAL_LM,
    r=16,                # LoRA 秩（常用 8/16/32）
    lora_alpha=32,       # 缩放因子（通常 = 2 * r）
    lora_dropout=0.05,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    bias="none",
)

model = get_peft_model(model, lora_config)
model.print_trainable_parameters()
# 输出：trainable params: 13M || all params: 7B || trainable%: 0.19%

# 3. 训练配置
training_args = TrainingArguments(
    output_dir="./output",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,   # 等效 batch_size = 4 * 8 = 32
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.1,
    logging_steps=10,
    save_strategy="epoch",
    fp16=True,
    optim="adamw_torch",
    report_to="none",
)

# 4. 开始训练
trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    processing_class=tokenizer,
    max_seq_length=2048,
)

trainer.train()
trainer.save_model("./my-lora-adapter")
```

### 3.4 模型合并与导出

```python
from peft import AutoPeftModelForCausalLM

# 合并 LoRA 权重到基础模型
model = AutoPeftModelForCausalLM.from_pretrained(
    "./my-lora-adapter",
    device_map="auto",
    torch_dtype="auto",
)
merged_model = model.merge_and_unload()
merged_model.save_pretrained("./my-merged-model")
tokenizer.save_pretrained("./my-merged-model")
```

**优点：**
- 数据需求量少（1K-10K 条即可见效）
- 算力要求低，单卡 RTX 4090 可微调 7B 模型
- 训练时间短（数小时到 1-2 天）
- 开源生态成熟，工具链完善（Hugging Face、vLLM、ollama）
- LoRA 参数可插拔，一套基础模型支持多个业务场景

**缺点：**
- 受限于基础模型的能力上限，无法突破预训练瓶颈
- 微调数据质量要求高，脏数据会导致"灾难性遗忘"
- 不同模型需要不同的微调策略，迁移成本存在
- 商业使用需注意模型许可证（如 Llama 有使用限制）

**适配场景：**
- 特定领域的文本分类、信息抽取、对话系统
- 企业内部知识增强（客服、文档问答）
- 图像分类、目标检测的定制化需求
- 资源有限的中小团队

**局限性：**
- 无法获得基础模型不具备的能力（如微调中文模型学不会日文）
- 过度微调会导致通用能力下降
- 推理需要 GPU，CPU 推理速度很慢

## 四、方案二：从头训练模型

当开源模型无法满足需求（新语言、新模态、特殊架构）时，从头训练是唯一选择。

### 4.1 数据工程

```python
# 大规模数据预处理流水线
import json
from pathlib import Path
from multiprocessing import Pool

def preprocess_file(file_path: str) -> list[dict]:
    """处理单个数据文件"""
    samples = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            raw = json.loads(line)
            # 清洗：去除过短、过长、含特殊字符的样本
            text = raw.get('text', '').strip()
            if len(text) < 10 or len(text) > 100000:
                continue
            if any(char in text for char in ['\x00', '\ufffd']):
                continue
            samples.append({'text': text})
    return samples

def build_dataset(data_dir: str, output_path: str, num_workers: int = 8):
    """并行处理大规模数据"""
    files = list(Path(data_dir).glob('**/*.jsonl'))
    with Pool(num_workers) as pool:
        results = pool.map(preprocess_file, [str(f) for f in files])

    all_samples = [s for batch in results for s in batch]
    # 去重
    seen = set()
    unique_samples = []
    for s in all_samples:
        key = s['text'][:100]  # 前缀去重
        if key not in seen:
            seen.add(key)
            unique_samples.append(s)

    with open(output_path, 'w', encoding='utf-8') as f:
        for s in unique_samples:
            f.write(json.dumps(s, ensure_ascii=False) + '\n')

    print(f"总样本数: {len(all_samples)}, 去重后: {len(unique_samples)}")
```

### 4.2 分布式训练

```python
# 使用 PyTorch + DeepSpeed 进行分布式训练
# deepspeed_config.json
{
    "train_batch_size": 128,
    "train_micro_batch_size_per_gpu": 2,
    "gradient_accumulation_steps": 16,
    "optimizer": {
        "type": "AdamW",
        "params": {
            "lr": 1e-4,
            "betas": [0.9, 0.95],
            "weight_decay": 0.1
        }
    },
    "fp16": {
        "enabled": true
    },
    "zero_optimization": {
        "stage": 3,
        "offload_optimizer": {
            "device": "cpu",
            "pin_memory": true
        },
        "offload_param": {
            "device": "cpu",
            "pin_memory": true
        }
    },
    "scheduler": {
        "type": "Cosine",
        "params": {
            "warmup_min_lr": 1e-6,
            "warmup_max_lr": 1e-4,
            "warmup_num_steps": 2000,
            "total_num_steps": 100000
        }
    }
}
```

```bash
# 启动 8 卡分布式训练
torchrun --nproc_per_node=8 \
    train.py \
    --deepspeed deepspeed_config.json \
    --model_config config_7b.json \
    --data_path /data/pretrain \
    --output_dir /output/checkpoints \
    --wandb_project my-model
```

**优点：**
- 完全自主可控，模型架构、训练数据、训练策略全部自定义
- 可以训练出针对特定任务的最优模型
- 无许可证限制，可自由商用

**缺点：**
- 数据需求量巨大（预训练至少数十亿 Token）
- 算力成本极高（训练一个 7B 模型约需 8×A100 运行数周，费用数万到数十万）
- 需要专业的 ML 工程团队
- 训练失败成本高，调参周期长

**适配场景：**
- 大规模商业化 AI 产品（自研大模型）
- 特殊语言或领域的预训练模型
- 需要特殊架构的研究项目
- 数据安全要求极高、完全不能外传的场景

**局限性：**
- 非大厂/研究机构不建议尝试预训练
- 单次训练成本高昂，试错空间小
- 需要持续的算力投入进行迭代优化

## 五、方案三：API 平台托管训练

使用云平台的一站式训练服务，无需管理 GPU 和训练框架。

### 5.1 主流平台对比

| 平台 | 特点 | 支持模型 | 计费方式 |
|------|------|---------|---------|
| OpenAI Fine-tuning | 最简单的文本微调 | GPT-4o-mini / GPT-3.5 | 按 Token 计费 |
| 阿里云百炼 | 中文能力最强的微调平台 | Qwen 全系列 | 按算力/Token |
| 火山方舟 | 字节出品，国内合规 | 豆包系列 | 按算力 |
| Together AI | 开源模型微调，性价比高 | Llama / Mistral / Qwen | 按 GPU 时间 |
| Replicate | 一键微调，极简操作 | 多种开源模型 | 按 GPU 时间 |
| Google Vertex AI | GCP 生态集成 | Gemini / Gemma | 按 GPU 时间 |

### 5.2 OpenAI Fine-tuning 示例

```python
from openai import OpenAI

client = OpenAI()

# 1. 上传训练数据
with open("training_data.jsonl", "rb") as f:
    training_file = client.files.create(file=f, purpose="fine-tune")

# 2. 创建微调任务
fine_tune = client.fine_tuning.jobs.create(
    training_file=training_file.id,
    model="gpt-4o-mini-2024-07-18",
    hyperparameters={
        "n_epochs": 3,
        "batch_size": 16,
        "learning_rate_multiplier": 0.5,
    },
)

# 3. 监控训练进度
import time
while True:
    job = client.fine_tuning.jobs.retrieve(fine_tune.id)
    print(f"状态: {job.status}, 已训练 Token: {job.trained_tokens}")
    if job.status in ("succeeded", "failed", "cancelled"):
        break
    time.sleep(60)

# 4. 使用微调后的模型
fine_tuned_model = job.fine_tuned_model
response = client.chat.completions.create(
    model=fine_tuned_model,
    messages=[
        {"role": "system", "content": "你是一个专业的客服助手"},
        {"role": "user", "content": "退款需要多久？"},
    ],
)
print(response.choices[0].message.content)
```

### 5.3 阿里云百炼微调示例

```python
import dashscope
from dashscope import FineTuning

dashscope.api_key = "your-api-key"

# 1. 上传训练数据
upload_result = FineTuning.upload_file(
    file_path="training_data.jsonl",
    purpose="fine-tune",
)
file_id = upload_result['file_id']

# 2. 创建微调任务
job = FineTuning.create(
    model="qwen2.5-7b-instruct",
    training_file_ids=[file_id],
    hyperparameters={
        "n_epochs": 3,
        "batch_size": 8,
        "learning_rate": 2e-5,
    },
)
job_id = job['job_id']

# 3. 查询状态
status = FineTuning.get(job_id=job_id)
print(f"状态: {status['status']}")

# 4. 部署为 API 服务
deploy_result = FineTuning.deploy(
    job_id=job_id,
    instance_type="gpu.a10",
)
endpoint = deploy_result['endpoint']
```

**优点：**
- 零基础设施管理，上传数据即可训练
- 全托管部署，直接获得 API 端点
- 操作简单，非 ML 专业背景也能使用
- 训练监控、自动调参等工具齐全

**缺点：**
- 定制化程度有限，不能修改模型架构
- 数据上传到第三方平台，存在隐私风险
- 长期使用成本高于自建（API 调用按量计费）
- 供应商锁定，迁移成本高

**适配场景：**
- 快速验证想法，不想投入基础设施
- 数据隐私要求不高的场景
- 非专业 ML 团队的业务定制需求
- MVP 阶段的原型验证

**局限性：**
- 不适合需要完全控制训练过程的场景
- 数据出境合规问题（使用海外平台时）
- 训练参数可调范围有限

## 六、模型压缩与优化

无论哪种训练方案，部署前都需要对模型进行压缩。

### 6.1 量化（Quantization）

```python
# GPTQ 4-bit 量化（推理速度提升 2-3 倍，显存减少 70%）
from transformers import AutoModelForCausalLM, AutoTokenizer, GPTQConfig

tokenizer = AutoTokenizer.from_pretrained("./my-merged-model")
gptq_config = GPTQConfig(bits=4, dataset="c4", tokenizer=tokenizer)
quantized_model = AutoModelForCausalLM.from_pretrained(
    "./my-merged-model",
    quantization_config=gptq_config,
    device_map="auto",
)
quantized_model.save_pretrained("./my-model-gptq-4bit")

# GGUF 格式（支持 CPU 推理，适合本地部署）
# 使用 llama.cpp 转换
# python convert_hf_to_gguf.py ./my-merged-model --outtype q4_k_m --outfile my-model.gguf
```

### 6.2 模型对比

| 精度 | 显存占用（7B） | 推理速度 | 精度损失 | 适用场景 |
|------|--------------|---------|---------|---------|
| FP16 | 14 GB | 基准 | 无 | 训练、高精度推理 |
| 8-bit | 7 GB | +30% | 极小 | 服务端推理 |
| 4-bit (GPTQ) | 4 GB | +50% | 小 | 服务端低成本推理 |
| 4-bit (GGUF) | 4 GB | 基准 | 小 | CPU / 边缘设备 |

## 七、模型部署方案

### 方案 A：自建推理服务（vLLM）

高性能推理引擎，支持连续批处理和 PagedAttention。

```python
# 安装 vLLM
# pip install vllm

from vllm import LLM, SamplingParams

# 加载模型
llm = LLM(
    model="./my-merged-model",
    tensor_parallel_size=2,  # 2 卡并行
    gpu_memory_utilization=0.9,
    max_model_len=4096,
    quantization="gptq",  # 如果是量化模型
)

# 批量推理
prompts = [
    "请判断以下文本的情感：这个产品太棒了",
    "提取实体：张三在北京创办了科技公司",
]
sampling_params = SamplingParams(temperature=0.7, max_tokens=256)
outputs = llm.generate(prompts, sampling_params)

for output in outputs:
    print(f"输入: {output.prompt}")
    print(f"输出: {output.outputs[0].text}")
```

**启动 API 服务：**

```bash
# 启动兼容 OpenAI 格式的 API 服务
python -m vllm.entrypoints.openai.api_server \
    --model ./my-merged-model \
    --host 0.0.0.0 \
    --port 8000 \
    --tensor-parallel-size 2 \
    --gpu-memory-utilization 0.9 \
    --max-model-len 4096

# 客户端调用（与 OpenAI SDK 兼容）
from openai import OpenAI
client = OpenAI(base_url="http://localhost:8000/v1", api_key="empty")

response = client.chat.completions.create(
    model="./my-merged-model",
    messages=[{"role": "user", "content": "你好"}],
)
```

### 方案 B：Ollama 本地部署

最简单的本地部署方案，一行命令运行模型。

```bash
# 1. 创建 Modelfile
cat > Modelfile <<'EOF'
FROM ./my-model.gguf

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096

SYSTEM 你是一个专业的AI助手，擅长回答技术问题。
EOF

# 2. 构建模型
ollama create my-model -f Modelfile

# 3. 运行
ollama run my-model

# 4. API 调用
curl http://localhost:11434/api/generate -d '{
    "model": "my-model",
    "prompt": "什么是微服务架构？"
}'
```

### 方案 C：Docker 容器化部署

```dockerfile
# Dockerfile
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

RUN pip install vllm fastapi uvicorn

COPY ./my-merged-model /app/model

EXPOSE 8000

CMD ["python", "-m", "vllm.entrypoints.openai.api_server", \
     "--model", "/app/model", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--tensor-parallel-size", "1"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  model-server:
    build: .
    ports:
      - "8000:8000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
    restart: unless-stopped

  # API 网关（限流、鉴权、日志）
  gateway:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - model-server
```

### 方案 D：Serverless 无服务器部署

```python
# 使用 AWS Lambda +容器镜像部署小模型
# 或使用 Cloudflare Workers AI / Modal / BentoML

# BentoML 示例
import bentoml
from bentoml.io import JSON

# 定义服务
runner = bentoml.transformers.get("my-model:latest").to_runner()
svc = bentoml.Service("my_model_service", runners=[runner])

@svc.api(input=JSON(), output=JSON())
async def predict(input_data: dict) -> dict:
    result = await runner.generate.run(
        input_data["prompt"],
        max_new_tokens=256,
    )
    return {"result": result}
```

### 部署方案对比

| 维度 | vLLM 自建 | Ollama 本地 | Docker 容器 | Serverless |
|------|----------|------------|------------|-----------|
| 适用场景 | 生产环境 | 开发测试 | 标准化部署 | 低流量/弹性 |
| 并发能力 | 高（连续批处理） | 低（单请求） | 高 | 中 |
| 运维成本 | 高 | 低 | 中 | 低 |
| GPU 要求 | 必须 | 可选 | 必须 | 平台提供 |
| 冷启动 | 无 | 无 | 无 | 有（数秒到数分钟） |
| 扩展性 | 手动扩容 | 不支持 | K8s 弹性 | 自动弹性 |
| 成本模型 | 固定（GPU 租赁） | 免费 | 固定 | 按用量 |

## 八、前端接入与效果评估

### 8.1 前端接入

```typescript
// 统一 AI 服务封装
class AIService {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async chat(messages: Array<{role: string; content: string}>, options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<string> {
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getApiKey()}`,
            },
            body: JSON.stringify({
                model: 'my-model',
                messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 256,
            }),
        });

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // 流式输出（SSE）
    async *chatStream(messages: Array<{role: string; content: string}>) {
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getApiKey()}`,
            },
            body: JSON.stringify({
                model: 'my-model',
                messages,
                stream: true,
            }),
        });

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') return;
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                if (content) yield content;
            }
        }
    }

    private getApiKey(): string {
        return process.env.NEXT_PUBLIC_AI_API_KEY || '';
    }
}
```

### 8.2 效果评估

```python
# 模型评估指标
def evaluate_model(model, test_dataset):
    results = {
        "accuracy": 0,       # 准确率
        "precision": 0,      # 精确率
        "recall": 0,         # 召回率
        "f1_score": 0,       # F1 分数
        "latency_p50": 0,    # 中位数延迟
        "latency_p99": 0,    # P99 延迟
        "tokens_per_second": 0,  # 吞吐量
    }

    # 自动评估
    correct = 0
    total = len(test_dataset)
    for sample in test_dataset:
        prediction = model.predict(sample['input'])
        if prediction == sample['expected']:
            correct += 1
    results['accuracy'] = correct / total

    # A/B 测试：新旧模型对比
    # 新模型与基础模型（或第三方 API）在相同测试集上对比
    # 人工评估：随机抽样 100 条，人工评判输出质量

    return results
```

## 九、方案对比总览

| 维度 | 微调开源模型 | 从头训练 | API 平台托管 |
|------|------------|---------|------------|
| 数据需求 | 1K-10K | 数十亿 Token | 1K-10K |
| 算力需求 | 单卡 GPU | GPU 集群 | 无（平台提供） |
| 时间成本 | 数小时-数天 | 数周-数月 | 数小时 |
| 人力成本 | 1-2 人 | 专业团队 | 1 人 |
| 金钱成本 | 低（自有 GPU） | 极高 | 中（按量计费） |
| 定制程度 | 中 | 最高 | 低 |
| 数据隐私 | 高（本地训练） | 最高 | 低（上传到平台） |
| 推荐路线 | 首选 | 仅限大厂 | 快速验证 |

## 总结

开发部署自己的模型不是一蹴而就的事情，推荐分阶段推进：

1. **阶段一（验证）**：用 Prompt Engineering + RAG 验证需求是否真实存在
2. **阶段二（微调）**：准备 1K-10K 条高质量数据，微调开源 7B 模型（LoRA）
3. **阶段三（部署）**：量化为 4-bit，用 vLLM 或 Ollama 部署推理服务
4. **阶段四（优化）**：根据线上反馈持续迭代数据和模型

大多数场景下，**LoRA 微调开源模型 + 量化 + vLLM 部署** 是性价比最高的路线。从头训练只在业务规模和团队实力都足够时才值得考虑。
