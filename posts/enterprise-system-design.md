---
title: 企业系统方案设计：从认证授权到核心业务模块的完整架构
date: '2026-03-07'
tags:
  - 企业系统
  - AI Agent
  - 架构
category: 架构
summary: >-
  从企业系统建设中的共性痛点出发，系统梳理企业级系统的核心模块方案设计——统一认证与 SSO（JWT vs Session vs
  OAuth2）、组织架构与数据权限、审批工作流引擎（状态机 vs
  BPMN）、消息通知中心（站内信/推送/邮件/短信）、多租户架构（三种隔离方案）、操作审计与合规日志、BFF 聚合层，以及各模块的选型边界与集成策略。
---

# 企业系统方案设计：从认证授权到核心业务模块的完整架构

## 一、问题来源

企业系统（ERP、OA、CRM、SaaS 平台）和互联网产品有本质区别——业务逻辑复杂、角色权限多样、流程审批严格、数据隔离要求高。但很多团队仍然用"写 CRUD"的思路做企业系统：

**认证授权层面的痛点：**

- 十几个子系统各自维护账号密码，员工离职后要在每个系统里单独禁用
- 不知道 SSO（单点登录）怎么实现，OAuth2 / OIDC / SAML 的区别是什么
- Token 过期、刷新、续期的策略混乱，用户频繁掉线或 Token 被盗用

**业务流程层面的痛点：**

- 每个审批流都硬编码实现，改一个流程要改代码重新发版
- 报销/请假/采购各有各的审批逻辑，但核心流程相似却无法复用
- 不清楚该用状态机还是专业工作流引擎

**多系统协同层面的痛点：**

- 多个子系统（人事、财务、项目管理）各自独立，数据不一致
- 一个业务操作需要同步更新多个系统，分布式事务处理困难
- 新接手的系统没有审计日志，出了问题无法追溯

**核心问题：企业系统的难点不在单个功能，而在于认证、权限、流程、消息、租户、审计等横切关注点的系统性设计。这些模块如果前期没规划好，后期改造成本极高。**

本文将从统一认证、组织架构、审批工作流、消息通知、多租户、审计日志六个核心模块，给出企业系统的完整方案设计。

---

## 二、统一认证与 SSO

### 2.1 认证方案对比

```
┌──────────┬───────────────────┬──────────────────┬──────────────────┐
│   方案   │       原理        │      优点        │      缺点        │
├──────────┼───────────────────┼──────────────────┼──────────────────┤
│ Session  │ 服务端存储会话    │ 简单成熟         │ 服务器有状态     │
│ + Cookie │ SessionId 在Cookie│ 即时吊销         │ 跨域困难         │
│          │                   │                  │ 不适合分布式     │
├──────────┼───────────────────┼──────────────────┼──────────────────┤
│ JWT      │ Token 自包含信息  │ 无状态           │ 无法即时吊销     │
│          │ 服务端不存储      │ 天然分布式       │ Token 体积大     │
│          │                   │ 跨域友好         │ 续期策略复杂     │
├──────────┼───────────────────┼──────────────────┼──────────────────┤
│ OAuth2   │ 授权框架          │ 标准化           │ 实现复杂         │
│ + OIDC   │ 第三方授权+身份层 │ 支持第三方登录   │ 需要授权服务器   │
│          │                   │ SSO 基础         │                  │
└──────────┴───────────────────┴──────────────────┴──────────────────┘
```

### 2.2 推荐方案：JWT + Refresh Token + Redis 黑名单

```
双 Token 方案：

Access Token（短命）：
  - 有效期 15~30 分钟
  - 携带用户 ID、角色、权限等基本信息
  - 每次请求携带，服务端无状态验证

Refresh Token（长命）：
  - 有效期 7~30 天
  - 只用于刷新 Access Token
  - 存储在 Redis 中（可即时吊销）

登录流程：
┌────────┐     1. 账号密码     ┌──────────┐
│  客户端 │ ──────────────→  │  认证服务  │
│        │                   │          │
│        │  2. Access Token  │ 验证密码 │
│        │     Refresh Token │ 生成JWT  │
│        │ ←──────────────  │ 存Redis  │
└────────┘                   └──────────┘

Token 刷新：
┌────────┐  Refresh Token    ┌──────────┐
│  客户端 │ ──────────────→  │  认证服务  │
│        │                   │          │
│        │  新 Access Token  │ 验证RT   │
│        │  新 Refresh Token │ 更新Redis │
│        │ ←──────────────  │          │
└────────┘                   └──────────┘

Token 吊销（登出 / 踢人）：
  → 将 Access Token 的 jti 加入 Redis 黑名单
  → 删除 Redis 中的 Refresh Token
  → 黑名单 TTL = Access Token 剩余有效期
```

