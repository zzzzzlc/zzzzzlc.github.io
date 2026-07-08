---
title: Express vs Koa vs Fastify：Node.js Web 框架深度对比与选型指南
date: '2026-01-22'
tags:
  - Node.js
category: 后端
summary: >-
  从 Node.js Web 框架选型的实际痛点出发，深度对比 Express、Koa、Fastify
  三大框架的设计哲学、中间件模型、错误处理、性能表现、生态体系，通过源码级分析揭示三者本质差异，给出不同场景下的选型建议与边界。
---

# Express vs Koa vs Fastify：Node.js Web 框架深度对比与选型指南

## 一、问题来源

Node.js 项目启动时，团队几乎都会面临一个基础选型问题：**Web 框架选 Express、Koa 还是 Fastify？**

**业务层面的痛点：**

- 新项目启动，技术负责人在 Express、Koa、Fastify 之间犹豫不决，团队讨论不出结论
- 现有 Express 项目维护困难，中间件执行顺序混乱，异步错误经常丢失
- 想迁移到 Koa 或 Fastify，但不确定投入产出比，生态差距大不大
- 面试中被问到"Express、Koa、Fastify 的区别"，只能回答"Koa 是 Express 原作者写的"就说不下去了

**技术层面的痛点：**

- Express 的回调地狱（callback hell）在复杂业务中难以维护，async/await 支持不友好
- Koa 的"裸框架"设计意味着很多功能需要自己找中间件，开发效率不如 Express 开箱即用
- Fastify 的 JSON Schema 校验和插件系统学习成本不低，团队需要时间适应
- 错误处理机制差异大：Express 用集中式 error handler，Koa 用 try-catch + event，Fastify 用 setErrorHandler，混用容易出问题
- 中间件模型根本不同（线性 vs 洋葱 vs 钩子），理解不深容易写出有隐患的代码

**核心问题：Express、Koa、Fastify 不是"好与坏"的关系，而是"不同哲学"的关系。理解它们的设计取舍，才能在正确的场景做出正确的选择。**

---

## 二、Express — 简约实用的经典框架

### 2.1 设计哲学

Express 的核心理念是 **"提供恰到好处的基础能力，其余交给生态"**。

```
设计原则：
1. 极简核心 — 路由 + 中间件 + 请求/响应增强，不捆绑模板引擎、数据库等
2. 约定优于配置 — 合理的默认值，开箱即用
3. 线性中间件 — 请求按注册顺序依次通过中间件，模型直观易懂
```

### 2.2 核心源码解析

**应用创建与路由注册：**

```javascript
// express/lib/express.js
function createApplication() {
  const app = function (req, res, next) {
    app.handle(req, res, next);
  };
  // 混入 EventEmitter、路由等方法
  Object.setPrototypeOf(app, proto);
  app.init();
  return app;
}

// 路由注册的本质：把中间件函数推入 stack 数组
app.get = function (path) {
  const route = this.route(path);        // 创建 Route 对象
  route.get.apply(route, slice.call(arguments, 1)); // 注册处理函数
  return this;
};
```

**线性中间件模型：**

```javascript
// express/lib/router/index.js — 核心的 proto.handle 方法
function handle(req, res, out) {
  let idx = 0;
  const stack = self.stack;

  function next(err) {
    // 从 stack 中取出下一个 Layer
    const layer = stack[idx++];

    // 匹配路径，不匹配则跳过
    if (layer.match(path) !== false) {
      // 有错误时只执行 error handler（4 参数函数）
      if (err) {
        if (layer.handle.length === 4) {
          layer.handle(err, req, res, next);
          return;
        }
      } else {
        // 普通中间件（3 参数函数）
        layer.handle(req, res, next);
        return;
      }
    }
    next(err); // 继续匹配下一个
  }

  next(); // 启动中间件链
}
```

**关键理解：** Express 中间件是一个数组（stack），next() 函数只是把索引 idx + 1，然后调用下一个函数。整个流程是线性的、单向的。

