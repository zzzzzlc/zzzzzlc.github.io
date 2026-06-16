---
title: 前端单元测试方案：从框架选型到落地实践
date: '2026-06-07'
tags:
  - 工程化
  - 前端
  - React
category: 前端工程
summary: >-
  从"改一行代码不敢上线"的实际痛点出发，系统梳理前端单元测试方案——测试框架选型（Jest vs Vitest）、组件测试（Testing
  Library）、Hooks/Store/工具函数测试策略、Mock 方案对比、覆盖率与 CI
  集成、测试金字塔设计，以及各方案的优缺点与适用场景。
---

# 前端单元测试方案：从框架选型到落地实践

## 一、问题来源

前端项目越做越大，但很多团队对单元测试的态度始终停留在"知道该写，但一直没写"的阶段：

**业务层面的痛点：**

- 改了一个工具函数，三个页面出了问题，手动测试只验证了其中一个
- 重构表单验证逻辑后，上线发现边界 case 全部回归，用户投诉不断
- 新人不敢改老代码——"这段逻辑没人敢动，一改就炸"
- Code Review 只能看代码逻辑，无法验证行为是否正确

**技术层面的痛点：**

- 组件内部状态复杂（加载中、空态、错误态、分页），手动测试要点击十几次才能覆盖
- 自定义 Hook 的生命周期（mount/unmount/依赖变化）靠人工根本测不全
- 公共库被多个项目引用，改一处影响面未知，没有测试就没信心发布
- CI 流水线只有 lint 和 build，真正的逻辑正确性无人保障

**核心问题：前端单元测试不是"锦上添花"，而是保障重构安全、提升交付信心的基础设施。选对框架、测对重点、控制好成本，才能让测试真正落地。**

本文将从框架选型、组件测试、Hooks/Store/工具函数测试、Mock 策略、CI 集成五个维度，给出可落地的测试方案。

---

## 二、测试框架选型

### 2.1 主流框架对比

| 维度 | Jest | Vitest |
|------|------|--------|
| **维护状态** | Meta 官方维护，生态最成熟 | Evan You 主导，社区活跃 |
| **配置复杂度** | 开箱即用（babel 转译） | 开箱即用（复用 Vite 配置） |
| **与 Vite 集成** | 需额外配置 jest + babel/ts-jest | 原生共享 vite.config.ts，零额外配置 |
| **与 Webpack 集成** | 原生支持 | 需配置 |
| **执行速度** | 中等（多 worker + 转译开销） | 快（ESM 原生 + Vite 转译缓存） |
| **Watch 模式** | 支持 | 支持（HMR 级别速度） |
| **快照测试** | 内置 | 内置，兼容 Jest 快照格式 |
| **覆盖率** | 内置 istanbul | 内置 istanbul/c8 |
| **生态兼容** | 最大，几乎所有库都有 Jest mock | 兼容绝大多数 Jest API（`vi` 替代 `jest`） |
| **TS 支持** | 需要 ts-jest 或 @swc/jest | 原生支持 |
| **适用项目** | Webpack/CRA 项目、React 生态 | Vite/Vue/Nuxt 项目、新项目首选 |

### 2.2 选型建议

| 场景 | 推荐框架 | 理由 |
|------|---------|------|
| 新项目 + Vite 构建 | **Vitest** | 共享配置、速度最快、零额外成本 |
| Vue/Nuxt 项目 | **Vitest** | 官方推荐，与 Vue Test Utils 配合最佳 |
| React + Webpack 老项目 | **Jest** | 生态成熟，迁移成本低 |
| React + Vite 新项目 | **Vitest** | 同样优秀，比 Jest 快 |
| 需要最大生态兼容 | **Jest** | 插件和 mock 方案最多 |

