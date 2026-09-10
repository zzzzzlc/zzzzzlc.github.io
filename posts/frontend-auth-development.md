---
title: 前端登录应用开发：认证方案、OAuth 2.0、单点登录、无感刷新与安全防御
date: '2026-08-28'
tags:
  - 前端进阶
  - 认证
  - 安全
  - OAuth
  - 架构
category: 前端进阶
summary: >-
  从「HTTP 无状态」这一根本问题出发，系统拆解前端登录应用开发：会话方案选型（Cookie-Session
  vs JWT）、六种登录方式对比、OAuth 2.0 四种授权模式与 PKCE、单点登录（同域/跨域）与单点注销、Token
  无感刷新（401 拦截排队、静默授权、多标签页同步）、Token 存储风险矩阵，以及 XSS 与 CSRF
  防御。每个主题按「问题来源 → 多方案对比 → 优缺点 → 适配场景 → 局限性」展开，并附符合分层规范的完整代码实现。
---

# 前端登录应用开发：认证方案、OAuth 2.0、单点登录、无感刷新与安全防御

登录是绝大多数应用的第一个功能，也是安全事故的重灾区。它看起来只是「一个表单 + 一个接口」，实际背后是一整条链路：**身份认证 → 凭证颁发 → 会话保持 → 静默续期 → 单点登录 → 主动登出**，每一环都有方案选型和安全取舍。本文把这条链路拆开讲透，并覆盖 XSS / CSRF 两大攻击面的防御。

> 阅读前提：了解 HTTP 基础（Header、Cookie）与 React 基本使用。文中代码均为 TypeScript，遵循「网络请求收敛到 service 层、类型显式、逻辑外置」的规范。

---

## 一、问题来源：登录到底在解决什么

### 1. HTTP 是无状态的

HTTP 协议本身不记忆「上一个请求是谁发的」。每个请求都是独立的，服务器无法通过连接识别用户——因为连接可能复用（Keep-Alive），也可能来自不同的 NAT 出口。所以「登录」的本质是：

> **用一次性的凭证交换（账号密码/验证码/授权码），换取一个可持续的凭证（Session ID / Token），并在后续每个请求中携带它，让服务器重新识别你是谁。**

由此衍生出三个经常被混淆的概念：

| 概念 | 英文 | 回答的问题 | 典型实现 |
| --- | --- | --- | --- |
| 认证 | Authentication (AuthN) | 你是谁？ | 账号密码、验证码、扫码、WebAuthn |
| 授权 | Authorization (AuthZ) | 你能做什么？ | RBAC 权限模型、OAuth 2.0 |
| 会话管理 | Session Management | 你登录的状态如何保持？ | Cookie-Session、JWT、Token |

「第三方登录」里既有认证也有授权：GitHub 登录时，你（用户）**授权**应用读取你的 GitHub 资料，GitHub 顺便**证明**了你是谁。

### 2. 登录的完整生命周期

```
┌─────────┐   ①凭证交换    ┌─────────┐   ②颁发凭证    ┌──────────┐
│ 登录页   │ ────────────→ │ 认证服务 │ ────────────→ │ 浏览器存储 │
└─────────┘  账号密码/码/码  └─────────┘  Set-Cookie/JSON └──────────┘
                                   ↑                        │
                                   │ ③每个请求携带凭证          ↓
                            ┌─────────────┐          ┌──────────┐
                            │ ④过期 → 续期  │←─────────│ 业务请求   │
                            └─────────────┘ 无感刷新   └──────────┘
                                   │
                            ┌─────────────┐
                            │ ⑤登出/被踢下线 │  清理凭证 + 失效会话
                            └─────────────┘
```

本文按 ②③④⑤ 的顺序展开，最后覆盖贯穿全程的安全防御（XSS / CSRF）。

---

## 二、会话保持方案选型：Cookie-Session vs JWT vs 混合

**问题来源**：服务器颁发了凭证之后，每个请求如何携带、服务器如何校验？这是登录系统的第一架构决策，直接影响后面所有章节的形态。

### 方案 A：Cookie-Session（服务端有状态）

```
浏览器                               服务器
  │ ①登录(账号密码)                     │
  │ ─────────────────────────────────→ │ 校验通过
  │                    Set-Cookie: sid=abc; HttpOnly; Secure; SameSite=Lax
  │ ←───────────────────────────────── │ (Session 存 Redis: sid=abc → {userId, ...})
  │ ②业务请求 Cookie: sid=abc           │
  │ ─────────────────────────────────→ │ 查 Redis → 识别用户
```

### 方案 B：JWT / Token（服务端无状态）

```
浏览器                               服务器
  │ ①登录                              │
  │ ─────────────────────────────────→ │ 签发 JWT: header.payload.signature
  │ ←───────────────────────────────── │ (payload 自带 userId、过期时间)
  │ ②业务请求 Authorization: Bearer xx  │ ← 无需查库，验签即可
  │ ─────────────────────────────────→ │
```

JWT 结构：`base64url(header).base64url(payload).signature`。**签名防篡改，不防偷看**——payload 只是编码，不是加密，前端 `atob()` 就能读出内容，所以 JWT 里绝对不放密码、手机号等敏感信息。

### 多方案对比