### 2.3 基础用法

```javascript
const express = require('express');
const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// 路由
app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.json({ data: users });
  } catch (err) {
    next(err); // 必须手动 next(err)，否则错误会被吞掉
  }
});

// 集中式错误处理（4 个参数）
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(3000);
```

### 2.4 Express 的优点

| 优点 | 说明 |
|------|------|
| **生态庞大** | npm 上有数万个 Express 中间件，几乎任何需求都有现成方案 |
| **学习曲线低** | 线性模型直观，新手 30 分钟即可上手 |
| **开箱即用** | 路由、静态文件、JSON 解析等基础能力内置，无需额外安装 |
| **社区成熟** | Stack Overflow 上几乎所有问题都有解答，教程资源丰富 |
| **企业验证** | 被大量企业使用，稳定性经受过考验 |

### 2.5 Express 的缺点

| 缺点 | 说明 |
|------|------|
| **异步错误处理不友好** | async 函数中的错误不会自动传递到 error handler，必须手动 try-catch + next(err) |
| **中间件模型局限** | 线性模型无法在响应后执行清理逻辑（如日志记录、资源释放） |
| **回调风格遗留** | 核心代码基于回调设计，与现代 async/await 风格有隔阂 |
| **req/res 隐式耦合** | 通过修改 req/res 对象传递数据，缺乏明确的上下文管理 |
| **维护节奏放缓** | Express 5 迟迟未正式发布，核心团队活跃度不如从前 |

### 2.6 适配场景

- **中小型项目**：API 服务、后台管理系统、快速原型开发
- **团队新手较多**：学习成本低，文档和教程资源丰富
- **依赖成熟生态**：需要大量现成中间件（session、文件上传、CORS 等）
- **企业级稳定性优先**：要求久经考验、问题可搜索的方案

### 2.7 局限性

- 大型项目的中间件组织容易混乱，缺乏模块化路由的最佳实践引导
- 不原生支持 WebSocket，需要额外引入 `ws` 或 `socket.io`
- 性能在高并发场景下不如 Fastify
- TypeScript 支持需要 `@types/express`，类型定义不够精确

---

## 三、Koa — 优雅现代的下一代框架

### 3.1 设计哲学

Koa 的核心理念是 **"提供最小化的优雅核心，用 async/await 驱动中间件"**。

```
设计原则：
1. 极致精简 — 核心只有 ~1500 行代码，不捆绑任何中间件
2. 洋葱模型 — 中间件可以"进去"和"出来"，支持前置/后置处理
3. Context 对象 — 统一封装 req/res 为 ctx，语义更清晰
4. 原生 async/await — 从底层设计就拥抱异步
```

### 3.2 核心源码解析

**洋葱模型的实现原理：**

```javascript
// koa/lib/application.js — 核心的 compose 逻辑
// 借助 koa-compose 包实现
function compose(middleware) {
  return function (context, next) {
    let index = -1;

    function dispatch(i) {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      const fn = i === middleware.length ? next : middleware[i];

      if (!fn) return Promise.resolve();

      try {
        // 关键：把 dispatch(i+1) 作为 next 传给当前中间件
        // 中间件 await next() 时，实际上是在调用 dispatch(i+1)
        // dispatch 返回 Promise，所以 await next() 会"暂停"当前中间件
        // 直到后续所有中间件执行完毕，Promise resolve 后才继续
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
```

**洋葱模型执行流程图：**

```
请求进入
    │
    ▼
┌─────────────────────────────────┐
│  中间件 1（前置逻辑）             │
│    ┌─────────────────────────┐  │
│    │  中间件 2（前置逻辑）     │  │
│    │    ┌─────────────────┐  │  │
│    │    │  中间件 3        │  │  │
│    │    │  (业务处理)      │  │  │
│    │    └─────────────────┘  │  │
│    │  中间件 2（后置逻辑）     │  │
│    └─────────────────────────┘  │
│  中间件 1（后置逻辑）             │
└─────────────────────────────────┘
    │
    ▼
响应返回
```