### 2.3 Vitest 最小配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,            // 全局 API（describe/it/expect）
        environment: 'jsdom',     // 模拟浏览器环境
        setupFiles: ['./test/setup.ts'],
        coverage: {
            provider: 'istanbul',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/**/*.d.ts', 'src/**/*.test.{ts,tsx}'],
        },
    },
});
```

```typescript
// test/setup.ts
import '@testing-library/jest-dom';
```

```json
// package.json scripts
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage"
    }
}
```

---

## 三、组件测试：Testing Library

### 3.1 为什么选 Testing Library 而非 Enzyme

| 维度 | Enzyme | Testing Library |
|------|--------|-----------------|
| 测试理念 | 测试实现细节（state、实例方法） | **测试用户行为**（渲染输出、交互） |
| 重构友好 | 差（改内部实现测试就挂） | 好（只要 UI 行为不变测试就通过） |
| React 版本支持 | React 18 需要非官方适配 | 官方维护，同步更新 |
| 社区趋势 | 维护模式，不再推荐新项目使用 | React 官方推荐 |
| 适用范围 | 仅 React | React / Vue / Angular / Preact / Svelte |

**核心原则：测试应该像用户使用组件一样——查找元素、执行交互、验证结果。**

### 3.2 基础组件测试

```tsx
// UserCard.tsx
interface Props {
    name: string;
    email: string;
    onFollow: () => void;
    loading?: boolean;
}

export function UserCard({ name, email, onFollow, loading }: Props) {
    return (
        <div data-testid="user-card">
            <h3>{name}</h3>
            <p>{email}</p>
            <button onClick={onFollow} disabled={loading}>
                {loading ? '关注中...' : '关注'}
            </button>
        </div>
    );
}
```

```tsx
// __tests__/UserCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserCard } from '../UserCard';

describe('UserCard', () => {
    it('渲染用户信息', () => {
        render(<UserCard name="张三" email="zhangsan@test.com" onFollow={() => {}} />);
        expect(screen.getByText('张三')).toBeInTheDocument();
        expect(screen.getByText('zhangsan@test.com')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '关注' })).toBeInTheDocument();
    });

    it('点击关注按钮触发回调', async () => {
        const onFollow = vi.fn();
        render(<UserCard name="张三" email="zhangsan@test.com" onFollow={onFollow} />);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: '关注' }));

        expect(onFollow).toHaveBeenCalledOnce();
    });

    it('加载中状态禁用按钮', () => {
        render(<UserCard name="张三" email="zhangsan@test.com" onFollow={() => {}} loading />);
        const button = screen.getByRole('button');
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('关注中...');
    });
});
```

### 3.3 异步组件测试

```tsx
// PostList.tsx
import { useState, useEffect } from 'react';

export function PostList() {
    const [posts, setPosts] = useState<{ id: number; title: string }[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/posts')
            .then(res => res.json())
            .then(data => setPosts(data))
            .catch(() => setError('加载失败'));
    }, []);

    if (error) return <div role="alert">{error}</div>;
    if (posts.length === 0) return <div>加载中...</div>;

    return (
        <ul>
            {posts.map(post => (
                <li key={post.id}>{post.title}</li>
            ))}
        </ul>
    );
}
```

```tsx
// __tests__/PostList.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PostList } from '../PostList';

describe('PostList', () => {
    beforeEach(() => {
        // 拦截 fetch
        vi.spyOn(globalThis, 'fetch');
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('加载并展示文章列表', async () => {
        (globalThis.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve([
                { id: 1, title: '文章一' },
                { id: 2, title: '文章二' },
            ]),
        });

        render(<PostList />);

        // 初始状态
        expect(screen.getByText('加载中...')).toBeInTheDocument();

        // 等待数据加载完成
        await waitFor(() => {
            expect(screen.getByText('文章一')).toBeInTheDocument();
            expect(screen.getByText('文章二')).toBeInTheDocument();
        });
    });

    it('请求失败显示错误提示', async () => {
        (globalThis.fetch as any).mockRejectedValueOnce(new Error('Network error'));

        render(<PostList />);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('加载失败');
        });
    });
});
```

### 3.4 表单测试

```tsx
// LoginForm.tsx
import { useState } from 'react';