| 维度 | Cookie-Session | JWT（纯无状态） | 混合（短期 JWT + 服务端版本校验） |
| --- | --- | --- | --- |
| 服务端存储 | 需要（Redis） | 不需要 | 轻量（用户级版本号） |
| 主动失效/踢人 | ✅ 删 Session 即可 | ❌ 签发后无法收回 | ✅ 改版本号使旧 JWT 失效 |
| 分布式扩展 | 需共享 Session 存储 | ✅ 天然支持 | ✅ 支持 |
| 跨域携带 | 受 Cookie 同源策略限制 | ✅ Header 任意跨域 | 取决于 token 载体 |
| 前端可控性 | 低（浏览器自动管理） | 高（可解码读取 claims） | 高 |
| 体积 | Cookie 几十字节 | 每请求数百字节起 | 同 JWT |
| CSRF 风险 | 有（Cookie 自动携带） | 放 Header 则无 | 同载体 |
| XSS 风险 | httpOnly 下偷不走 | localStorage 可被偷 | 同载体 |

### 优缺点与适配场景

- **Cookie-Session**：适合单体应用、内部系统、对「可控性」要求高（随时封号、强制下线）的场景。缺点是分布式架构必须引入 Redis 类共享存储，且跨域/移动端/App/小程序里 Cookie 支持不佳。
- **纯 JWT**：适合 API 开放平台、跨域多端（Web/App/小程序统一）、无状态网关透传场景。致命短板是**无法主动失效**——用户点「退出登录」，JWT 在过期前依然有效；泄露后无法补救。
- **混合方案**：access token 用短寿命 JWT（5~30 分钟）保性能，配套 refresh token 存服务端可吊销，「短命 + 可吊销的续期凭证」同时拿到性能与可控性。**这是目前中大型系统的主流选择**，也是第六节无感刷新的基础。

### 局限性

- 没有银弹：任何方案下「凭证一旦泄露、在失效前都是合法的」，只能靠**缩短寿命 + 泄露检测（旋转/复用检测）** 压缩攻击窗口，见第六节。
- Cookie 方案在同域下最省心，一旦涉及跨域 SSO，就要进入第五节的复杂度。

---

## 三、登录方式全景：不止账号密码

**问题来源**：密码容易撞库、弱口令、钓鱼，且新场景（扫码、免密）需要不同的信任传递方式。实际项目往往是多种方式并存，都汇聚到同一套会话颁发流程。

### 3.1 账号密码登录：前端要做的三件事

**① 密码安全传输**。先纠正一个常见误区：**前端 MD5/SHA256 一次再传，不是加密，反而有害**。

- 哈希是编码不是加密，抓包者拿到哈希值可以直接重放登录（pass-the-hash）；
- 前端固定算法哈希后，数据库存的等价于「哈希的哈希」，攻击者建一张「常见密码 → 前端哈希值」的彩虹表可以批量撞库。

正确姿势：**全程 HTTPS + 后端用慢哈希加盐存储**（bcrypt / Argon2 / scrypt）。前端加密仅在极端合规要求（服务端不允许接触明文密码的密码学设计，如 SRP）下才有意义，那是另一套协议，不是「加一层 MD5」。

**② 防爆破**。登录接口必须有频率限制：图形验证码/滑块（人机区分）、IP 与账号双维度限流、连续失败锁定（注意锁定信息不要提示「密码错误」vs「账号不存在」——统一返回「账号或密码错误」，避免撞用户名）。前端要配合展示验证码组件与剩余尝试次数。

**③ 回显安全**。登录后的「欢迎你，{username}」是 XSS 高发区，见第八节。

### 3.2 手机/邮箱验证码

流程：前端调「发送验证码」接口（带图形验证码防轰炸 + 限流）→ 用户输入 → 提交校验 → 颁发会话。前端注意点：

- 发送按钮倒计时（防重复触发），倒计时状态放 hook 而不是散在组件里；
- 验证码接口与服务端约定**发送频控 + 单账号日限额**，前端只做体验层配合；
- 验证码是一次性、短时效（5 分钟）凭证，本质上是「用持有手机号这一事实换会话」。

### 3.3 扫码登录

本质是「把 A 端（手机 App）已登录的会话，授权给 B 端（网页）」。二维码本身只是一个带 `qrcodeId` 的 URL：

```
网页(B端)                    服务器                     手机App(A端)
   │ ①生成二维码 qrcodeId        │                          │
   │ ←──────────────────────── │ 状态: pending             │
   │ ②轮询状态                   │  ③App扫码 → 已扫(scanned) │
   │ ── GET /qrcode/status ──→ │                          │
   │ ←── scanned ──              │ ④App确认登录              │
   │                            │ ←── confirmed + A的凭证 ──│
   │ ←── confirmed(带临时code) ── │ 状态: confirmed          │
   │ ⑤用 code 换会话             │                          │
   │ ── POST /qrcode/exchange ─→ │ 颁发 B 端会话             │
```

状态机：`pending → scanned → confirmed / expired(通常2分钟)`。

状态同步的三种方式对比：

| 方式 | 实时性 | 服务端成本 | 适配场景 | 局限 |
| --- | --- | --- | --- | --- |
| 短轮询（2s 一次） | 秒级低 | 高（无效请求多） | 中小规模，实现最简单 | 大量空轮询 |
| 长轮询 / SSE | 秒级高 | 中 | 中大型，SSE 只收不发最省 | 需要网关支持长连接 |
| WebSocket | 实时 | 低（事件驱动） | 已有 WS 基建（IM、协作） | 额外连接管理成本 |

关键安全点：**App 确认后才发 `code`，网页拿 `code` 换 token**——`code` 一次性且 30 秒过期，即使二维码截图外泄，攻击者也无法重复使用（这个「中间一次性票据」思想与 OAuth 授权码一致）。

### 3.4 第三方登录（GitHub / 微信 / Google）

前端视角的完整流程（以 GitHub OAuth 为例）：

