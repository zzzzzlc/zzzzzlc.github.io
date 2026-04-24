---
title: "前端文件上传与批量上传方案全解析"
date: "2026-04-24"
tags:
  - 文件上传
  - 大文件分片
  - 断点续传
  - 批量上传
  - 前端工程化
category: "前端进阶"
summary: "从实际项目中文件上传的常见问题出发，对比分析 FormData 直传、分片上传、断点续传、拖拽批量上传等多种方案，涵盖进度追踪、并发控制、秒传判断等核心能力的实现。"
---

# 前端文件上传与批量上传方案全解析

## 一、问题来源

文件上传是几乎所有业务系统都绕不开的功能，但在实际项目中，简单的 `<input type="file">` 远远不够：

**基础场景的痛点：**

- 用户选择了错误文件，上传完才发现，没有上传前预览和校验
- 上传进度不可见，大文件上传时用户以为页面卡死，反复刷新导致重复提交
- 网络波动导致上传失败，只能从头再来，几百 MB 的文件要重新传

**批量场景的痛点：**

- 一次选择 100 个文件，浏览器发起 100 个并发请求，服务端直接打挂
- 部分文件失败后无法单独重试，只能全部重新上传
- 文件夹上传保留不了目录结构，解压后文件找不到对应关系
- 上传队列没有优先级，小文件和大文件排队等待，体验差

**大文件场景的痛点：**

- 单个文件 2GB，FormData 直传在弱网环境下几乎不可能成功
- 上传到 90% 断网，重连后从头开始，用户心态崩溃
- 服务端收到完整文件前无法处理，无法做到边传边解析

**安全场景的痛点：**

- 用户上传 `.exe`、`.php` 等危险文件绕过了前端校验
- 同一文件被不同用户重复上传，浪费存储空间
- 上传接口被恶意刷量，没有限流和鉴权

这些问题的核心是：**文件上传不是简单的 HTTP POST，而是一个涉及可靠性、性能、安全和用户体验的完整工程问题。**

## 二、方案一：FormData 直传

最基础的上传方式，适合小文件、简单场景。

### 基本实现

```typescript
async function uploadFile(file: File, url: string): Promise<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('size', String(file.size));

    const response = await fetch(url, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) throw new Error(`上传失败: HTTP ${response.status}`);
    return response.json();
}
```

### 带进度追踪

`fetch` 不支持上传进度，需要使用 `XMLHttpRequest`：

```typescript
interface UploadOptions {
    url: string;
    file: File;
    onProgress?: (percent: number) => void;
    onSuccess?: (response: unknown) => void;
    onError?: (error: Error) => void;
    metadata?: Record<string, string>;
}

function uploadWithProgress(options: UploadOptions): { abort: () => void } {
    const { url, file, onProgress, onSuccess, onError, metadata } = options;
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append('file', file);
    if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
            formData.append(key, value);
        });
    }

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
        }
    };

    xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const response = JSON.parse(xhr.responseText);
                onSuccess?.(response);
            } catch {
                onSuccess?.(xhr.responseText);
            }
        } else {
            onError?.(new Error(`上传失败: HTTP ${xhr.status}`));
        }
    };

    xhr.onerror = () => onError?.(new Error('网络错误'));
    xhr.onabort = () => onError?.(new Error('上传已取消'));

    xhr.open('POST', url);
    xhr.send(formData);

    return { abort: () => xhr.abort() };
}
```

### 文件校验

```typescript
interface FileValidation {
    maxSize?: number;          // 字节
    accept?: string[];         // MIME 类型或扩展名
    maxNameLength?: number;
}

function validateFile(file: File, rules: FileValidation): string | null {
    if (rules.maxSize && file.size > rules.maxSize) {
        const maxMB = (rules.maxSize / 1024 / 1024).toFixed(1);
        return `文件大小不能超过 ${maxMB}MB`;
    }

    if (rules.accept) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const isAccepted = rules.accept.some(pattern => {
            if (pattern.startsWith('.')) return ext === pattern.slice(1).toLowerCase();
            if (pattern.includes('/')) return file.type === pattern || file.type.startsWith(pattern.replace('/*', '/'));
            return true;
        });
        if (!isAccepted) return `不支持的文件格式: .${ext}`;
    }

    if (rules.maxNameLength && file.name.length > rules.maxNameLength) {
        return `文件名不能超过 ${rules.maxNameLength} 个字符`;
    }

    return null; // 校验通过
}
```