```typescript
// Token 生成与验证
interface TokenPayload {
  userId: string;
  username: string;
  roles: string[];
  jti: string;            // Token 唯一标识（用于黑名单）
  iat: number;            // 签发时间
  exp: number;            // 过期时间
}

// 生成 Access Token
function generateAccessToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      jti: uuid(),
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: '30m' },
  );
}

// 生成 Refresh Token
async function generateRefreshToken(userId: string): Promise<string> {
  const token = uuid();
  await redis.setex(
    `refresh_token:${userId}:${token}`,  // key
    30 * 24 * 3600,                       // 30 天
    JSON.stringify({ userId, createdAt: Date.now() }),
  );
  return token;
}

// Token 黑名单（登出时调用）
async function revokeToken(jti: string, exp: number): Promise<void> {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.setex(`token_blacklist:${jti}`, ttl, '1');
  }
}

// 验证中间件
async function authMiddleware(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ code: 'UNAUTHORIZED' });

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;

    // 检查黑名单
    const isBlacklisted = await redis.exists(`token_blacklist:${payload.jti}`);
    if (isBlacklisted) {
      return res.status(401).json({ code: 'TOKEN_REVOKED' });
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ code: 'INVALID_TOKEN' });
  }
}
```

### 2.3 SSO 单点登录

```
目标：登录一次，所有子系统免登

方案一：基于认证中心（推荐）

┌────────┐                    ┌──────────┐
│ 子系统A │ ── 未登录，跳转 ──→│  认证中心  │
│        │                    │ (SSO服务) │
│        │ ←─ 带Ticket回调 ──│          │
│        │                    └──────────┘
│        │ ── 用Ticket换Token─→│ 认证中心  │
│ 子系统A │ ←─ 返回 Token ────│          │
└────────┘                    └──────────┘

当用户访问子系统 B 时：
┌────────┐                    ┌──────────┐
│ 子系统B │ ── 未登录，跳转 ──→│  认证中心  │
│        │                    │          │
│        │ ←─ 检测到全局会话  │ 已登录    │
│        │     直接带Ticket   │ 不需要再输│
│        │     回调（免登）    │ 密码      │
└────────┘                    └──────────┘

全局登出（单点登出 SLO）：
  用户在任一子系统登出 → 通知认证中心 → 认证中心通知所有子系统销毁会话

方案二：OAuth2 Authorization Code Flow

  客户端 → 授权服务器（登录）→ 回调带 code → 客户端用 code 换 token
  标准协议，适合第三方集成

方案三：OIDC（OpenID Connect）

  在 OAuth2 基础上增加身份层
  ID Token（JWT 格式）包含用户身份信息
  适合：需要标准化身份联邦的场景
```

### 2.4 三种 SSO 协议对比

| 维度 | OAuth2 | OIDC | SAML |
|------|--------|------|------|
| 定位 | 授权框架 | 身份认证（基于 OAuth2） | 身份认证 |
| Token 格式 | 自定义 | JWT（ID Token） | XML |
| 适用场景 | API 授权、第三方登录 | SSO + 身份联邦 | 企业内网 SSO |
| 复杂度 | 中 | 中 | 高（XML 签名） |
| 移动端 | 友好 | 友好 | 不友好 |
| 推荐 | API 场景 | 企业 SSO 首选 | 老旧系统集成 |

---

## 三、组织架构与数据权限

### 3.1 组织架构模型

