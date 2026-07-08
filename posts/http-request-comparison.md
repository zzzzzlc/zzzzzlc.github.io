---
title: HTTP 请求详解——参数设计、字段作用与工程取舍
date: '2025-08-23'
tags:
  - 网络
  - HTTP
  - 前端基础
category: 前端基础
summary: >-
  拆解一个 HTTP 请求的每一个组成部分——method、URL、query、path、header、body、cookie、缓存控制、CORS、压缩、连接复用等，剖析每个参数的设计动机、作用范围、安全边界与常见误用，帮助你写出"懂 HTTP"的请求而非"调 API"的请求。
---

# HTTP 请求详解——参数设计、字段作用与工程取舍

## 一、问题来源：为什么要重读 HTTP 请求

`fetch` 和 `axios` 把 HTTP 封装成"调一个函数"，但**理解每个参数的设计意图，决定了你能否排查线上问题、设计 RESTful 接口、做对鉴权与缓存**：

**当前痛点：**

- **token 放哪纠结**：JWT 该放 Cookie 还是 Header？放 `Authorization` 还是自定义 `X-Token`？
- **GET 带 body 被网关拒**：用 fetch 给 GET 传 JSON body，被 Nginx/CDN 截断
- **缓存策略失效**：明明设了 `Cache-Control`，每次还是打后端，因为分不清 `max-age / s-maxage / no-cache / no-store`
- **CORS 调不通**：跨域预检 OPTIONS 报错，看不懂 `Access-Control-Allow-Headers` 报了哪个头
- **大文件上传 413**：分不清 Content-Length、Transfer-Encoding: chunked、multipart 的关系
- **gzip 没生效**：服务端配了 gzip 但响应体积没变，因为请求头 `Accept-Encoding` 没带

**核心问题：每个 HTTP 参数都是"协议设计者为某个具体场景设计的旋钮"，不了解旋钮用途就调不好线上系统。本文按请求结构逐字段拆解，让你看清每个参数的作用、边界与陷阱。**

---

## 二、HTTP 请求的整体结构

一个完整的 HTTP 请求由 4 部分组成：

```
POST /api/v2/user?id=abc HTTP/1.1      ← ① 请求行（method / path / query / 版本）
Host: api.example.com                   ← ② 请求头（headers）
Content-Type: application/json
Authorization: Bearer eyJhbGc...
Accept-Encoding: gzip
Cookie: sid=xxx
                                        ← 空行（CRLF），分隔头和体
{"name":"tom","age":18}                 ← ③ 请求体（body，可选）
```

外加**传输层**的连接复用、压缩、流式编码——这是协议之外的工程优化，但常被混在"请求参数"里讨论。

下面逐块拆解。

---

## 三、请求方法（Method）——语义而非动作

### 1. 设计原则：方法表达"语义"

HTTP 方法的本质是**告诉服务器这次请求的意图**，而不是"调哪个函数"。它源于 REST 的统一接口约束：

| Method | 语义 | 安全 | 幂等 | 可缓存 | 典型用途 |
|---|---|---|---|---|---|
| `GET` | 获取资源 | ✅ | ✅ | ✅ | 列表、详情 |
| `POST` | 创建/提交 | ❌ | ❌ | ⚠️ | 新建、复杂查询 |
| `PUT` | 全量替换 | ❌ | ✅ | ❌ | 更新整个资源 |
| `PATCH` | 部分修改 | ❌ | ❌ | ❌ | 更新部分字段 |
| `DELETE` | 删除 | ❌ | ✅ | ❌ | 删除资源 |
| `HEAD` | 只取响应头 | ✅ | ✅ | ✅ | 探测资源是否存在 |
| `OPTIONS` | 询问支持的方法 | ✅ | ✅ | ❌ | CORS 预检 |

**关键概念：**
- **安全（Safe）**：不修改服务器状态（GET/HEAD/OPTIONS）
- **幂等（Idempotent）**：多次执行结果相同（GET/PUT/DELETE）
- 这两个属性决定了**缓存、重试、爬虫规范**

### 2. 常见误用