1. 点击「GitHub 登录」→ 重定向到 `https://github.com/login/oauth/authorize?client_id=xxx&redirect_uri=https://myapp.com/callback&state=xyz&scope=user:email`；
2. 用户在 GitHub 页面授权 → GitHub 带 `?code=xxx&state=xyz` 重定向回 `redirect_uri`；
3. **前端拿到 `code` 后交给自家后端**，由后端拿 `code` + `client_secret` 去 GitHub 换 access token，再取用户信息，映射/注册本地账号，最后给前端颁发**自家会话**。

注意：第三方登录只解决「认证」，登录成功后进入的是**你自己的会话体系**——第三方 token 只在服务端用于首次拉取资料，不要把它当业务会话用。

### 3.5 WebAuthn / Passkey（免密认证）

用公私钥对替代密码：私钥存设备的安全芯片（指纹/Face ID/Windows Hello 解锁），认证时浏览器对挑战值签名，服务器用注册时存的公钥验签。防钓鱼（绑定域名）、无密码可泄、无撞库。2024 年起 Passkey 开始云端同步（iCloud 钥匙串、Google 密码管理器），可用性大幅改善。

前端用 `@simplewebauthn/browser` 即可集成。局限：需要用户设备支持 + 服务端改造 + 兜底方案（丢了设备怎么办），目前多作为 MFA 因素或渐进增强，而非唯一方式。

### 3.6 MFA（多因素认证）

从「你知道的（密码）/ 你拥有的（手机、设备）/ 你本身的（指纹）」中取至少两种。常见组合：密码 + TOTP 动态码（Google Authenticator）、密码 + WebAuthn。金融、企业后台应强制 MFA。

### 登录方式选型

| 方式 | 门槛 | 安全性 | 典型场景 |
| --- | --- | --- | --- |
| 账号密码 | 低 | 低（撞库/钓鱼） | 兜底必备 |
| 短信验证码 | 低 | 中（SIM 劫持风险） | C 端快捷登录 |
| 扫码 | 中（需 App） | 高 | 有 App 生态的产品 |
| 第三方 OAuth | 低 | 高（依托大厂） | 面向开发者的产品 |
| WebAuthn/Passkey | 高 | 最高（防钓鱼） | 新建系统的前瞻选项 |
| MFA | 中 | 最高 | 金融/企业内部 |

---

## 四、OAuth 2.0 授权模式深度拆解

**问题来源**：3.4 的第三方登录为什么要绕一圈「授权码换 token」，而不是让用户把 GitHub 账号密码直接给你的应用？因为**密码给出去就等于交出全部权限，且无法收回**。OAuth 2.0（RFC 6749）解决的就是：让用户把**有限的、可撤销的授权**安全地交给第三方应用。

### 4.1 四种授权模式 + PKCE 对比

| 模式 | 流程复杂度 | 安全性 | 现状 | 适配场景 |
| --- | --- | --- | --- | --- |
| 授权码模式 Authorization Code | 高 | 高（code 换 token 在服务端） | ✅ 主流 | 有后端的 Web 应用 |
| 授权码 + PKCE | 高 | 最高 | ✅ **OAuth 2.1 唯一保留的浏览器方案** | SPA、移动端、桌面端 |
| 隐式模式 Implicit | 低 | 低（token 走 URL 明文） | ❌ 已废弃 | 仅历史遗留 |
| 密码模式 ROPC | 低 | 低（应用接触用户密码） | ❌ OAuth 2.1 废弃 | 仅第一方高度信任的遗留系统 |
| 客户端凭证 Client Credentials | 低 | 高 | ✅ | 服务对服务，无用户参与 |

### 4.2 授权码 + PKCE 完整时序（SPA 场景）

PKCE（RFC 7636）解决的问题是：SPA 没有 `client_secret`（代码全在浏览器里，藏不住），如果裸用授权码，恶意应用可以拦截 `code` 冒充你换 token。PKCE 让「发起授权的浏览器」和「换 token 的浏览器」用随机数自证是同一方：

```
SPA(浏览器)                          授权服务器                     SPA后端
   │ 1.生成 code_verifier(随机43-128字符)                              │
   │   code_challenge = BASE64URL(SHA256(verifier))                    │
   │ 2.重定向 /authorize?response_type=code                            │
   │      &client_id&redirect_uri&scope                                 │
   │      &state=随机数(防CSRF)                                         │
   │      &code_challenge=xxx&code_challenge_method=S256 ─────────────→ │
   │                              3.用户登录并授权(或已有会话则静默通过)     │
   │ ←─ 4.重定向 redirect_uri?code=abc&state=原样返回(必须比对!) ──────── │
   │                                                                    │
   │ 5.POST /token  grant_type=authorization_code                       │
   │           code=abc & code_verifier=原verifier ───────────────────→ │ 验证 SHA256(verifier)==challenge
   │ ←─ 6.access_token (+ refresh_token / id_token) ─────────────────── │
```

**每个安全参数为什么存在**：

- `state`：防 CSRF/授权码注入。发起时生成随机数存 sessionStorage，回调时严格比对——防止攻击者把自己的 `code` 塞进你的回调流程（登录 CSRF 的变种）。
- `redirect_uri`：授权服务器必须**精确匹配**注册值，防止 `code` 被重定向到攻击者页面。
- `code_challenge` / `code_verifier`：verifier 只存在发起授权的浏览器内存里，拦截了 `code` 也换不出 token。
- OIDC 的 `nonce`：`id_token` 里会回填 nonce，防止 id_token 重放。

### 4.3 为什么隐式模式被废弃