```sql
-- 部门树（支持多级嵌套）
CREATE TABLE org_department (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    parent_id BIGINT DEFAULT NULL COMMENT '父部门ID',
    name VARCHAR(100) NOT NULL COMMENT '部门名称',
    code VARCHAR(50) NOT NULL COMMENT '部门编码',
    leader_id BIGINT COMMENT '部门负责人',
    sort_order INT NOT NULL DEFAULT 0,
    path VARCHAR(500) COMMENT '物化路径：/1/5/12/',
    level TINYINT NOT NULL DEFAULT 1 COMMENT '层级',
    status TINYINT NOT NULL DEFAULT 1,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_code (code),
    INDEX idx_parent (parent_id),
    INDEX idx_path (path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门';

-- 员工
CREATE TABLE org_employee (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '关联系统用户',
    name VARCHAR(50) NOT NULL,
    employee_no VARCHAR(30) NOT NULL COMMENT '工号',
    dept_id BIGINT NOT NULL COMMENT '主部门',
    position VARCHAR(50) COMMENT '职位',
    entry_date DATE COMMENT '入职日期',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1在职 2离职',
    UNIQUE INDEX uk_employee_no (employee_no),
    INDEX idx_dept (dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='员工';

-- 员工-部门关联（兼职/多部门）
CREATE TABLE org_employee_dept (
    employee_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    is_primary TINYINT NOT NULL DEFAULT 0 COMMENT '是否主部门',
    PRIMARY KEY (employee_id, dept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='员工部门关联';

-- 查询某部门及所有子部门的员工（物化路径方案）
SELECT e.* FROM org_employee e
JOIN org_department d ON e.dept_id = d.id
WHERE d.path LIKE CONCAT(
    (SELECT path FROM org_department WHERE id = #{deptId}), '%'
);
```

### 3.2 数据权限规则

```
数据权限策略（复用 rbac-design 中的设计）：

┌──────────────────┬────────────────────────────────────────────┐
│     规则类型     │                  含义                       │
├──────────────────┼────────────────────────────────────────────┤
│ ALL              │ 看全部数据                                  │
│ DEPT_ONLY        │ 只看本部门数据                              │
│ DEPT_AND_CHILDREN│ 看本部门及子部门数据                        │
│ SELF_ONLY        │ 只看自己的数据                              │
│ CUSTOM           │ 自定义部门列表                              │
└──────────────────┴────────────────────────────────────────────┘

典型映射：
  超级管理员     → ALL
  部门经理       → DEPT_AND_CHILDREN
  普通员工       → SELF_ONLY
  跨部门协调角色 → CUSTOM（指定多个部门）

SQL 拼接策略：
  ALL             → 无额外条件
  DEPT_ONLY       → WHERE creator_dept_id = #{currentUser.deptId}
  DEPT_AND_CHILDREN → WHERE creator_dept_id IN (部门子树ID列表)
  SELF_ONLY       → WHERE creator_id = #{currentUserId}
  CUSTOM          → WHERE creator_dept_id IN (自定义部门列表)
```

---

## 四、审批工作流引擎

### 4.1 两种实现路径

```
路径一：状态机（简单审批）

  适用：审批步骤固定（3~5 步）、不需要动态调整
  实现：业务表中加 status 字段 + 审批记录表

路径二：工作流引擎（复杂审批）

  适用：审批步骤可配置、支持条件分支/并行审批/会签/加签
  实现：Flowable / Camunda / 自研轻量引擎
```

### 4.2 状态机方案（轻量）

```sql
-- 业务表自带状态字段
CREATE TABLE biz_expense_claim (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    applicant_id BIGINT NOT NULL COMMENT '申请人',
    amount DECIMAL(10,2) NOT NULL COMMENT '金额',
    status ENUM('draft','pending_mgr','pending_finance','approved','rejected','cancelled')
        NOT NULL DEFAULT 'draft',
    current_approver_id BIGINT COMMENT '当前审批人',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报销申请';

-- 审批记录表
CREATE TABLE biz_approval_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    business_type VARCHAR(30) NOT NULL COMMENT '业务类型：expense/leave/purchase',
    business_id BIGINT NOT NULL COMMENT '业务ID',
    action ENUM('submit','approve','reject','withdraw','delegate') NOT NULL,
    operator_id BIGINT NOT NULL COMMENT '操作人',
    comment TEXT COMMENT '审批意见',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_business (business_type, business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批日志';

-- 状态转换规则
const EXPENSE_TRANSITIONS = {
  draft:         { submit: 'pending_mgr', cancel: 'cancelled' },
  pending_mgr:   { approve: 'pending_finance', reject: 'rejected', withdraw: 'draft' },
  pending_finance:{ approve: 'approved', reject: 'rejected', withdraw: 'pending_mgr' },
  approved:      {},
  rejected:      { resubmit: 'pending_mgr' },
  cancelled:     {},
};
```

### 4.3 工作流引擎方案（Flowable）

