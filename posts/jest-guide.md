---
title: Jest 测试框架深度实践：从配置到高级用法
date: '2025-12-13'
tags:
  - 工程化
  - 前端
  - 测试
  - Jest
category: 前端工程
summary: >-
  从"为什么选择 Jest"的实际疑问出发，系统讲解 Jest 测试框架——核心概念、配置方案（Babel vs ts-jest vs SWC）、匹配器与异步测试、Mock/Spy 策略、快照测试、定时器模拟、覆盖率配置、性能优化、与 Vitest 的深度对比，以及各方案的优缺点与适用场景。
---

# Jest 测试框架深度实践：从配置到高级用法

## 一、问题来源

前端项目引入单元测试时，最先面临的问题就是"选哪个框架"：

**选型困惑：**

- Jest 是 Meta（Facebook）开源的测试框架，长期占据前端测试生态主流地位，但配置体系庞杂（Babel、ts-jest、SWC 多种转译方案）
- Vitest 作为后起之秀，与 Vite 深度集成，速度更快，但老项目和 Webpack 生态中 Jest 仍是首选
- 团队已有 Jest 经验，迁移到 Vitest 有学习成本，但 Jest 配置经常踩坑（ESM 支持、TypeScript、路径别名）

**实际痛点：**

- `jest.config.js` 配置项多达几十个，`transform`、`moduleNameMapper`、`testEnvironment` 经常配错
- 异步测试经常遇到 "Promise unresolved" 或超时问题，不知道该用 `resolves/rejects` 还是 `async/await`
- Mock 体系混乱：`jest.fn()`、`jest.spyOn()`、`jest.mock()` 分不清什么时候用哪个
- 快照测试要么过度使用导致快照膨胀，要么不知道该测什么
- TS 项目中 `ts-jest` 编译慢、类型报错、路径别名不生效等问题频出

**核心问题：Jest 不是"装上就能用"的框架，理解其核心机制才能正确配置、高效使用。本文将从配置、核心 API、Mock 策略、快照测试、性能优化五个维度，给出 Jest 的深度实践方案。**

---

## 二、Jest 核心概念

### 2.1 工作流程

```
jest CLI
  │
  ├── 读取 jest.config.js / package.json 中的 jest 配置
  │
  ├── 根据 testMatch / testRegex 找到测试文件
  │
  ├── 通过 transform 转译（Babel / ts-jest / SWC）
  │
  ├── 在 testEnvironment（node / jsdom）中执行测试
  │
  ├── 收集覆盖率（istanbul）
  │
  └── 输出测试结果 + 快照对比
```

### 2.2 核心 API 速查

| API | 作用 | 示例 |
|-----|------|------|
| `describe(name, fn)` | 测试分组 | `describe('Math', () => { ... })` |
| `test / it(name, fn)` | 定义测试用例 | `it('1+1=2', () => expect(1+1).toBe(2))` |
| `expect(value)` | 断言入口 | `expect(result).toBe(42)` |
| `beforeAll / afterAll` | 测试组前后执行一次 | 初始化/清理数据库连接 |
| `beforeEach / afterEach` | 每个用例前后执行 | 重置 Mock、清理状态 |
| `jest.fn()` | 创建 Mock 函数 | `const fn = jest.fn(); fn('a'); expect(fn).toHaveBeenCalledWith('a')` |
| `jest.spyOn(obj, method)` | 监听并可选替换方法 | `jest.spyOn(console, 'log').mockImplementation(() => {})` |
| `jest.mock(module)` | Mock 整个模块 | `jest.mock('axios')` |

---

## 三、配置方案

### 3.1 转译方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **Babel + @babel/preset-env** | 生态最成熟，JS/TS 都支持 | 编译速度中等，需多份 Babel 配置 | 混合 JS/TS 项目 |
| **ts-jest** | 直接编译 TS，类型检查可选 | 编译速度较慢，大型项目明显 | 纯 TS 项目，类型安全优先 |
| **@swc/jest** | SWC 编译极快（Rust 实现） | SWC 生态不如 Babel 成熟 | 大型项目，追求速度 |

### 3.2 最小配置（ts-jest）

```bash
# 安装依赖
pnpm add -D jest ts-jest @types/jest jest-environment-jsdom
```