隐式模式把 `access_token` 直接放在重定向 URL 的 `#fragment` 里返回，省掉换 token 一步。三个死因：token 经由浏览器 URL 传递（历史、插件、Referer 泄露）、无 refresh token（体验差）、无法证明回调方身份。OAuth 2.1（草案）已将其移除——**新项目直接忘掉它**。

### 4.4 OIDC：OAuth 2.0 之上的认证层

OAuth 2.0 只定义了「授权」，没定义「用户是谁」。OpenID Connect 在其上加了：

- `scope=openid` 与 `id_token`（一个 JWT，含 `sub`（用户唯一标识）、`aud`、`nonce`、签名可前端本地校验）；
- 标准端点发现（`/.well-known/openid-configuration`）与用户信息端点（`/userinfo`）。

OIDC 是第五节跨域 SSO 的现代标准基础。**记住一句话：OAuth 2.0 是授权协议，拿它做认证要用 OIDC**——直接拿 access_token 调 userinfo 当登录，会掉进「令牌替换攻击」的坑（不同 issuer 的 token 混用）。

---

## 五、单点登录（SSO）：同域与跨域

**问题来源**：公司大了以后出现一堆子系统（`a.example.com`、`b.example.com`，或干脆 `a.com`、`b.com`），用户不想每个系统都注册登录一遍。「一次登录、处处通行」就是 SSO。它的技术核心只有一个：**多个应用如何安全地共享/传递登录态**。

### 5.1 同域 SSO（共享父域 Cookie）

子域之间默认不共享 Cookie，但设置在**父域**上的 Cookie 所有子域都会携带：

```
浏览器访问 app.example.com
  → Cookie: token=xxx; Domain=.example.com  (所有 *.example.com 都带)
```

两种实现对比：

| 方案 | 原理 | 优点 | 缺点 | 局限 |
| --- | --- | --- | --- | --- |
| 父域 Cookie + Redis 共享 Session | Cookie 只存 sid，Session 数据放 Redis | 可主动失效、踢人；体积小 | 所有子系统必须接同一 Redis、同一 Session 协议 | 强耦合技术栈 |
| 父域 Cookie 存 JWT | Cookie 直接存签名的 JWT | 各系统无共享存储，只共享签发密钥（公钥） | 无法主动失效；JWT 体积大 | 登出难题（见 5.3） |

**登录流程**：任一子系统发现无 Cookie → 跳统一认证中心 `auth.example.com`（也在同一父域下，读得到登录态）→ 已登录则直接发新 Cookie / 重定向回来，未登录则展示登录页。

适配场景：集团内部系统、主站 + 子产品同属一个主域。**局限性：要求所有应用都在同一个注册域下**——一旦有 `b.com` 就无能为力，进入跨域方案。

### 5.2 跨域 SSO：四种方案对比

| 方案 | 核心机制 | 优点 | 缺点 | 适配场景 |
| --- | --- | --- | --- | --- |
| A. 统一 IdP + OIDC 授权码 | 每个应用作为 OIDC Client，统一到 IdP 登录 | 标准协议、安全完善、天然支持登出协议 | 实现复杂，需要 IdP（Keycloak / Auth0 / Casdoor / 自研） | 中大型、多技术栈、对外合作 |
| B. CAS 协议 | 认证中心发一次性 ticket，各应用拿 ticket 换用户信息 | 高校/传统企业生态成熟 | 协议老、JSON/移动端不友好 | 存量 CAS 体系 |
| C. 独立认证域 + 跨站 Cookie | 认证中心在 `auth-corp.com`，各应用用它签发的第三方 Cookie | 用户体验接近同域 | **第三方 Cookie 正被各浏览器逐步禁用**（Chrome/Safari ITP） | ⚠️ 不建议新项目采用 |
| D. 首跳 URL 带一次性 code 跨域跳转 | 认证中心验证后 `302 a.com/cb?code=xxx`，a.com 用 code 换 token | 无 Cookie 依赖 | 依赖重定向链路、实现细节多 | 本质上就是方案 A 的授权码流程 |

展开讲主流的 **方案 A（OIDC）**——它其实就是第四节「授权码 + PKCE」的直接应用：每个子系统都是 IdP 的 Client，用户登录过一次后，IdP 域内已有自己的会话 Cookie，再访问其他子系统时的授权跳转会在认证中心**静默通过**（`prompt=none`），用户全程无感知：

```
用户访问 b.com（未登录）
  → b.com 跳转 idp.com/authorize?client_id=b&prompt=none...
  → idp.com 发现自己域内已有会话 Cookie（之前登录 a.com 时建立的）
  → 无需再输密码，直接 302 回 b.com/cb?code=xxx
  → b.com 后端换 token，建立 b.com 自己的会话
```

**跨域 SSO 的本质：登录态只存在认证中心（IdP）的域里；各应用持有的只是各自独立的短会话，由 IdP 负责背书。** 这也是为什么方案 C（想让多个不相关域直接共享一个 Cookie）注定随第三方 Cookie 禁用而消亡——浏览器同源策略的设计初衷就不允许它。

### 5.3 单点注销：SSO 最难的一环

**登录容易登出难**：各应用的会话在各自域里，认证中心删掉自己的 Cookie 后，子系统不知道。两种标准方案：

- **Front-Channel Logout（前向登出）**：IdP 登出页里对每个子系统的 `logout_url` 各嵌一个 `<iframe>`，逐个通知清 Cookie。依赖第三方 Cookie，**正在失效**，不推荐新项目。
- **Back-Channel Logout（后向登出）**：IdP **服务端**直接 POST 每个子系统的 `backchannel_logout_uri`（带签名的 logout token）。可靠、不依赖浏览器，是 OIDC 当前推荐。