```
BPMN 2.0 流程定义：

┌───────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────┐
│ 提交  │───→│ 主管审批  │───→│ 财务审批  │───→│ CEO审批   │───→│ 结束 │
│       │    │(金额<1万) │    │(金额<5万) │    │(金额≥5万) │    │      │
└───────┘    └──────────┘    └──────────┘    └──────────┘    └──────┘
                  │               │               │
                  ▼               ▼               ▼
              ┌───────┐      ┌───────┐       ┌───────┐
              │ 驳回  │      │ 驳回  │       │ 驳回  │
              └───────┘      └───────┘       └───────┘

条件分支：金额 < 1万 → 跳过财务；金额 ≥ 5万 → 需要 CEO 审批
```

```xml
<!-- BPMN 流程定义（简化示例） -->
<process id="expenseApproval" name="报销审批">
  <startEvent id="start" />
  <sequenceFlow sourceRef="start" targetRef="submitTask" />

  <userTask id="submitTask" name="提交报销" assignee="${applicant}" />
  <sequenceFlow sourceRef="submitTask" targetRef="managerApproval" />

  <userTask id="managerApproval" name="主管审批"
            candidateGroups="managers" />
  <sequenceFlow sourceRef="managerApproval" targetRef="gateway1" />

  <exclusiveGateway id="gateway1" name="金额判断" />
  <!-- 金额 < 10000 → 直接结束 -->
  <sequenceFlow sourceRef="gateway1" targetRef="end">
    <conditionExpression>${amount < 10000}</conditionExpression>
  </sequenceFlow>
  <!-- 金额 >= 10000 → 财务审批 -->
  <sequenceFlow sourceRef="gateway1" targetRef="financeApproval">
    <conditionExpression>${amount >= 10000}</conditionExpression>
  </sequenceFlow>

  <userTask id="financeApproval" name="财务审批"
            candidateGroups="finance" />
  <endEvent id="end" />
</process>
```

### 4.4 两种方案对比

| 维度 | 状态机 | 工作流引擎（Flowable） |
|------|--------|----------------------|
| 复杂度 | 低 | 高 |
| 流程变更 | 改代码发版 | 改配置即时生效 |
| 条件分支 | 硬编码 | 表达式配置 |
| 并行审批 | 需自己实现 | 原生支持 |
| 会签/加签 | 需自己实现 | 原生支持 |
| 流程可视化 | 无 | BPMN 图形编辑器 |
| 运维成本 | 低 | 高（额外组件） |
| 适用场景 | 3~5 步固定流程 | 复杂可配置流程 |

**选型建议：**

```
审批步骤 ≤ 5 步、流程固定很少变 → 状态机
审批步骤多、需要运营配置流程 → 工作流引擎
未来可能变复杂但现在简单 → 先用状态机，预留接口
```

---

## 五、消息通知中心

### 5.1 多渠道消息架构

```
消息中心的目标：一次发送，多渠道触达

┌────────────┐
│  业务系统   │ ── 发送消息 ──→ ┌──────────────┐
│ (报销/OA等) │               │  消息中心      │
└────────────┘                │              │
                              │  消息模板管理  │
                              │  渠道路由      │
                              │  发送策略      │
                              │  已读/未读     │
                              └──────┬───────┘
                                     │
                    ┌────────┬───────┼───────┬────────┐
                    ▼        ▼       ▼       ▼        ▼
                ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
                │站内信││ 邮件 ││ 短信 ││ 推送 ││ 企微 │
                └──────┘└──────┘└──────┘└──────┘└──────┘
```

### 5.2 表结构设计

```sql
-- 消息模板
CREATE TABLE msg_template (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL COMMENT '模板编码：expense_approved',
    name VARCHAR(100) NOT NULL,
    channels VARCHAR(100) NOT NULL COMMENT '渠道：email,sms,in_app',
    title_template VARCHAR(200) NOT NULL COMMENT '标题模板',
    body_template TEXT NOT NULL COMMENT '内容模板',
    UNIQUE INDEX uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息模板';

-- 消息记录
CREATE TABLE msg_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    template_code VARCHAR(50) COMMENT '模板编码',
    user_id BIGINT NOT NULL COMMENT '接收人',
    channel VARCHAR(20) NOT NULL COMMENT '发送渠道',
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    biz_type VARCHAR(30) COMMENT '业务类型',
    biz_id VARCHAR(64) COMMENT '业务ID',
    is_read TINYINT NOT NULL DEFAULT 0,
    read_at DATETIME,
    status TINYINT NOT NULL DEFAULT 0 COMMENT '0待发送 1已发送 2发送失败',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_biz (biz_type, biz_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息记录';

-- 用户消息偏好
CREATE TABLE msg_user_preference (
    user_id BIGINT NOT NULL,
    msg_type VARCHAR(30) NOT NULL COMMENT '消息类型',
    channels VARCHAR(100) NOT NULL COMMENT '用户选择的渠道',
    PRIMARY KEY (user_id, msg_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消息偏好';
```

