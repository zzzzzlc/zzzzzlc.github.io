---
title: "JavaScript 原型链投毒原理与防御方案"
date: "2026-04-24"
tags:
  - 原型链
  - 安全
  - JavaScript
  - 深拷贝
  - 输入校验
category: "前端安全"
summary: "从真实攻击案例出发，深入剖析 JavaScript 原型链投毒的攻击原理，对比分析冻结原型、输入过滤、安全深拷贝、Proxy 拦截等多种防御方案，涵盖 Node.js 和浏览器端的实战防御策略。"
---

# JavaScript 原型链投毒原理与防御方案

## 一、问题来源

2020 年，Node.js 生态爆发了一次严重的安全事件：热门库 `lodash` 的 `defaultsDeep` 函数被发现存在原型链投毒漏洞（CVE-2020-82083），攻击者可以通过精心构造的 JSON 输入，向所有 JavaScript 对象的原型链注入恶意属性。

类似的安全事件还有：

- **jQuery < 3.4.0**：`$.extend(true, {}, userInput)` 可被投毒
- **express-fileupload**：通过 HTTP 请求体的 `__proto__` 字段实现远程代码执行
- **minimist**：命令行参数解析时未过滤 `__proto__`，导致配置被篡改
- **plain-clone**：深拷贝库直接复制 `__proto__` 属性

**核心问题：** JavaScript 的原型继承机制允许运行时修改所有对象的基类 `Object.prototype`，而开发者常用的深拷贝、对象合并等操作如果未对特殊属性做过滤，就会被攻击者利用，将恶意数据注入到整个应用的对象原型链中。

## 二、攻击原理深入分析

### 2.1 JavaScript 原型链基础

```javascript
// 每个对象都有一个隐式原型 __proto__，指向其构造函数的 prototype
const obj = {};
console.log(obj.__proto__ === Object.prototype); // true

// 属性查找会沿着原型链向上查找
console.log(obj.toString); // [Function: toString] — 来自 Object.prototype

// 修改 Object.prototype 会影响所有对象
Object.prototype.hacked = true;
console.log({}.hacked);        // true
console.log([].hacked);        // true
console.log("str".hacked);     // true
```

### 2.2 投毒的两种路径

**路径一：通过 `__proto__` 直接赋值**

```javascript
// 攻击者构造的恶意输入（通常来自用户提交的 JSON）
const maliciousPayload = JSON.parse('{"__proto__":{"isAdmin":true}}');

// 常见的漏洞代码：直接合并用户输入
const config = {};
Object.assign(config, maliciousPayload);

// 结果：Object.prototype 被污染
console.log({}.isAdmin); // true —— 所有新对象都有 isAdmin 属性
```

**路径二：通过 `constructor.prototype` 间接赋值**

```javascript
// 更隐蔽的攻击方式
const payload = {
    constructor: {
        prototype: {
            isAdmin: true,
        },
    },
};

// 某些深拷贝实现会递归复制这些属性
function vulnerableMerge(target, source) {
    for (const key in source) {
        if (typeof source[key] === 'object' && source[key] !== null) {
            if (!target[key]) target[key] = {};
            vulnerableMerge(target[key], source[key]); // 递归时可能触发投毒
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

vulnerableMerge({}, payload);
// 此时 Function.prototype 或 Object.prototype 可能被污染
```

### 2.3 真实攻击场景复现

**场景一：用户注册接口投毒**

```javascript
// 服务端代码（Node.js）
app.post('/api/register', (req, res) => {
    const defaults = { role: 'user', isActive: false };
    // ⚠️ 漏洞：直接用用户输入覆盖默认配置
    const userConfig = _.merge({}, defaults, req.body);

    // 创建用户对象
    const user = {};
    console.log(user.role); // undefined（正常）
    // 但如果 req.body 是 {"__proto__":{"role":"admin"}}
    // 那么 Object.prototype.role = "admin"
    // 此后所有新创建的对象 {} 都会有 role: "admin"
});
```

**场景二：配置文件解析投毒**

```javascript
// 读取用户上传的 JSON 配置文件
const userConfig = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
// config.json 内容：
// {
//   "__proto__": {
//     "shell": "/bin/bash",
//     "env": { "NODE_OPTIONS": "--require /tmp/malicious.js" }
//   }
// }

// 合并配置
const appConfig = deepMerge(defaultConfig, userConfig);
// Object.prototype 被污染，后续所有对象都继承了恶意属性
```