export function LoginForm({ onSubmit }: { onSubmit: (data: { username: string; password: string }) => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!username.trim()) errs.username = '请输入用户名';
        if (password.length < 6) errs.password = '密码至少 6 位';
        return errs;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        onSubmit({ username, password });
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                data-testid="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="用户名"
            />
            {errors.username && <span role="alert">{errors.username}</span>}

            <input
                data-testid="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="密码"
            />
            {errors.password && <span role="alert">{errors.password}</span>}

            <button type="submit">登录</button>
        </form>
    );
}
```

```tsx
// __tests__/LoginForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
    it('空表单提交显示校验错误', async () => {
        render(<LoginForm onSubmit={() => {}} />);

        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: '登录' }));

        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(2);
        expect(screen.getByText('请输入用户名')).toBeInTheDocument();
        expect(screen.getByText('密码至少 6 位')).toBeInTheDocument();
    });

    it('正确填写后提交', async () => {
        const onSubmit = vi.fn();
        render(<LoginForm onSubmit={onSubmit} />);

        const user = userEvent.setup();
        await user.type(screen.getByTestId('username'), 'admin');
        await user.type(screen.getByTestId('password'), '123456');
        await user.click(screen.getByRole('button', { name: '登录' }));

        expect(onSubmit).toHaveBeenCalledWith({
            username: 'admin',
            password: '123456',
        });
    });
});
```

---

## 四、Hooks 测试

### 4.1 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| `@testing-library/react-hooks` | Hook 专用 API | 已停止维护，不支持 React 18 |
| `renderHook` (来自 `@testing-library/react`) | React 18 官方推荐 | 需要了解 `result.current` |
| 在组件内测试 | 最真实 | 写法啰嗦 |

### 4.2 renderHook 测试自定义 Hook

```tsx
// hooks/useCounter.ts
import { useState, useCallback } from 'react';

export function useCounter(initial = 0) {
    const [count, setCount] = useState(initial);
    const increment = useCallback(() => setCount(c => c + 1), []);
    const decrement = useCallback(() => setCount(c => c - 1), []);
    const reset = useCallback(() => setCount(initial), [initial]);
    return { count, increment, decrement, reset };
}
```

```tsx
// __tests__/useCounter.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCounter } from '../hooks/useCounter';

describe('useCounter', () => {
    it('初始值', () => {
        const { result } = renderHook(() => useCounter(5));
        expect(result.current.count).toBe(5);
    });

    it('increment / decrement', () => {
        const { result } = renderHook(() => useCounter());

        act(() => result.current.increment());
        expect(result.current.count).toBe(1);

        act(() => result.current.decrement());
        expect(result.current.count).toBe(0);
    });

    it('reset', () => {
        const { result } = renderHook(() => useCounter(10));

        act(() => result.current.increment());
        expect(result.current.count).toBe(11);

        act(() => result.current.reset());
        expect(result.current.count).toBe(10);
    });
});
```

### 4.3 异步 Hook 测试

```tsx
// hooks/useFetch.ts
import { useState, useEffect } from 'react';

interface State<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

export function useFetch<T>(url: string) {
    const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });

    useEffect(() => {
        fetch(url)
            .then(res => res.json())
            .then(data => setState({ data, loading: false, error: null }))
            .catch(err => setState({ data: null, loading: false, error: err.message }));
    }, [url]);

    return state;
}
```

```tsx
// __tests__/useFetch.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFetch } from '../hooks/useFetch';