### 5.3 消息发送流程

```typescript
// 消息发送服务
interface SendMessageOptions {
  templateCode: string;            // 消息模板
  recipientId: number;             // 接收人
  params: Record<string, string>;  // 模板变量
  bizType?: string;                // 业务类型
  bizId?: string;                  // 业务ID
}

async function sendMessage(options: SendMessageOptions): Promise<void> {
  // 1. 加载模板
  const template = await getTemplate(options.templateCode);

  // 2. 渲染模板
  const title = renderTemplate(template.titleTemplate, options.params);
  const content = renderTemplate(template.bodyTemplate, options.params);

  // 3. 查用户偏好（用户可以关闭某些渠道）
  const preference = await getUserPreference(options.recipientId, options.templateCode);
  const channels = preference?.channels?.split(',') ?? template.channels.split(',');

  // 4. 按渠道发送
  for (const channel of channels) {
    switch (channel) {
      case 'in_app':
        await saveInAppMessage(options.recipientId, title, content, options);
        break;
      case 'email':
        await sendEmail(options.recipientId, title, content);
        break;
      case 'sms':
        await sendSMS(options.recipientId, content);
        break;
      case 'push':
        await sendPush(options.recipientId, title, content);
        break;
    }
  }
}

// 使用示例
await sendMessage({
  templateCode: 'expense_approved',
  recipientId: 10086,
  params: {
    applicantName: '张三',
    amount: '2580.00',
    claimId: 'EXP-20260506-001',
  },
  bizType: 'expense',
  bizId: '123',
});
```

---

## 六、多租户架构

### 6.1 三种隔离方案

```
方案一：字段隔离（共享数据库）
  所有租户共享数据库和表，通过 tenant_id 字段区分
  适合：中小规模 SaaS、租户数量多但数据量不大

方案二：Schema 隔离（共享实例）
  同一数据库实例，每个租户一个 Schema
  适合：中等规模、对隔离有一定要求

方案三：数据库隔离（独立实例）
  每个租户独立的数据库实例
  适合：大客户、合规要求、金融/医疗场景

┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│     方案     │  隔离性  │  成本    │  运维    │  扩展性  │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│ 字段隔离     │  低      │  低      │  简单    │  高      │
│ Schema隔离   │  中      │  中      │  中等    │  中      │
│ 数据库隔离   │  高      │  高      │  复杂    │  低      │
└──────────────┴──────────┴──────────┴──────────┴──────────┘
```

### 6.2 字段隔离实现

```typescript
// 方案：全局 tenant_id 过滤（MyBatis-Plus / TypeORM 拦截器思路）

// 1. 请求上下文中存储租户 ID
class TenantContext {
  private static store = new AsyncLocalStorage<number>();

  static run(tenantId: number, fn: () => Promise<void>) {
    return this.store.run(tenantId, fn);
  }

  static getTenantId(): number {
    return this.store.getStore() ?? 0;
  }
}

// 2. 中间件自动注入租户上下文
function tenantMiddleware(req, res, next) {
  const tenantId = req.user?.tenantId;  // 从 JWT Token 中获取
  if (!tenantId) return res.status(403).json({ code: 'NO_TENANT' });

  TenantContext.run(tenantId, () => next());
}

// 3. SQL 自动拼接租户条件（以 Knex 为例）
function tenantQuery(table: string) {
  const tenantId = TenantContext.getTenantId();
  return db(table).where('tenant_id', tenantId);
}

// 使用时自动带上租户过滤
const orders = await tenantQuery('orders').where('status', 'paid');

// 4. 新增数据自动填充租户 ID
async function createOrder(data: OrderInput) {
  return db('orders').insert({
    ...data,
    tenant_id: TenantContext.getTenantId(),  // 自动填充
  });
}

// 5. 查询时全局钩子（TypeORM EntitySubscriber）
// 在所有 SELECT 语句自动追加 WHERE tenant_id = ?
// 在所有 INSERT 语句自动追加 tenant_id 字段
// 确保开发不可能忘记加租户过滤
```