**Context 对象设计：**

```javascript
// koa/lib/context.js — 代理模式，将 req/res 的属性代理到 ctx
const proto = module.exports = {
  // ctx.body 实际上是 ctx.response.body
  get body() {
    return this.response.body;
  },
  set body(val) {
    this.response.body = val;
  },

  // ctx.query 实际上是 ctx.request.query
  get query() {
    return this.request.query;
  },
  // ... 更多代理属性
};

// koa/lib/create.js
function create() {
  return Object.create(proto); // 基于原型链创建 context
}
```

### 3.3 基础用法

```javascript
const Koa = require('koa');
const app = new Koa();

// 洋葱模型中间件 — 日志（可记录响应时间）
app.use(async (ctx, next) => {
  const start = Date.now();
  await next(); // 等待后续中间件执行完毕
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});

// 错误处理中间件（放在最前面，捕获所有后续错误）
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message };
    ctx.app.emit('error', err, ctx); // 触发全局错误事件
  }
});

// 业务路由（需要 koa-router）
const Router = require('@koa/router');
const router = new Router();

router.get('/api/users', async (ctx) => {
  // async 错误会自动被外层 try-catch 捕获
  const users = await User.findAll();
  ctx.body = { data: users };
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);
```

### 3.4 Koa 的优点

| 优点 | 说明 |
|------|------|
| **优雅的异步流控** | 原生 async/await，async 错误会自动冒泡到外层中间件 |
| **洋葱模型** | 前置/后置逻辑自然组织，日志、计时、资源清理非常优雅 |
| **Context 对象** | 统一的 ctx 代替分散的 req/res，API 更语义化 |
| **极致精简** | 核心只做 HTTP 上下文和中间件编排，没有多余捆绑 |
| **错误处理一致** | async/await + try-catch 统一同步和异步错误处理 |

### 3.5 Koa 的缺点

| 缺点 | 说明 |
|------|------|
| **生态较小** | 中间件数量远不及 Express，很多功能需要自己组合 |
| **开箱即用程度低** | 路由、body 解析、静态文件等都需要额外安装中间件 |
| **学习曲线略高** | 洋葱模型需要时间理解，新手容易写出执行顺序不符合预期的代码 |
| **中间件质量参差** | 官方中间件较少，社区中间件维护状态不确定 |
| **与 Express 中间件不兼容** | 无法直接使用 Express 生态的大量中间件 |

### 3.6 适配场景

- **中大型项目**：需要良好的中间件组织和优雅的异步流控
- **API 网关 / BFF 层**：洋葱模型天然适合请求拦截、鉴权、日志
- **技术探索型项目**：团队愿意投入时间选型和组合中间件
- **重视代码优雅**：追求现代 async/await 风格和清晰的上下文管理

### 3.7 局限性

- 没有官方路由中间件，`@koa/router` 和 `koa-router` 两个包并存，容易混淆
- 社区活跃度不如 Express，遇到问题的搜索成本更高
- 不适合需要快速交付的项目，大量基础功能需要手动组合
- TypeScript 支持同样需要额外类型定义

---

## 四、Fastify — 极致性能的现代框架

### 4.1 设计哲学

Fastify 的核心理念是 **"以性能为第一优先级，提供开箱即用的完整开发体验"**。

```
设计原则：
1. 极致性能 — 基于 JSON Schema 序列化/反序列化，吞吐量是 Express 的 3 倍
2. 插件体系 — 封装良好的插件架构，支持作用域隔离和生命周期钩子
3. Schema 驱动 — 通过 JSON Schema 校验请求/响应，同时获得性能收益和类型安全
4. 开发者体验 — 内置日志（pino）、生命周期钩子、TypeScript 原生支持
```

### 4.2 核心源码解析

**基于 JSON Schema 的高性能序列化：**