describe('useFetch', () => {
    beforeEach(() => { vi.spyOn(globalThis, 'fetch'); });
    afterEach(() => { vi.restoreAllMocks(); });

    it('成功获取数据', async () => {
        (globalThis.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ name: 'test' }),
        });

        const { result } = renderHook(() => useFetch('/api/test'));

        expect(result.current.loading).toBe(true);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.data).toEqual({ name: 'test' });
            expect(result.current.error).toBeNull();
        });
    });

    it('请求失败', async () => {
        (globalThis.fetch as any).mockRejectedValueOnce(new Error('fail'));

        const { result } = renderHook(() => useFetch('/api/test'));

        await waitFor(() => {
            expect(result.current.error).toBe('fail');
            expect(result.current.data).toBeNull();
        });
    });
});
```

---

## 五、工具函数测试

工具函数是投入产出比最高的测试对象——纯函数、无副作用、边界清晰。

```typescript
// utils/validate.ts
export function validateEmail(email: string): boolean {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function formatCurrency(value: number, locale = 'zh-CN', currency = 'CNY'): string {
    if (value < 0) return '-' + formatCurrency(-value, locale, currency);
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

export function truncate(str: string, maxLength: number): string {
    if (maxLength < 0) throw new Error('maxLength must be >= 0');
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength) + '...';
}
```

```typescript
// __tests__/validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateEmail, formatCurrency, truncate } from '../utils/validate';

describe('validateEmail', () => {
    it('合法邮箱', () => {
        expect(validateEmail('test@example.com')).toBe(true);
        expect(validateEmail('user.name+tag@domain.co')).toBe(true);
    });

    it('非法邮箱', () => {
        expect(validateEmail('')).toBe(false);
        expect(validateEmail('invalid')).toBe(false);
        expect(validateEmail('@domain.com')).toBe(false);
        expect(validateEmail('user@')).toBe(false);
        expect(validateEmail('user@.com')).toBe(false);
    });
});

describe('formatCurrency', () => {
    it('格式化人民币', () => {
        expect(formatCurrency(1234.5)).toBe('¥1,234.50');
    });

    it('负数', () => {
        expect(formatCurrency(-100)).toBe('-¥100.00');
    });

    it('零值', () => {
        expect(formatCurrency(0)).toBe('¥0.00');
    });
});

describe('truncate', () => {
    it('短字符串不截断', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    it('超长截断加省略号', () => {
        expect(truncate('hello world', 5)).toBe('hello...');
    });

    it('边界：maxLength 为 0', () => {
        expect(truncate('hello', 0)).toBe('...');
    });

    it('异常：负数 maxLength', () => {
        expect(() => truncate('hello', -1)).toThrow('maxLength must be >= 0');
    });
});
```

---

## 六、Mock 策略

### 6.1 三种 Mock 方式对比

| 方式 | API | 适用场景 | 注意事项 |
|------|-----|---------|---------|
| **模块 Mock** | `vi.mock('module')` | Mock 第三方库（axios、router） | 影响整个文件，需 `vi.restoreAllMocks()` |
| **函数 Mock** | `vi.fn()` | Mock 回调函数、验证调用参数 | 配合 `toHaveBeenCalledWith` |
| **全局 Mock** | `vi.spyOn(obj, 'method')` | Mock `fetch`、`localStorage`、`Date` | 需在 `afterEach` 中恢复 |

### 6.2 Mock 第三方模块

```tsx
// __tests__/UserPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserPage } from '../UserPage';

// Mock axios
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));
import axios from 'axios';

// Mock react-router
vi.mock('react-router', () => ({
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '42' }),
}));

describe('UserPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('加载用户信息并展示', async () => {
        (axios.get as any).mockResolvedValueOnce({
            data: { id: 42, name: '张三', role: 'admin' },
        });

        render(<UserPage />);

        await waitFor(() => {
            expect(screen.getByText('张三')).toBeInTheDocument();
            expect(screen.getByText('admin')).toBeInTheDocument();
        });

        // 验证请求参数
        expect(axios.get).toHaveBeenCalledWith('/api/users/42');
    });
});
```

### 6.3 Mock 定时器

```tsx
// __tests__/Timer.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../hooks/useCountdown';

describe('useCountdown', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('每秒递减', () => {
        const { result } = renderHook(() => useCountdown(10));

        expect(result.current).toBe(10);

        act(() => { vi.advanceTimersByTime(1000); });
        expect(result.current).toBe(9);

        act(() => { vi.advanceTimersByTime(5000); });
        expect(result.current).toBe(4);
    });

    it('减到 0 停止', () => {
        const { result } = renderHook(() => useCountdown(3));

        act(() => { vi.advanceTimersByTime(5000); });
        expect(result.current).toBe(0);
    });
});
```

### 6.4 Mock 策略选择

```
需要 Mock 吗？
    │
    ├── 不需要 → 直接测试（工具函数、纯逻辑）
    │
    └── 需要 → Mock 什么？
                │
                ├── 回调函数 → vi.fn()（最简单）
                ├── 外部请求 → vi.spyOn(globalThis, 'fetch')
                ├── 第三方库 → vi.mock('module')
                ├── 路由/导航 → vi.mock('react-router')
                └── 定时器 → vi.useFakeTimers()
```

---

## 七、测试金字塔与策略

### 7.1 测试分层

```
          ╱  E2E 测试  ╲          少量 · 端到端覆盖 · 成本最高
         ╱───────────────╲
        ╱   集成测试       ╲       适量 · 组件交互 · 成本中等
       ╱───────────────────╲
      ╱     单元测试         ╲     大量 · 函数/组件 · 成本最低
     ╱───────────────────────╲
