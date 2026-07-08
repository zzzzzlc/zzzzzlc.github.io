---
title: RBAC 权限管理设计：从模型选型到工程落地
date: '2026-02-19'
tags:
  - 数据库
  - 架构
category: 后端工程
summary: >-
  从实际业务中的权限管理痛点出发，系统梳理权限模型的选型路径——ACL、RBAC 0/1/2/3、ABAC 的原理与对比，RBAC
  的完整工程落地方案（表设计、核心查询、菜单权限、数据权限、前端联动），以及多租户扩展与权限模型的局限性。
---

# RBAC 权限管理设计：从模型选型到工程落地

## 一、问题来源

几乎所有中后台系统都会面对权限管理的问题：

**业务层面的痛点：**

- 产品经理说"给运营加个权限"，开发发现代码里到处是 `if (user.role === 'admin')`，改一处漏一处
- 新入职的员工不该看到某些菜单和数据，但权限粒度太粗，要么全给要么全不给
- 多租户 SaaS 系统中，A 租户的管理员不能看到 B 租户的数据，但数据库是共享的
- 权限需求频繁变动，每次都要改代码重新发版

**技术层面的痛点：**

- 不清楚 ACL、RBAC、ABAC 各自适合什么场景，选型靠拍脑袋
- 知道要上 RBAC，但不知道 RBAC 还分 0/1/2/3 四个级别
- 做了角色-权限管理，但数据权限（谁能看哪些数据）不知道怎么设计
- 前后端权限同步困难，后端加了个权限前端没有对应控制

**核心问题：权限管理不是"加个角色字段"这么简单，它是一套从模型选型 → 表结构设计 → 权限判定 → 前后端联动的完整体系。**

本文将从权限模型对比、RBAC 分级设计、工程落地、数据权限、前端联动五个维度，给出可落地的 RBAC 权限管理方案。

---

## 二、权限模型对比

### 2.1 三大模型概览

#### ACL（Access Control List，访问控制列表）

```
核心思想：每个资源维护一个"谁能访问我"的列表

用户 ──→ 资源 A：[张三可读, 李四可读写]
用户 ──→ 资源 B：[张三可读写]

示例：
┌─────────────┬──────────────────┐
│    资源      │   访问控制列表   │
├─────────────┼──────────────────┤
│ 文件 A      │ 张三:读, 李四:读写 │
│ 文件 B      │ 张三:读写         │
│ 文档 C      │ 王五:读           │
└─────────────┴──────────────────┘
```

**优点：** 简单直观，权限粒度细到单个资源
**缺点：** 用户多/资源多时，维护成本爆炸；无法按角色批量授权

#### RBAC（Role-Based Access Control，基于角色的访问控制）

```
核心思想：用户 → 角色 → 权限，通过角色解耦用户和权限

张三 ──→ [编辑] ──→ [文章:创建, 文章:编辑]
李四 ──→ [审核] ──→ [文章:审核, 文章:发布]
王五 ──→ [编辑, 审核] ──→ 合并以上所有权限
```

**优点：** 权限统一管理，角色变更自动生效，用户-权限解耦
**缺点：** 角色爆炸问题（角色组合太多），难以表达复杂策略

#### ABAC（Attribute-Based Access Control，基于属性的访问控制）

```
核心思想：根据主体属性、资源属性、环境属性、操作组合判定

规则示例：
  当 主体.department == "销售部"
  且 资源.region == 主体.region
  且 环境.time >= 09:00 && 环境.time <= 18:00
  则 允许 访问 客户资料

判定引擎：
  Policy = Subject + Resource + Action + Environment
```

**优点：** 灵活度最高，能表达复杂业务规则
**缺点：** 实现复杂，性能开销大，策略难以理解和审计

### 2.2 选型对比

| 维度 | ACL | RBAC | ABAC |
|------|-----|------|------|
| 粒度 | 资源级 | 角色/操作级 | 属性级（最细） |
| 复杂度 | 低 | 中 | 高 |
| 维护成本 | 高（资源×用户） | 中 | 高（策略配置） |
| 适用规模 | 小型系统 | 中大型系统 | 复杂策略系统 |
| 典型场景 | 文件系统、Wiki | 管理后台、SaaS | 云平台 IAM、合规系统 |
| 灵活性 | 低 | 中 | 高 |
| 可审计性 | 差 | 好 | 好（但策略复杂） |