```javascript
// fastify/lib/contentTypeParser.js
// Fastify 在启动时根据 JSON Schema 预编译序列化函数
// 而不是在每次请求时动态 JSON.stringify

const fastJson = require('fast-json-stringify');

// 路由注册时，如果有 response schema，预编译序列化器
function buildSerializer(schema) {
  // fast-json-stringify 根据 JSON Schema 生成高度优化的序列化代码
  // 生成的代码类似于手写的 JSON 拼接，比 JSON.stringify 快 2-3 倍
  return fastJson(schema);
}

// 示例：预编译的序列化函数等价于
function serialize(user) {
  // 不是 JSON.stringify(user)，而是：
  return '{"id":' + user.id + ',"name":' + JSON.stringify(user.name) + '}';
}
```

**请求生命周期钩子：**

```javascript
// fastify/lib/request.js
// Fastify 不是简单的中间件链，而是一套完整的生命周期系统
// 每个请求经过以下阶段：

// 1. onRequest    — 请求进入，最先执行
// 2. preParsing   — 解析请求体之前
// 3. preValidation — Schema 校验之前
// 4. preHandler   — 路由处理函数之前
// 5. handler      — 路由处理函数
// 6. preSerialization — 序列化响应之前
// 7. onSend       — 发送响应之前
// 8. onResponse   — 响应发送完成之后

// 每个阶段可以注册多个钩子函数
fastify.addHook('onRequest', async (request, reply) => {
  // 鉴权、限流等
});

fastify.addHook('preHandler', async (request, reply) => {
  // 参数预处理
});

fastify.addHook('onResponse', async (request, reply) => {
  // 响应完成后的日志、指标采集
});
```

**插件系统与封装模型：**

```javascript
// fastify/lib/pluginUtils.js
// Fastify 的插件系统支持作用域隔离
// 每个插件可以有自己的独立作用域，互不干扰

// fastify.register 创建一个新的作用域
fastify.register(async function pluginA(fastify, opts) {
  // 这里的装饰器只在这个插件及其子插件中可见
  fastify.decorate('dbA', dbConnectionA);

  fastify.get('/a', async (request, reply) => {
    return { data: fastify.dbA.query() }; // 可以访问 dbA
  });
});

fastify.register(async function pluginB(fastify, opts) {
  fastify.decorate('dbB', dbConnectionB);

  fastify.get('/b', async (request, reply) => {
    // return fastify.dbA.query(); // ❌ 访问不到 dbA，作用域隔离
    return { data: fastify.dbB.query() }; // ✅ 只能访问 dbB
  });
});
```

### 4.3 基础用法

```javascript
const fastify = require('fastify')({ logger: true });

// 带 Schema 校验的路由
fastify.get('/api/users/:id', {
  schema: {
    params: {
      type: 'object',
      properties: {
        id: { type: 'integer' }
      },
      required: ['id']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  const { id } = request.params; // 已通过 Schema 校验，类型确定
  const user = await User.findById(id);
  return user; // Fastify 自动用预编译的序列化器处理响应
});

// 错误处理
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: error.message
  });
});

// 生命周期钩子 — 请求计时
fastify.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
});

fastify.addHook('onResponse', async (request, reply) => {
  const ms = Date.now() - request.startTime;
  fastify.log.info(`${request.method} ${request.url} - ${ms}ms`);
});

// 插件注册
fastify.register(require('@fastify/cors'));
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public')
});

fastify.listen({ port: 3000 });
```

### 4.4 Fastify 的优点

| 优点 | 说明 |
|------|------|
| **极致性能** | 基于 JSON Schema 预编译序列化，吞吐量是 Express 的 3 倍 |
| **Schema 校验** | 请求/响应自动校验，减少手动验证代码，同时提升性能 |
| **插件架构** | 作用域隔离的插件系统，大型项目代码组织更清晰 |
| **生命周期钩子** | 比 Express/Koa 的中间件模型更细粒度的控制 |
| **TypeScript 原生支持** | 内置类型定义，无需额外 @types 包 |
| **内置日志** | 集成 pino（最快的 Node.js 日志库），开箱即用 |
| **活跃维护** | 核心团队活跃，版本迭代快，社区增长迅速 |