| 误用 | 后果 | 正解 |
|---|---|---|
| 用 GET 创建资源 | 被爬虫/预取触发，意外创建数据 | POST |
| 用 POST 做查询 | 无法被缓存、无法分享 URL | GET + query |
| 用 PUT 做部分更新 | 幂等覆盖导致字段被清空 | PATCH |
| 用 DELETE 带 body | 部分网关/CDN 丢弃 body | DELETE + query 或 POST |

### 3. 局限性
- **PATCH 没有标准格式**：JSON Patch (RFC 6902) vs Merge Patch (RFC 7396) 各有实现，前后端要约定
- **CONNECT / TRACE** 几乎被禁用，前者用于 HTTPS 隧道、后者有安全风险

---

## 四、URL、Path 与 Query——资源的寻址

### 1. URL 结构

```
https://api.example.com:443/v2/user?id=abc&from=web#profile
└─scheme┘└─────host──────┘└port┘└─path─┘└──query──┘└hash┘
```

| 部分 | 作用 | 谁处理 |
|---|---|---|
| **scheme** | 协议（http/https/ws） | 客户端/网关 |
| **host** | 域名，决定 DNS 与 SNI | 客户端/CDN |
| **port** | 端口，默认 80/443 | OS |
| **path** | 资源路径，**RESTful 的核心** | 网关/后端路由 |
| **query** | 过滤/筛选参数 | 后端解析 |
| **hash** | 客户端锚点，**不发往服务器** | 浏览器 |

### 2. Path 设计：资源导向

RESTful 用 **名词 + 嵌套表达关系**：

| ❌ 动词风格 | ✅ 资源风格 |
|---|---|
| `POST /getUser?id=1` | `GET /users/1` |
| `POST /createUser` | `POST /users` |
| `POST /deleteUser` | `DELETE /users/1` |
| `POST /updateUser` | `PATCH /users/1` |

**版本化路径**：`/v1/users` vs `/v2/users`——通过 URL 显式版本化最直观，便于灰度与回滚。

### 3. Query 的设计原则

- **用于过滤/分页/可选参数**：`?page=1&size=20&status=active`
- **不要塞敏感信息**：URL 会进访问日志、浏览器历史、Referer 头
- **长度限制**：浏览器约 2K~8K，Nginx 默认 8K，超长用 POST body
- **必须 URL 编码**：中文、空格、`&`、`=` 都要 `encodeURIComponent`

### 4. 常见坑
- **GET 带 body**：HTTP 规范允许但**部分代理/CDN 会丢弃**，fetch 在某些环境直接报错
- **hash 不上报**：埋点想拿完整 URL 时，hash 部分会被服务器忽略
- **路径大小写**：Linux 服务器区分大小写，Windows/macOS 不区分——部署到 Linux 才暴露

---

## 五、请求头（Headers）——协议级的"元信息"

Headers 是 HTTP 设计最精巧的部分：**用键值对描述请求的"上下文"**——客户端身份、能力、缓存、安全策略。

### 1. 按作用分类

| 分类 | 代表 Header | 作用 |
|---|---|---|
| **认证** | `Authorization`、`Cookie` | 携带身份凭证 |
| **内容协商** | `Accept`、`Accept-Encoding`、`Accept-Language` | 客户端能接收什么 |
| **内容描述** | `Content-Type`、`Content-Length` | body 的格式与长度 |
| **缓存** | `Cache-Control`、`If-None-Match`、`If-Modified-Since` | 缓存策略与校验 |
| **来源** | `Origin`、`Referer` | 请求从哪来（CORS/防盗链） |
| **客户端信息** | `User-Agent`、`X-Forwarded-For` | 设备/真实 IP |
| **安全** | `Strict-Transport-Security`、`X-Frame-Options` | 响应头保护客户端 |

### 2. 关键 Header 详解

#### `Authorization`：标准鉴权头

```
Authorization: Bearer <token>      # JWT / OAuth
Authorization: Basic <base64>      # 基本认证（已弃用）
```

**为什么不要自定义 `X-Token`**：
- 标准头会被反向代理、APM、SDK 自动识别
- `X-` 前缀已废弃（RFC 6648），现代应用应使用语义化命名