**场景三：通过查询参数投毒**

```javascript
// GET /api/search?__proto__[isAdmin]=true
// Express 的 qs 库会解析为：{ __proto__: { isAdmin: true } }
app.get('/api/search', (req, res) => {
    const filter = _.defaultsDeep({}, req.query, defaultFilter);
    // 原型链被投毒
});
```

### 2.4 投毒的危害等级

| 危害 | 说明 |
|------|------|
| **属性注入** | 所有对象继承恶意属性，导致逻辑判断被绕过（如 `isAdmin`） |
| **DoS 攻击** | 向原型注入 getter/setter，触发无限循环或内存泄漏 |
| **远程代码执行** | 在 Node.js 环境中，通过污染 `env` 或 `shell` 配置，可能实现 RCE |
| **XSS 攻击** | 污染前端组件的默认属性，注入恶意脚本 |
| **权限提升** | 覆盖权限校验逻辑，普通用户获得管理员权限 |

## 三、防御方案

### 方案一：输入过滤 —— 拦截危险属性名

最直接的防御方式，在对象合并/深拷贝之前过滤掉危险键名。

```typescript
const DANGEROUS_KEYS = new Set([
    '__proto__',
    'constructor',
    'prototype',
]);

function sanitizeObject<T extends Record<string, unknown>>(
    obj: T,
    maxDepth: number = 10,
): T {
    if (maxDepth <= 0) return {} as T;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        // 跳过危险键名
        if (DANGEROUS_KEYS.has(key)) continue;

        // 递归处理嵌套对象
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = sanitizeObject(value as Record<string, unknown>, maxDepth - 1);
        } else {
            result[key] = value;
        }
    }

    return result as T;
}
```

**与请求处理集成：**

```typescript
// Express 中间件
function sanitizeMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction) {
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.query) req.query = sanitizeObject(req.query as Record<string, unknown>);
    if (req.params) req.params = sanitizeObject(req.params as Record<string, unknown>);
    next();
}

app.use(express.json());
app.use(sanitizeMiddleware);
```

**优点：**
- 实现简单，在入口处统一拦截
- 对业务逻辑无侵入，不需要修改现有代码
- 可以同时防御 `__proto__`、`constructor`、`prototype` 三条攻击路径

**缺点：**
- 需要覆盖所有用户输入入口，遗漏任何一个就是漏洞
- 过滤规则是黑名单机制，未来可能出现新的攻击向量
- 可能误杀合法的属性名（如用户确实需要 `constructor` 字段）
- 深层嵌套对象的递归过滤有性能开销

**适配场景：**
- 已有项目的快速修补
- API 网关层的统一安全拦截
- 无法修改底层库的场景

**局限性：**
- 只能防御已知的危险键名，不能防御未知的攻击方式
- 如果有绕过输入层的代码路径（如内部调用），仍然可能被投毒

### 方案二：安全深拷贝 —— 使用 `Object.create(null)`

从根本上避免原型链投毒：使用没有原型的对象（null-prototype object）作为拷贝目标。

```typescript
// 安全的对象合并函数
function safeMerge<T extends Record<string, unknown>>(target: T, ...sources: Record<string, unknown>[]): T {
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;

        // 使用 Object.getOwnPropertyNames 而非 for...in
        // Object.getOwnPropertyNames 不会遍历原型链上的属性
        const keys = Object.getOwnPropertyNames(source);

        for (const key of keys) {
            // 跳过危险属性
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                continue;
            }

            const sourceValue = source[key];
            const targetValue = (target as Record<string, unknown>)[key];

            if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
                // 递归合并时使用 null 原型对象
                const nestedTarget = targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)
                    ? targetValue as Record<string, unknown>
                    : Object.create(null);
                (target as Record<string, unknown>)[key] = safeMerge(nestedTarget, sourceValue);
            } else {
                (target as Record<string, unknown>)[key] = sourceValue;
            }
        }
    }

    return target;
}
```

**`Object.create(null)` 的安全性验证：**

```javascript
// 普通对象有原型
const normal = {};
console.log(normal.__proto__);           // {} (Object.prototype)
console.log(normal.toString);            // [Function]
'__proto__' in normal;                   // true（继承自原型链）

// null 原型对象没有原型，完全免疫投毒
const safe = Object.create(null);
console.log(safe.__proto__);             // undefined
console.log(safe.toString);              // undefined
'__proto__' in safe;                     // false
```