前端在登出时要做的：清本应用 token → 调本应用登出接口（让服务端失效会话）→ 跳转 IdP 的 `end_session_endpoint`（带 `id_token_hint` 与登出后回跳地址），由 IdP 完成其余子系统的通知。

### 局限性

- SSO 是「把鸡蛋放进一个篮子」：IdP 挂了全线无法登录，必须有降级预案与健康监控；
- 授权跳转链路长，任何一环 `redirect_uri` 校验不严都是漏洞；
- 子系统会话寿命与 IdP 会话寿命的耦合需要明确策略（IdP 会话活着，子系统 token 过期时能否静默续发）。

---

## 六、无感刷新：Token 静默续期

**问题来源**：混合方案里 access token 只有 5~30 分钟寿命，到期后用户正在填表单、看图表，突然弹回登录页——体验灾难。「无感刷新」= 在用户无感知的前提下换新 token。

### 6.1 双 Token 模型

```
登录成功
  ├─ access_token  （短寿命 5~30min，每个业务请求携带，泄露危害小）
  └─ refresh_token （长寿命 7~30 天，只用来自动换取新 access_token）
```

核心思想：**高风险高频使用的凭证短命，低频使用的续命凭证长命且可吊销**。refresh token 存在服务端（或带 `jti` 可查），泄露可单独吊销。

### 6.2 四种刷新方案对比

| 方案 | 机制 | 优点 | 缺点 | 适配场景 |
| --- | --- | --- | --- | --- |
| 1. 定时器预刷新 | 过期前 N 秒 setTimeout 主动刷 | 请求零延迟 | 后台标签页白白刷、系统休眠后时钟漂移、页面多实例竞争 | 小项目 |
| 2. **401 拦截 + 并发排队** | 请求 401 后拦截刷新，其余请求挂起等待新 token 重放 | 按需刷新零浪费、通用 | 首个失败请求有一次往返延迟 | **主流，推荐默认** |
| 3. OIDC 静默授权（silent refresh） | 隐藏 iframe 走 `authorize?prompt=none`，靠 IdP 的 httpOnly 会话 Cookie 重新发码 | 浏览器里完全不落地 refresh token | 依赖 IdP 会话、iframe 可能被 Cookie 策略挡 | 标准 OIDC 体系 |
| 4. Cookie 滑动过期 | 服务端每次响应都 `Set-Cookie` 续期 | 前端零代码、天然多标签页一致 | 高频重设 Cookie、纯滑动窗口难做绝对超时、需 CSRF 防御 | 传统 Web 应用 |

### 6.3 方案 2 完整实现（401 拦截 + 单飞排队）

这是最常用也最容易写错的方案，错误写法是「每个 401 各刷各的」——并发 5 个请求过期就会触发 5 次 refresh 接口，甚至互相覆盖导致连环 401。正确姿势是 **single-flight（单飞）**：同一时刻只有一个刷新请求在飞，其余请求 await 同一个 Promise。

按分层规范拆为三个 service 模块（组件内不写任何请求与刷新逻辑）：

```ts
// services/tokenService.ts —— 凭证存取的唯一出口
const ACCESS_KEY = 'access_token'

export const tokenService = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },
  setAccess(token: string): void {
    localStorage.setItem(ACCESS_KEY, token)
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY)
  },
}
```

```ts
// services/refreshManager.ts —— 单飞刷新，全局唯一
import { http } from './http'
import { tokenService } from './tokenService'

let refreshing: Promise<string> | null = null

/** 发起刷新；并发调用只会发出一次真实请求，共享同一个 Promise */
export function refreshAccessToken(): Promise<string> {
  if (refreshing) return refreshing

  refreshing = (async () => {
    try {
      // refresh_token 放 httpOnly Cookie，前端拿不到也偷不走（推荐）
      const res = await http.post<{ accessToken: string }>('/auth/refresh')
      tokenService.setAccess(res.data.accessToken)
      return res.data.accessToken
    } finally {
      refreshing = null // 成功失败都要复位，失败后允许下次重试
    }
  })()

  return refreshing
}
```

```ts
// services/http.ts —— axios 实例与拦截器（队列重放）
import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { tokenService } from './tokenService'
import { refreshAccessToken } from './refreshManager'

/** 401 后等待重放的请求，带一个 _retried 标记防止无限循环 */
type RetriableConfig = AxiosRequestConfig & { _retried?: boolean }

export const http = axios.create({ baseURL: '/api', timeout: 10_000 })

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenService.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const isAuthApi = config?.url?.startsWith('/auth/')
    const needRefresh =
      error.response?.status === 401 && config && !config._retried && !isAuthApi

    if (!needRefresh) return Promise.reject(error)

    config._retried = true
    try {
      const token = await refreshAccessToken() // 所有并发 401 都 await 同一个刷新
      config.headers.Authorization = `Bearer ${token}`
      return http(config) // 重放原请求
    } catch {
      tokenService.clear()            // 刷新也失败：refresh token 过期/被吊销
      window.location.assign('/login') // 兜底跳登录（保留当前路径供回来）
      return Promise.reject(error)
    }
  },
)
```

关键细节逐条解释：

- **`_retried` 标记**：重放后的请求再 401 就不再刷新，直接失败，避免死循环；
- **刷新接口自身不走刷新逻辑**（`isAuthApi` 判断）：refresh 都 401 了说明彻底失效，直接走登录；
- **`finally` 复位 `refreshing`**：失败的刷新 Promise 不能被缓存，否则后续所有请求永远拿到同一个 rejected Promise。