### 2.3 选型建议

```
决策路径：

1. 用户 < 50，资源 < 1000 → ACL 足够
2. 管理后台 / SaaS / 企业内部系统 → RBAC（90% 的场景）
3. 权限策略极其复杂（跨部门、跨地域、多条件组合） → ABAC
4. RBAC 搞不定，但又不想上 ABAC → RBAC + 数据权限规则（折中方案）

本文重点：RBAC 的完整工程落地。
```

---

## 三、RBAC 模型分级

RBAC 规范（NIST）定义了四个递进级别：

### 3.1 RBAC0 — 基础模型

```
用户 ←→ 角色 ←→ 权限

最简单的三表结构：用户表、角色表、权限表
两个关联表：用户-角色、角色-权限

适用：简单管理系统，角色固定，几乎不变
```

### 3.2 RBAC1 — 角色继承

```
在 RBAC0 基础上增加角色继承（角色树）

        超级管理员
        ┌────┴────┐
    管理员         运营主管
    ┌──┴──┐       ┌──┴──┐
  编辑   审计    运营   客服

继承规则：
- 子角色自动拥有父角色的所有权限
- 可以在父角色基础上增加权限
- 一个角色只能有一个父角色（单继承）或多个父角色（多继承）

适用：组织架构明确、角色有层级关系的系统
```

### 3.3 RBAC2 — 互斥约束

```
在 RBAC0 基础上增加约束规则：

1. 互斥角色：同一用户不能同时拥有"出纳"和"审计"角色（职责分离）
2. 基数约束：一个用户最多拥有 N 个角色；一个角色最多有 M 个用户
3. 先决条件：要拥有"审核员"角色，必须先拥有"编辑"角色

适用：金融、审计等对职责分离有严格要求的系统
```

### 3.4 RBAC3 — RBAC1 + RBAC2

```
完整模型：同时支持角色继承和约束规则

实际工程中：
- RBAC0 能覆盖 70% 的场景
- RBAC1 能覆盖 90% 的场景
- RBAC2/3 适用于金融、政务等高合规领域
```

**本文落地方案基于 RBAC1（角色继承），这是性价比最高的选择。**

---

## 四、表结构设计

### 4.1 核心表（RBAC0 基础）

```sql
-- 用户表（简化，实际项目中字段更多）
CREATE TABLE sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    password VARCHAR(200) NOT NULL COMMENT '密码（加密存储）',
    phone VARCHAR(20) COMMENT '手机号',
    email VARCHAR(100) COMMENT '邮箱',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用 0禁用',
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_username (username),
    UNIQUE INDEX uk_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统用户';

-- 角色表
CREATE TABLE sys_role (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL COMMENT '角色编码：admin/editor/viewer',
    name VARCHAR(100) NOT NULL COMMENT '角色名称',
    description VARCHAR(200) COMMENT '描述',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1启用 0禁用',
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统角色';

-- 权限表
CREATE TABLE sys_permission (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parent_id INT DEFAULT NULL COMMENT '父权限ID（树形结构）',
    code VARCHAR(100) NOT NULL COMMENT '权限编码：article:create',
    name VARCHAR(100) NOT NULL COMMENT '权限名称',
    type TINYINT NOT NULL COMMENT '类型：1菜单 2按钮 3数据',
    module VARCHAR(30) NOT NULL COMMENT '所属模块：article/user/system',
    sort_order INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    UNIQUE INDEX uk_code (code),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统权限';

-- 用户-角色关联
CREATE TABLE sys_user_role (
    user_id BIGINT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    INDEX idx_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户-角色关联';

-- 角色-权限关联
CREATE TABLE sys_role_permission (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    INDEX idx_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色-权限关联';
```

### 4.2 角色继承扩展（RBAC1）

```sql
-- 在角色表上增加父角色字段（单继承，覆盖大部分场景）
ALTER TABLE sys_role ADD COLUMN parent_id INT DEFAULT NULL COMMENT '父角色ID';
ALTER TABLE sys_role ADD INDEX idx_parent (parent_id);

-- 示例数据
INSERT INTO sys_role (id, code, name, parent_id) VALUES
(1, 'super_admin', '超级管理员', NULL),
(2, 'admin',       '管理员',     1),
(3, 'editor',      '编辑',       2),
(4, 'auditor',     '审核员',     2),
(5, 'viewer',      '只读用户',   2);
```