#### `Content-Type`：告诉服务器 body 是什么

| 值 | 适用场景 |
|---|---|
| `application/json` | 现代 API 默认 |
| `application/x-www-form-urlencoded` | 传统表单、OAuth token 端点 |
| `multipart/form-data` | 文件上传 |
| `text/plain` | 简单文本 |
| `application/octet-stream` | 二进制流 |

**坑**：`fetch` 默认 `Content-Type: text/plain`，必须手动设置——这是 axios/fetch 行为差异的根源之一。

#### `Accept-Encoding`：告诉服务器你能解压什么

```
Accept-Encoding: gzip, deflate, br
```

服务端据此选择压缩算法，**返回时 `Content-Encoding: gzip`**。如果请求头没带，服务端不会压缩——这是"配了 gzip 还慢"的常见原因。

#### `Cache-Control`：缓存策略的核心

| 值 | 含义 |
|---|---|
| `no-cache` | **可以缓存，但每次用前要向服务器校验** |
| `no-store` | **完全不缓存** |
| `max-age=3600` | 缓存有效期 3600 秒 |
| `s-maxage=3600` | 共享缓存（CDN/Nginx）的有效期 |
| `public` / `private` | 是否允许中间代理缓存 |

**最大误解**：以为 `no-cache` = 不缓存，其实它**仍然缓存**，只是每次需校验。完全不缓存要 `no-store`。

#### `If-None-Match` / `If-Modified-Since`：条件请求

配合 `ETag` / `Last-Modified` 实现 **304 Not Modified**——没变化时服务器只回空 body + 304，节省带宽。这是 HTTP 缓存校验的核心。

### 3. 自定义 Header 命名约定
- 现代：`X-Request-Id`、`Trace-Id`（链路追踪）
- 避免 `X-` 前缀（RFC 6648 废弃），但仍广泛使用，团队内统一即可

### 4. 局限性
- **大小限制**：Nginx 默认单 header 8K，总 32K，超长（如把 JWT 塞太多 claim）会 400
- **不能传中文**：必须 RFC 5987 编码或转 Base64
- **某些 header 浏览器禁止覆盖**（`Forbidden header name`）：`Host`、`Referer`、`Cookie` 等，前端不能伪造

---

## 六、请求体（Body）——载荷的几种形态

### 1. body 的四种典型形态

| 形态 | Content-Type | 场景 |
|---|---|---|
| **JSON** | `application/json` | API 主流 |
| **表单** | `application/x-www-form-urlencoded` | 传统 form、OAuth |
| **多部分** | `multipart/form-data` | 文件上传 + 混合字段 |
| **二进制流** | `application/octet-stream` | 大文件直传 OSS |

### 2. 字段命名风格：camelCase vs snake_case

- **前端约定**：camelCase（JS 习惯）
- **后端/数据库**：snake_case（SQL/Python 习惯）
- **协议层建议**：API 输出统一一种风格，避免在客户端手写转换层
- GraphQL 默认 camelCase，REST 通常 snake_case——团队约定优先

### 3. 大文件上传：分片 vs 直传 vs 流式

| 方案 | 适用 | 关键 Header |
|---|---|---|
| 整体上传（multipart） | 小文件 < 10MB | `Content-Type: multipart/form-data` |
| 分片上传 | 大文件 + 弱网 | 每片独立请求 + 合并接口 |
| 直传 OSS/S3 | 大文件、节省服务器带宽 | 预签名 URL + `PUT` |
| 流式（chunked） | 不知总长度 | `Transfer-Encoding: chunked` |

### 4. body 编码与签名
- **签名校验**：把 body + timestamp + secret 用 HMAC 算签名，放在 `X-Signature` 头——防篡改
- **加密 body**：敏感字段先 AES 加密再发送，配合 RSA 传密钥
- 注意：**签名方案要在文档里明确"哪些字段参与签名、什么顺序"**，否则前后端联调噩梦