### 6.4 多标签页同步

标签页 A 刷新了 token，标签页 B 内存/存储里还是旧的，B 的下一个请求 401 又触发刷新——如果服务端启用了**刷新令牌旋转（Rotation）**，旧 refresh token 已被作废，B 会把 A 也搞下线。前端解法：用 `BroadcastChannel` 广播刷新事件：

```ts
// services/refreshBroadcast.ts —— 跨标签页同步新 token
const CHANNEL_NAME = 'auth'
const TOKEN_EVENT = 'token-refreshed'

export function notifyTokenRefreshed(token: string): void {
  new BroadcastChannel(CHANNEL_NAME).postMessage({ type: TOKEN_EVENT, token })
}

export function onTokenRefreshed(handler: (token: string) => void): () => void {
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (e: MessageEvent) => {
    if (e.data?.type === TOKEN_EVENT) handler(e.data.token as string)
  }
  return () => channel.close()
}
```

在 `refreshManager` 刷新成功后 `notifyTokenRefreshed(token)`，各页面初始化时订阅并覆写本地 token。（降级方案：监听 `storage` 事件，localStorage 变更会跨标签页触发。）

### 6.5 服务端配套：旋转与复用检测

无感刷新不只是前端的事，服务端必须配合：

- **Refresh Token Rotation**：每次刷新发新 refresh token 并立即作废旧的，把「长寿命凭证」变成一串短命凭证，压缩泄露窗口；
- **复用检测（Reuse Detection）**：已被作废的 refresh token 又被使用 = 几乎可以断定泄露（正常流程不可能拿到旧 token），此时应作废该用户整条 token 链，强制重新登录。

### 局限性

- 无感刷新延长的是「免输密码」的时间，不等于「永不登录」：refresh token 到期、IdP 会话过期、异地风控都会终止静默续期，前端必须优雅兜底（跳登录 + 记录当前路径 + 恢复现场）；
- 方案 3 的 iframe 静默授权在部分浏览器（第三方 Cookie 限制）下已经不稳，新项目建议 refresh token 方案或改用顶层重定向（refresh token rotation + cookie）。

---

## 七、Token 存在哪：风险矩阵

**问题来源**：无感刷新把 token 长期留在浏览器，存的位置直接决定 XSS / CSRF 的暴露面。这是前端登录安全里被问最多的问题，单独成节。

| 存储位置 | XSS 能否偷走 | CSRF 暴露 | 多标签页共享 | 刷新页面后保留 |
| --- | --- | --- | --- | --- |
| localStorage | ❌ 能（任意脚本可读） | 无 | ✅ | ✅ |
| 内存变量 | ⚠️ 难（需注入 hook，但 XSS 已成立时大概率失守） | 无 | ❌ 需广播同步 | ❌ 丢失 |
| Cookie（httpOnly + Secure） | ✅ 偷不走（JS 不可读） | **有**（需 SameSite/CSRF 防御） | ✅ 自动 | ✅ |
| sessionStorage | ❌ 能 | 无 | ❌（每标签页独立） | ✅（仅本标签页） |

选型结论：

- **安全优先（管理后台、金融）**：access token 放内存 + refresh token 放 `httpOnly; Secure; SameSite=Strict` Cookie，配套 CSRF 防御（第九节）。XSS 偷不到、CSRF 有防御，两个攻击面都堵上。
- **多端统一（Web/App/小程序共用 API）**：Bearer token 放 localStorage 是务实妥协，但必须：短寿命 + 严格 CSP + 输出转义，把 XSS 概率压到最低。
- **httpOnly Cookie 的真正代价**不是 CSRF，而是**跨域携带难**——这也是为什么跨域 SSO 往往回到 Bearer token。

---

## 八、XSS 防御：登录场景实战

**问题来源**：XSS（跨站脚本）指攻击者把恶意脚本注入你的页面执行。一旦成立，攻击者以当前用户身份做任何事：偷 token、改绑手机、代替用户转账——前几节所有的 token 安全设计在 XSS 面前全部作废（localStorage 直接被读走）。所以 XSS 是登录安全的第一道闸。

### 8.1 三种类型

| 类型 | 注入点 | 登录场景例子 |
| --- | --- | --- |
| 存储型 | 恶意数据入库，别人浏览时执行 | 用户名注册为 `<img src=x onerror=steal()>`，管理员在后台看到该用户列表即中招 |
| 反射型 | 服务端把输入回显在响应里 | 搜索「关键词」被原样拼进 HTML |
| DOM 型 | 纯前端 JS 操作 DOM 引入 | `location.hash` 被 `innerHTML` 渲染；登录后跳转 `?redirect=` 未校验 |

### 8.2 登录页高频踩坑点

**坑 1：登录后欢迎语 / 错误回显**。React/Vue 默认对插值转义，是安全的；危险来自逃生舱：

```tsx
// ❌ 用户名含 <script> 或 <img onerror> 将直接执行
<div dangerouslySetInnerHTML={{ __html: `欢迎你，${user.nickname}` }} />

// ✅ 插值默认转义
<div>{`欢迎你，${user.nickname}`}</div>
```

**坑 2：redirect 参数注入 + 开放重定向**。登录成功后 `navigate(redirect)`，若 `redirect=https://evil.com` 或 `javascript:alert(1)`，轻则钓鱼重定向，重则 `javascript:` 协议直接执行：