### 4.3 权限表树形结构设计

```sql
-- 权限按树形组织：模块 → 菜单 → 按钮
INSERT INTO sys_permission (id, parent_id, code, name, type, module) VALUES
-- 文章管理模块
(100, NULL,   'article',        '文章管理', 1, 'article'),
(101, 100,    'article:list',   '文章列表', 1, 'article'),
(102, 101,    'article:create', '新增文章', 2, 'article'),
(103, 101,    'article:edit',   '编辑文章', 2, 'article'),
(104, 101,    'article:delete', '删除文章', 2, 'article'),
(105, 101,    'article:audit',  '审核文章', 2, 'article'),
(106, 101,    'article:publish','发布文章', 2, 'article'),

-- 用户管理模块
(200, NULL,   'user',           '用户管理', 1, 'user'),
(201, 200,    'user:list',      '用户列表', 1, 'user'),
(202, 201,    'user:create',    '新增用户', 2, 'user'),
(203, 201,    'user:edit',      '编辑用户', 2, 'user'),
(204, 201,    'user:delete',    '删除用户', 2, 'user'),
(205, 201,    'user:reset_pwd', '重置密码', 2, 'user'),

-- 系统管理模块
(300, NULL,   'system',         '系统管理', 1, 'system'),
(301, 300,    'system:role',    '角色管理', 1, 'system'),
(302, 301,    'role:create',    '新增角色', 2, 'system'),
(303, 301,    'role:edit',      '编辑角色', 2, 'system'),
(304, 301,    'role:delete',    '删除角色', 2, 'system');
```

---

## 五、核心查询

### 5.1 查询用户所有权限（含继承角色）

```sql
-- 查询用户的直接权限
SELECT DISTINCT p.code, p.name, p.type, p.module
FROM sys_permission p
JOIN sys_role_permission rp ON p.id = rp.permission_id
JOIN sys_user_role ur ON rp.role_id = ur.role_id
WHERE ur.user_id = #{userId}
  AND p.status = 1;

-- 查询用户的所有权限（含继承角色的权限）
-- 方法：递归查询角色链，再查所有角色的权限
WITH RECURSIVE role_tree AS (
    -- 起点：用户直接拥有的角色
    SELECT r.id, r.parent_id
    FROM sys_role r
    JOIN sys_user_role ur ON r.id = ur.role_id
    WHERE ur.user_id = #{userId} AND r.status = 1 AND r.is_deleted = 0

    UNION ALL

    -- 递归：查找所有祖先角色（向上遍历继承链）
    SELECT parent.id, parent.parent_id
    FROM sys_role parent
    JOIN role_tree rt ON parent.id = rt.parent_id
    WHERE parent.status = 1 AND parent.is_deleted = 0
)
SELECT DISTINCT p.code, p.name, p.type, p.module, p.parent_id, p.sort_order
FROM sys_permission p
JOIN sys_role_permission rp ON p.id = rp.permission_id
JOIN role_tree rt ON rp.role_id = rt.id
WHERE p.status = 1;
```

### 5.2 查询用户菜单树

```sql
-- 只取 type=1（菜单类型）的权限
WITH RECURSIVE role_tree AS (
    SELECT r.id, r.parent_id
    FROM sys_role r
    JOIN sys_user_role ur ON r.id = ur.role_id
    WHERE ur.user_id = #{userId} AND r.status = 1 AND r.is_deleted = 0
    UNION ALL
    SELECT parent.id, parent.parent_id
    FROM sys_role parent
    JOIN role_tree rt ON parent.id = rt.parent_id
    WHERE parent.status = 1 AND parent.is_deleted = 0
)
SELECT DISTINCT p.id, p.parent_id, p.code, p.name, p.module, p.sort_order
FROM sys_permission p
JOIN sys_role_permission rp ON p.id = rp.permission_id
JOIN role_tree rt ON rp.role_id = rt.id
WHERE p.status = 1 AND p.type = 1
ORDER BY p.sort_order;
```

### 5.3 权限校验（后端）

```sql
-- 校验用户是否拥有某个权限编码
SELECT COUNT(*) > 0 AS has_permission
FROM sys_permission p
JOIN sys_role_permission rp ON p.id = rp.permission_id
JOIN sys_user_role ur ON rp.role_id = ur.role_id
WHERE ur.user_id = #{userId}
  AND p.code = #{permissionCode}
  AND p.status = 1;
```