```javascript
// jest.config.js
/** @type {import('jest').Config} */
module.exports = {
    // 测试文件匹配
    testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],

    // 转译配置
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                jsx: 'react-jsx',
                module: 'ESNext',
                moduleResolution: 'bundler',
            },
        }],
    },

    // 模块名映射（路径别名 + 静态资源）
    moduleNameMapper: {
        '^@components/(.*)$': '<rootDir>/component/$1',
        '^@pages/(.*)$': '<rootDir>/app/pages/$1',
        '\\.(css|less|scss)$': '<rootDir>/test/__mocks__/style.js',
        '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/test/__mocks__/file.js',
    },

    // 测试环境
    testEnvironment: 'jsdom',

    // 模块文件扩展名
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

    // 覆盖率配置
    collectCoverageFrom: [
        'app/**/*.{ts,tsx}',
        'component/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
    ],

    // Setup 文件
    setupFilesAfterSetup: ['<rootDir>/test/setup.ts'],
};
```

### 3.3 SWC 方案配置（高性能）

```bash
pnpm add -D jest @swc/core @swc/jest jest-environment-jsdom @types/jest
```

```javascript
// jest.config.js
module.exports = {
    transform: {
        '^.+\\.(t|j)sx?$': ['@swc/jest', {
            jsc: {
                parser: {
                    syntax: 'typescript',
                    tsx: true,
                },
                transform: {
                    react: {
                        runtime: 'automatic',
                    },
                },
            },
        }],
    },
    testEnvironment: 'jsdom',
    // ...其余配置同上
};
```

### 3.4 静态资源 Mock 文件

```javascript
// test/__mocks__/style.js
module.exports = {};
```

```javascript
// test/__mocks__/file.js
module.exports = 'test-file-stub';
```

### 3.5 Setup 文件

```typescript
// test/setup.ts
import '@testing-library/jest-dom';

// 可选：全局 Mock IntersectionObserver
class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
});

// 可选：全局 Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});
```

### 3.6 package.json scripts

```json
{
    "scripts": {
        "test": "jest",
        "test:watch": "jest --watch",
        "test:coverage": "jest --coverage",
        "test:ci": "jest --ci --coverage --maxWorkers=2"
    }
}
```

---

## 四、匹配器（Matchers）

### 4.1 常用匹配器

```typescript
// 等值判断
expect(1 + 1).toBe(2);              // === 严格相等
expect({ name: 'a' }).toEqual({ name: 'a' });  // 深度相等
expect([1, 2, 3]).toStrictEqual([1, 2, 3]);    // 严格深度相等

// 真值判断
expect(true).toBeTruthy();
expect(false).toBeFalsy();
expect(null).toBeNull();
expect(undefined).toBeUndefined();
expect('hello').toBeDefined();

// 数字比较
expect(3.14).toBeCloseTo(3.141, 1);  // 浮点近似
expect(5).toBeGreaterThan(4);
expect(5).toBeLessThanOrEqual(5);

// 字符串匹配
expect('hello world').toMatch(/world/);
expect('hello world').toContain('hello');

// 数组 / 可迭代对象
expect([1, 2, 3]).toContain(2);
expect([1, 2, 3]).toHaveLength(3);
expect([{ id: 1 }]).toContainEqual({ id: 1 });  // 深度匹配元素

// 异常
expect(() => JSON.parse('invalid')).toThrow();
expect(() => fn(-1)).toThrow('negative not allowed');

// 对象属性
expect({ a: 1, b: 2 }).toHaveProperty('a', 1);
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
```

### 4.2 异步匹配器

```typescript
// Promise resolves / rejects
test('fetch 返回数据', () => {
    return expect(fetchData()).resolves.toEqual({ id: 1 });
});

test('fetch 抛出错误', () => {
    return expect(fetchData(true)).rejects.toThrow('network error');
});
```

---

## 五、异步测试

### 5.1 三种异步测试模式对比

| 模式 | 写法 | 适用场景 | 注意事项 |
|------|------|---------|---------|
| **回调模式** | `test('...', done => { ... })` | 回调式异步 | 必须调用 `done()`，否则超时 |
| **Promise 模式** | `return expect(promise).resolves...` | Promise 返回值 | 必须返回 Promise，否则测试提前结束 |
| **async/await** | `test('...', async () => { await ... })` | 最推荐 | 简洁、可读性强 |

### 5.2 回调模式

```typescript
test('回调函数被调用', done => {
    function callback(data: string) {
        expect(data).toBe('result');
        done(); // 必须调用，否则测试超时
    }

    fetchDataWithCallback(callback);
});
```

### 5.3 Promise 模式