### 4.5 Fastify 的缺点

| 缺点 | 说明 |
|------|------|
| **学习曲线较陡** | Schema 驱动、插件封装、生命周期钩子等概念需要时间学习 |
| **Schema 编写成本** | 每个路由都需要写 JSON Schema，初期开发速度不如 Express |
| **生态虽增长快但不及 Express** | 插件数量 ~200+，覆盖面不如 Express 的数万个中间件 |
| **调试难度较高** | 预编译和作用域隔离增加了调试复杂度 |
| **小项目收益不大** | 性能优势在低并发场景下不明显，Schema 反而是负担 |

### 4.6 适配场景

- **高并发 API 服务**：电商、社交、IoT 等对吞吐量有硬性要求的场景
- **微服务架构**：插件系统 + 作用域隔离，天然适合微服务拆分
- **团队重视性能与规范**：Schema 驱动强制 API 契约，适合对质量要求高的团队
- **TypeScript 项目**：原生 TS 支持，开发体验最好
- **需要详细日志和监控**：内置 pino + 生命周期钩子，可观测性强

### 4.7 局限性

- JSON Schema 的编写和维护成本在接口频繁变动的早期阶段较高
- 框架概念较多（Hooks、Plugins、Decorators、Encapsulation），新人上手周期长
- 部分社区插件的成熟度和文档质量不如 Express 生态
- 与 Express/Koa 的中间件完全不兼容，迁移成本高

---

## 五、核心差异对比

### 5.1 中间件模型对比

```
Express（线性模型）：

  请求 → 中间件A → 中间件B → 路由处理 → 结束
        next()     next()     res.json()
                                           ↓
                                       错误处理（如果有错误）

特点：单向流动，next() 调用后无法回到当前中间件


Koa（洋葱模型）：

  请求 → 中间件A（前置）→ 中间件B（前置）→ 路由处理
              ↑                  ↑                ↓
         中间件A（后置）← 中间件B（后置）← ────────┘
         await next()      await next()

特点：双向流动，await next() 返回后可以继续执行后置逻辑


Fastify（生命周期钩子模型）：

  请求 → onRequest → preParsing → preValidation → preHandler
           ↓            ↓              ↓               ↓
        (钩子函数)   (钩子函数)     (钩子函数)      (钩子函数)
                                                          ↓
                                                      handler
                                                          ↓
         onResponse ← onSend ← preSerialization ← ──────┘
           ↓
        (钩子函数)

特点：固定生命周期阶段，每个阶段可注册多个钩子，粒度最细
```

**代码对比——实现请求计时：**

```javascript
// Express — 只能在响应前记录（拿不到实际响应时间）
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // 通过监听 finish 事件曲线救国
    console.log(`${req.method} ${req.url} - ${Date.now() - start}ms`);
  });
  next();
});

// Koa — 自然地在后置逻辑中记录
app.use(async (ctx, next) => {
  const start = Date.now();
  await next(); // 等待后续所有中间件执行完毕
  console.log(`${ctx.method} ${ctx.url} - ${Date.now() - start}ms`);
});

// Fastify — 通过生命周期钩子记录
fastify.addHook('onRequest', async (request, reply) => {
  request.startTime = Date.now();
});
fastify.addHook('onResponse', async (request, reply) => {
  const ms = Date.now() - request.startTime;
  fastify.log.info(`${request.method} ${request.url} - ${ms}ms`);
});
```

### 5.2 错误处理对比

```javascript
// Express — async 错误会被静默吞掉 ❌
app.get('/api/users', async (req, res, next) => {
  const users = await User.findAll(); // 如果抛错，不会走到 error handler
  res.json(users);
});
// 必须这样写才行：
app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    next(err); // 手动传递
  }
});

// Express 5 改进了这个问题，但截至目前仍不是正式版

// Koa — async 错误自动冒泡 ✅
app.use(async (ctx, next) => {
  try {
    await next(); // 内层所有 async 错误都会冒泡到这里
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message };
  }
});

router.get('/api/users', async (ctx) => {
  const users = await User.findAll(); // 错误自动冒泡
  ctx.body = users;
});

// Fastify — async 错误自动被 setErrorHandler 捕获 ✅
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    error: error.message
  });
});

fastify.get('/api/users', async (request, reply) => {
  const users = await User.findAll(); // 错误自动捕获
  return users;
});
```