---

## 六、菜单权限：前后端联动

### 6.1 后端返回菜单树

```typescript
// 后端接口：GET /api/user/menus
// 返回结构示例
interface MenuItem {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  path: string;
  icon?: string;
  children?: MenuItem[];
  buttons?: string[];  // 该菜单下的按钮权限编码列表
}

// 响应示例
[
  {
    id: 100,
    name: "文章管理",
    code: "article",
    path: "/article",
    icon: "edit",
    children: [
      {
        id: 101,
        name: "文章列表",
        code: "article:list",
        path: "/article/list",
        buttons: ["article:create", "article:edit", "article:delete"]
      }
    ]
  }
]
```

### 6.2 前端路由控制

```typescript
// 前端根据后端返回的菜单动态生成路由
const backendMenus = await fetchUserMenus();

function generateRoutes(menus: MenuItem[]): RouteRecordRaw[] {
  return menus
    .filter(menu => menu.type === 1)  // 只处理菜单类型
    .map(menu => ({
      path: menu.path,
      name: menu.code,
      component: () => import(`@/views${menu.path}/index.vue`),
      meta: {
        title: menu.name,
        icon: menu.icon,
        buttons: menu.buttons || [],  // 按钮权限列表传给页面
      },
      children: menu.children ? generateRoutes(menu.children) : [],
    }));
}

const dynamicRoutes = generateRoutes(backendMenus);
dynamicRoutes.forEach(route => router.addRoute(route));
```

### 6.3 前端按钮级权限控制

```typescript
// 权限指令 v-permission
// 用法：<button v-permission="'article:delete'">删除</button>

import type { Directive } from 'vue';

export const permission: Directive = {
  mounted(el, binding) {
    const userButtons = getUserButtons();  // 从 store/pinia 中获取当前用户的按钮权限列表
    const required = binding.value;

    if (!userButtons.includes(required)) {
      el.parentNode?.removeChild(el);  // 无权限则移除 DOM 元素
    }
  }
};

// 全局注册
app.directive('permission', permission);

// 或者封装为组合式函数
function usePermission() {
  const userButtons = new Set(getUserButtons());

  const hasPermission = (code: string) => userButtons.has(code);

  return { hasPermission };
}

// 在组件中使用
const { hasPermission } = usePermission();
// <template>
//   <button v-if="hasPermission('article:create')">新增</button>
//   <button v-if="hasPermission('article:edit')">编辑</button>
//   <button v-if="hasPermission('article:delete')">删除</button>
// </template>
```

### 6.4 后端接口权限守卫

```typescript
// NestJS 示例：权限守卫装饰器
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

// 装饰器：标记接口需要的权限
export const RequirePermission = (code: string) =>
  SetMetadata(PERMISSION_KEY, code);

// 使用
@Controller('article')
export class ArticleController {
  @Post()
  @RequirePermission('article:create')
  create() { /* ... */ }

  @Delete(':id')
  @RequirePermission('article:delete')
  remove() { /* ... */ }
}

// 权限守卫
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get(PERMISSION_KEY, context.getHandler());
    if (!required) return true;  // 未标记权限的接口直接放行

    const request = context.switchToHttp().getRequest();
    const user = request.user;  // 经过认证守卫后挂载的用户信息

    const hasPermission = await this.checkPermission(user.id, required);
    if (!hasPermission) {
      throw new ForbiddenException('没有操作权限');
    }
    return true;
  }

  private async checkPermission(userId: number, code: string): Promise<boolean> {
    // 查询数据库或缓存中的权限列表
    const permissions = await getUserPermissions(userId);
    return permissions.includes(code);
  }
}
```

---

## 七、数据权限

功能权限控制"能不能做"，数据权限控制"能看哪些数据"。这是 RBAC 最常见的扩展需求。

### 7.1 数据权限的常见规则

```
规则类型：
1. 全部数据      → 超级管理员可看所有
2. 本部门数据    → 只看自己所属部门的数据
3. 本部门及子部门 → 部门主管看本部门 + 下级部门
4. 仅本人数据    → 普通员工只看自己的
5. 自定义数据    → 按指定条件过滤
```