### 6.3 租户级别的配置与限制

```sql
-- 租户配置表
CREATE TABLE tenant_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    config_key VARCHAR(50) NOT NULL,
    config_value VARCHAR(500) NOT NULL,
    UNIQUE INDEX uk_tenant_key (tenant_id, config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户配置';

-- 租户套餐/限制
CREATE TABLE tenant_plan (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL UNIQUE,
    plan VARCHAR(30) NOT NULL DEFAULT 'basic' COMMENT '套餐',
    max_users INT NOT NULL DEFAULT 50 COMMENT '最大用户数',
    max_storage_mb INT NOT NULL DEFAULT 1024 COMMENT '最大存储(MB)',
    features JSON COMMENT '可用功能列表',
    expired_at DATETIME COMMENT '到期时间',
    status TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户套餐';

-- 中间件中检查限制
async function checkTenantLimit(tenantId: number, limitType: string): Promise<boolean> {
  const plan = await getTenantPlan(tenantId);
  if (plan.status !== 1 || new Date(plan.expired_at) < new Date()) return false;

  switch (limitType) {
    case 'users': {
      const count = await countTenantUsers(tenantId);
      return count < plan.max_users;
    }
    case 'storage': {
      const usage = await getTenantStorageUsage(tenantId);
      return usage < plan.max_storage_mb;
    }
  }
  return true;
}
```

---

## 七、操作审计与合规日志

### 7.1 审计日志设计

```sql
CREATE TABLE sys_audit_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    trace_id VARCHAR(32) NOT NULL COMMENT '链路追踪ID',
    tenant_id INT COMMENT '租户ID',
    user_id BIGINT NOT NULL COMMENT '操作人',
    username VARCHAR(50) NOT NULL COMMENT '操作人用户名',
    action VARCHAR(30) NOT NULL COMMENT '操作类型：CREATE/UPDATE/DELETE/EXPORT/LOGIN',
    module VARCHAR(30) NOT NULL COMMENT '模块：user/order/article',
    target_type VARCHAR(30) COMMENT '目标类型',
    target_id VARCHAR(64) COMMENT '目标ID',
    target_name VARCHAR(200) COMMENT '目标名称（便于阅读）',
    before_data JSON COMMENT '变更前数据',
    after_data JSON COMMENT '变更后数据',
    diff_summary VARCHAR(500) COMMENT '变更摘要',
    ip VARCHAR(45) NOT NULL COMMENT '操作IP',
    user_agent VARCHAR(500) COMMENT '浏览器UA',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_target (target_type, target_id),
    INDEX idx_module_action (module, action),
    INDEX idx_created (created_at),
    INDEX idx_trace (trace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计日志';
```

### 7.2 审计日志自动采集

```typescript
// 装饰器 / 中间件方式自动记录审计日志

// 方案：AOP 拦截器（NestJS 示例）
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const path = request.route?.path;

    // 只审计写操作
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const auditInfo = {
      userId: user.id,
      username: user.username,
      tenantId: user.tenantId,
      action: methodToAction(method),
      module: extractModule(path),
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      traceId: request.headers['x-trace-id'],
    };

    return next.handle().pipe(
      tap((result) => {
        // 异步写入审计日志（不阻塞响应）
        this.saveAuditLog({
          ...auditInfo,
          targetType: result?.__type,
          targetId: result?.id,
          afterData: sanitizeForAudit(result),
        });
      }),
    );
  }

  private async saveAuditLog(log: Partial<AuditLog>) {
    // 写入消息队列 → 异步持久化（不影响接口性能）
    await mq.publish('audit_log', JSON.stringify(log));
  }
}

// 必须审计的操作（安全合规要求）：
// - 用户登录/登出
// - 权限变更（角色分配、权限修改）
// - 数据导出
// - 敏感数据查看（手机号、身份证）
// - 系统配置修改
// - 数据删除
```

### 7.3 数据变更对比

```typescript
// 生成 before/after diff
function generateDiff(before: Record<string, any>, after: Record<string, any>): string {
  const changes: string[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      changes.push(`${key}: "${before[key] ?? '无'}" → "${after[key] ?? '无'}"`);
    }
  }
  return changes.join('; ');
}

// 使用
const before = { name: '张三', role: 'editor', status: 'active' };
const after  = { name: '张三', role: 'admin',  status: 'active' };
// diff → 'role: "editor" → "admin"'
```

---

## 八、BFF 聚合层

### 8.1 为什么需要 BFF