**优点：**
- 实现最简单，浏览器原生支持
- 兼容性最好，支持所有现代浏览器
- 代码量少，维护成本低

**缺点：**
- 大文件上传失败后无法续传，必须从头开始
- 单次请求传输整个文件，弱网环境容易超时
- 无法实现秒传（判断文件是否已存在）
- 并发上传多个文件时需要自行管理队列

**适配场景：**
- 文件大小在 50MB 以内的简单上传场景
- 内部管理系统的附件上传
- 快速原型、MVP 阶段

**局限性：**
- 不适合大文件（>100MB）和弱网环境
- 无法满足断点续传和秒传需求

## 三、方案二：大文件分片上传 + 断点续传

将大文件切分成固定大小的块（chunk），逐块上传，失败后只需重传失败的块。

### 文件分片与哈希计算

```typescript
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

interface FileChunk {
    index: number;
    blob: Blob;
    size: number;
    hash?: string;
}

interface SplitResult {
    fileHash: string;
    fileName: string;
    fileSize: number;
    totalChunks: number;
    chunks: FileChunk[];
}

// 使用 Web Worker 计算文件哈希，避免阻塞 UI
function calculateHash(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        // 使用抽样哈希：对大文件只取首尾和中间部分，加速计算
        const sampleSize = 2 * 1024 * 1024; // 抽样 2MB
        const chunks: Blob[] = [];

        if (file.size <= sampleSize * 3) {
            // 小文件直接全量计算
            chunks.push(file);
        } else {
            // 大文件抽样：头部 + 中间 + 尾部
            chunks.push(file.slice(0, sampleSize));
            chunks.push(file.slice(Math.floor(file.size / 2), Math.floor(file.size / 2) + sampleSize));
            chunks.push(file.slice(file.size - sampleSize, file.size));
        }

        const blob = new Blob(chunks);
        reader.onload = async (e) => {
            const buffer = e.target?.result as ArrayBuffer;
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            resolve(hash);
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(blob);
    });
}

async function splitFile(file: File): Promise<SplitResult> {
    const fileHash = await calculateHash(file);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const chunks: FileChunk[] = [];

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        chunks.push({
            index: i,
            blob: file.slice(start, end),
            size: end - start,
        });
    }

    return {
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        chunks,
    };
}
```

### 分片上传核心逻辑