```

### 7.2 什么该测，什么不该测

| 该测 | 不该测 |
|------|--------|
| 工具函数（validate、format、parse） | 第三方库的内部行为 |
| 自定义 Hook 的状态变化 | CSS 样式（用视觉回归测试） |
| 组件的交互行为（点击、输入、提交） | React 框架本身（setState、生命周期） |
| 条件渲染（加载态、空态、错误态） | 组件的 DOM 结构（实现细节） |
| 边界条件（空值、极值、异常输入） | 过于简单的组件（纯展示无逻辑） |

### 7.3 覆盖率目标

| 层级 | 建议覆盖率 | 说明 |
|------|-----------|------|
| 公共库 / 工具函数 | **≥ 90%** | 纯函数，投入产出比最高 |
| 自定义 Hook | **≥ 80%** | 状态逻辑核心，必须覆盖 |
| 业务组件 | **≥ 60%** | 重点覆盖交互和边界条件 |
| 页面组件 | **≥ 40%** | 测关键流程，不强求全覆盖 |
| 整体项目 | **≥ 70%** | 平衡覆盖率和开发效率 |

```json
// package.json — 覆盖率阈值配置
{
    "vitest": {
        "coverage": {
            "thresholds": {
                "statements": 70,
                "branches": 65,
                "functions": 70,
                "lines": 70
            }
        }
    }
}
```

---

## 八、CI 集成

### 8.1 GitHub Actions 配置

```yaml
# .github/workflows/test.yml
name: Test

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 20
                  cache: 'npm'

            - run: npm ci
            - run: npm run test:coverage

            # 覆盖率不达标则 CI 失败
            - name: Check coverage
              run: npm run test:coverage -- --coverage.thresholdAutoUpdate=false

            # 上传覆盖率报告（可选）
            - uses: codecov/codecov-action@v4
              with:
                  files: ./coverage/lcov.info
```

### 8.2 Git Hooks（可选）

```bash
# 安装 husky + lint-staged
npm install -D husky lint-staged
npx husky init

# pre-commit 钩子：只跑变更相关的测试
echo 'npx lint-staged' > .husky/pre-commit
```

```json
// package.json
{
    "lint-staged": {
        "*.{ts,tsx}": [
            "eslint --fix",
            "vitest related --run"
        ]
    }
}
```

---

## 九、各方案优缺点与适用场景总结

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **Vitest + Testing Library** | 配置简单、速度快、测试用户行为 | React 生态文档不如 Jest 丰富 | Vite 项目首选 |
| **Jest + Testing Library** | 生态最成熟、社区资源最多 | 配置繁琐、TS 需额外配置 | Webpack/CRA 老项目 |
| **Jest + Enzyme** | 可测内部 state 和生命周期 | 测试实现细节、重构不友好、维护停止 | 遗留项目迁移过渡 |
| **Vitest + Vue Test Utils** | Vue 官方推荐、组件 API 完善 | 仅限 Vue 生态 | Vue/Nuxt 项目 |

---

## 十、局限性

1. **DOM 环境差异**：jsdom 不是真实浏览器，`canvas`、`WebGL`、`IntersectionObserver` 等需要额外 polyfill 或跳过
2. **样式计算无法测试**：CSS 布局、动画、响应式断点在 jsdom 中不生效，需 E2E 测试或视觉回归测试补充
3. **测试维护成本**：业务快速迭代时测试容易过时，需要团队文化保障"改代码必改测试"
4. **Mock 过度的风险**：过度 Mock 会让测试失去意义——测的是 Mock 而非真实行为，需要把握度
5. **覆盖率的误导性**：高覆盖率 ≠ 高质量，100% 覆盖但只测了 happy path 等于没测边界
6. **异步测试的不确定性**：`waitFor` 超时、定时器模拟与真实计时器的差异，偶发 flaky test
7. **学习曲线**：Testing Library "查询优先级"（getByRole > getByLabelText > getByTestId）需要团队统一认知

---

## 十一、总结

前端单元测试落地的关键不是工具，而是**测什么、怎么测、怎么持续**：

- **框架选型**：新项目 Vitest，老项目 Jest，组件测试统一用 Testing Library
- **测试重点**：工具函数 > 自定义 Hook > 业务组件 > 页面组件，按金字塔分配精力
- **Mock 原则**：优先 Mock 外部依赖（网络、路由），少 Mock 内部实现
- **测试理念**：测用户行为而非实现细节，重构后测试仍通过才是好测试
- **CI 保障**：覆盖率阈值卡在 CI，低于标准不允许合并
- **持续演进**：不追求一步到位，从工具函数开始，逐步扩大覆盖范围