```
企业系统中，一个前端页面往往需要聚合多个后端服务的接口：

订单详情页需要：
  ├── 订单服务 → 订单基本信息
  ├── 用户服务 → 买家/卖家信息
  ├── 商品服务 → 商品详情
  ├── 支付服务 → 支付状态
  └── 物流服务 → 物流信息

问题：
1. 前端发 5 个请求 → 慢、瀑布式依赖
2. 各服务返回格式不同 → 前端适配困难
3. 敏感字段不应暴露给前端 → 需要裁剪
4. 各端（Web/App/小程序）需要不同字段 → 需要定制

BFF（Backend For Frontend）= 前端专属的后端聚合层
```

### 8.2 BFF 架构

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Web端   │  │  App端   │  │ 小程序端  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Web BFF │  │  App BFF │  │  小程序   │
│          │  │          │  │   BFF    │
│ 聚合/裁剪│  │ 聚合/裁剪│  │ 聚合/裁剪│
│ 字段过滤 │  │ 字段过滤 │  │ 字段过滤 │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │
     └─────────┬───┴─────────────┘
               │
     ┌─────────┴───────────────┐
     │       微服务集群          │
     │  订单服务 用户服务 商品服务│
     │  支付服务 物流服务 ...    │
     └─────────────────────────┘
```

```typescript
// BFF 聚合示例
// GET /bff/order/:id/detail

async function getOrderDetail(orderId: string, userId: string) {
  // 并行请求多个服务
  const [order, buyer, products, payment, logistics] = await Promise.all([
    orderService.getOrder(orderId),
    userService.getUserBrief(userId),
    productService.getByIds(order.itemIds),
    paymentService.getPaymentStatus(orderId),
    logisticsService.getTrackInfo(orderId),
  ]);

  // 聚合 + 裁剪（不暴露内部字段）
  return {
    orderNo: order.orderNo,
    status: order.status,
    createdAt: order.createdAt,
    totalAmount: order.totalAmount,

    buyer: {
      name: buyer.name,          // 只暴露姓名
      // 不暴露手机号、邮箱等敏感字段
    },

    items: products.map(p => ({
      name: p.name,
      price: p.price,
      quantity: order.items.find(i => i.productId === p.id)?.quantity,
    })),

    payment: {
      status: payment.status,
      paidAt: payment.paidAt,
      // 不暴露支付流水号
    },

    logistics: logistics ? {
      company: logistics.company,
      trackingNo: logistics.trackingNo,
      status: logistics.status,
    } : null,
  };
}
```

### 8.3 BFF 的边界

```
BFF 应该做的：
✅ 接口聚合（多服务数据合并）
✅ 字段裁剪（不暴露敏感信息）
✅ 格式转换（适配不同端的需求）
✅ 错误合并（统一错误格式）
✅ 缓存（减少对后端服务的调用）

BFF 不应该做的：
❌ 业务逻辑（不应该在 BFF 中写业务规则）
❌ 数据校验（应该在后端服务做）
❌ 数据持久化（不直接写数据库）
❌ 成为性能瓶颈（避免串行请求，尽量并行）
```

---

## 九、模块集成策略

### 9.1 事件驱动解耦

```
问题：报销审批通过后需要同时：
  1. 更新财务系统的账目
  2. 通知申请人
  3. 更新预算系统
  4. 记录审计日志

如果用同步调用 → 4 个操作任何一个失败都会影响主流程
→ 用事件驱动解耦

报销服务 ──发布事件──→ 消息队列（MQ）
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          财务服务       通知服务       审计服务
          (更新账目)    (发通知)       (记录日志)

优势：
- 主流程不需要等待下游服务
- 下游服务故障不影响主流程
- 新增下游服务不需要改主流程
- 每个消费者可以独立重试
```

```typescript
// 事件发布
interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, any>;
  occurredAt: string;
}

// 报销审批通过后发布事件
async function onExpenseApproved(claim: ExpenseClaim) {
  await eventBus.publish({
    eventId: uuid(),
    eventType: 'expense.approved',
    aggregateType: 'expense_claim',
    aggregateId: claim.id,
    payload: {
      claimId: claim.id,
      applicantId: claim.applicantId,
      amount: claim.amount,
      approvedAt: new Date().toISOString(),
    },
    occurredAt: new Date().toISOString(),
  });
}

// 消费者：财务服务
eventBus.subscribe('expense.approved', async (event) => {
  await createFinanceRecord(event.payload);
});