```ts
// utils/safeRedirect.ts —— 白名单校验跳转目标
const ALLOWED_PREFIXES = ['/', '/user', '/market']

export function toSafeRedirect(target: string | null): string {
  if (!target) return '/'
  // 必须以 / 开头且不以 // 开头（协议相对 URL 会跳出本站）
  if (!target.startsWith('/') || target.startsWith('//')) return '/'
  return ALLOWED_PREFIXES.some((p) => target.startsWith(p)) ? target : '/'
}
```

**坑 3：富文本/Markdown 渲染**（评论、公告）。不能用转义（会杀掉合法标签），必须消毒：

```ts
import DOMPurify from 'dompurify'

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'] })
}
```

### 8.3 防御方案对比

| 方案 | 机制 | 优点 | 缺点 | 适配场景 |
| --- | --- | --- | --- | --- |
| 输出转义（框架默认） | 插值按上下文编码 | 零成本、默认开启 | 逃生舱（v-html/dangerouslySetInnerHTML）绕过 | 一切现代框架项目 |
| DOMPurify 消毒 | 白名单过滤 HTML | 富文本场景标准解 | 只管 HTML，不管 URL/JS 上下文 | 富文本渲染必用 |
| httpOnly Cookie | JS 读不到凭证 | XSS 即使发生也偷不走 token | 不防「代替用户发请求」（XSS 可直接 fetch） | token 存储必选 |
| CSP（Content-Security-Policy） | 限制脚本来源/内联执行 | 纵深防御，让注入的脚本跑不起来 | 配置侵入（需改造内联脚本），`unsafe-inline` 一开就形同虚设 | 中大型系统 |
| Trusted Types | 强制 DOM API 只接受类型化值 | 从根上堵 DOM 型注入 | 仅 Chromium 系全面支持 | 高安全要求渐进增强 |

CSP 示例（nginx 或 `<meta>` 下发）：

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';   // 禁外域脚本与内联脚本
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';               // 顺带防点击劫持
```

### 8.4 局限性

- XSS 防不住「会话内的合法操作」：即使偷不走 token，攻击脚本仍能以当前用户身份调用接口。**XSS 防御的目标是让脚本无法注入，而不是让注入后偷不到东西**——纵深防御的每一层都不能省；
- CSP 无法识别「业务上合法但语义恶意」的内容（比如用户自己发诈骗文本），那是内容审核的领域。

---

## 九、CSRF 防御

**问题来源**：Cookie 的设计是「同站请求自动携带」。你在 `bank.com` 登录后，Cookie 安静地躺在浏览器里；此时访问了 `evil.com`，它的页面里有：

```html
<!-- evil.com 上的表单：用户一点按钮，浏览器自动带上 bank.com 的 Cookie -->
<form action="https://bank.com/api/transfer" method="POST">
  <input name="to" value="attacker">
  <input name="amount" value="10000">
</form>
<script>document.forms[0].submit()</script>
```

bank.com 收到一个**带着合法 Cookie 的伪造请求**——这就是 CSRF（跨站请求伪造）。它利用的不是你的代码漏洞，而是浏览器的 Cookie 自动携带机制。**只要会话凭证走 Cookie（第二/七节的 httpOnly 方案），就必须防 CSRF。**

### 9.1 五种防御方案对比

| 方案 | 机制 | 优点 | 缺点 | 适配场景 |
| --- | --- | --- | --- | --- |
| SameSite Cookie | 跨站请求不携带 Cookie | 一行配置、浏览器原生 | 顶级导航 GET 仍带（Lax）；跨域 SSO 需要 `None` 时失效 | 首选基础防御 |
| CSRF Token（同步令牌） | 服务端渲染时嵌入随机 token，提交时比对 | 可靠、兼容老浏览器 | 纯前后端分离下发放麻烦 | 传统服务端模板应用 |
| **Double Submit Cookie** | Cookie 存随机值 + 请求 Header 带同值，服务端比对 | 前后端分离友好、服务端无状态 | 依赖子域无污染（子域可覆写 Cookie） | **SPA 主流方案** |
| 自定义 Header + CORS | 要求带 `X-Requested-With` 等头，跨域简单请求发不出 | 天然被 CORS preflight 拦截 | 依赖前端库配合，浏览器扩展可绕 | Bearer token 体系天然免疫 |
| Origin / Referer 校验 | 服务端校验请求来源域名 | 零 token 成本 | 隐私软件会剥 Referer，需容错分支 | 辅助校验 |

### 9.2 现代组合拳（推荐基线）

```
Cookie: session=xxx; HttpOnly; Secure; SameSite=Lax + 双提交验证 + Origin 校验
```

前端实现双提交（与 6.3 的 http.ts 同层）：

```ts
// services/csrfService.ts —— 双提交：Cookie 与 Header 携带同一随机值
export const CSRF_COOKIE = 'csrf_token'
export const CSRF_HEADER = 'x-csrf-token'

/** 生成随机 token 并写入 Cookie（非 httpOnly，本域 JS 可读） */
export function ensureCsrfToken(): string {
  let token = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE}=`))
    ?.split('=')[1]

  if (!token) {
    token = crypto.randomUUID()
    document.cookie = `${CSRF_COOKIE}=${token}; Path=/; Secure; SameSite=Lax`
  }
  return token
}

// http.interceptors.request.use((config) => {
//   config.headers[CSRF_HEADER] = ensureCsrfToken()
//   return config
// })
```

原理：`evil.com` 的表单**无法设置自定义 Header**（跨域自定义头会触发 preflight 且被 CORS 拒绝），也**读不到** `bank.com` 的 Cookie 来填值，双保险。

### 9.3 两个特殊场景