### 7.2 表结构扩展

```sql
-- 部门表（树形结构）
CREATE TABLE sys_dept (
    id INT PRIMARY KEY AUTO_INCREMENT,
    parent_id INT DEFAULT NULL COMMENT '父部门ID',
    name VARCHAR(100) NOT NULL COMMENT '部门名称',
    sort_order INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门';

-- 用户扩展部门
ALTER TABLE sys_user ADD COLUMN dept_id INT DEFAULT NULL COMMENT '所属部门';
ALTER TABLE sys_user ADD INDEX idx_dept (dept_id);

-- 角色数据权限规则
CREATE TABLE sys_role_data_scope (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL COMMENT '角色ID',
    scope_type TINYINT NOT NULL COMMENT '规则类型：1全部 2本部门 3本部门及子部门 4仅本人 5自定义',
    module VARCHAR(30) NOT NULL COMMENT '所属模块：article/order/customer',
    UNIQUE INDEX uk_role_module (role_id, module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色数据权限';

-- 自定义数据权限（scope_type=5 时使用）
CREATE TABLE sys_role_data_custom (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_data_scope_id INT NOT NULL COMMENT '关联 sys_role_data_scope.id',
    dept_id INT NOT NULL COMMENT '授权的部门ID',
    INDEX idx_scope (role_data_scope_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自定义数据权限-部门';
```

### 7.3 数据权限查询

```sql
-- 查询某用户在"文章"模块能看到的文章列表

-- 步骤1：确定数据权限规则
-- 假设用户角色返回 scope_type = 3（本部门及子部门）

-- 步骤2：根据规则拼接 SQL 条件

-- scope_type = 1：全部数据 → 无额外条件
SELECT * FROM article WHERE ... ;

-- scope_type = 2：本部门数据
SELECT a.* FROM article a
WHERE a.author_dept_id = #{currentUser.deptId};

-- scope_type = 3：本部门及子部门（递归查部门树）
WITH RECURSIVE dept_tree AS (
    SELECT id FROM sys_dept WHERE id = #{currentUser.deptId}
    UNION ALL
    SELECT d.id FROM sys_dept d JOIN dept_tree dt ON d.parent_id = dt.id
)
SELECT a.* FROM article a
WHERE a.author_dept_id IN (SELECT id FROM dept_tree);

-- scope_type = 4：仅本人数据
SELECT a.* FROM article a
WHERE a.author_id = #{currentUserId};

-- scope_type = 5：自定义部门
SELECT a.* FROM article a
WHERE a.author_dept_id IN (
    SELECT rdc.dept_id
    FROM sys_role_data_custom rdc
    JOIN sys_role_data_scope rds ON rdc.role_data_scope_id = rds.id
    JOIN sys_user_role ur ON rds.role_id = ur.role_id
    WHERE ur.user_id = #{currentUserId} AND rds.module = 'article'
);
```

### 7.4 数据权限在代码中的实现

```typescript
// 数据权限拦截器（MyBatis-Plus 风格的思路）

// 定义数据权限上下文
interface DataScope {
  scopeType: 'ALL' | 'DEPT' | 'DEPT_AND_CHILDREN' | 'SELF' | 'CUSTOM';
  deptId?: number;
  userId: number;
  customDeptIds?: number[];
}

// 根据用户角色获取数据权限
async function getDataScope(userId: number, module: string): Promise<DataScope> {
  const rules = await getRoleDataScope(userId, module);
  // 取最宽松的规则（多个角色时取并集）
  if (rules.some(r => r.scopeType === 1)) {
    return { scopeType: 'ALL', userId };
  }
  // ... 其他规则合并逻辑
}

// SQL 拼接（伪代码）
function applyDataScope(sql: string, scope: DataScope, deptColumn: string, userColumn: string): string {
  switch (scope.scopeType) {
    case 'ALL':
      return sql;  // 无额外条件
    case 'DEPT':
      return `${sql} AND ${deptColumn} = ${scope.deptId}`;
    case 'DEPT_AND_CHILDREN':
      return `${sql} AND ${deptColumn} IN (${getDeptTreeIds(scope.deptId).join(',')})`;
    case 'SELF':
      return `${sql} AND ${userColumn} = ${scope.userId}`;
    case 'CUSTOM':
      return `${sql} AND ${deptColumn} IN (${scope.customDeptIds.join(',')})`;
  }
}
```