```typescript
test('Promise 成功', () => {
    // 必须返回 Promise
    return fetchData().then(data => {
        expect(data).toEqual({ id: 1 });
    });
});

test('Promise 失败', () => {
    return expect(fetchData(true)).rejects.toThrow('error');
});

test('.resolves 语法糖', () => {
    return expect(fetchData()).resolves.toEqual({ id: 1 });
});
```

### 5.4 async/await 模式（推荐）

```typescript
test('async/await 测试', async () => {
    const data = await fetchData();
    expect(data).toEqual({ id: 1 });
});

test('异步错误处理', async () => {
    await expect(fetchData(true)).rejects.toThrow('error');
});
```

### 5.5 异步测试常见陷阱

```typescript
// ❌ 错误：没有 return / await，Promise 未等完就结束了
test('不会捕获错误', () => {
    fetchData().then(data => {
        expect(data).toBe('wrong'); // 即使失败也报 PASS
    });
});

// ✅ 正确：return Promise
test('正确写法', () => {
    return fetchData().then(data => {
        expect(data).toBe('correct');
    });
});

// ✅ 正确：async/await
test('正确写法', async () => {
    const data = await fetchData();
    expect(data).toBe('correct');
});
```

---

## 六、Mock 策略

### 6.1 Mock 体系全景

```
Jest Mock 体系
    │
    ├── jest.fn()              → 创建 Mock 函数（最基础）
    │      └── 记录调用：calls, results, instances
    │
    ├── jest.spyOn(obj, method) → 监听真实方法（可选替换）
    │      └── mockImplementation / mockReturnValue / mockResolvedValue
    │
    ├── jest.mock('module')     → 自动 Mock 整个模块
    │      └── 工厂函数：jest.mock('mod', () => ({ ... }))
    │
    └── jest.createMockFromModule('module')
                               → 基于类型自动生成 Mock
```

### 6.2 jest.fn()：Mock 函数

```typescript
test('jest.fn() 基础', () => {
    const mockFn = jest.fn();

    // 调用
    mockFn('hello');
    mockFn('world');

    // 验证调用
    expect(mockFn).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith('hello');
    expect(mockFn).toHaveBeenLastCalledWith('world');

    // 查看调用记录
    expect(mockFn.mock.calls).toEqual([['hello'], ['world']]);
    expect(mockFn.mock.results[0].value).toBeUndefined();
});

test('Mock 返回值', () => {
    const fn = jest.fn();

    fn.mockReturnValue('default');
    expect(fn()).toBe('default');

    fn.mockReturnValueOnce('first').mockReturnValueOnce('second');
    expect(fn()).toBe('first');
    expect(fn()).toBe('second');
    expect(fn()).toBe('default'); // 回到 mockReturnValue 的值
});

test('Mock 异步返回', async () => {
    const fn = jest.fn().mockResolvedValue({ data: 'ok' });
    const result = await fn();
    expect(result).toEqual({ data: 'ok' });
});
```

### 6.3 jest.spyOn()：监听与替换

```typescript
test('spyOn 监听但不替换', () => {
    const obj = {
        add: (a: number, b: number) => a + b,
    };

    const spy = jest.spyOn(obj, 'add');

    obj.add(1, 2);

    expect(spy).toHaveBeenCalledWith(1, 2);
    expect(spy).toHaveReturnedWith(3);

    spy.mockRestore(); // 恢复原始实现
});

test('spyOn 替换实现', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(Math.random()).toBe(0.5);

    jest.restoreAllMocks(); // 恢复所有 spy
});

test('spyOn 控制台输出', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    someFunctionThatLogs();

    expect(logSpy).toHaveBeenCalledWith('expected message');

    logSpy.mockRestore();
});
```

### 6.4 jest.mock()：模块 Mock

```typescript
// 自动 Mock：用 jest.fn() 替换模块所有导出
jest.mock('axios');
import axios from 'axios';

test('axios.get 被调用', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { id: 1 } });

    const result = await fetchUser(1);

    expect(axios.get).toHaveBeenCalledWith('/api/users/1');
    expect(result).toEqual({ id: 1 });
});

// 工厂函数 Mock：自定义 Mock 实现
jest.mock('../config', () => ({
    API_URL: 'http://test-api.local',
    TIMEOUT: 5000,
    isDev: true,
}));

// 部分 Mock：保留部分真实实现
jest.mock('../utils', () => {
    const actual = jest.requireActual('../utils');
    return {
        ...actual,
        // 只 Mock 发送邮件，其余保留真实实现
        sendEmail: jest.fn().mockResolvedValue(true),
    };
});
```