### 5.3 API 风格对比

```javascript
// Express — 直接操作 req/res
app.get('/api/users/:id', (req, res) => {
  const id = req.params.id;     // 路径参数
  const name = req.query.name;  // 查询参数
  const body = req.body;        // 请求体

  res.status(200).json({        // 链式调用
    id,
    name,
    body
  });
});

// Koa — 统一的 ctx 对象
router.get('/api/users/:id', (ctx) => {
  const id = ctx.params.id;     // 路径参数
  const name = ctx.query.name;  // 查询参数
  const body = ctx.request.body;// 请求体

  ctx.status = 200;             // 直接赋值
  ctx.body = { id, name, body };
});

// Fastify — request/reply 分离 + Schema 校验
fastify.get('/api/users/:id', {
  schema: {
    params: {
      type: 'object',
      properties: { id: { type: 'integer' } }
    }
  }
}, async (request, reply) => {
  const id = request.params.id;     // 已通过校验
  const name = request.query.name;
  const body = request.body;

  return { id, name, body };        // 直接 return，自动序列化
});
```

### 5.4 性能对比

使用 `autocannon` 进行基准测试（Hello World 场景）：

```
测试条件：Node.js 20.x，10s 持续请求，100 并发连接

┌──────────┬──────────────┬──────────────┬──────────────┐
│ 框架     │ 平均延迟(ms) │ 吞吐量(req/s)│ 错误率       │
├──────────┼──────────────┼──────────────┼──────────────┤
│ Express  │    ~12       │   ~8,300     │   0%         │
│ Koa      │    ~10       │   ~10,000    │   0%         │
│ Fastify  │    ~4        │   ~25,000    │   0%         │
└──────────┴──────────────┴──────────────┴──────────────┘

说明：Fastify 在极简场景下吞吐量约为 Express 的 3 倍。
      真实业务中（数据库查询、IO 操作），框架本身的性能差异会被稀释，
      但在高并发 API 网关、微服务等场景下，Fastify 的优势依然显著。
      Fastify 的性能优势主要来自：
      1. JSON Schema 预编译序列化（fast-json-stringify）
      2. 高效的路由匹配（find-my-way，基于基数树）
      3. 最小化的请求对象创建开销
```

### 5.5 综合对比表

| 维度 | Express | Koa | Fastify |
|------|---------|-----|---------|
| **中间件模型** | 线性（单向） | 洋葱模型（双向） | 生命周期钩子 |
| **核心代码量** | ~5,000 行 | ~1,500 行 | ~8,000 行（含插件系统） |
| **async/await** | 需手动 try-catch | 原生支持，自动冒泡 | 原生支持，自动捕获 |
| **内置功能** | 路由、静态文件、JSON 解析等 | 几乎无，全靠中间件 | 日志、路由、Schema 校验、插件系统 |
| **Context** | req + res 分离 | 统一的 ctx 对象 | request + reply 分离 |
| **Schema 校验** | 无（需手动或第三方） | 无（需手动或第三方） | 内置 JSON Schema |
| **npm 生态** | 数万中间件 | 数百中间件 | ~200+ 插件（快速增长） |
| **性能** | 良好 | 略优 | 最优（3x Express） |
| **学习难度** | 低 | 中 | 中高 |
| **TypeScript** | 需 @types/express | 需 @types/koa | 原生支持 |
| **日志** | 需第三方（morgan） | 需第三方 | 内置 pino |
| **维护状态** | 活跃（Express 5 开发中） | 低频维护 | 非常活跃 |
| **首次发布** | 2010 年 | 2013 年 | 2016 年 |

---