**① SameSite 与跨域 SSO 的冲突**。第五节方案里，认证中心 Cookie 需要在 `idp.com` 被其他域的跳转流程使用：隐式 iframe 静默授权要求 `SameSite=None; Secure`——而 `None` 意味着放弃 SameSite 防护，必须回退到双提交/Origin 校验补位。这是「体验与安全互相拉扯」的典型例子，新项目可直接用顶层重定向 + 授权码规避 iframe。

**② 登录 CSRF（Login CSRF）**。攻击者用**自己的账号**，让受害者的浏览器完成登录。受害者以为登录了自己的账号，实际处于攻击者会话中——之后在里面绑定的支付方式、保存的搜索记录、重置的密码全都归攻击者所有。防御：登录接口同样校验一次性 nonce（表单隐藏字段 + 服务端一次性消费），成本极低，容易被忽视。

### 9.4 局限性

- CSRF 防御全部依赖「跨站无法读/无法设」，对**同站的恶意子域**（被入侵的兄弟子域）无效——子域可以污染父域 Cookie（配合 `__Host-` 前缀 Cookie 可缓解）、可以发起同站请求；
- Bearer token（Authorization Header）体系天然免疫 CSRF，但把风险挪回了 XSS 一侧。**XSS 与 CSRF 的跷跷板贯穿 token 存储选型**：Cookie 方案防 XSS 换来 CSRF 风险，localStorage 方案反之。没有两头都占的免费午餐，只有按业务风险排序的取舍。

---

## 十、工程化周边：让登录功能「完整」

安全之外，一个生产可用的登录模块还需要：

### 10.1 路由守卫（前端权限控制）

```tsx
// components/AuthGuard.tsx —— 路由守卫组件
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { ReactElement } from 'react'

interface AuthGuardProps {
  children: ReactElement
}

export function AuthGuard({ children }: AuthGuardProps): ReactElement {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    // 记录来路，登录成功后送回（注意走 toSafeRedirect 消毒）
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return children
}
```

注意：**前端守卫只是体验，不是安全边界**——真正的校验必须落在服务端（每个接口都验权），前端挡的是「别让未登录用户看到页面空转」。

### 10.2 登出要做完整

一个不完整的登出等于没登出，清单化：

- 清前端凭证：token、用户信息缓存、业务 store 重置；
- 调服务端登出接口：失效会话 / 吊销 refresh token；
- 中止在途请求：`AbortController` 取消，防止登出后 401 又触发刷新；
- 公共设备：清 `localStorage` 里记住的账号、退出 SSO（第五节单点注销）。

### 10.3 多端登录与互踢

策略三选一（服务端决策，前端配合）：允许多端并存（IM 常见）、单端互踢（旧端收到特定错误码如 `401 + code=KICKED` 跳登录并提示）、互不干扰按端隔离。前端要处理的是「被踢」的被动登出路径——它和 token 过期的跳转逻辑不同，要给用户明确提示。

### 10.4 记住我

本质是 refresh token 的寿命策略：勾选 = refresh token 30 天（httpOnly Cookie 持久化）；不勾 = 会话级 Cookie（关浏览器即失效）。前端只是一个 checkbox 传参，安全语义全在服务端。

---

## 十一、全链路选型决策

把全文压缩成一张决策表（从上往下依次确认）：

```
1. 会话载体？
   ├─ 同域 Web 单体/内部系统 ──────────→ Cookie-Session(httpOnly)
   └─ 多端/跨域/API 开放 ──────────────→ 双 Token（短 access + 可吊销 refresh）

2. Token 存哪？
   ├─ 安全优先（后台/金融） ───────────→ 内存 access + httpOnly Cookie refresh + CSRF 双提交
   └─ 务实多端 ───────────────────────→ localStorage + 严格 CSP + 短寿命

3. 需要第三方登录/SSO？
   ├─ 是，同主域 ─────────────────────→ 父域 Cookie + 统一认证中心
   ├─ 是，跨域 ───────────────────────→ OIDC 授权码 + PKCE（自建 Keycloak/Casdoor 或云服务）
   └─ 否 ─────────────────────────────→ 自研双 token 即可

4. 续期方式？
   ├─ 自研双 token ───────────────────→ 401 拦截 + 单飞排队 + BroadcastChannel 同步
   └─ OIDC 体系 ──────────────────────→ refresh_token grant（或顶层重定向静默授权）

5. 安全基线（无论如何都做）
   ├─ HTTPS 全站
   ├─ 统一错误文案（防撞用户名）
   ├─ 登录限流 + 验证码 + 失败锁定
   ├─ redirect 白名单校验
   └─ CSP + 输出转义（XSS）/ SameSite + 双提交（CSRF）
```

### 总结

- **登录不是一个页面，是一条生命周期链路**：凭证交换 → 会话保持 → 静默续期 → 主动登出，每环都独立选型；
- **Cookie-Session 与 JWT 的核心分野是「状态放哪」**，混合双 token 是当下主流解；
- **OAuth 2.0 是授权不是认证**，浏览器端新项目只有一种正确答案：授权码 + PKCE（+ OIDC 做认证）；
- **跨域 SSO 的本质是登录态收敛到 IdP 域**，第三方 Cookie 的消亡让「多域共享 Cookie」成为历史方案；
- **无感刷新的关键词是单飞排队与多标签页同步**，服务端的旋转 + 复用检测同样不可或缺；
- **XSS 与 CSRF 是一对跷跷板**：Cookie 防 XSS 偷取但引入 CSRF，Header/Bearer 反之——先做存储选型，再按矩阵补对应防御，别指望单点方案包打天下。