### 6.5 Mock 选择策略

```
需要 Mock 什么？
    │
    ├── 回调函数 / props 回调
    │   └── jest.fn()（最简单）
    │
    ├── 对象方法 / 全局方法（fetch、localStorage、Date）
    │   └── jest.spyOn(obj, method)（可恢复）
    │
    ├── 第三方模块（axios、react-router）
    │   └── jest.mock('module')（整个替换）
    │
    ├── 部分模块（保留部分真实）
    │   └── jest.mock + jest.requireActual
    │
    └── 定时器
        └── jest.useFakeTimers()（见第七节）
```

---

## 七、快照测试

### 7.1 什么是快照测试

快照测试将组件的渲染输出序列化并保存，下次运行时对比是否有变化：

```typescript
import renderer from 'react-test-renderer';
import { Link } from './Link';

test('Link 快照', () => {
    const tree = renderer
        .create(<Link page="https://example.com">Example</Link>)
        .toJSON();

    expect(tree).toMatchSnapshot();
});
```

首次运行生成 `__snapshots__/Link.test.tsx.snap`，后续运行对比变更。

### 7.2 内联快照

快照直接写在测试文件中，无需额外 `.snap` 文件：

```typescript
test('内联快照', () => {
    const tree = renderer.create(<Button>Click</Button>).toJSON();
    expect(tree).toMatchInlineSnapshot(`
        <button>
            Click
        </button>
    `);
});
```

### 7.3 属性快照

只匹配部分属性，忽略动态值：

```typescript
test('用户卡片快照（忽略动态属性）', () => {
    const tree = renderer.create(<UserCard id={Date.now()} name="张三" />).toJSON();

    expect(tree).toMatchSnapshot({
        props: {
            id: expect.any(Number), // 动态值用 matcher 替代
        },
    });
});
```

### 7.4 快照测试的最佳实践

| 建议 | 原因 |
|------|------|
| **不要过度使用** | 大型组件快照变更频繁，维护成本高 |
| **快照要小而聚焦** | 拆分为小组件分别快照，而非整页快照 |
| **用内联快照** | 快照在测试文件中可见，方便 Review |
| **Review 快照变更** | `git diff` 快照文件，确认变更是否符合预期 |
| **不要用快照替代行为测试** | 快照只验证结构，不验证交互逻辑 |
| **CI 中加 `--updateSnapshot` 检查** | 防止开发者无脑 `jest -u` 更新快照 |

---

## 八、定时器模拟

### 8.1 假定时器 API

```typescript
describe('定时器', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('setTimeout', () => {
        const callback = jest.fn();
        setTimeout(callback, 1000);

        expect(callback).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000); // 前进 1 秒
        expect(callback).toHaveBeenCalledOnce();
    });

    test('setInterval', () => {
        const callback = jest.fn();
        setInterval(callback, 100);

        jest.advanceTimersByTime(500);
        expect(callback).toHaveBeenCalledTimes(5);
    });

    test('runAllTimers', () => {
        const callback = jest.fn();
        setTimeout(callback, 99999);

        jest.runAllTimers(); // 执行所有定时器（无视时间）
        expect(callback).toHaveBeenCalled();
    });

    test('runOnlyPendingTimers', () => {
        const fn = jest.fn();
        setTimeout(fn, 100);
        setTimeout(() => {
            setTimeout(fn, 100); // 嵌套定时器
        }, 100);

        jest.runOnlyPendingTimers(); // 只执行当前排队的
        // fn 只被调用 1 次（嵌套的还没排进队列）
    });
});
```

### 8.2 现代 vs 遗留假定时器

| 选项 | 说明 | 适用场景 |
|------|------|---------|
| `jest.useFakeTimers({ legacyFakeTimers: false })` | 现代（默认）：用 `@sinonjs/fake-timers` | 推荐，支持 `Date` Mock 等 |
| `jest.useFakeTimers({ legacyFakeTimers: true })` | 遗留：直接替换 `setTimeout` 等 | 兼容老代码 |

---

## 九、覆盖率配置

### 9.1 命令行参数

```bash
# 生成覆盖率报告
jest --coverage

# 指定覆盖率提供者
jest --coverage --coverageProvider=v8

# 指定报告格式
jest --coverage --coverageReporters=text --coverageReporters=html --coverageReporters=lcov
```

### 9.2 配置覆盖率阈值

```javascript
// jest.config.js
module.exports = {
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
        // 按路径设置不同阈值
        './src/utils/**/*.ts': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
        },
        './src/pages/**/*.tsx': {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50,
        },
    },
};
```