## 六、常见陷阱与最佳实践

### 6.1 Express 异步错误丢失

```javascript
// ❌ 错误写法：async 错误被静默吞掉
app.get('/api/users', async (req, res) => {
  throw new Error('数据库连接失败');
  // 进程可能直接崩溃，error handler 收不到
});

// ✅ 方案一：express-async-errors（推荐）
// 在入口文件最顶部引入
require('express-async-errors');
const app = require('./app');
// 之后所有 async 路由的错误会自动传递到 error handler

// ✅ 方案二：包装函数
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await User.findAll();
  res.json(users);
}));
```

### 6.2 Koa next() 多次调用

```javascript
// ❌ 错误写法：在一个中间件中多次调用 next()
app.use(async (ctx, next) => {
  await next();
  await next(); // 抛出错误："next() called multiple times"
});

// ✅ 正确写法：每个中间件只调用一次 next()
app.use(async (ctx, next) => {
  console.log('before');
  await next();
  console.log('after');
});
```

### 6.3 Express 中间件顺序陷阱

```javascript
// ❌ 错误写法：错误处理中间件放在路由前面
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

app.get('/api/users', (req, res) => {
  throw new Error('出错了'); // 不会被上面的 error handler 捕获
});

// ✅ 正确写法：错误处理中间件放在最后
app.get('/api/users', (req, res) => {
  throw new Error('出错了');
});

// 放在所有路由之后
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});
```

### 6.4 Fastify Schema 校验遗漏

```javascript
// ❌ 错误写法：忘了写 response schema，失去序列化性能优势
fastify.get('/api/users', async (request, reply) => {
  const users = await User.findAll();
  return users; // 没有 response schema，走普通 JSON.stringify
});

// ✅ 正确写法：补全 response schema，激活预编译序列化
fastify.get('/api/users', {
  schema: {
    response: {
      200: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' }
          }
        }
      }
    }
  }
}, async (request, reply) => {
  const users = await User.findAll();
  return users; // 走 fast-json-stringify 预编译序列化
});
```

### 6.5 Fastify 插件作用域陷阱

```javascript
// ❌ 错误写法：期望跨作用域访问装饰器
fastify.register(async (instance) => {
  instance.decorate('answer', 42);
});

fastify.get('/', async (request, reply) => {
  return { answer: fastify.answer }; // ❌ undefined，作用域隔离
});

// ✅ 方案一：在根级别注册装饰器
fastify.decorate('answer', 42);

// ✅ 方案二：使用 fastify-plugin 打破封装
const fp = require('fastify-plugin');

fastify.register(fp(async (instance) => {
  instance.decorate('answer', 42); // fastify-plugin 跳过封装
}));
```

---

## 七、迁移指南

### 7.1 从 Express 迁移到 Fastify

```javascript
// Express 版本
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.get('/api/users', async (req, res) => {
  res.json({ data: [] });
});

app.listen(3000);

// ===== 对应的 Fastify 版本 =====
const fastify = require('fastify')({ logger: true });

fastify.register(require('@fastify/cors'));

// 日志已由内置 pino 处理，无需 morgan

fastify.get('/api/users', async (request, reply) => {
  return { data: [] };
});

fastify.listen({ port: 3000 });
```

### 7.2 从 Koa 迁移到 Fastify

```javascript
// Koa 版本
const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');

const app = new Koa();
const router = new Router();

app.use(cors());
app.use(bodyParser());
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(`${ctx.method} ${ctx.url} ${ctx.status} - ${Date.now() - start}ms`);
});

router.get('/api/users', async (ctx) => {
  ctx.body = { data: [] };
});

app.use(router.routes());
app.listen(3000);

// ===== 对应的 Fastify 版本 =====
const fastify = require('fastify')({ logger: true });

fastify.register(require('@fastify/cors'));

// 内置请求体解析，无需 bodyparser
// 日志已由内置 pino 处理

fastify.get('/api/users', async (request, reply) => {
  return { data: [] };
});

fastify.listen({ port: 3000 });
```