// 消费者：通知服务
eventBus.subscribe('expense.approved', async (event) => {
  await sendMessage({
    templateCode: 'expense_approved',
    recipientId: event.payload.applicantId,
    params: { amount: event.payload.amount },
  });
});
```

### 9.2 模块依赖关系

```
企业系统核心模块依赖图：

  ┌──────────────────────────────────────┐
  │            统一认证 (SSO)             │
  │   JWT + Refresh Token + OAuth2       │
  └──────────────────┬───────────────────┘
                     │ 鉴权
  ┌──────────────────┴───────────────────┐
  │           组织架构 + RBAC             │
  │   部门/员工 + 角色/权限 + 数据权限    │
  └──────────────────┬───────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌─────────┐   ┌──────────┐   ┌──────────┐
│ 审批流   │   │ 消息中心  │   │ 审计日志  │
│ 状态机/  │   │ 多渠道    │   │ 操作记录  │
│ 引擎     │   │ 模板管理  │   │ 合规追溯  │
└─────────┘   └──────────┘   └──────────┘
     │               │               │
     └───────────────┼───────────────┘
                     │ 事件驱动
              ┌──────┴──────┐
              │  业务模块    │
              │ 报销/请假/   │
              │ 采购/合同    │
              └─────────────┘

横向关注点（所有模块共享）：
├── 多租户隔离
├── 操作审计
├── 消息通知
├── 异常处理
└── 日志链路追踪
```

---

## 十、方案选型与边界

### 10.1 按企业规模选型

| 企业规模 | 认证 | 审批 | 消息 | 租户 | 数据库 |
|---------|------|------|------|------|--------|
| 小型（< 50 人） | JWT | 状态机 | 站内信 | 不需要 | 单库 |
| 中型（50~500 人） | JWT + SSO | 状态机/引擎 | 站内信 + 邮件 | 可选 | 读写分离 |
| 大型（500~5000 人） | SSO + OAuth2 | 工作流引擎 | 全渠道 | 字段隔离 | 分库 |
| 集团（5000+ 人） | OIDC + SAML | BPM 平台 | 全渠道 + 集成 | Schema/DB 隔离 | 分库分表 |

### 10.2 局限性

```
企业系统设计的局限：

1. 过度设计的风险
   - 10 人的团队用了 5000 人的架构 → 开发效率极低
   - 先做 MVP，再逐步演进
   - 不要一开始就上工作流引擎 / 微服务 / 事件溯源

2. 标准化的边界
   - 不是所有企业流程都适合标准化
   - 特殊业务可能需要绕过通用模块
   - 通用模块要留扩展点（钩子 / 策略模式）

3. 数据一致性的挑战
   - 事件驱动意味着最终一致性
   - 某些场景需要强一致性（财务、库存）
   - 需要在架构层面区分强弱一致性的业务

4. 迁移成本
   - 老系统改造不是"推翻重来"
   - 需要考虑存量数据迁移、接口兼容、灰度切换
   - Strangler Fig 模式（绞杀者模式）逐步替换

5. 合规约束
   - 金融/医疗/政务有特殊的合规要求
   - 数据留存期限、访问审计、加密存储
   - 合规需求往往决定架构下限
```

---

## 十一、Code Review 检查清单

```
认证授权：
□ 是否使用 HTTPS 传输 Token？
□ Access Token 有效期是否 <= 30 分钟？
□ Refresh Token 是否存储在服务端（可即时吊销）？
□ 登出是否同时清除 Token 黑名单？
□ 敏感接口是否做了权限校验？

数据权限：
□ 所有查询是否都带了租户/部门过滤？
□ 是否存在绕过数据权限的查询？
□ 管理员查看敏感数据是否记录审计日志？

审批流程：
□ 审批状态转换是否遵循状态机/流程定义？
□ 审批操作是否有审计记录？
□ 并发审批是否有乐观锁/悲观锁控制？

消息通知：
□ 消息发送是否异步（不阻塞主流程）？
□ 消息模板是否与代码解耦（数据库/配置中心）？
□ 发送失败是否有重试机制？

多租户：
□ 新增数据的 tenant_id 是否自动填充？
□ 租户数据量是否有限制？
□ 租户切换是否安全（不会串数据）？

审计日志：
□ 写操作是否都有审计记录？
□ 审计日志是否包含操作人、IP、时间、变更内容？
□ 审计日志是否不可篡改？
```