覆盖率不达标时 Jest 会以非零退出码退出，CI 中自动阻止合并。

### 9.3 Istanbul vs V8 覆盖率

| 提供者 | 优点 | 缺点 |
|--------|------|------|
| **Istanbul（babel 默认）** | 支持分支覆盖率、更准确 | 需要代码插桩，稍慢 |
| **V8** | 速度快，不需要插桩 | 分支覆盖率不如 Istanbul 精确 |

---

## 十、React 组件测试实战

### 10.1 安装 Testing Library

```bash
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### 10.2 基础组件测试

```tsx
// component/Button.tsx
interface ButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

export function Button({ label, onClick, disabled }: ButtonProps) {
    return (
        <button onClick={onClick} disabled={disabled}>
            {label}
        </button>
    );
}
```

```tsx
// __tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../component/Button';

describe('Button', () => {
    it('渲染按钮文字', () => {
        render(<Button label="提交" onClick={() => {}} />);
        expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument();
    });

    it('点击触发回调', async () => {
        const onClick = jest.fn();
        render(<Button label="提交" onClick={onClick} />);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('disabled 状态不触发回调', async () => {
        const onClick = jest.fn();
        render(<Button label="提交" onClick={onClick} disabled />);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button'));

        expect(onClick).not.toHaveBeenCalled();
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
```

### 10.3 异步组件测试

```tsx
// __tests__/UserList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { UserList } from '../component/UserList';

describe('UserList', () => {
    beforeEach(() => {
        jest.spyOn(globalThis, 'fetch');
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('加载并展示用户列表', async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([{ id: 1, name: '张三' }]),
        });

        render(<UserList />);

        expect(screen.getByText('加载中...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('张三')).toBeInTheDocument();
        });
    });

    it('请求失败展示错误', async () => {
        (globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error('网络错误'));

        render(<UserList />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('加载失败');
        });
    });
});
```

---

## 十一、性能优化

### 11.1 加速策略

| 策略 | 效果 | 配置方式 |
|------|------|---------|
| **SWC 替代 Babel/ts-jest** | 转译速度提升 5-10 倍 | `transform: { '\\.tsx?$': ['@swc/jest', {}] }` |
| **隔离测试** | 并行执行，互不干扰 | 默认开启（每个文件独立 worker） |
| **maxWorkers 控制** | 避免 CI 内存溢出 | `jest --maxWorkers=2`（CI）或 `--maxWorkers=50%`（本地） |
| **仅运行变更相关测试** | Watch 模式下大幅减少 | `jest --watch --onlyChanged` |
| **缓存** | 跳过未变更的测试 | 默认开启，`--no-cache` 可禁用 |
| **shard 分片** | CI 多机器并行 | `jest --shard=1/3`（第 1 片，共 3 片） |

### 11.2 CI 分片配置

```yaml
# .github/workflows/test.yml
jobs:
    test:
        strategy:
            matrix:
                shard: [1, 2, 3]
        steps:
            - run: npx jest --shard=${{ matrix.shard }}/3 --coverage --ci
```

### 11.3 常见性能问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 首次启动慢 | 转译所有测试文件 | 用 SWC 替代 ts-jest |
| 内存溢出 | jsdom 实例过多 | 降低 `maxWorkers`，或按需用 `node` 环境 |
| Watch 模式卡顿 | 文件监听范围过大 | 配置 `watchPathIgnorePatterns: ['node_modules', 'dist']` |
| 快照文件巨大 | 组件快照过度 | 拆分小组件快照，或用内联快照 |

---

## 十二、Jest vs Vitest 深度对比

### 12.1 全面对比

| 维度 | Jest | Vitest |
|------|------|--------|
| **维护方** | Meta / OpenJS Foundation | Evan You / 社区 |
| **转译方式** | Babel / ts-jest / SWC（需配置） | 复用 Vite 管线（零配置） |
| **ESM 支持** | 实验性（`--experimental-vm-modules`） | 原生支持 |
| **TypeScript** | 需 ts-jest 或 @swc/jest | 原生支持（Vite 处理） |
| **执行速度** | 中等 | 快（Vite 转译缓存 + ESM） |
| **Watch 模式** | 支持 | HMR 级别速度 |
| **快照测试** | 内置 | 兼容 Jest 快照格式 |
| **覆盖率** | 内置 Istanbul | 内置 Istanbul / c8 / v8 |
| **Mock API** | `jest.fn()` / `jest.mock()` | `vi.fn()` / `vi.mock()`（API 兼容） |
| **测试环境** | node / jsdom | node / jsdom / happy-dom |
| **浏览器测试** | 无（需 Playwright 等） | 通过 `@vitest/browser` 支持 |
| **Bench 测试** | 不支持 | 内置 `bench()` API |
| **生态兼容** | 最大，几乎所有库都有 Jest mock | 兼容绝大部分 Jest API |
| **Vite 集成** | 需额外配置 | 原生共享 `vite.config.ts` |
| **Webpack 集成** | 原生支持 | 需配置 |
| **学习曲线** | 配置体系庞大 | 简单（尤其对 Vite 用户） |

### 12.2 API 对照表

| Jest API | Vitest 等价 | 说明 |
|----------|------------|------|
| `jest.fn()` | `vi.fn()` | Mock 函数 |
| `jest.spyOn()` | `vi.spyOn()` | 监听方法 |
| `jest.mock('mod')` | `vi.mock('mod')` | 模块 Mock |
| `jest.useFakeTimers()` | `vi.useFakeTimers()` | 假定时器 |
| `jest.advanceTimersByTime()` | `vi.advanceTimersByTime()` | 前进时间 |
| `jest.mockResolvedValue()` | `vi.mockResolvedValue()` | 异步 Mock |
| `expect.any()` | `expect.any()` | 完全相同 |
| `describe / it / test` | `describe / it / test` | 完全相同 |

### 12.3 迁移建议

| 场景 | 建议 |
|------|------|
| Webpack + Jest 老项目 | 保持 Jest，优化配置（SWC、maxWorkers） |
| Vite + Jest 项目 | **迁移到 Vitest**，配置共享、速度更快 |
| 新项目 + Vite | **直接用 Vitest** |
| 新项目 + Webpack | Jest（生态更成熟） |
| 大型 monorepo | Jest（分片机制更成熟）或 Vitest（workspace 支持） |

---

## 十三、优缺点与适用场景总结

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **Jest + ts-jest** | 类型安全、配置可控 | 编译慢、配置复杂 | 纯 TS 项目、类型安全优先 |
| **Jest + SWC** | 编译极快、TS 支持 | SWC 生态不如 Babel | 大型项目、追求编译速度 |
| **Jest + Babel** | 生态最成熟、JS/TS 混合 | Babel 配置繁琐 | 混合 JS/TS 项目 |
| **Jest + Testing Library** | 测用户行为、重构友好 | jsdom 限制（无 canvas 等） | React 组件测试 |
| **Jest 快照测试** | 一键检测 UI 变更 | 容易滥用、维护成本高 | UI 组件库、设计系统 |

---

## 十四、局限性

1. **ESM 支持不完善**：原生 ESM 项目需要 `--experimental-vm-modules`，配置复杂且不稳定
2. **jsdom 限制**：不是真实浏览器，`canvas`、`WebGL`、`WebSocket`、`IntersectionObserver` 等需要 polyfill
3. **ts-jest 编译慢**：大型项目全量测试可能需要数十秒，建议用 SWC 替代
4. **快照测试维护成本**：组件频繁变更时快照不断更新，容易无脑 `jest -u` 跳过审查
5. **Mock 过度的风险**：过度 Mock 让测试失去意义——测的是 Mock 而非真实行为
6. **覆盖率误导**：高覆盖率 ≠ 高质量，100% 覆盖但只测 happy path 等于没测边界
7. **配置碎片化**：Babel、ts-jest、SWC 多种方案并存，社区最佳实践不统一

---

## 十五、总结

Jest 作为前端测试生态最成熟的框架，其核心价值在于**稳定、完整、生态丰富**：

- **配置选型**：SWC > Babel > ts-jest，根据项目规模和 TS 需求选择
- **Mock 体系**：`jest.fn()`（回调）→ `jest.spyOn()`（方法）→ `jest.mock()`（模块），按需选择
- **异步测试**：统一用 async/await，避免 `done()` 回调地狱
- **快照测试**：小而聚焦，配合内联快照和 `expect.any()` 处理动态值
- **性能优化**：SWC 加速、CI 分片、maxWorkers 控制是三大关键
- **Vite 项目迁移**：如果项目已用 Vite，迁移到 Vitest 是更优解——API 几乎兼容，配置零成本
- **Webpack 项目保持**：Jest 在 Webpack 生态中仍是最佳选择，通过 SWC 优化性能即可