---

## 八、权限缓存策略

每次请求都查数据库获取权限列表是不现实的，需要缓存。

### 8.1 缓存结构设计

```
Redis 缓存 Key 设计：

用户权限列表：  user:permissions:{userId}     → SET ['article:create', 'article:edit', ...]
用户菜单树：    user:menus:{userId}           → JSON 字符串
用户数据权限：  user:data_scope:{userId}      → HASH { module → scope_type }

缓存时机：
- 用户登录时加载权限到缓存
- 角色/权限变更时清除相关用户的缓存
- 设置合理的过期时间（如 30 分钟）兜底
```

### 8.2 缓存更新策略

```
权限变更时的缓存失效：

场景1：修改角色的权限
  → 查询该角色关联的所有用户
  → 批量删除这些用户的 user:permissions:* 和 user:menus:*
  → 下次请求时重新加载

场景2：修改用户的角色
  → 删除该用户的 user:permissions:* 和 user:menus:*
  → 下次请求时重新加载

场景3：修改部门结构
  → 清除所有 user:data_scope:*
  → 部门变更影响范围大，需要全量失效
```

```typescript
// 权限缓存服务（伪代码）
class PermissionCacheService {
  // 加载用户权限到缓存
  async loadUserPermissions(userId: number) {
    const permissions = await queryUserPermissions(userId);
    const menus = await queryUserMenus(userId);
    const dataScopes = await queryUserDataScopes(userId);

    await redis.setex(`user:permissions:${userId}`, 1800, JSON.stringify(permissions));
    await redis.setex(`user:menus:${userId}`, 1800, JSON.stringify(menus));
    await redis.setex(`user:data_scope:${userId}`, 1800, JSON.stringify(dataScopes));
  }

  // 清除用户权限缓存
  async invalidateUser(userId: number) {
    await redis.del(
      `user:permissions:${userId}`,
      `user:menus:${userId}`,
      `user:data_scope:${userId}`
    );
  }

  // 角色权限变更时，清除所有关联用户
  async invalidateRoleUsers(roleId: number) {
    const userIds = await queryRoleUsers(roleId);
    const pipeline = redis.pipeline();
    for (const uid of userIds) {
      pipeline.del(`user:permissions:${uid}`, `user:menus:${uid}`);
    }
    await pipeline.exec();
  }
}
```

---

## 九、多租户扩展

SaaS 系统中，权限需要租户隔离。

### 9.1 表结构扩展

```sql
-- 核心表增加租户 ID
ALTER TABLE sys_user ADD COLUMN tenant_id INT NOT NULL COMMENT '租户ID';
ALTER TABLE sys_role ADD COLUMN tenant_id INT NOT NULL COMMENT '租户ID';
ALTER TABLE sys_permission ADD COLUMN tenant_id INT DEFAULT NULL COMMENT '租户ID（NULL表示系统级）';
ALTER TABLE sys_dept ADD COLUMN tenant_id INT NOT NULL COMMENT '租户ID';

-- 所有查询都带租户条件
SELECT DISTINCT p.code
FROM sys_permission p
JOIN sys_role_permission rp ON p.id = rp.permission_id
JOIN sys_user_role ur ON rp.role_id = ur.role_id
JOIN sys_role r ON ur.role_id = r.id
WHERE ur.user_id = #{userId}
  AND r.tenant_id = #{tenantId}   -- 租户隔离
  AND p.status = 1;

-- 租户表
CREATE TABLE sys_tenant (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '租户名称',
    code VARCHAR(50) NOT NULL COMMENT '租户编码',
    plan VARCHAR(30) NOT NULL DEFAULT 'basic' COMMENT '套餐：basic/pro/enterprise',
    max_users INT NOT NULL DEFAULT 50 COMMENT '最大用户数',
    expired_at DATETIME COMMENT '到期时间',
    status TINYINT NOT NULL DEFAULT 1,
    UNIQUE INDEX uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='租户';

-- 每个租户可以自定义角色（基于平台预置角色的副本）
-- 平台预置权限：tenant_id IS NULL（全局权限）
-- 租户自定义权限：tenant_id = 具体值
```

### 9.2 多租户隔离方案对比