**优点：**
- 从根本上消除原型链投毒的可能性
- null 原型对象无法通过 `__proto__` 访问到 `Object.prototype`
- 不依赖黑名单，防御更彻底

**缺点：**
- `Object.create(null)` 创建的对象没有 `toString`、`hasOwnProperty` 等方法
- 不能用 `instanceof` 检查类型
- 部分第三方库和框架不兼容 null 原型对象
- JSON.stringify/parse 可以正常使用，但其他操作可能出错

**适配场景：**
- 纯数据对象（配置、DTO、API 响应）
- 不需要继承方法的数据传输层
- 安全敏感的中间件和工具函数

**局限性：**
- 不适合需要原型方法的对象（如 class 实例）
- 与某些序列化库、ORM 框架不兼容
- 调试时 `console.log` 输出可能不如普通对象直观

### 方案三：冻结 `Object.prototype` —— 阻断写入

在应用启动时冻结原型链，使任何对 `Object.prototype` 的写入操作静默失败或抛出错误。

```typescript
// 方式一：完全冻结
Object.freeze(Object.prototype);

// 验证
(Object.prototype as Record<string, unknown>).evil = true;
console.log((Object.prototype as Record<string, unknown>).evil); // undefined —— 写入被阻止

// 方式二：使用 Proxy 监控（开发环境）
function protectPrototype(proto: object, name: string): void {
    const proxy = new Proxy(proto, {
        set(target, prop, value) {
            console.error(`[Security] 尝试修改 ${name}.prototype.${String(prop)}，已被拦截`);
            // 在严格模式下抛出错误
            throw new TypeError(`不允许修改 ${name}.prototype`);
        },
        defineProperty(target, prop, descriptor) {
            console.error(`[Security] 尝试定义 ${name}.prototype.${String(prop)}，已被拦截`);
            throw new TypeError(`不允许定义 ${name}.prototype 上的属性`);
        },
        deleteProperty(target, prop) {
            console.error(`[Security] 尝试删除 ${name}.prototype.${String(prop)}，已被拦截`);
            throw new TypeError(`不允许删除 ${name}.prototype 上的属性`);
        },
    });

    // 注意：Proxy 不能直接替换 Object.prototype
    // 此模式适用于自定义类的原型保护
}

// 保护自定义类的原型
class ConfigManager {}
protectPrototype(ConfigManager.prototype, 'ConfigManager');
```

**在 Node.js 应用启动时冻结：**

```typescript
// security.ts — 在应用入口最前面引入
function lockPrototypes(): void {
    // 冻结核心原型
    Object.freeze(Object.prototype);
    Object.freeze(Array.prototype);
    Object.freeze(Function.prototype);
    Object.freeze(String.prototype);
    Object.freeze(Number.prototype);
    Object.freeze(Boolean.prototype);

    console.log('[Security] 核心原型链已冻结');
}

// 立即执行
lockPrototypes();
```

**优点：**
- 一次性防御，不需要修改每个合并函数
- 攻击者无法通过任何途径修改原型链
- 严格模式下会抛出错误，便于发现问题

**缺点：**
- 冻结后第三方库可能无法正常扩展原型（如 Polyfill）
- 部分 Babel 插件和运行时需要在原型上添加方法
- `Object.freeze` 不可逆，一旦冻结无法解冻
- 某些测试框架（如 Jest 的 mock 功能）依赖原型修改

**适配场景：**
- 生产环境的安全加固
- 不依赖原型扩展的现代化项目
- 高安全要求的金融、政务系统

**局限性：**
- 必须在所有模块加载之前执行，否则其他模块可能在冻结前修改原型
- 与需要修改原型的 Polyfill 冲突
- 不能解决已经发生的投毒（需要在投毒前冻结）

### 方案四：使用 Map 替代 Object 存储用户数据

`Map` 的键可以是任意值，且不存在原型链，完全免疫投毒攻击。