```typescript
interface ChunkUploadOptions {
    url: string;
    file: File;
    concurrency?: number;
    onProgress?: (percent: number) => void;
    onChunkProgress?: (chunkIndex: number, percent: number) => void;
    retryCount?: number;
}

interface UploadTask {
    fileHash: string;
    fileName: string;
    totalChunks: number;
    uploadedChunks: Set<number>;
    status: 'pending' | 'uploading' | 'paused' | 'done' | 'error';
}

async function chunkUpload(options: ChunkUploadOptions): Promise<unknown> {
    const {
        url, file, concurrency = 3,
        onProgress, onChunkProgress,
        retryCount = 3,
    } = options;

    const { fileHash, fileName, totalChunks, chunks } = await splitFile(file);

    // 1. 秒传检查：询问服务端是否已有该文件
    const checkResp = await fetch(`${url}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileHash, fileName, totalChunks }),
    });
    const checkData = await checkResp.json();

    if (checkData.uploaded) {
        onProgress?.(100);
        return checkData; // 秒传成功
    }

    const uploadedChunks = new Set<number>(checkData.uploadedChunks || []);
    const pendingChunks = chunks.filter(c => !uploadedChunks.has(c.index));

    let completedBytes = uploadedChunks.size * CHUNK_SIZE;
    const totalBytes = file.size;

    // 2. 并发上传分片
    const uploadChunk = async (chunk: FileChunk): Promise<void> => {
        let attempts = 0;
        while (attempts < retryCount) {
            try {
                const formData = new FormData();
                formData.append('chunk', chunk.blob);
                formData.append('fileHash', fileHash);
                formData.append('chunkIndex', String(chunk.index));
                formData.append('totalChunks', String(totalChunks));
                formData.append('fileName', fileName);

                await fetch(`${url}/chunk`, { method: 'POST', body: formData });

                completedBytes += chunk.size;
                onProgress?.(Math.round((completedBytes / totalBytes) * 100));
                onChunkProgress?.(chunk.index, 100);
                return;
            } catch (err) {
                attempts++;
                if (attempts >= retryCount) throw err;
                // 指数退避重试
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts)));
            }
        }
    };

    await runWithConcurrency(pendingChunks, uploadChunk, concurrency);

    // 3. 通知服务端合并
    const mergeResp = await fetch(`${url}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileHash, fileName, totalChunks, fileSize: file.size }),
    });

    return mergeResp.json();
}
```

### 并发控制

```typescript
function runWithConcurrency<T>(
    items: T[],
    handler: (item: T) => Promise<void>,
    concurrency: number,
): Promise<void> {
    return new Promise((resolve, reject) => {
        let index = 0;
        let active = 0;
        let hasError = false;

        const next = () => {
            if (hasError) return;
            if (index >= items.length && active === 0) {
                resolve();
                return;
            }

            while (active < concurrency && index < items.length) {
                const item = items[index++];
                active++;
                handler(item)
                    .then(() => {
                        active--;
                        next();
                    })
                    .catch((err) => {
                        hasError = true;
                        reject(err);
                    });
            }
        };

        next();
    });
}
```

### 暂停与恢复

```typescript
class ResumableUploader {
    private abortControllers = new Map<number, AbortController>();
    private paused = false;
    private pendingChunks: FileChunk[] = [];

    pause() {
        this.paused = true;
        this.abortControllers.forEach((controller) => controller.abort());
        this.abortControllers.clear();
    }

    resume() {
        this.paused = false;
        // 重新上传暂停的分片
        this.uploadPendingChunks();
    }

    private async uploadPendingChunks() {
        // 从 pendingChunks 中取出未完成的分片继续上传
    }
}
```

**优点：**
- 大文件上传稳定可靠，失败后只需重传失败的分片
- 支持秒传，相同文件不重复上传，节省带宽和存储
- 支持暂停/恢复，用户体验好
- 分片大小可配置，适应不同网络环境

**缺点：**
- 实现复杂度高，前后端都需要改造
- 文件哈希计算耗时（全量 SHA-256 对 GB 级文件较慢）
- 服务端需要维护分片临时存储和合并逻辑
- 分片数量多时，HTTP 请求开销大

**适配场景：**
- 文件大于 100MB 的上传场景
- 视频平台、网盘、设计协作工具等大文件业务
- 需要断点续传和秒传能力的企业级应用

**局限性：**
- 服务端必须支持分片接收和合并接口
- 哈希计算可能阻塞主线程（需 Web Worker）
- 跨域场景需要配置 CORS，`Range` 请求头可能被拦截

## 四、方案三：拖拽批量上传 + 队列管理

面向多文件场景，提供拖拽上传、文件队列、并发控制、状态管理的完整方案。

### 拖拽区域组件

```tsx
interface DropZoneProps {
    accept?: string[];
    maxSize?: number;
    maxFiles?: number;
    onFiles: (files: File[]) => void;
}

function DropZone({ accept, maxSize, maxFiles, onFiles }: DropZoneProps) {
    const [dragging, setDragging] = useState(false);
    const dragCount = useRef(0);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        dragCount.current++;
        setDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        dragCount.current--;
        if (dragCount.current === 0) setDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        dragCount.current = 0;
        setDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files);

        // 支持文件夹上传
        if (e.dataTransfer.items) {
            const entries = Array.from(e.dataTransfer.items)
                .map(item => item.webkitGetAsEntry())
                .filter(Boolean);
            readAllEntries(entries).then(files => onFiles(files));
        } else {
            onFiles(droppedFiles);
        }
    };

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
                border: `2px dashed ${dragging ? '#1677ff' : '#d9d9d9'}`,
                borderRadius: 8,
                padding: '40px 20px',
                textAlign: 'center',
                background: dragging ? '#e6f4ff' : '#fafafa',
                transition: 'all 0.3s',
                cursor: 'pointer',
            }}
        >
            <UploadOutlined style={{ fontSize: 32, color: dragging ? '#1677ff' : '#999' }} />
            <p style={{ marginTop: 8, color: '#666' }}>
                {dragging ? '释放文件以上传' : '将文件拖到此处，或点击选择文件'}
            </p>
        </div>
    );
}
```

### 文件夹遍历

```typescript
async function readAllEntries(entries: (FileSystemEntry | null)[]): Promise<File[]> {
    const files: File[] = [];

    async function readEntry(entry: FileSystemEntry, path = ''): Promise<void> {
        if (entry.isFile) {
            const fileEntry = entry as FileSystemFileEntry;
            const file = await new Promise<File>((resolve, reject) => {
                fileEntry.file(resolve, reject);
            });
            // 保留目录结构信息
            Object.defineProperty(file, 'webkitRelativePath', {
                value: path + file.name,
                writable: false,
            });
            files.push(file);
        } else if (entry.isDirectory) {
            const dirReader = (entry as FileSystemDirectoryEntry).createReader();
            const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
                const results: FileSystemEntry[] = [];
                const readBatch = () => {
                    dirReader.readEntries((batch) => {
                        if (batch.length === 0) {
                            resolve(results);
                        } else {
                            results.push(...batch);
                            readBatch(); // 可能需要多次读取
                        }
                    }, reject);
                };
                readBatch();
            });
            for (const child of entries) {
                await readEntry(child, path + entry.name + '/');
            }
        }
    }

    for (const entry of entries) {
        if (entry) await readEntry(entry);
    }
    return files;
}
```

### 上传队列管理

```typescript
type FileStatus = 'pending' | 'uploading' | 'success' | 'error' | 'paused';

interface QueueItem {
    id: string;
    file: File;
    status: FileStatus;
    progress: number;
    error?: string;
    abortController?: AbortController;
}

class UploadQueue {
    private queue: QueueItem[] = [];
    private concurrency: number;
    private activeCount = 0;
    private uploadFn: (item: QueueItem) => Promise<void>;
    private onUpdate?: (queue: QueueItem[]) => void;

    constructor(options: {
        concurrency?: number;
        uploadFn: (item: QueueItem) => Promise<void>;
        onUpdate?: (queue: QueueItem[]) => void;
    }) {
        this.concurrency = options.concurrency ?? 3;
        this.uploadFn = options.uploadFn;
        this.onUpdate = options.onUpdate;
    }

    add(files: File[]) {
        const newItems = files.map(file => ({
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            file,
            status: 'pending' as FileStatus,
            progress: 0,
        }));
        this.queue.push(...newItems);
        this.notify();
        this.process();
        return newItems;
    }

    retry(id: string) {
        const item = this.queue.find(i => i.id === id);
        if (item && item.status === 'error') {
            item.status = 'pending';
            item.progress = 0;
            item.error = undefined;
            this.notify();
            this.process();
        }
    }

    remove(id: string) {
        const item = this.queue.find(i => i.id === id);
        if (item?.abortController) item.abortController.abort();
        this.queue = this.queue.filter(i => i.id !== id);
        this.notify();
    }

    pause(id: string) {
        const item = this.queue.find(i => i.id === id);
        if (item && item.status === 'uploading') {
            item.abortController?.abort();
            item.status = 'paused';
            this.activeCount--;
            this.notify();
            this.process();
        }
    }

    getQueue() { return this.queue; }

    private async process() {
        while (this.activeCount < this.concurrency) {
            const next = this.queue.find(i => i.status === 'pending');
            if (!next) break;

            this.activeCount++;
            next.status = 'uploading';
            next.abortController = new AbortController();
            this.notify();

            try {
                await this.uploadFn(next);
                next.status = 'success';
                next.progress = 100;
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    next.status = 'error';
                    next.error = (err as Error).message;
                }
            } finally {
                this.activeCount--;
                this.notify();
                this.process();
            }
        }
    }

    private notify() {
        this.onUpdate?.([...this.queue]);
    }
}
```

### 批量上传 UI 组件

```tsx
function BatchUploader() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const queueRef = useRef(new UploadQueue({
        concurrency: 3,
        uploadFn: async (item) => {
            const formData = new FormData();
            formData.append('file', item.file);

            const xhr = new XMLHttpRequest();
            item.abortController = new AbortController();

            return new Promise<void>((resolve, reject) => {
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        item.progress = Math.round((e.loaded / e.total) * 100);
                        setQueue([...queueRef.current.getQueue()]);
                    }
                };
                xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error('上传失败'));
                xhr.onerror = () => reject(new Error('网络错误'));
                xhr.onabort = () => reject(new DOMException('已取消', 'AbortError'));

                xhr.open('POST', '/api/upload');
                xhr.send(formData);

                item.abortController.signal.addEventListener('abort', () => xhr.abort());
            });
        },
        onUpdate: setQueue,
    }));

    const stats = useMemo(() => ({
        total: queue.length,
        success: queue.filter(i => i.status === 'success').length,
        error: queue.filter(i => i.status === 'error').length,
        uploading: queue.filter(i => i.status === 'uploading').length,
    }), [queue]);

    return (
        <div>
            <DropZone
                maxFiles={200}
                maxSize={500 * 1024 * 1024}
                onFiles={(files) => queueRef.current.add(files)}
            />
            {queue.length > 0 && (
                <Card title={`上传队列 (${stats.success}/${stats.total})`} style={{ marginTop: 16 }}>
                    {queue.map(item => (
                        <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 0', borderBottom: '1px solid #f0f0f0',
                        }}>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.file.name}
                            </span>
                            <span style={{ width: 60, textAlign: 'right' }}>
                                {item.status === 'uploading' ? `${item.progress}%` :
                                 item.status === 'success' ? '完成' :
                                 item.status === 'error' ? '失败' :
                                 item.status === 'paused' ? '暂停' : '等待中'}
                            </span>
                            {item.status === 'error' && (
                                <Button size="small" onClick={() => queueRef.current.retry(item.id)}>重试</Button>
                            )}
                            {item.status === 'uploading' && (
                                <Button size="small" onClick={() => queueRef.current.pause(item.id)}>暂停</Button>
                            )}
                            {item.status !== 'uploading' && item.status !== 'success' && (
                                <Button size="small" danger onClick={() => queueRef.current.remove(item.id)}>移除</Button>
                            )}
                        </div>
                    ))}
                </Card>
            )}
        </div>
    );
}
```

**优点：**
- 完整的队列管理：并发控制、优先级、暂停/恢复/重试
- 支持拖拽上传和文件夹上传，保留目录结构
- 每个文件独立状态管理，失败可单独重试
- UI 体验好，用户可实时看到每个文件的上传进度

**缺点：**
- 前端实现复杂，队列状态管理容易出 bug
- 文件夹上传依赖 `webkitGetAsEntry`，兼容性有限
- 大量文件时 DOM 渲染可能卡顿（需要虚拟滚动）
- 并发控制策略需要根据服务端承受能力动态调整

**适配场景：**
- 图片批量上传（相册、电商）
- 文件批量管理（网盘、文档系统）
- 需要可视化队列管理的上传场景

**局限性：**
- 文件夹上传在 Firefox 中行为不一致
- 移动端拖拽体验受限，需要配合文件选择器
- 200+ 文件的队列渲染需要性能优化

## 五、方案四：对象存储直传（S3 / OSS / COS）

文件不经过业务服务器，直接上传到云存储，减轻服务器压力。

### STS 临时凭证模式

```typescript
// 1. 前端向业务后端申请临时上传凭证
async function getUploadCredentials(): Promise<{
    uploadUrl: string;
    accessKeyId: string;
    accessKeySecret: string;
    stsToken: string;
    bucket: string;
    region: string;
    objectKey: string;
}> {
    const resp = await fetch('/api/upload/credentials', { method: 'POST' });
    return resp.json();
}

// 2. 使用 AWS S3 SDK 直传
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function uploadToS3(file: File): Promise<string> {
    const credentials = await getUploadCredentials();

    const client = new S3Client({
        region: credentials.region,
        credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.accessKeySecret,
            sessionToken: credentials.stsToken,
        },
    });

    const command = new PutObjectCommand({
        Bucket: credentials.bucket,
        Key: credentials.objectKey,
        Body: file,
        ContentType: file.type,
    });

    await client.send(command);
    return `https://${credentials.bucket}.s3.${credentials.region}.amazonaws.com/${credentials.objectKey}`;
}
```

### 阿里云 OSS 直传（PostObject）

```typescript
async function uploadToOSS(file: File): Promise<string> {
    const credentials = await getUploadCredentials();

    const formData = new FormData();
    formData.append('key', credentials.objectKey);
    formData.append('policy', credentials.policy);     // 服务端生成的策略
    formData.append('OSSAccessKeyId', credentials.accessKeyId);
    formData.append('signature', credentials.signature);
    formData.append('x-oss-security-token', credentials.stsToken);
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://${credentials.bucket}.${credentials.region}.aliyuncs.com`);

    return new Promise((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                console.log(`进度: ${Math.round((e.loaded / e.total) * 100)}%`);
            }
        };
        xhr.onload = () => {
            if (xhr.status === 204) {
                resolve(`https://${credentials.bucket}.${credentials.region}.aliyuncs.com/${credentials.objectKey}`);
            } else {
                reject(new Error('OSS 上传失败'));
            }
        };
        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.send(formData);
    });
}
```

**优点：**
- 文件不经过业务服务器，上传速度快，服务器零压力
- 天然支持 CDN 加速，下载也快
- 云存储提供完善的安全策略（STS 临时凭证、Bucket Policy）
- 支持分片上传、断点续传（S3 Multipart Upload）

**缺点：**
- 依赖云服务商，存在厂商锁定风险
- STS 凭证管理增加了后端复杂度
- 跨域配置需要在云控制台设置
- 成本随存储量和流量增长

**适配场景：**
- 文件存储量大、访问频繁的业务（图片/视频平台）
- 需要高可用、高并发的上传服务
- 多端（Web/App/小程序）统一文件存储

**局限性：**
- 内网环境、私有化部署无法使用公有云
- 敏感文件不适合存放在公有云（合规要求）
- 需要额外处理上传后的文件访问权限

## 六、方案对比

| 维度 | FormData 直传 | 分片上传 | 拖拽批量上传 | 对象存储直传 |
|------|-------------|---------|------------|------------|
| 适用文件大小 | < 50MB | 不限 | < 500MB/个 | 不限 |
| 断点续传 | 不支持 | 支持 | 需额外实现 | 支持（S3 Multipart） |
| 秒传 | 不支持 | 支持 | 需额外实现 | 支持 |
| 并发控制 | 无 | 内置 | 队列管理 | SDK 内置 |
| 进度追踪 | XHR 支持 | 精确到分片 | 精确到文件 | SDK 支持 |
| 服务端压力 | 大（文件过服务器） | 中 | 大 | 小（不过服务器） |
| 实现复杂度 | 低 | 高 | 中 | 中 |
| 基础设施 | 无 | 需合并服务 | 无 | 需云存储 |
| 推荐场景 | 简单附件 | 大文件/视频 | 图片/文档批量 | 高并发/大流量 |

## 七、最佳实践总结

### 选型建议

1. **小文件简单上传**（头像、附件）→ FormData 直传 + 文件校验
2. **大文件上传**（视频、安装包）→ 分片上传 + 断点续传 + 秒传
3. **批量文件上传**（相册、文档）→ 拖拽队列 + 并发控制 + 重试
4. **高并发场景**（C 端产品）→ 对象存储直传 + CDN

### 安全 Checklist

- [ ] 前后端双重文件类型校验（MIME + 扩展名）
- [ ] 文件大小限制（前端 + Nginx `client_max_body_size`）
- [ ] 上传接口鉴权，防止匿名上传
- [ ] 文件名脱敏，不使用用户原始文件名
- [ ] 上传频率限制（Rate Limiting）
- [ ] 文件内容检测（图片不出错、文档不包含恶意脚本）
- [ ] 存储路径不可预测，防止路径遍历

### 性能优化

```typescript
// 1. 压缩图片后再上传
async function compressImage(file: File, quality = 0.8): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const maxDim = 1920;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', quality));
}

// 2. Web Worker 计算哈希，不阻塞 UI
// hash-worker.ts
self.onmessage = async (e) => {
    const buffer = await e.data.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    self.postMessage(Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
};

// 3. 使用 IndexedDB 缓存大文件分片，支持页面刷新后续传
```

## 总结

文件上传方案的选择取决于三个维度：**文件大小**、**文件数量**、**流量规模**。

- 小文件 → 简单直传，不要过度设计
- 大文件 → 分片 + 哈希 + 断点续传是必须的
- 批量 → 队列管理 + 并发控制 + 独立重试
- 高流量 → 对象存储直传，让专业服务做专业的事

无论选择哪种方案，文件校验、安全防护和进度反馈都是不可省略的基础能力。