| 方案 | 说明 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|---------|
| 字段隔离 | 共享数据库，所有表加 tenant_id | 成本低，运维简单 | 隔离性弱，需要每条 SQL 都带条件 | 中小规模 SaaS |
| Schema 隔离 | 同一数据库实例，不同 Schema | 隔离性较好 | 连接管理复杂 | 中等规模 |
| 数据库隔离 | 每个租户独立数据库 | 隔离性最强 | 运维成本高，资源浪费 | 大客户/金融场景 |

**大部分 SaaS 选择字段隔离 + 行级安全策略。**

---

## 十、完整方案对比与选型

### 10.1 按项目规模选择

| 项目规模 | 推荐方案 | 表数量 | 说明 |
|---------|---------|--------|------|
| 小项目（< 10 个角色） | RBAC0 | 5 张核心表 | 用户、角色、权限、两个关联表 |
| 中项目（角色有层级） | RBAC1 | 5 张核心表 + 角色继承字段 | 角色表加 parent_id |
| 大项目（需要数据权限） | RBAC1 + 数据权限 | 8~9 张表 | 加部门、数据权限规则表 |
| SaaS（多租户） | RBAC1 + 数据权限 + 租户隔离 | 10+ 张表 | 核心表加 tenant_id |
| 金融/合规 | RBAC3 | 10+ 张表 + 约束规则表 | 增加互斥角色、基数约束 |

### 10.2 不要过度设计

```
常见过度设计：

❌ 内部管理系统搞 ABAC → RBAC 足够，ABAC 徒增复杂度
❌ 给每个按钮都配数据权限 → 按钮级数据权限维护成本极高
❌ 角色继承搞多层（5 层以上）→ 角色链过长难以理解和调试
❌ 权限表设计到字段级（哪个字段能看）→ 用列级权限的场景极少

正确做法：
✅ 从 RBAC0 开始，需要时再扩展
✅ 功能权限（菜单+按钮）+ 数据权限（部门级别），覆盖 95% 的需求
✅ 角色继承控制在 3 层以内
```

---

## 十一、局限性与边界

```
RBAC 的局限：

1. 角色爆炸
   - 如果角色组合太多（如：部门 × 职级 × 业务线），角色数量会失控
   - 解决：引入用户组或属性标签，减少角色粒度

2. 无法表达动态策略
   - "工作时间才能审批" "IP 白名单内才能操作" 这类条件 RBAC 无法处理
   - 解决：在 RBAC 基础上叠加规则引擎或切换 ABAC

3. 权限变更的实时性
   - 权限变更后，已登录用户的缓存可能不会立即更新
   - 解决：WebSocket 推送通知前端刷新权限，或设置较短的缓存过期时间

4. 跨系统权限同步
   - 多个系统各自的 RBAC 是独立的，用户需要重复配置角色
   - 解决：统一认证中心（SSO）+ 统一权限平台

5. 审计与合规
   - RBAC 只记录"谁有什么权限"，不记录"谁在什么时候做了什么"
   - 解决：增加操作审计日志表，记录每次权限校验的结果

6. 性能瓶颈
   - 权限查询涉及多表 JOIN，高频场景下可能成为瓶颈
   - 解决：Redis 缓存 + 权限预加载 + 定期刷新
```

---

## 十二、Code Review 检查清单

```
RBAC Review 要点：

表结构：
□ 核心五表是否齐全（用户、角色、权限、用户-角色、角色-权限）？
□ 关联表是否用联合主键（而非自增 ID）？
□ 是否有 is_deleted / status 字段支持软删除和启停？
□ 权限表是否支持树形结构（parent_id）？

查询：
□ 权限查询是否走了索引？
□ 角色继承查询是否用递归 CTE？
□ 是否有 N+1 查询问题（循环查权限）？

安全：
□ 后端每个接口是否都有权限守卫？
□ 前端按钮是否做了权限控制（v-permission 或 v-if）？
□ 是否存在前端隐藏了按钮但后端没校验的情况？
□ 超级管理员权限是否硬编码在代码中？

缓存：
□ 权限变更时是否清除了缓存？
□ 缓存过期时间是否合理？
□ 多实例部署时缓存失效是否能同步？

数据权限：
□ 数据权限规则是否覆盖了所有业务模块？
□ 数据权限的 SQL 拼接是否有 SQL 注入风险？
□ 自定义数据权限的部门列表是否做了深度限制？
```