```typescript
// 用 Map 存储外部输入
function parseUserInput(json: string): Map<string, unknown> {
    const data = JSON.parse(json);
    return objectToMap(data);
}

function objectToMap(obj: Record<string, unknown>): Map<string, unknown> {
    const map = new Map<string, unknown>();

    for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            map.set(key, objectToMap(value as Record<string, unknown>));
        } else {
            map.set(key, value);
        }
    }

    return map;
}

// 使用
const userInput = parseUserInput('{"__proto__":{"isAdmin":true},"name":"test"}');
console.log(userInput.get('__proto__')); // { isAdmin: true } —— 存储为普通值，不影响原型
console.log(({} as Record<string, unknown>).isAdmin);  // undefined —— 原型未被污染

// 安全的配置合并
function safeConfigMerge(
    defaults: Map<string, unknown>,
    overrides: Map<string, unknown>,
): Map<string, unknown> {
    const result = new Map(defaults);
    for (const [key, value] of overrides) {
        result.set(key, value);
    }
    return result;
}
```

**优点：**
- Map 天然不存在原型链，从根本上杜绝投毒
- 键可以是任意类型（对象、函数等），灵活性更高
- `map.has()`、`map.get()`、`map.set()` API 清晰，不会与原型属性冲突
- 遍历时只返回自身的键，不会遍历到继承属性

**缺点：**
- 需要改造现有代码，将 Object 操作改为 Map 操作
- JSON 序列化/反序列化需要额外的转换层
- 不能用点语法和方括号语法访问（`data.key` → `data.get('key')`）
- 部分第三方库只接受 Object，不兼容 Map

**适配场景：**
- 新项目的数据结构设计
- 处理大量不可信用户输入的核心模块
- 替代普通对象作为配置存储和缓存

**局限性：**
- 现有项目改造成本高，需要大规模重构
- 与期望 Object 类型的 API（如 `req.body`、`JSON.stringify`）不直接兼容
- 在性能敏感的热路径上，Map 的操作速度略慢于 Object

### 方案五：运行时检测 —— 发现已被投毒的对象

在关键业务逻辑执行前，检测原型链是否已被污染。

```typescript
// 基线快照：记录 Object.prototype 的初始属性
const BASELINE_PROPERTIES = new Set(Object.getOwnPropertyNames(Object.prototype));

function detectPollution(): { polluted: boolean; extraProps: string[] } {
    const currentProps = Object.getOwnPropertyNames(Object.prototype);
    const extraProps = currentProps.filter(p => !BASELINE_PROPERTIES.has(p));

    return {
        polluted: extraProps.length > 0,
        extraProps,
    };
}

// 定期检测（Node.js 环境）
function startPollutionMonitor(intervalMs: number = 30000): NodeJS.Timer {
    return setInterval(() => {
        const { polluted, extraProps } = detectPollution();
        if (polluted) {
            console.error(`[Security Alert] 原型链被投毒！新增属性: ${extraProps.join(', ')}`);
            // 生产环境：触发告警、记录日志、甚至终止进程
        }
    }, intervalMs);
}

// 关键操作前检测
function secureOperation<T>(fn: () => T, label: string): T {
    const { polluted } = detectPollution();
    if (polluted) {
        throw new Error(`[Security] 拒绝执行 ${label}：检测到原型链投毒`);
    }
    return fn();
}
```

**检测特定对象的污染：**

```typescript
function isObjectClean(obj: object): boolean {
    // 检查对象自身是否被注入了不应该存在的属性
    const ownProps = Object.getOwnPropertyNames(obj);
    const dangerous = ownProps.filter(p =>
        p === '__proto__' || p === 'constructor' || p === 'prototype'
    );
    return dangerous.length === 0;
}

// 检查对象是否受原型链投毒影响
function getInheritedDangerousProps(obj: object): string[] {
    const result: string[] = [];
    for (const key in obj) {
        // 如果属性不在对象自身，而是在原型链上
        if (!Object.prototype.hasOwnProperty.call(obj, key)) {
            // 排除标准的 Object.prototype 方法
            if (!BASELINE_PROPERTIES.has(key)) {
                result.push(key);
            }
        }
    }
    return result;
}
```

**优点：**
- 不改变现有代码结构，零侵入
- 可以检测到已发生的投毒，用于事后发现和告警
- 适用于安全审计和渗透测试

**缺点：**
- 只能发现，不能阻止投毒
- 基线快照可能在应用启动时就被投毒（需要在最早时机记录）
- 定期检测有性能开销
- 严格来说不是防御，而是监控

**适配场景：**
- 已上线项目的安全监控
- CI/CD 流水线中的安全检查
- 与其他防御方案配合使用，作为最后一道防线