### 5. 局限性
- **GET 带 body**：规范允许、实践中被丢弃
- **multipart 解析慢**：服务端需流式解析，大文件易 OOM——大文件优先直传
- **body 大小限制**：Nginx `client_max_body_size` 默认 1MB，超了 413

---

## 七、Cookie——服务端下发的"持久化身份"

### 1. Cookie 的特殊性

Cookie **不是请求参数**，而是**服务器通过 `Set-Cookie` 响应头种到浏览器，浏览器后续请求自动带上**的特殊 Header。

### 2. Cookie 的关键属性

```
Set-Cookie: sid=abc; Domain=.example.com; Path=/; Max-Age=86400;
            HttpOnly; Secure; SameSite=Lax
```

| 属性 | 作用 |
|---|---|
| `Domain` / `Path` | Cookie 生效范围 |
| `Max-Age` / `Expires` | 有效期 |
| **`HttpOnly`** | JS 无法读取（防 XSS 偷 token） |
| **`Secure`** | 仅 HTTPS 传输 |
| **`SameSite`** | 跨站是否携带（防 CSRF） |

**SameSite 三档**：
- `Strict`：跨站完全不带
- `Lax`（默认）：顶层导航 GET 带，其它不带
- `None`：跨站全带（必须配 `Secure`）

### 3. JWT 放 Cookie 还是 Header？

| 维度 | Cookie + HttpOnly | Header (`Authorization`) |
|---|---|---|
| **XSS 防护** | ✅ JS 读不到 | ❌ token 在 JS 内存里 |
| **CSRF 防护** | ❌ 自动带，需额外防御 | ✅ 不自动带 |
| **跨域** | 麻烦（SameSite/credentials） | 简单 |
| **移动端/RN** | 不适用 | ✅ 通用 |

**结论**：Web 单体应用优先 Cookie + HttpOnly + SameSite=Lax；前后端分离 + 多端统一鉴权用 Header。

### 4. 局限性
- **单域名 Cookie 数 ≤ 50，单条 ≤ 4KB**
- **跨子域需配 `Domain=.example.com`**
- 移动端、SSR、跨域 API 时 Cookie 麻烦，常改用 Header

---

## 八、缓存策略——请求参数里的"成本旋钮"

### 1. 三层缓存

```
浏览器缓存 → CDN/代理缓存 → 服务端缓存（Redis）
```

HTTP 请求/响应头控制前两层。

### 2. 缓存决策流程

```
1. Cache-Control: no-store? → 完全不缓存
2. no-cache? → 缓存但每次校验
3. max-age 未过期? → 直接用本地缓存
4. 过期了 → 带 If-None-Match/If-Modified-Since 校验 → 304 续命 or 200 重新拉
```

### 3. 强缓存 vs 协商缓存

| 类型 | 触发 Header | 命中表现 |
|---|---|---|
| **强缓存** | `Cache-Control: max-age` / `Expires` | 200 (from disk/memory cache)，不发请求 |
| **协商缓存** | `ETag` + `If-None-Match` / `Last-Modified` + `If-Modified-Since` | 304，发请求但 body 空 |

### 4. 常见误用
- 静态资源用 `Cache-Control: no-cache` → 每次 304，浪费 RTT；应 `max-age=31536000, immutable` + 文件名加 hash
- HTML 用 `max-age` 太长 → 用户拿不到更新；HTML 应 `no-cache` 配合协商缓存
- API 接口禁用缓存忘了加 `Cache-Control: no-store` → 可能被 CDN 错误缓存

### 5. 局限性
- HTTP 缓存粒度粗，复杂场景需配合 Service Worker / IndexedDB
- `Vary` 头不正确会导致 CDN 缓存串号（按 Accept-Language 缓存英文版给中文用户）

---

## 九、CORS——跨域请求的"预检协议"

### 1. 为什么有 CORS

浏览器同源策略：**JS 默认只能读同源响应**。CORS 是服务器**显式声明"允许谁跨域访问"**的协议。

### 2. 简单请求 vs 预检请求

**简单请求**（不发预检）需同时满足：
- Method ∈ {GET, HEAD, POST}
- Content-Type ∈ {`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`}
- 不带自定义 Header