### 7.3 中间件/插件对应关系

| 功能 | Express | Koa | Fastify |
|------|---------|-----|---------|
| JSON 解析 | `express.json()` | `koa-bodyparser` | 内置 |
| 路由 | 内置 | `@koa/router` | 内置 |
| CORS | `cors` | `@koa/cors` | `@fastify/cors` |
| 静态文件 | `express.static()` | `koa-static` | `@fastify/static` |
| Session | `express-session` | `koa-session` | `@fastify/session` |
| 安全头 | `helmet` | `koa-helmet` | `@fastify/helmet` |
| 日志 | `morgan` | `koa-logger` / 自定义 | 内置 pino |
| 表单验证 | `express-validator` | 手动 / `koa-joi-router` | 内置 JSON Schema |
| 文件上传 | `multer` | `koa-body` | `@fastify/multipart` |
| Cookie | `cookie-parser` | 内置 `ctx.cookies` | `@fastify/cookie` |
| 速率限制 | `express-rate-limit` | `koa-ratelimit` | `@fastify/rate-limit` |
| WebSocket | `express-ws` | `koa-websocket` | `@fastify/websocket` |

---

## 八、选型决策树

```
项目需要选 Node.js Web 框架
    │
    ├─ 团队以新手为主 / 需要快速交付？
    │   └─ ✅ Express
    │       └─ 生态丰富、教程多、开箱即用
    │
    ├─ 需要大量现成中间件 / 维护遗留项目？
    │   └─ ✅ Express
    │       └─ npm 上数万个中间件，几乎所有需求都有方案
    │
    ├─ 需要优雅的请求拦截 / 日志 / 鉴权？
    │   └─ ✅ Koa
    │       └─ 洋葱模型天然适合前置/后置处理
    │
    ├─ 团队重视 async/await 体验且偏好精简核心？
    │   └─ ✅ Koa
    │       └─ 原生 async/await，错误自动冒泡
    │
    ├─ 追求极致性能 / 高并发场景？
    │   └─ ✅ Fastify
    │       └─ 吞吐量 Express 的 3 倍，内置 JSON Schema 序列化
    │
    ├─ 需要严格的 API 契约 / 自动校验？
    │   └─ ✅ Fastify
    │       └─ JSON Schema 驱动，请求/响应自动校验
    │
    ├─ TypeScript 项目 / 重视开发体验？
    │   └─ ✅ Fastify
    │       └─ 原生 TS 支持，类型推断最完整
    │
    ├─ 微服务架构 / 大型项目模块化？
    │   └─ ✅ Fastify
    │       └─ 插件系统 + 作用域隔离，天然适合微服务
    │
    └─ API 网关 / BFF 层？
        ├─ 轻量场景 → ✅ Koa（精简 + 洋葱模型）
        └─ 高并发场景 → ✅ Fastify（性能 + 钩子）
```

---

## 九、总结

| 场景 | 推荐框架 | 原因 |
|------|---------|------|
| 快速原型 / MVP | Express | 开箱即用，30 分钟搭起 API |
| 小型项目（1-3 人） | Express | 生态丰富，遇到问题容易搜到答案 |
| 中大型项目 | Koa / Fastify | 中间件组织更优雅（Koa）或性能更强（Fastify） |
| 高并发 API 服务 | Fastify | 吞吐量是 Express 的 3 倍 |
| API 网关 / BFF | Koa / Fastify | 洋葱模型或生命周期钩子天然适合请求拦截 |
| 微服务架构 | Fastify | 插件系统 + 作用域隔离 + 高性能 |
| 团队新手多 | Express | 学习成本低，社区资源丰富 |
| TypeScript 项目 | Fastify | 原生 TS 支持，开发体验最好 |
| 技术探索型团队 | Koa | 精简核心 + 现代 API，可深度定制 |

**一句话总结：Express 是"务实之选"，Koa 是"优雅之选"，Fastify 是"性能之选"。没有最好的框架，只有最适合当前场景的框架。**