**局限性：**
- 不能阻止攻击发生，只能事后发现
- 如果应用启动时的依赖就包含投毒漏洞，基线快照会包含恶意属性

## 四、方案对比

| 维度 | 输入过滤 | 安全深拷贝 | 冻结原型 | Map 替代 | 运行时检测 |
|------|---------|-----------|---------|---------|-----------|
| 防御时机 | 攻击前 | 攻击前 | 攻击前 | 攻击前 | 攻击后 |
| 防御彻底性 | 中 | 高 | 高 | 最高 | 低（仅发现） |
| 代码侵入性 | 低 | 中 | 低 | 高 | 低 |
| 兼容性风险 | 低 | 低 | 中（Polyfill 冲突） | 高（需改造） | 低 |
| 性能影响 | 小 | 小 | 无 | 中（Map 转换） | 小（定时检测） |
| 实施难度 | 低 | 中 | 低 | 高 | 低 |
| 推荐优先级 | 1（必做） | 2（推荐） | 3（加固） | 4（新项目） | 5（补充） |

## 五、实战防御策略

### 5.1 多层防御架构

```
第一层：输入过滤（入口拦截）
  ↓ 万一遗漏
第二层：安全深拷贝（合并时防御）
  ↓ 万一遗漏
第三层：冻结原型（写入时阻断）
  ↓ 万一遗漏
第四层：运行时检测（事后发现）
```

### 5.2 推荐的防御代码模板

```typescript
// security/anti-pollution.ts

// 1. 危险键名黑名单
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// 2. 输入净化
export function sanitizeInput<T>(input: unknown): T {
    if (input === null || input === undefined) return input as T;
    if (typeof input !== 'object') return input as T;
    if (Array.isArray(input)) return input.map(item => sanitizeInput(item)) as T;

    const cleaned = Object.create(null);
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (FORBIDDEN_KEYS.has(key)) continue;
        cleaned[key] = typeof value === 'object' && value !== null
            ? sanitizeInput(value)
            : value;
    }
    return cleaned as T;
}

// 3. 安全合并
export function safeMerge<T extends Record<string, unknown>>(
    target: T,
    ...sources: Record<string, unknown>[]
): T {
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;
        for (const key of Object.keys(source)) {
            if (FORBIDDEN_KEYS.has(key)) continue;

            const sourceVal = source[key];
            const targetVal = (target as Record<string, unknown>)[key];

            if (sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal)) {
                (target as Record<string, unknown>)[key] = safeMerge(
                    (targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal)
                        ? targetVal : Object.create(null)) as Record<string, unknown>,
                    sourceVal,
                );
            } else {
                (target as Record<string, unknown>)[key] = sourceVal;
            }
        }
    }
    return target;
}

// 4. 基线快照
const PROTO_SNAPSHOT = Object.getOwnPropertyNames(Object.prototype);

// 5. 检测函数
export function isPrototypeClean(): boolean {
    const current = Object.getOwnPropertyNames(Object.prototype);
    return current.length === PROTO_SNAPSHOT.length
        && current.every((prop, i) => prop === PROTO_SNAPSHOT[i]);
}
```

### 5.3 第三方库安全 Checklist

- [ ] 检查依赖是否包含已知原型链投毒漏洞（`npm audit`）
- [ ] 避免将用户输入直接传给 `_.merge`、`$.extend`、`Object.assign` 等函数
- [ ] 使用 `JSON.parse` 解析用户输入时，立即执行净化
- [ ] 深拷贝函数必须过滤 `__proto__`、`constructor`、`prototype`
- [ ] 使用 `Object.hasOwnProperty` 或 `Object.keys`（不遍历原型链）代替 `for...in`
- [ ] 在 CI 中集成 `npm audit` 和 Snyk 等安全扫描工具

## 总结

原型链投毒是 JavaScript 语言层面的安全隐患，防御的核心思路是：

1. **永远不要信任用户输入** — 在入口处过滤危险键名
2. **使用安全的合并/拷贝函数** — 不要将原始用户输入传给对象合并操作
3. **优先使用 `Object.create(null)`** — 对不可信数据使用无原型对象
4. **冻结原型作为最后防线** — 生产环境冻结 `Object.prototype`
5. **定期审计依赖** — 及时更新含漏洞的第三方包

防御不是选择某一种方案，而是多层叠加，让攻击者即使突破一层也会被下一层拦截。