**预检请求**：不满足以上 → 浏览器先发 `OPTIONS` 询问。

### 3. 关键响应头

| 头 | 作用 |
|---|---|
| `Access-Control-Allow-Origin` | 允许的源（不能 `*` + 凭证） |
| `Access-Control-Allow-Methods` | 允许的方法 |
| `Access-Control-Allow-Headers` | 允许的请求头 |
| `Access-Control-Allow-Credentials` | 是否允许带 Cookie |
| `Access-Control-Max-Age` | 预检结果缓存时间 |

### 4. 常见报错对照

| 报错 | 原因 |
|---|---|
| `No 'Access-Control-Allow-Origin'` | 服务端没返回允许源 |
| `Credentials flag is true, but Allow-Origin is *` | 带凭证时不能用 `*`，要具体源 |
| `Header X-Token is not allowed` | 自定义头未在 `Allow-Headers` 声明 |
| `Method PUT not allowed` | `Allow-Methods` 没声明 |

### 5. 局限性
- 预检请求增加一次 RTT，**高频接口可改简单请求**（GET / 表单类型）以省掉预检
- Cookie 跨域需要 `SameSite=None; Secure` + `credentials: 'include'` + 具体源，三者缺一不可
- 反向代理"假装同源"（Nginx 转发）是绕过 CORS 的常用手段，但仅是工程优化

---

## 十、连接与传输层优化

虽然不属于"请求字段"，但影响请求行为：

### 1. keep-alive：连接复用
HTTP/1.1 默认开启，**复用 TCP 连接**省去握手开销。Nginx `keepalive_timeout` 控制超时。

### 2. HTTP/2 多路复用
单个 TCP 连接并发多个请求，**解决了 HTTP/1 的队头阻塞**。但**TCP 层丢包仍会阻塞所有流**。

### 3. HTTP/3 (QUIC)
基于 UDP，彻底消除队头阻塞——适合弱网移动场景。

### 4. 压缩
- **请求体压缩**罕见（请求体小，且与签名校验冲突）
- **响应体压缩**（gzip/br）是默认优化，需请求头 `Accept-Encoding` 协商

### 5. 局限性
- HTTP/2 Server Push 几乎被废弃（Chrome 已移除支持）
- HTTP/3 部署率仍受限于中间件/防火墙对 UDP 的限制

---

## 十一、参数设计决策框架

| 需求 | 推荐做法 |
|---|---|
| **身份凭证** | Cookie + HttpOnly + SameSite=Lax（Web） / Authorization Header（多端） |
| **过滤/分页** | Query string |
| **复杂查询** | POST + JSON body（避免 URL 过长） |
| **文件上传** | multipart（小）/ 预签名直传（大） |
| **敏感数据** | Header 或加密 body，**绝不放 URL** |
| **可缓存的读** | GET + `Cache-Control: max-age` + 强版本 hash |
| **不可缓存的写** | POST/PUT/PATCH + `no-store` |
| **链路追踪** | 自定义 `X-Request-Id` / `Trace-Id` |
| **跨域鉴权** | `credentials: include` + `SameSite=None; Secure` + 具体源 |

---

## 十二、本文的局限性

- **未深入 HTTP/2 / HTTP/3 的二进制帧细节**——属于协议层，业务无感知但排查高级性能问题需要
- **未展开 HSTS / CSP / X-XSS-Protection** 等安全响应头——应单独成文
- **未对比 GraphQL / gRPC / WebSocket** 的请求结构差异——它们是 HTTP 之上的另一套约定
- **未讨论签名/加密方案的算法选择**（AES-CBC vs GCM、RSA vs ECC）——密码学是独立主题
- **OAuth 2.0 / OIDC 的 token 流程**（access_token / refresh_token / id_token）未展开
- **WebTransport / WebRTC** 等非 HTTP 通道未涉及

> 一句话总结：**HTTP 不是"调个函数"，而是"用一串结构化的字段与服务器协商意图、能力、安全、缓存"。看清每个字段的旋钮用途，才能在鉴权、性能、跨域、上传这些"看似 CRUD 实则深坑"的场景里做出正确取舍。**
