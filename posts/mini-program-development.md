---
title: 小程序开发解决方案与常见问题：从选型到踩坑
date: '2025-12-19'
tags:
  - 小程序
  - 前端
  - 工程化
  - 跨端
category: 前端工程
summary: >-
  从"小程序开发该选什么技术栈、多端怎么覆盖"的实际困惑出发，系统梳理小程序开发方案——原生开发 vs
  跨端框架（Taro/uni-app/Remax）、各平台差异（微信/支付宝/抖音/百度）、状态管理、网络请求、性能优化、分包、登录授权、支付、组件库选型，以及开发中常见问题与解决方案。
---

# 小程序开发解决方案与常见问题：从选型到踩坑

## 一、问题来源

小程序已经成为移动端不可忽视的入口，但开发体验远不如 Web：

**选型困惑：**

- 微信小程序、支付宝小程序、抖音小程序、百度小程序……每个平台一套 API，全做一遍？
- 原生开发（WXML/WXSS/JS）还是跨端框架（Taro/uni-app）？团队只有 React 经验，能直接上手吗？
- 同一套代码要同时跑在小程序 + H5 + App，到底用什么框架？

**开发痛点：**

- 小程序的语法和 Web 差异大：没有 DOM、不能用 `document.querySelector`、CSS 支持有限
- 数据驱动方式和 React/Vue 不同，`setData` 的性能坑（全量更新 vs 局部更新）
- 包体积限制（主包 2MB、总包 20MB），稍不注意就超限
- 登录授权流程复杂（`wx.login` → code → 后端换 openid/session_key）
- 支付、分享、订阅消息等能力各平台实现不一

**线上问题：**

- 首屏白屏 2-3 秒，用户体验差
- 滚动列表卡顿，长列表渲染性能差
- 真机表现和开发者工具不一致（样式错位、API 不支持）
- 审核被拒（类目不符、诱导分享、虚拟支付限制）

**核心问题：小程序开发不是"把 Web 搬过来"，而是要理解各平台特性、选对技术栈、规避性能陷阱、掌握审核规则。本文将系统梳理从选型到踩坑的完整方案。**

---

## 二、技术栈选型

### 2.1 原生开发 vs 跨端框架

| 维度 | 原生开发 | Taro | uni-app | Remax |
|------|---------|------|---------|-------|
| **语法** | WXML/WXSS/JS | React/Vue | Vue 为主 | React |
| **多端覆盖** | 单平台 | 微信/支付宝/H5/RN/抖音 | 几乎全平台 | 微信/支付宝/H5 |
| **学习成本** | 中（需学小程序语法） | 低（会 React 即可） | 低（会 Vue 即可） | 低（会 React 即可） |
| **性能** | 最优（平台原生） | 良好（编译时优化） | 良好 | 良好（运行时） |
| **生态** | 平台官方 | 京东开源，社区活跃 | DCloud 出品，生态最大 | 蚂蚁开源 |
| **调试体验** | 官方工具最好 | 需要额外配置 | HBuilderX 集成好 | 一般 |
| **平台新特性跟进** | 最快（官方） | 滞后 1-2 月 | 滞后 1-2 月 | 滞后 |
| **TypeScript** | 支持（较弱） | 原生支持 | 支持 | 原生支持 |
| **适用场景** | 单平台、追求极致性能 | React 团队、多端 | Vue 团队、多端全覆盖 | React 团队、轻量多端 |

### 2.2 选型决策树

```
你的需求是什么？
    │
    ├── 只做微信小程序，追求极致性能
    │   └── 原生开发（WXML/WXSS/JS）
    │
    ├── 多端覆盖（小程序 + H5 + App）
    │   ├── 团队用 React → Taro
    │   ├── 团队用 Vue  → uni-app
    │   └── 需要 App 原生能力 → uni-app（nvue）或 Taro（RN）
    │
    ├── 多个小程序平台（微信 + 支付宝 + 抖音）
    │   └── Taro 或 uni-app（一套代码多端编译）
    │
    └── 已有 React Web 项目，想移植小程序
        └── Taro（代码复用率最高）
```

### 2.3 Taro 项目结构

```bash
# 安装 Taro CLI
npm install -g @tarojs/cli

# 创建项目
taro init my-app
# 选择：React + TypeScript + Sass + webpack5
```

```
my-app/
├── config/              # 编译配置
│   ├── index.ts
│   ├── dev.ts
│   └── prod.ts
├── src/
│   ├── pages/           # 页面
│   │   └── index/
│   │       ├── index.tsx
│   │       ├── index.scss
│   │       └── index.config.ts  # 页面配置
│   ├── components/      # 组件
│   ├── services/        # API 请求
│   ├── store/           # 状态管理
│   ├── utils/
│   ├── app.tsx          # 入口
│   ├── app.config.ts    # 全局配置（路由、 tabBar）
│   ├── app.scss
│   └── global.d.ts
├── package.json
└── project.config.json  # 微信开发者工具配置
```

```typescript
// src/app.config.ts — 全局配置
export default {
    pages: [
        'pages/index/index',
        'pages/list/index',
        'pages/detail/index',
    ],
    subPackages: [                    // 分包
        {
            root: 'pages/sub/',
            pages: ['page-a', 'page-b'],
        },
    ],
    window: {
        backgroundTextStyle: 'light',
        navigationBarBackgroundColor: '#fff',
        navigationBarTitleText: '我的小程序',
        navigationBarTextStyle: 'black',
    },
    tabBar: {
        list: [
            { pagePath: 'pages/index/index', text: '首页', iconPath: '...', selectedIconPath: '...' },
            { pagePath: 'pages/list/index', text: '列表' },
        ],
    },
    permission: {
        'scope.userLocation': { desc: '你的位置信息将用于展示附近门店' },
    },
};
```

```typescript
// src/pages/index/index.tsx — React 写法
import { View, Text, Button } from '@tarojs/components';
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import './index.scss';

export default function Index() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        Taro.login().then(res => {
            console.log('login code:', res.code);
        });
    }, []);

    const handleClick = () => {
        setCount(c => c + 1);
        Taro.vibrateShort();  // 震动反馈
    };

    return (
        <View className="container">
            <Text className="title">计数器：{count}</Text>
            <Button onClick={handleClick}>点击 +1</Button>
        </View>
    );
}
```

---

## 三、各平台差异对比

### 3.1 平台能力差异

| 能力 | 微信 | 支付宝 | 抖音 | 百度 |
|------|------|--------|------|------|
| **JS 引擎** | V8（Android）/ JSCore（iOS） | V8 | V8 | V8 |
| **渲染层** | WebView（Skyline 可选） | WebView | WebView | WebView |
| **包大小限制** | 主包 2MB/总 20MB | 主包 2MB/总 20MB | 主包 2MB/总 20MB | 主包 8MB |
| **WXS/SJS** | WXS | SJS（语法不同） | 不支持 | Filter |
| **自定义组件** | 支持 | 支持 | 支持 | 支持 |
| **CloudBase** | 云开发 | 云开发（能力较弱） | 云开发 | 智能云 |
| **支付** | 微信支付 | 支付宝支付 | 抖音支付 | 百度支付 |
| **登录** | wx.login | my.getAuthCode | tt.login | swan.login |
| **分包** | 支持 | 支持 | 支持 | 支持 |
| **独立分包** | 支持 | 支持 | 不支持 | 支持 |
| **分包预下载** | 支持 | 支持 | 支持 | 支持 |

### 3.2 跨端开发的条件编译

```typescript
// Taro 条件编译
// #ifdef WEAPP
console.log('微信小程序');
Taro.requestPayment({ /* 微信支付 */ });
// #endif

// #ifdef ALIPAY
console.log('支付宝小程序');
my.paySignMethod({ /* 支付宝支付 */ });
// #endif

// #ifdef TT
console.log('抖音小程序');
// #endif

// #ifdef H5
console.log('H5');
// #endif

// 跨端 API 抽象
const login = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        // #ifdef WEAPP
        Taro.login().then(res => resolve(res.code));
        // #endif

        // #ifdef ALIPAY
        my.getAuthCode({ scopes: 'auth_base' }).then(res => resolve(res.authCode));
        // #endif
    });
};
```

---

## 四、状态管理

### 4.1 方案对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **Page data + setData** | 简单页面 | 零依赖 | 全量更新性能差、跨页面共享难 |
| **Taro MobX** | 中型项目 | 简单、响应式 | 需要装饰器配置 |
| **Redux Toolkit** | 大型项目 | 可预测、DevTools | boilerplate 多 |
| **Zustand** | 中大型项目 | 轻量、API 简洁 | 小程序需适配 |
| **dva** | Taro + React | 集成 redux-saga | 学习成本、已停止维护 |

### 4.2 Zustand 在小程序中的使用（推荐）

```typescript
// store/useStore.ts
import { create } from 'zustand';

interface AppState {
    user: { openid: string; nickname: string } | null;
    cart: { id: string; name: string; price: number; count: number }[];
    setUser: (user: AppState['user']) => void;
    addToCart: (item: AppState['cart'][0]) => void;
    removeFromCart: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
    user: null,
    cart: [],
    setUser: (user) => set({ user }),
    addToCart: (item) => set((state) => {
        const existing = state.cart.find(i => i.id === item.id);
        if (existing) {
            return {
                cart: state.cart.map(i =>
                    i.id === item.id ? { ...i, count: i.count + 1 } : i
                ),
            };
        }
        return { cart: [...state.cart, item] };
    }),
    removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter(i => i.id !== id),
    })),
}));

// 持久化（小程序存储）
export const persistToStorage = () => {
    const state = useStore.getState();
    Taro.setStorageSync('app-state', JSON.stringify({
        cart: state.cart,
    }));
};

export const loadFromStorage = () => {
    const saved = Taro.getStorageSync('app-state');
    if (saved) {
        const data = JSON.parse(saved);
        useStore.getState().addToCart; // 恢复状态
    }
};
```

---

## 五、网络请求封装

### 5.1 统一请求层

```typescript
// services/request.ts
import Taro from '@tarojs/taro';

const BASE_URL = 'https://api.example.com';

interface RequestOptions {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: Record<string, unknown>;
    header?: Record<string, string>;
    loading?: boolean;  // 是否显示 loading
}

interface ApiResponse<T = unknown> {
    code: number;
    message: string;
    data: T;
}

// Token 刷新锁（避免并发刷新）
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
    refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string) => {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
};

export async function request<T = unknown>(options: RequestOptions): Promise<T> {
    const { url, method = 'GET', data, header = {}, loading = false } = options;

    if (loading) Taro.showLoading({ title: '加载中' });

    // 注入 token
    const token = Taro.getStorageSync('access_token');
    if (token) header.Authorization = `Bearer ${token}`;

    try {
        const res = await Taro.request({
            url: url.startsWith('http') ? url : BASE_URL + url,
            method,
            data,
            header: { 'Content-Type': 'application/json', ...header },
            timeout: 10000,
        });

        if (loading) Taro.hideLoading();

        // HTTP 状态码处理
        if (res.statusCode === 401) {
            // Token 过期 → 刷新
            const newToken = await refreshToken();
            if (newToken) {
                // 用新 token 重试
                return request<T>({ ...options, loading: false });
            } else {
                Taro.redirectTo({ url: '/pages/login/index' });
                throw new Error('登录已过期');
            }
        }

        if (res.statusCode >= 400) {
            throw new Error(`请求失败: ${res.statusCode}`);
        }

        const body = res.data as ApiResponse<T>;
        if (body.code !== 0) {
            Taro.showToast({ title: body.message, icon: 'none' });
            throw new Error(body.message);
        }

        return body.data;
    } catch (err) {
        if (loading) Taro.hideLoading();
        Taro.showToast({ title: '网络异常', icon: 'none' });
        throw err;
    }
}

// Token 刷新
async function refreshToken(): Promise<string | null> {
    if (isRefreshing) {
        // 已在刷新中，排队等待
        return new Promise(resolve => subscribeTokenRefresh(resolve));
    }

    isRefreshing = true;
    try {
        const res = await Taro.request({
            url: BASE_URL + '/auth/refresh',
            method: 'POST',
            data: { refreshToken: Taro.getStorageSync('refresh_token') },
        });
        const { accessToken, refreshToken } = res.data.data;
        Taro.setStorageSync('access_token', accessToken);
        Taro.setStorageSync('refresh_token', refreshToken);
        onTokenRefreshed(accessToken);
        return accessToken;
    } catch {
        return null;
    } finally {
        isRefreshing = false;
    }
}
```

### 5.2 API 定义层

```typescript
// services/api.ts
import { request } from './request';

export const api = {
    // 用户
    login: (code: string) =>
        request<{ openid: string; token: string }>({
            url: '/auth/login',
            method: 'POST',
            data: { code },
        }),

    getUserInfo: () =>
        request<{ nickname: string; avatar: string }>({
            url: '/user/info',
        }),

    // 商品
    getProducts: (page = 1, size = 20) =>
        request<{ list: Product[]; total: number }>({
            url: '/products',
            data: { page, size },
        }),

    // 订单
    createOrder: (items: { productId: string; count: number }[]) =>
        request<{ orderId: string }>({
            url: '/orders',
            method: 'POST',
            data: { items },
            loading: true,
        }),
};
```

---

## 六、登录授权流程

### 6.1 微信登录完整流程

```
微信小程序登录流程：

  小程序前端                    后端服务器                    微信服务器
      │                            │                            │
      │  1. wx.login()             │                            │
      ├───────────────────────────────────────────────────────▶│
      │                            │                            │
      │  2. 返回临时 code          │                            │
      │◀───────────────────────────────────────────────────────┤
      │                            │                            │
      │  3. 发送 code 给后端        │                            │
      ├───────────────────────────▶│                            │
      │                            │  4. code2Session(code)     │
      │                            ├───────────────────────────▶│
      │                            │                            │
      │                            │  5. 返回 openid+session_key│
      │                            │◀───────────────────────────┤
      │                            │                            │
      │                            │  6. 生成业务 token          │
      │                            │                            │
      │  7. 返回业务 token         │                            │
      │◀───────────────────────────┤                            │
      │                            │                            │
      │  8. 存储 token，后续请求带 token                          │
```

### 6.2 代码实现

```typescript
// services/auth.ts
import Taro from '@tarojs/taro';
import { api } from './api';

export async function login(): Promise<void> {
    try {
        // Step 1: 获取 code
        const { code } = await Taro.login();
        if (!code) throw new Error('获取 code 失败');

        // Step 2: 发送给后端换取 token
        const { openid, token } = await api.login(code);

        // Step 3: 存储 token
        Taro.setStorageSync('access_token', token);
        Taro.setStorageSync('openid', openid);

        // Step 4: 获取用户信息（需要用户授权）
        await getUserProfile();
    } catch (err) {
        console.error('登录失败', err);
        Taro.showToast({ title: '登录失败', icon: 'none' });
    }
}

// 获取用户头像昵称（新版本 API）
export async function getUserProfile(): Promise<void> {
    try {
        const { userInfo } = await Taro.getUserProfile({
            desc: '用于完善用户资料',
        });
        Taro.setStorageSync('user_info', userInfo);

        // 同步到后端
        await api.updateUserInfo({
            nickname: userInfo.nickName,
            avatar: userInfo.avatarUrl,
        });
    } catch {
        // 用户拒绝授权，使用默认头像
        console.log('用户拒绝授权');
    }
}

// 检查登录状态
export function checkLogin(): boolean {
    const token = Taro.getStorageSync('access_token');
    if (!token) return false;

    // 检查 session 是否过期
    Taro.checkSession().catch(() => {
        // session 过期，重新登录
        login();
    });
    return !!token;
}
```

### 6.3 各平台登录差异

| 平台 | 获取 code | 用户信息 API |
|------|----------|-------------|
| **微信** | `Taro.login()` → `code` | `Taro.getUserProfile()`（需按钮触发） |
| **支付宝** | `my.getAuthCode({ scopes: 'auth_base' })` | `my.getOpenUserInfo()` |
| **抖音** | `tt.login()` → `code` | `tt.getUserInfo()`（组件方式） |
| **百度** | `swan.login()` → `code` | `swan.getUserInfo()` |

---

## 七、性能优化

### 7.1 首屏加载优化

```
首屏白屏原因分析：

  1. 主包过大（>2MB）→ 下载慢
  2. 同步 API 过多 → 阻塞渲染
  3. 首屏数据依赖网络请求 → 等待接口
  4. 图片未压缩/懒加载 → 下载慢
  5. 过多的 setData → 频繁渲染
```

**优化策略：**

| 策略 | 效果 | 实现方式 |
|------|------|---------|
| **分包加载** | 减少主包体积 | 将非首屏页面放分包 |
| **分包预下载** | 分包页面打开快 | `preloadRule` 配置 |
| **骨架屏** | 视觉上减少白屏 | 首屏先渲染骨架 |
| **数据预拉取** | 减少接口等待 | `wx.request` 提前发 |
| **图片懒加载** | 减少首屏下载 | `lazy-load` 属性 |
| **图片压缩** | 减小体积 | WebP 格式 + CDN 缩放 |
| **减少 setData** | 减少渲染次数 | 合并更新、局部更新 |

```json
// 分包预下载配置（app.config.ts）
{
    "preloadRule": {
        "pages/index/index": {
            "network": "all",
            "packages": ["pages/sub"]
        }
    }
}
```

### 7.2 setData 性能优化

```typescript
// ❌ 错误：频繁 setData + 全量更新
this.setData({
    list: newData,       // 全量更新整个 list
});
// 紧接着又 setData
this.setData({
    loading: false,
});

// ✅ 正确：合并 setData
this.setData({
    list: newData,
    loading: false,
});

// ✅ 更优：局部更新（路径更新）
// 只更新第 0 项的 name 字段
this.setData({
    'list[0].name': '新名称',
});

// ✅ Taro/React 中：使用函数式更新，避免不必要的渲染
const [list, setList] = useState([]);
setList(prev => {
    const next = [...prev];
    next[0] = { ...next[0], name: '新名称' };
    return next;  // 只更新变化的部分
});
```

### 7.3 长列表渲染

```typescript
// 长列表性能方案对比：

// 方案一：虚拟列表（推荐）
// 使用 recycle-view 或 Taro 的 VirtualList
import VirtualList from '@tarojs/components/virtual-list';

function Row({ index, data }) {
    return <View style={{ height: '100px' }}>{data[index].name}</View>;
}

function LongList({ list }) {
    return (
        <VirtualList
            height={600}        // 容器高度
            width="100%"
            itemData={list}
            itemCount={list.length}
            itemSize={100}      // 每项高度
        >
            {Row}
        </VirtualList>
    );
}

// 方案二：分页加载 + onReachBottom
// 适合数据量适中的场景
function ProductList() {
    const [list, setList] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useReachBottom(() => {
        if (!hasMore) return;
        loadMore(page + 1);
    });

    const loadMore = async (nextPage) => {
        const res = await api.getProducts(nextPage);
        setList(prev => [...prev, ...res.list]);
        setPage(nextPage);
        if (res.list.length < 20) setHasMore(false);
    };
}

// 方案三：骨架屏 + 数据占位
// 视觉上减少等待感
```

### 7.4 图片优化

```typescript
// 图片优化最佳实践

// 1. 使用 CDN 动态缩放
const getOptimizedImage = (url: string, width: number) => {
    return `${url}?imageView2/2/w/${width}/format/webp`;
};

// 2. 懒加载
<Image src={url} lazy-load mode="aspectFill" />

// 3. 多分辨率适配
const dpr = Taro.getSystemInfoSync().pixelRatio;
const size = 100 * dpr;
<Image src={`${url}?w=${size}`} />

// 4. 占位图
<Image
    src={url}
    lazy-load
    placeholder={placeholderBase64}  // Base64 占位图
/>
```

---

## 八、常见问题与解决方案

### 8.1 包体积超限

```
问题：主包超过 2MB 无法上传

解决方案：
  1. 静态资源外置
     └─ 图片/字体上传 CDN，代码中用 URL 引用

  2. 分包
     └─ 非首屏页面放分包

  3. 分包独立化
     └─ 独立分包不依赖主包，可独立运行

  4. Tree Shaking
     └─ 删除未使用的 npm 包
     └─ 用 babel-plugin-import 按需引入组件库

  5. 压缩
     └─ webpack5 production 模式自动压缩
     └─ 小程序→工具→上传时勾选"压缩代码"
```

```typescript
// 按需引入组件库（以 Taro UI 为例）
// .babelrc 或 babel.config.js
{
    "plugins": [
        ["import", {
            "libraryName": "@taroify/core",
            "libraryDirectory": "es",
            "style": "css"
        }]
    ]
}
```

### 8.2 setData 数据量过大

```typescript
// 问题：一次 setData 传递大量数据导致卡顿

// ❌ 错误：传递完整的大数组
this.setData({ bigList: arrayWith1000Items });

// ✅ 正确：只传需要更新的部分
this.setData({
    [`bigList[${index}]`]: updatedItem,  // 路径更新
});

// ✅ 更优：分批 setData
function batchSetData(data, batchSize = 50) {
    for (let i = 0; i < data.length; i += batchSize) {
        setTimeout(() => {
            this.setData({
                [`list[${i}]`]: data[i],
            });
        }, 0);
    }
}
```

### 8.3 真机与开发者工具不一致

```
常见差异：

  1. CSS 样式
     └─ 开发者工具支持某些 CSS3 特性，真机不支持
     └─ 如：filter、backdrop-filter 在部分机型不支持

  2. API 行为
     └─ 开发者工具的 wx.chooseImage 和真机行为不同
     └─ 开发者工具的 rpx 计算可能和真机有差异

  3. 性能
     └─ 开发者工具是桌面性能，真机性能弱很多
     └─ 真机上长列表/动画更容易卡顿

解决方案：
  └─ 必须真机调试（扫码预览）
  └─ 多机型测试（低端机重点测）
  └─ 使用 Taro.canIUse() 做特性检测
```

```typescript
// 特性检测
if (Taro.canIUse('scroll-view.enable-flex')) {
    // 支持 flex 布局
} else {
    // 降级方案
}
```

### 8.4 页面栈溢出

```typescript
// 问题：页面跳转超过 10 层，navigateTo 失败

// ❌ 错误：一直 navigateTo
Taro.navigateTo({ url: '/pages/detail/index?id=' + id });

// ✅ 正确：判断页面栈深度
function safeNavigate(url: string) {
    const pages = Taro.getCurrentPages();
    if (pages.length >= 10) {
        // 用 redirectTo 替换当前页（不增加栈深度）
        Taro.redirectTo({ url });
    } else {
        Taro.navigateTo({ url });
    }
}

// ✅ 更优：返回首页用 reLaunch（清空栈）
Taro.reLaunch({ url: '/pages/index/index' });
```

### 8.5 授权弹窗被拒绝

```typescript
// 问题：用户拒绝授权后，无法再次弹窗

// 解决：引导用户去设置页开启
async function ensurePermission(scope: string): Promise<boolean> {
    try {
        const setting = await Taro.getSetting();
        if (setting.authSetting[scope] === false) {
            // 曾拒绝过，引导去设置
            const res = await Taro.showModal({
                title: '需要授权',
                content: '需要您开启相应权限才能使用此功能',
                confirmText: '去设置',
            });
            if (res.confirm) {
                await Taro.openSetting();
                // 重新检查
                const newSetting = await Taro.getSetting();
                return newSetting.authSetting[scope] === true;
            }
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

// 使用
if (await ensurePermission('scope.userLocation')) {
    const location = await Taro.getLocation();
}
```

### 8.6 支付问题

```typescript
// 微信支付流程
async function pay(orderId: string) {
    // 1. 后端创建预支付订单
    const payParams = await api.createPayment(orderId);
    // 返回：{ timeStamp, nonceStr, package, signType, paySign }

    // 2. 调起微信支付
    try {
        await Taro.requestPayment({
            timeStamp: payParams.timeStamp,
            nonceStr: payParams.nonceStr,
            package: payParams.package,
            signType: payParams.signType as 'MD5' | 'HMAC-SHA256',
            paySign: payParams.paySign,
        });
        // 支付成功
        Taro.showToast({ title: '支付成功' });
    } catch (err) {
        if (err.errMsg.includes('cancel')) {
            Taro.showToast({ title: '已取消支付', icon: 'none' });
        } else {
            Taro.showToast({ title: '支付失败', icon: 'none' });
        }
    }
}
```

### 8.7 审核被拒常见原因

| 审核拒绝原因 | 解决方案 |
|------------|---------|
| **类目不符** | 注册时选择正确的服务类目 |
| **诱导分享/关注** | 去掉"分享得奖励""关注公众号"等引导 |
| **虚拟支付** | iOS 端虚拟商品不能用微信支付（需接入苹果 IAP） |
| **内容违规** | 接入内容安全检测 API（`security.msgSecCheck`） |
| **无隐私政策** | 添加隐私政策页面，首次启动弹出同意框 |
| **测试账号** | 提供可测试的账号密码 |
| **功能不完整** | 确保所有页面可访问，无"敬请期待"占位页 |

```typescript
// 内容安全检测（UGC 内容必须检测）
async function checkContentSecurity(text: string): Promise<boolean> {
    try {
        const res = await Taro.request({
            url: `${BASE_URL}/security/msg-check`,
            method: 'POST',
            data: { content: text },
        });
        return res.data.code === 0;  // 0 = 安全
    } catch {
        return false;  // 检测失败默认不通过
    }
}

// 发帖前检测
if (!await checkContentSecurity(content)) {
    return Taro.showToast({ title: '内容包含违规信息', icon: 'none' });
}
```

### 8.8 样式问题与解决方案

小程序的 WXSS 和 Web 的 CSS 表面相似，实际坑非常多。下面按出现频率排列。

#### 问题 1：1px 边框在高清屏变粗

**原因**：小程序用 `rpx` 单位时，`1rpx` 在不同 DPR 设备上换算后的物理像素不一致，`1px` 在 2x/3x 屏会被渲染成 2-3 个物理像素，看起来很粗。

```scss
// ❌ 直接写 1px，真机上偏粗
.border { border: 1px solid #eee; }

// ✅ 方案一：用 1rpx（在 750px 设计稿下约等于 0.5px）
.border { border: 1rpx solid #eee; }

// ✅ 方案二：transform 缩放（伪元素 + scale）
.hairline-bottom {
    position: relative;
    &::after {
        content: '';
        position: absolute;
        left: 0; bottom: 0;
        width: 100%; height: 1px;
        background: #eee;
        transform: scaleY(0.5);
        transform-origin: 0 0;
    }
}
```

#### 问题 2：rpx 与 px 混用导致布局错位

**原因**：`rpx` 是响应式单位（屏幕宽度 / 750），`px` 是固定单位，混用时在不同尺寸屏幕上比例失调。

```scss
// ❌ 混用：宽度用 rpx，字号用 px
.box {
    width: 200rpx;
    font-size: 14px;  // 在大屏上字号不变，但宽度变大了，比例失衡
}

// ✅ 统一用 rpx（设计稿是 750 宽）
.box {
    width: 200rpx;
    font-size: 28rpx;  // 14px ≈ 28rpx（750 设计稿）
}
```

**换算公式**：`1px = (750 / 屏幕宽度) rpx`，在 iPhone 6（375pt）上 `1px = 2rpx`。

#### 问题 3：scoped 样式失效 / 全局污染

**原因**：原生小程序每个页面的 WXSS 默认只作用于当前页面，但**自定义组件的样式隔离**机制和组件库的样式优先级经常冲突。

```json
// 组件样式隔离配置（组件 json）
{
    "component": true,
    "styleIsolation": "isolated"  // isolated | apply-shared | shared
}
```

| 值 | 含义 |
|----|------|
| `isolated` | 默认。组件内外样式完全隔离 |
| `apply-shared` | 页面 WXSS 可作用于组件，组件样式不影响页面 |
| `shared` | 双向影响（慎用） |

```scss
// 跨端框架（Taro/uni）中：用 CSS Modules 或 scoped
// Taro 自动开启 scoped，但深层组件需用 :global 穿透
:global .van-button {
    border-radius: 8rpx;
}
```

#### 问题 4：文字截断（多行省略号）不生效

**原因**：旧版小程序 WebView 不支持 `-webkit-box`，或组件库内层元素没有继承样式。

```scss
// 多行省略
.line-clamp-2 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-all;  // 英文/长串数字断行
}

// 单行省略
.ellipsis {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
```

**避坑**：如果文字在 `<text>` 组件内，`<text>` 是 inline 元素，需要外层包 `<view>` 设置宽度。

#### 问题 5：fixed 定位被 transform 破坏

**原因**：父元素设置了 `transform` 后，子元素的 `position: fixed` 会以父元素为参照（变成 absolute 效果），吸顶/吸底失效。

```scss
// ❌ 父元素 transform 后，子元素 fixed 失效
.parent { transform: translateZ(0); }
.child { position: fixed; bottom: 0; }  // 不再相对屏幕

// ✅ 把 fixed 元素移到 transform 容器外层
<view class="parent-with-transform">...</view>
<view class="fixed-bottom">吸底栏</view>
```

#### 问题 6：滚动区域高度计算错误

**原因**：小程序没有 `100vh` 的可靠支持（刘海屏、虚拟键盘遮挡），固定高度滚动区经常算错。

```scss
// ❌ 用固定 px 或 100vh
.scroll-area { height: 100vh; }  // 没扣掉导航栏 + tabBar

// ✅ 用 calc + 系统信息动态计算
// 在 JS 中拿到状态栏/导航栏高度，通过 CSS 变量传入
```

```typescript
// 获取系统信息
const { statusBarHeight, windowHeight } = Taro.getSystemInfoSync();
const navBarHeight = 44; // 自定义导航栏高度
const scrollHeight = windowHeight - statusBarHeight - navBarHeight;
// 通过 style 传入
<View style={{ height: `${scrollHeight}px` }} />
```

#### 问题 7：图片下方默认有间隙

**原因**：`<image>` 默认是 inline 元素，有行内基线对齐间隙。

```scss
// ✅ 改成 block
image { display: block; }
// 或
image { vertical-align: top; }
```

#### 问题 8：渐变/阴影/滤镜兼容性差

```scss
// backdrop-filter（毛玻璃）在 Android 大量机型不支持
.glass {
    backdrop-filter: blur(10px);
    background: rgba(255,255,255,0.8); // 必须有 fallback 背景
}

// filter 兼容性差，建议改用图片或 box-shadow
```

### 8.9 兼容性问题与解决方案

#### 问题 1：iOS 与 Android 字体表现不一致

**原因**：iOS 默认 PingFang SC，Android 默认 Noto Sans CJK / Droid Sans，同样的 `font-size` 渲染高度不同。

```scss
// 统一字体栈（优先级从高到低）
page {
    font-family:
        -apple-system,           // iOS 系统字体
        BlinkMacSystemFont,
        'Helvetica Neue',
        'PingFang SC',           // iOS 中文
        'Microsoft YaHei',       // Windows 中文
        sans-serif;
}
// 注意：小程序不支持 @font-face 加载本地字体（需转 base64 或网络字体）
```

#### 问题 2：iOS 滚动惯性 / 回弹效果

```scss
// iOS 默认有弹性滚动，Android 没有
// 开启弹性滚动
.scroll-view {
    -webkit-overflow-scrolling: touch;
}
// scroll-view 组件的 enhanced 属性可统一行为
```

```xml
<!-- 增强滚动（统一双端行为） -->
<scroll-view scroll-y enhanced bounces show-scrollbar="{{false}}">
```

#### 问题 3：safe-area（刘海屏/底部 Home 条）适配

```scss
// 知识储备：env(safe-area-inset-*) 是 CSS 环境变量
// iOS 顶部状态栏、底部 Home 指示条都需要避让

/* 底部吸底栏，避开 Home 指示条 */
.bottom-bar {
    padding-bottom: calc(20rpx + constant(safe-area-inset-bottom)); /* iOS < 11.2 */
    padding-bottom: calc(20rpx + env(safe-area-inset-bottom));       /* iOS >= 11.2 */
}

/* 顶部自定义导航栏，避开刘海 */
.custom-nav {
    padding-top: calc(var(--status-bar-height) + 8rpx);
}
```

```typescript
// 在 app.tsx 启动时获取并写入 CSS 变量
const { statusBarHeight } = Taro.getSystemInfoSync();
// 通过 style 或 setData 注入到页面根节点
```

#### 问题 4：input / textarea 键盘遮挡

**原因**：软键盘弹起会顶起页面（iOS）或盖住输入框（Android）。

```xml
<!-- input 的 adjust-position 自动上推（默认开启） -->
<input adjust-position="{{true}}" cursor-spacing="20" />

<!-- textarea 用 show-confirm-bar 和固定高度 -->
<textarea
    auto-height
    show-confirm-bar="{{false}}"
    adjust-position="{{true}}"
    cursor-spacing="20"
/>
```

**进阶方案**：监听键盘高度，手动调整吸底元素位置。

```typescript
Taro.onKeyboardHeightChange((res) => {
    this.setState({ keyboardHeight: res.height });
});
// style bottom: keyboardHeight
```

#### 问题 5：scroll-view 横向滚动失效

**原因**：`scroll-x` 生效需要 `white-space: nowrap` + 子元素 `display: inline-block`。

```scss
/* ❌ 不生效 */
.scroll-x { overflow-x: auto; }
.scroll-x .item { display: flex; }

/* ✅ 正确 */
.scroll-x {
    white-space: nowrap;
    width: 100%;
}
.scroll-x .item {
    display: inline-block;  /* 不能用 flex 子项 */
    width: 200rpx;
}
```

#### 问题 6：按钮自带样式无法去除

**原因**：`<button>` 默认有背景、边框、padding，影响设计还原。

```scss
/* 微信原生 button 去除默认样式 */
button {
    padding: 0;
    margin: 0;
    background: transparent;
    border: none;
    line-height: normal;
}
button::after {
    border: none;  /* 关键：伪元素的边框要去掉 */
}
/* 注意：button 的 open-type 功能（获取手机号、分享等）必须用 button 元素 */
```

#### 问题 7：自定义组件样式穿透失败

**原因**：组件样式隔离导致外部样式无法作用到组件内部。

```xml
<!-- 方式一：组件内外都加 externalClasses -->
<!-- 组件 my-component.js -->
Component({
    externalClasses: ['custom-class'],
});

<!-- 组件 wxml -->
<view class="custom-class"></view>

<!-- 页面使用 -->
<my-component custom-class="my-style" />
```

```scss
/* 方式二：用 styleIsolation: apply-shared（推荐） */
```

#### 问题 8：时间格式化在 iOS 上 NaN

**原因**：iOS 的 JS 引擎不支持 `new Date('2026-01-01 12:00:00')`（带空格的格式），Android 支持。

```typescript
// ❌ iOS 报 Invalid Date
new Date('2026-01-01 12:00:00');

// ✅ 替换为 ISO 格式或用正则替换
new Date('2026-01-01T12:00:00');  // ISO 标准
// 或
new Date('2026-01-01 12:00:00'.replace(/-/g, '/').replace(' ', ' '));
// iOS 也支持 '2026/01/01 12:00:00'
```

#### 问题 9：setData 在 iOS 上比 Android 慢

**原因**：iOS 用 JavaScriptCore，Android 用 V8，数据序列化方式不同，大数据 setData 在 iOS 上慢 3-5 倍。

```typescript
// 应对：iOS 上更要严格控制 setData 数据量
// 路径更新 + 合并更新 + 避免传递不需要渲染的数据
```

#### 问题 10：canvus / video 组件层级最高（遮挡弹窗）

**原因**：原生组件（video、map、canvas、camera）由原生层渲染，z-index 无效。

```xml
<!-- 方案：用 cover-view / cover-image 覆盖在原生组件上 -->
<video src="...">
    <cover-view class="overlay">覆盖层</cover-view>
</video>

<!-- 或：弹窗时隐藏原生组件 -->
<video wx:if="{{!showModal}}" />
```

### 8.10 接口常见问题与解决方案

小程序的网络请求和 Web 的 `fetch`/`axios` 看起来一样，但运行环境和平台限制带来一系列独有的坑。下面按出现频率从高到低排列。

#### 问题 1：合法域名未配置（request:fail url not in domain list）

**原因**：微信小程序要求所有请求域名必须在小程序后台「开发设置 → 服务器域名」中预先配置，且必须 HTTPS。开发者工具默认勾选了「不校验合法域名」，所以本地能跑，上线就报错。

```
开发阶段：
  开发者工具 → 详情 → 本地设置 → ☑ 不校验合法域名、HTTPS 证书
  （仅开发用，真机预览/线上必须配置）

上线前必须配置：
  mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名
    request合法域名:  https://api.example.com
    socket合法域名:   wss://api.example.com
    uploadFile合法域名: https://upload.example.com
    downloadFile合法域名: https://cdn.example.com
```

**避坑点**：
- 每月只能修改 50 次域名配置，频繁换域名的项目要规划好
- 二级域名不通用：配了 `api.example.com` 不能请求 `api2.example.com`，需逐个配置
- WebSocket 用 `wss://`，不能用 `ws://`
- 开发者工具关闭校验后，**真机预览仍然校验**，必须在后台配置

#### 问题 2：并发请求超过 10 个被丢弃

**原因**：微信小程序 `wx.request` 同时存在的最大连接数为 **10 个**，超过的请求会被直接丢弃或排队阻塞。列表页批量加载图片 + 接口请求时极易触发。

```typescript
// ❌ 错误：列表渲染时每项都发请求
list.map(item => api.getDetail(item.id));  // 50 条数据 = 50 个并发，后 40 个卡住

// ✅ 方案一：后端聚合接口（推荐）
// 一次请求拿回所有详情
api.getDetails(ids.join(','));

// ✅ 方案二：前端并发控制（请求池）
class RequestPool {
    private queue: (() => Promise<unknown>)[] = [];
    private active = 0;
    private readonly max = 6;  // 留 4 个给其他请求

    add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const run = () => {
                this.active++;
                task().then(resolve, reject).finally(() => {
                    this.active--;
                    this.next();
                });
            };
            this.queue.push(run);
            this.next();
        });
    }

    private next() {
        if (this.active >= this.max) return;
        const run = this.queue.shift();
        if (run) run();
    }
}

// 使用
const pool = new RequestPool();
list.map(item => pool.add(() => api.getDetail(item.id)));
```

#### 问题 3：HTTPS 证书问题（request:fail ssl hand shake error）

**原因**：证书过期、证书链不完整、使用自签名证书、或证书的 SAN（Subject Alternative Name）不包含请求域名。

```
排查清单：
  1. 证书是否过期（Let's Encrypt 90 天到期）
  2. 是否配置了完整证书链（中间证书缺失，Android 上报错）
  3. 域名是否匹配证书的 SAN
  4. TLS 版本是否 >= 1.2（微信不支持 TLS 1.0/1.1）

验证工具：
  https://www.myssl.cn/tools/check-server-cert.html
```

**避坑**：证书快到期时提前 7 天更换，避免线上突然失效。

#### 问题 4：弱网/请求超时无反馈

**原因**：`wx.request` 默认超时 60s，用户等半天只看到空白，没有 loading 也没有错误提示。

```typescript
// ✅ 统一设置较短超时 + 重试 + loading
async function safeRequest(options) {
    const { loading = true, retry = 2, timeout = 10000 } = options;

    if (loading) Taro.showLoading({ title: '加载中', mask: true });

    let lastError;
    for (let i = 0; i <= retry; i++) {
        try {
            const res = await Taro.request({ ...options, timeout });
            if (loading) Taro.hideLoading();
            return res;
        } catch (err) {
            lastError = err;
            // 超时才重试，其他错误（404/401）不重试
            if (!err.errMsg?.includes('timeout')) break;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));  // 退避
        }
    }

    if (loading) Taro.hideLoading();
    Taro.showToast({ title: '网络较差，请稍后重试', icon: 'none' });
    throw lastError;
}
```

#### 问题 5：接口返回数据格式不稳定

**原因**：`wx.request` 的 `res.data` 类型取决于响应头 `Content-Type`：
- `application/json` → 自动解析为对象
- `text/html` 或其他 → 字符串
- 后端返回 JSON 但 Content-Type 写错 → 拿到字符串，`.code` 访问 undefined

```typescript
// ✅ 防御性解析
function parseResponse(res) {
    let data = res.data;
    // 兜底：如果是字符串，尝试 JSON.parse
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            return { code: -1, message: '响应格式错误', data: null };
        }
    }
    // 后端约定：code === 0 成功
    if (data.code !== 0) {
        throw new Error(data.message || '未知错误');
    }
    return data.data;
}
```

#### 问题 6：上传文件 Content-Type 被 framework 改坏

**原因**：`wx.uploadFile` 必须用 `multipart/form-data`，开发者手动设置 `Content-Type` header 会破坏 boundary，导致后端解析失败。

```typescript
// ❌ 错误：手动设置 Content-Type
Taro.uploadFile({
    url,
    filePath,
    name: 'file',
    header: { 'Content-Type': 'multipart/form-data' },  // 破坏了 boundary
});

// ✅ 正确：不要设置 Content-Type，让底层自动加
Taro.uploadFile({
    url,
    filePath,
    name: 'file',
    formData: { userId: '123' },  // 额外的字段放 formData
    header: {
        Authorization: `Bearer ${token}`,  // 业务 header 可以加
        // 不要加 Content-Type
    },
});
```

#### 问题 7：token 过期 + 并发刷新

这个问题在第五节 5.1 已详细给出「请求锁 + 订阅队列」的完整方案，这里补充**为什么不能简单处理**：

```typescript
// ❌ 错误做法一：每个请求独立刷新
// 后果：10 个请求同时 401，触发 10 次 refreshToken，后端限流
async function request() {
    const res = await Taro.request({ ... });
    if (res.statusCode === 401) {
        await refreshToken();  // 10 个请求会刷 10 次
        return request();
    }
}

// ❌ 错误做法二：用一个全局变量挡，但不排队
let isRefreshing = false;
if (res.statusCode === 401) {
    if (isRefreshing) {
        return Promise.reject('刷新中');  // 直接失败，用户看到一堆错误
    }
    isRefreshing = true;
    await refreshToken();
    isRefreshing = false;
    return request();
}

// ✅ 正确做法：5.1 节的「锁 + 订阅队列」
// 第一个 401 触发刷新，其余请求挂起等待，刷新完成后统一用新 token 重试
```

#### 问题 8：接口被重复请求（防抖）

**原因**：用户快速点击按钮、列表频繁触发加载，导致同一接口被调用多次，浪费流量且数据错乱。

```typescript
// ✅ 方案一：基于 URL 的请求去重（同一 URL 进行中的请求复用）
const pending = new Map<string, Promise<unknown>>();

function dedupRequest(key: string, task: () => Promise<unknown>) {
    if (pending.has(key)) return pending.get(key)!;
    const p = task().finally(() => pending.delete(key));
    pending.set(key, p);
    return p;
}

// 使用：列表加载同一页不会重复发
dedupRequest(`products_${page}`, () => api.getProducts(page));

// ✅ 方案二：按钮级别的 loading 防抖
const [submitting, setSubmitting] = useState(false);
const handleSubmit = async () => {
    if (submitting) return;  // 挡住重复点击
    setSubmitting(true);
    try {
        await api.submit();
    } finally {
        setSubmitting(false);
    }
};
```

#### 问题 9：WebSocket 断连不重连

**原因**：小程序的 `wx.connectSocket` 默认不会自动重连，网络切换、后台切前台、服务端重启都会断开。

```typescript
class WsManager {
    private socket: Taro.SocketTask | null = null;
    private reconnectCount = 0;
    private readonly maxReconnect = 5;
    private shouldReconnect = true;

    connect(url: string) {
        this.socket = Taro.connectSocket({ url });
        this.socket.onOpen(() => {
            this.reconnectCount = 0;  // 重置重连次数
            console.log('WS 已连接');
        });
        this.socket.onClose(() => {
            if (this.shouldReconnect) this.reconnect(url);
        });
        this.socket.onError((err) => {
            console.error('WS 错误', err);
        });
    }

    private reconnect(url: string) {
        if (this.reconnectCount >= this.maxReconnect) {
            Taro.showToast({ title: '连接已断开', icon: 'none' });
            return;
        }
        this.reconnectCount++;
        const delay = Math.min(1000 * 2 ** this.reconnectCount, 30000);  // 指数退避，最大 30s
        setTimeout(() => this.connect(url), delay);
    }

    close() {
        this.shouldReconnect = false;  // 主动关闭不重连
        this.socket?.close({});
    }

    // 心跳保活（防止连接被中间网络设备断开）
    startHeartbeat() {
        setInterval(() => {
            this.socket?.send({ data: JSON.stringify({ type: 'ping' }) });
        }, 30000);
    }
}
```

#### 问题 10：接口缓存导致脏数据

**原因**：小程序的 `wx.request` 默认会走系统缓存，部分场景下 GET 请求拿到旧数据；或前端做了缓存但未设置失效时间。

```typescript
// 问题一：GET 请求被 HTTP 缓存
// ✅ 加时间戳或随机数破坏缓存
function withCacheBust(url: string) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_t=${Date.now()}`;
}

// 问题二：业务层缓存未失效
// ✅ 缓存必须带 TTL
const cache = new Map<string, { data: unknown; expireAt: number }>();

async function cachedRequest(key: string, task: () => Promise<unknown>, ttl = 60000) {
    const cached = cache.get(key);
    if (cached && cached.expireAt > Date.now()) return cached.data;
    const data = await task();
    cache.set(key, { data, expireAt: Date.now() + ttl });
    return data;
}
```

#### 问题 11：跨平台接口路径/参数差异

**原因**：跨端项目（Taro/uni）编译到不同小程序，后端可能用不同接口或不同鉴权方式。

```typescript
// 用条件编译处理平台差异
async function getCommonParams() {
    // #ifdef WEAPP
    const { code } = await Taro.login();
    return { platform: 'wechat', code };
    // #endif

    // #ifdef ALIPAY
    const { authCode } = await Taro.getAuthCode({ scopes: 'auth_base' });
    return { platform: 'alipay', code: authCode };
    // #endif

    // #ifdef H5
    return { platform: 'h5', token: getCookie('token') };
    // #endif
}
```

#### 问题 12：埋点请求阻塞业务

**原因**：埋点上报和业务请求共用连接池，大量埋点挤压业务请求。

```typescript
// ✅ 埋点用 sendBeacon（不阻塞）或独立队列
// 小程序没有 sendBeacon，用 beacon 模式：fire-and-forget
function track(event: string, data: unknown) {
    // 不 await，不处理错误，不阻塞业务
    Taro.request({
        url: `${BASE_URL}/track`,
        method: 'POST',
        data: { event, data, timestamp: Date.now() },
    }).catch(() => {});  // 静默失败
}

// ✅ 进阶：批量上报，定时 flush
const trackQueue: unknown[] = [];
let flushTimer: ReturnType<typeof setTimeout>;

function track(event: string, data: unknown) {
    trackQueue.push({ event, data, ts: Date.now() });
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushTrack, 5000);  // 5 秒后批量发
}

function flushTrack() {
    if (!trackQueue.length) return;
    const batch = trackQueue.splice(0);
    Taro.request({ url: `${BASE_URL}/track/batch`, method: 'POST', data: batch });
}
```

### 8.11 智能客服常见难点

智能客服（ChatBot / AI 助手）是小程序的高频场景，但实时通信、流式输出、长会话管理、键盘交互等都比普通页面复杂得多。

#### 难点 1：AI 流式输出 — 小程序不支持 SSE

**原因**：AI 大模型回答通常是 Server-Sent Events（SSE）逐字流式返回。但小程序的 `wx.request` **不支持 SSE**（无法读取流式响应），只能拿到完整响应。

```
Web 端：           fetch + ReadableStream → 逐字打字机效果 ✅
小程序 wx.request：等接口完全返回才触发 success ❌
```

**三种替代方案对比：**

| 方案 | 原理 | 实时性 | 复杂度 | 体验 |
|------|------|--------|--------|------|
| **WebSocket 流式** | 后端通过 WS 推送每个 token | 最佳 | 中 | 真·打字机 |
| **分块轮询** | 后端把回答切片，前端定时拉取 | 中 | 低 | 卡顿感 |
| **整包返回** | 后端等大模型答完一次返回 | 差 | 最低 | 用户干等 5-10s |

```typescript
// ✅ 推荐方案：WebSocket 流式
// 后端从大模型拿 SSE，转成 WS 消息推给小程序
const ws = Taro.connectSocket({ url: 'wss://api.example.com/chat' });

ws.onMessage((res) => {
    const chunk = JSON.parse(res.data);
    // chunk: { type: 'token', content: '你', messageId: 'xxx' }
    if (chunk.type === 'token') {
        // 追加到当前回答
        appendToCurrentMessage(chunk.content);
    } else if (chunk.type === 'done') {
        // 回答完成
        finalizeMessage(chunk.messageId);
    } else if (chunk.type === 'error') {
        handleStreamError(chunk);
    }
});

// 前端发送问题
ws.send({ data: JSON.stringify({
    type: 'ask',
    content: userQuestion,
    sessionId,
}) });
```

```typescript
// 备选方案：分块轮询（无 WS 时的降级）
async function pollAnswer(taskId: string) {
    let offset = 0;
    while (true) {
        const res = await api.pollTask(taskId, offset);
        if (res.chunk) {
            appendToCurrentMessage(res.chunk);
            offset += res.chunk.length;
        }
        if (res.done) break;
        await new Promise(r => setTimeout(r, 300));  // 300ms 轮询
    }
}
```

#### 难点 2：WebSocket 断连与后台切换

**原因**：小程序切到后台后 WS 连接会被系统挂起/断开；网络切换（WiFi ↔ 4G）也会断连；AI 回答到一半断开，会出现「答到一半就停」。

```typescript
class ChatSocket {
    private socket: Taro.SocketTask | null = null;
    private reconnectAttempts = 0;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private pendingMessages: Array<{ id: string; content: string }> = [];
    private lastMessageId = '';

    connect() {
        this.socket = Taro.connectSocket({ url: WS_URL });
        this.bindEvents();
    }

    private bindEvents() {
        this.socket!.onOpen(() => {
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            // 重连后：重发未确认的消息（基于 messageId 幂等）
            this.flushPending();
            // 拉取断线期间的遗漏消息（lastMessageId 之后）
            if (this.lastMessageId) {
                api.fetchMissedMessages(this.lastMessageId);
            }
        });

        this.socket!.onClose(() => this.reconnect());
        this.socket!.onError(() => this.reconnect());

        // 切前台/切后台监听
        Taro.onAppShow(() => this.checkAndReconnect());
        Taro.onAppHide(() => this.stopHeartbeat());
    }

    private reconnect() {
        if (this.reconnectAttempts >= 5) {
            Taro.showToast({ title: '连接断开，请刷新', icon: 'none' });
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
        setTimeout(() => this.connect(), delay);
    }

    // 心跳：30s 一次，防止中间网络设备断开空闲连接
    private startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.socket?.send({ data: JSON.stringify({ type: 'ping' }) });
        }, 30000);
    }

    // 发消息：必须带客户端 messageId，用于幂等去重
    send(content: string) {
        const clientMsgId = `${Date.now()}_${Math.random()}`;
        this.pendingMessages.push({ id: clientMsgId, content });
        this.socket?.send({
            data: JSON.stringify({ type: 'ask', clientMsgId, content }),
        });
    }

    private flushPending() {
        // 重连后重发未确认的消息（后端按 clientMsgId 去重）
        this.pendingMessages.forEach(m => {
            this.socket?.send({
                data: JSON.stringify({ type: 'ask', clientMsgId: m.id, content: m.content }),
            });
        });
    }

    // 收到服务端 ACK 后从 pending 移除
    ackMessage(clientMsgId: string) {
        this.pendingMessages = this.pendingMessages.filter(m => m.id !== clientMsgId);
    }
}
```

#### 难点 3：键盘遮挡输入框 — 聊天场景最痛

普通页面键盘问题在第八节 8.9 已讲，但聊天场景更复杂：**输入框要随键盘上推，同时消息列表要保持在可见区且自动滚到底部**。

```xml
<!-- 聊天页结构 -->
<view class="chat-page" style="padding-bottom: {{keyboardHeight + inputBarHeight}}px">
    <scroll-view
        scroll-y
        scroll-into-view="msg-{{lastMsgId}}"
        style="height: {{scrollHeight - keyboardHeight}}px"
    >
        <view wx:for="{{messages}}" id="msg-{{item.id}}">{{item.content}}</view>
    </scroll-view>

    <view class="input-bar" style="bottom: {{keyboardHeight}}px">
        <textarea
            adjust-position="{{false}}"   <!-- 关闭自动上推，自己控制 -->
            cursor-spacing="20"
            bindfocus="onInputFocus"
            bindblur="onInputBlur"
        />
        <button bindtap="onSend">发送</button>
    </view>
</view>
```

```typescript
// 监听键盘高度，手动布局
onInputFocus() {
    Taro.onKeyboardHeightChange((res) => {
        this.setData({ keyboardHeight: res.height });
        this.scrollToBottom();  // 键盘弹起时滚到底
    });
}

onInputBlur() {
    this.setData({ keyboardHeight: 0 });
}

scrollToBottom() {
    // 用 scroll-into-view 而非 scrollTop，避免计算误差
    const lastMsg = this.data.messages[this.data.messages.length - 1];
    this.setData({ lastMsgId: lastMsg.id });
}
```

**关键点**：
- `adjust-position="{{false}}"` 关掉默认上推，自己根据键盘高度计算（默认行为在自定义布局下经常错位）
- iOS 上键盘弹起有动画，`onKeyboardHeightChange` 会触发多次，要做防抖
- Android 上 `cursor-spacing` 必须设，否则光标紧贴键盘顶部

#### 难点 4：长会话消息列表性能

**原因**：聊天记录会无限增长，几百条消息直接渲染，setData 数据量爆炸 + DOM 节点过多，低端机卡死。

```typescript
// ❌ 错误：所有消息都存 data，每次 setData 全量
this.setData({ messages: allMessages });  // 1000 条 = 几百 KB 数据传输

// ✅ 方案一：虚拟列表（只渲染可视区域）
// 小程序原生没有，用 recycle-view 或 Taro VirtualList
import VirtualList from '@tarojs/components/virtual-list';
// 注意：聊天列表高度不固定，需要动态测量

// ✅ 方案二：分页 + 本地缓存 + 触顶加载历史
// 1. 内存只保留最近 N 条（如 50 条）
// 2. 更早的存 Storage
// 3. 用户上滑触顶时，从 Storage/接口拉取追加到顶部

const VISIBLE_LIMIT = 50;

Page({
    data: {
        visibleMessages: [],   // 只渲染这批
        allMessageIds: [],     // 所有消息 ID（轻量）
    },

    onLoad() {
        // 加载最近 50 条
        this.loadRecentMessages();
    },

    onScrollToUpper() {
        // 触顶加载更早的历史
        this.loadOlderMessages();
    },

    appendStreamToken(token: string) {
        // 流式追加：只更新最后一条，路径更新避免全量
        const msgs = this.data.visibleMessages;
        const last = msgs[msgs.length - 1];
        this.setData({
            [`visibleMessages[${msgs.length - 1}].content`]: last.content + token,
        });
    },
});
```

#### 难点 5：流式输出时的频繁 setData

**原因**：AI 流式输出每个 token 都触发一次 setData，1 秒几十次，低端机直接卡死。

```typescript
// ❌ 错误：每收到一个 token 就 setData
ws.onMessage((res) => {
    this.setData({
        [`messages[${lastIdx}].content`]: current + res.data,
    });
});

// ✅ 方案：缓冲 + 合并 + requestAnimationFrame 节流
class StreamBuffer {
    private buffer = '';
    private flushScheduled = false;

    append(token: string) {
        this.buffer += token;
        if (!this.flushScheduled) {
            this.flushScheduled = true;
            // 用 nextTick / setTimeout 合并同一帧内的多次更新
            setTimeout(() => this.flush(), 50);  // 50ms 合并一次，肉眼无感
        }
    }

    private flush() {
        this.flushScheduled = false;
        if (!this.buffer) return;
        const chunk = this.buffer;
        this.buffer = '';
        // 一次 setData 更新多个 token
        this.setData({
            [`messages[${lastIdx}].content`]: currentContent + chunk,
        });
    }
}
```

**性能权衡**：
- 合并间隔 50ms：流畅度好，但打字机效果略钝
- 合并间隔 16ms（一帧）：最流畅，但 setData 压力大
- 实测低端机建议 80-100ms

#### 难点 6：多轮对话上下文管理

**原因**：AI 多轮对话需要把历史消息传给大模型，但：
- 历史太长 → token 超限 + 成本高
- 历史太短 → AI 忘了上文
- 上下文谁来维护：前端传 or 后端按 sessionId 维护

```typescript
// 方案 A（推荐）：后端按 sessionId 维护上下文
// 前端只传 sessionId + 当前问题
ws.send({
    data: JSON.stringify({
        type: 'ask',
        sessionId: 'user_xxx_session',
        content: currentQuestion,
        // 不需要传历史，后端自己查
    }),
});

// 方案 B：前端传历史（适合无状态后端）
// 必须做截断：保留最近 N 轮 + 系统提示词
function buildContext(messages: Message[]) {
    const systemPrompt = { role: 'system', content: '你是客服助手...' };
    // 保留最近 6 轮（12 条消息）
    const recent = messages.slice(-12);
    // 计算 token 数，超限继续截断
    return [systemPrompt, ...recent].slice(-MAX_TOKENS);
}
```

#### 难点 7：会话切换/切后台的状态保持

**原因**：用户切到别的页面再回来、或锁屏后再打开，期望看到完整的历史和未读消息。

```typescript
// 1. 消息持久化到 Storage（每条消息存）
function persistMessages(sessionId: string, messages: Message[]) {
    // 只存最近的，太老的归档到后端
    const recent = messages.slice(-200);
    Taro.setStorageSync(`chat_${sessionId}`, JSON.stringify(recent));
}

// 2. 页面 onLoad 时先从 Storage 恢复（秒开），再拉最新
async onLoad(options) {
    const sessionId = options.sessionId;
    // 立即渲染缓存（无白屏）
    const cached = Taro.getStorageSync(`chat_${sessionId}`);
    if (cached) {
        this.setData({ messages: JSON.parse(cached) });
    }
    // 拉增量消息（lastMessageId 之后）
    const incremental = await api.fetchMessages(sessionId, this.lastMessageId);
    this.appendMessages(incremental);
}

// 3. 切后台后再回前台：检查未读
Taro.onAppShow(() => {
    this.checkUnreadAndReconnect();
});
```

#### 难点 8：未读消息提示与角标

```typescript
// tabBar 角标
Taro.setTabBarBadge({ index: 2, text: String(unreadCount) });

// 全局未读：所有页面都要同步
// 用全局状态（Zustand）+ Storage 持久化
// 收到新消息时更新角标 + 震动反馈
ws.onMessage((res) => {
    const msg = JSON.parse(res.data);
    if (msg.type === 'new_message' && !isOnChatPage) {
        updateGlobalUnread(1);
        Taro.vibrateShort();
        Taro.setTabBarBadge({ index: 2, text: String(globalUnread) });
    }
});
```

#### 难点 9：富文本/图片/语音消息渲染

**原因**：AI 可能返回 Markdown、图片卡片、推荐问题卡片等富文本，小程序的 `rich-text` 组件能力有限，且不支持事件绑定。

```typescript
// 方案：用第三方 Markdown 渲染库（towxml / wemark / mp-html）
// mp-html 最常用，支持 HTML + Markdown + 图片预览 + 链接点击

// 安装
// npm install mp-html

// 使用
import mpHtml from 'mp-html';
<mp-html content="{{markdownContent}}" @linktap="onLinkTap" />

// 自定义卡片消息：用条件渲染
<view wx:for="{{messages}}" wx:for-item="msg">
    <view wx:if="{{msg.type === 'text'}}">{{msg.content}}</view>
    <mp-html wx:elif="{{msg.type === 'markdown'}}" content="{{msg.content}}" />
    <ProductCard wx:elif="{{msg.type === 'product'}}" data="{{msg.data}}" />
    <Image wx:elif="{{msg.type === 'image'}}" src="{{msg.url}}" mode="widthFix" />
</view>
```

**避坑**：
- `rich-text` 的 `nodes` 不支持事件，要做交互必须用第三方库或自定义组件
- 图片消息要做懒加载 + 占位 + 点击预览（`wx.previewImage`）
- 语音消息用 `InnerAudioContext`，注意 iOS 静音模式下无声

#### 难点 10：敏感词过滤与合规

**原因**：用户输入和 AI 输出都要过敏感词，否则审核被拒 + 违规下架。

```typescript
// 1. 用户输入：发问前先检测
async function onSend() {
    const content = this.data.inputValue;
    // 前端预检（关键词黑名单，快但漏报）
    if (containsBlacklist(content)) {
        return Taro.showToast({ title: '输入包含违规内容', icon: 'none' });
    }
    // 后端二次检测（必做，调微信 security.msgSecCheck）
    const safe = await api.checkContent(content);
    if (!safe) return;

    // 发送给 AI
    chatSocket.send(content);
}

// 2. AI 输出：流式输出时也要拦截
// 后端在推送 token 前过一遍敏感词，前端再做兜底过滤
function filterOutput(text: string): string {
    return text.replace(BLACKLIST_REGEX, '**');
}
```

#### 难点 11：转人工衔接

```typescript
// 典型流程：AI 先答 → 检测到"转人工"意图 → 排队 → 接入人工客服 → 历史同步给客服
async function handleIntent(intent: string) {
    if (intent === 'transfer_human') {
        // 1. 提示排队
        Taro.showLoading({ title: '正在为您转接...' });
        // 2. 加入排队队列
        const queueInfo = await api.joinQueue({ sessionId });
        Taro.hideLoading();

        if (queueInfo.position > 0) {
            Taro.showToast({
                title: `前面还有 ${queueInfo.position} 人`,
                icon: 'none',
                duration: 3000,
            });
        }
        // 3. 切换到人工客服通道（可能换 WS 或换接口）
        chatSocket.switchToHuman(queueInfo.agentId);
    }
}
```

#### 难点 12：消息序号、去重与乱序

**原因**：网络抖动、重连重发、流式与人工消息并存，消息可能重复或乱序。

```typescript
// 每条消息必须有服务端递增的 seq
interface Message {
    seq: number;       // 服务端全局递增
    clientMsgId: string; // 客户端去重 ID
    content: string;
    timestamp: number;
}

// 去重 + 排序
function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
    const map = new Map<string, Message>();
    [...existing, ...incoming]
        .sort((a, b) => a.seq - b.seq)  // 按 seq 排序
        .forEach(m => {
            if (!map.has(m.clientMsgId)) {  // clientMsgId 去重
                map.set(m.clientMsgId, m);
            }
        });
    return Array.from(map.values());
}
```

### 8.12 在线客服实现方案

前面 8.11 讲的是"坑在哪里"，这一节回答"从零怎么搭"。在线客服 = **实时通信 + 会话管理 + 消息存储 + 客服工作台**，下面按完整实现路径拆解。

#### 8.12.1 整体架构

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│  访客小程序  │         │   服务端          │         │  客服工作台  │
│ (Web/小程序)│         │  (Node/Go/Java)   │         │  (Web 端)   │
└──────┬──────┘         └────────┬──────────┘         └──────┬──────┘
       │                         │                            │
       │  1. 建立 WS 连接          │                            │
       ├────────────────────────▶│                            │
       │                         │  2. 客服也建立 WS 连接       │
       │                         │◀───────────────────────────┤
       │                         │                            │
       │  3. 发起会话(进排队)      │                            │
       ├────────────────────────▶│                            │
       │                         │  4. 路由分配给空闲客服        │
       │                         ├───────────────────────────▶│
       │                         │                            │
       │  5. 访客发消息            │                            │
       ├────────────────────────▶│                            │
       │                         │  6. 服务端广播给客服         │
       │                         ├───────────────────────────▶│
       │                         │                            │
       │  8. 服务端转发客服回复     │  7. 客服回复                │
       │◀────────────────────────┤◀───────────────────────────┤
       │                         │                            │
       │                         │  9. 消息持久化到 DB          │
       │                         ├───────▶ 消息表 / 会话表      │
       │                         │                            │
```

**四个核心模块：**

| 模块 | 职责 | 技术选型 |
|------|------|---------|
| **通信层** | 访客 ↔ 服务端 ↔ 客服 的实时双向通道 | WebSocket（主）+ HTTP 降级 |
| **会话管理** | 创建、排队、分配、转接、关闭 | 服务端状态机 |
| **消息存储** | 消息落库、历史查询、离线消息 | MySQL（会话/消息）+ Redis（在线状态/队列） |
| **客服工作台** | 接待、回复、转接、查看历史 | Web 端（React/Vue） |

#### 8.12.2 通信方案选型

| 方案 | 原理 | 实时性 | 小程序兼容 | 适用 |
|------|------|--------|-----------|------|
| **WebSocket** | 全双工长连接 | 最佳 | ✅ `wx.connectSocket` | **首选** |
| **SSE** | 服务端单向流 | 好 | ❌ 小程序不支持 | 仅 Web 端 |
| **长轮询** | 客户端定时拉，服务端 hold 住 | 中 | ✅ | WS 不可用时的降级 |
| **短轮询** | 固定间隔拉取 | 差 | ✅ | 简单场景，不推荐 |

**结论**：小程序在线客服用 **WebSocket**，不可用时降级到长轮询。SSE 在小程序里直接排除。

#### 8.12.3 消息协议设计

协议设计是在线客服的地基，必须统一前后端。每条消息用统一的信封格式：

```typescript
// 消息信封：所有通信都走这个结构
interface WsMessage {
    type: MessageType;       // 消息类型（见下表）
    sessionId: string;       // 会话 ID
    msgId: string;           // 消息唯一 ID（客户端生成，用于 ACK 去重）
    from: string;            // 发送者 ID（访客 openid / 客服 ID）
    fromType: 'visitor' | 'agent' | 'system' | 'bot';
    content: MessageContent; // 消息体（文本/图片/卡片）
    timestamp: number;
    seq?: number;            // 服务端递增序号（用于排序和断线补拉）
    extra?: Record<string, unknown>;
}

type MessageType =
    | 'chat'           // 聊天消息（文本/图片/语音）
    | 'session_start'  // 会话开始
    | 'session_end'    // 会话结束
    | 'queue'          // 排队状态更新
    | 'assign'         // 分配客服
    | 'transfer'       // 转接
    | 'typing'         // 正在输入
    | 'read'           // 已读回执
    | 'ack'            // 消息确认
    | 'history'        // 历史消息补拉
    | 'ping' | 'pong'; // 心跳

// 消息内容
interface MessageContent {
    contentType: 'text' | 'image' | 'voice' | 'file' | 'card' | 'rich';
    text?: string;
    url?: string;       // 图片/语音/文件 URL
    duration?: number;  // 语音时长
    card?: { title: string; desc: string; action: string }; // 卡片
}
```

**设计要点：**
- `msgId` 客户端生成（`时间戳_随机数`），服务端据此去重（网络重发不会重复入库）
- `seq` 服务端递增，客户端断线后用「最后一个 seq」向服务端补拉遗漏消息
- `fromType` 区分访客/客服/系统/AI，前端据此决定气泡颜色和位置

#### 8.12.4 前端实现（小程序访客端）

##### 1) 连接管理器

```typescript
// services/chat-socket.ts
import Taro from '@tarojs/taro';

const WS_URL = 'wss://api.example.com/chat/ws';

class ChatSocket {
    private socket: Taro.SocketTask | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectAttempts = 0;
    private lastSeq = 0;                    // 最后收到的服务端 seq
    private pendingAcks = new Set<string>(); // 等待 ACK 的 msgId
    private listeners: Record<string, Function[]> = {};

    connect(openid: string) {
        this.socket = Taro.connectSocket({
            url: `${WS_URL}?openid=${openid}&client=visitor`,
        });
        this.socket.onOpen(() => {
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.refetchMissed();   // 断线期间的遗漏消息
            this.emit('connected');
        });
        this.socket.onMessage((res) => this.handleMessage(res.data));
        this.socket.onClose(() => this.reconnect(openid));
        this.socket.onError(() => this.reconnect(openid));
    }

    // 统一消息分发
    private handleMessage(raw: string) {
        const msg: WsMessage = JSON.parse(raw);
        switch (msg.type) {
            case 'pong': return;                    // 心跳响应
            case 'ack':                             // 服务端确认收到我的消息
                this.pendingAcks.delete(msg.msgId);
                return;
            case 'chat':
            case 'session_start':
            case 'session_end':
            case 'queue':
            case 'assign':
            case 'transfer':
                this.lastSeq = Math.max(this.lastSeq, msg.seq ?? 0);
                this.emit(msg.type, msg);          // 分发给页面
                this.sendAck(msg.msgId);           // 告诉服务端我收到了
                return;
            case 'history':
                this.emit('history', msg);
                return;
        }
    }

    // 发送聊天消息
    sendChat(sessionId: string, content: MessageContent) {
        const msgId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const msg: WsMessage = {
            type: 'chat', sessionId, msgId,
            from: this.openid, fromType: 'visitor',
            content, timestamp: Date.now(),
        };
        this.pendingAcks.add(msgId);               // 加入待确认队列
        this.socket?.send({ data: JSON.stringify(msg) });

        // 超时未收到 ACK，重发
        setTimeout(() => {
            if (this.pendingAcks.has(msgId)) {
                this.socket?.send({ data: JSON.stringify(msg) });
            }
        }, 3000);
        return msg;   // 立即返回，前端乐观渲染
    }

    private sendAck(msgId: string) {
        this.socket?.send({ data: JSON.stringify({ type: 'ack', msgId }) });
    }

    private startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.socket?.send({ data: JSON.stringify({ type: 'ping' }) });
        }, 30000);
    }

    // 断线补拉：lastSeq 之后的所有消息
    private async refetchMissed() {
        if (this.lastSeq === 0) return;
        const missed = await api.fetchMessagesSince(this.sessionId, this.lastSeq);
        missed.forEach(m => this.emit(m.type, m));
    }

    private reconnect(openid: string) {
        if (this.reconnectAttempts >= 5) {
            this.emit('disconnect');
            return;
        }
        this.reconnectAttempts++;
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
        setTimeout(() => this.connect(openid), delay);
    }

    // 事件订阅
    on(event: string, cb: Function) {
        (this.listeners[event] ||= []).push(cb);
    }
    private emit(event: string, data?: unknown) {
        (this.listeners[event] || []).forEach(cb => cb(data));
    }
}

export const chatSocket = new ChatSocket();
```

##### 2) 聊天页面

```typescript
// pages/chat/index.tsx
import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Input, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { chatSocket } from '@/services/chat-socket';
import { api } from '@/services/api';

interface Message { msgId: string; fromType: string; content: MessageContent; status?: 'sending' | 'sent' | 'failed'; }

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [queueInfo, setQueueInfo] = useState<{ position: number } | null>(null);
    const [agent, setAgent] = useState<{ name: string; avatar: string } | null>(null);
    const [keyboardH, setKeyboardH] = useState(0);
    const openid = Taro.getStorageSync('openid');

    useEffect(() => {
        // 1. 建立连接
        chatSocket.connect(openid);

        // 2. 订阅各类事件
        chatSocket.on('queue', (msg) => setQueueInfo(msg.extra));        // 排队中
        chatSocket.on('assign', (msg) => {                               // 分配到客服
            setQueueInfo(null);
            setAgent(msg.extra);
            setSessionId(msg.sessionId);
        });
        chatSocket.on('chat', (msg) => {                                 // 收到消息
            setMessages(prev => [...prev, { ...msg, status: 'sent' }]);
            scrollToBottom();
        });
        chatSocket.on('session_end', () => setAgent(null));              // 会话结束

        // 3. 发起会话（进排队）
        api.startSession({ openid, source: 'product_page_123' });

        // 4. 恢复历史
        loadHistory();
    }, []);

    const loadHistory = async () => {
        const history = await api.getHistory(sessionId);
        setMessages(history);
    };

    // 发送消息：乐观更新
    const handleSend = () => {
        if (!input.trim()) return;
        const msg = chatSocket.sendChat(sessionId, { contentType: 'text', text: input });
        setMessages(prev => [...prev, { ...msg, status: 'sending' }]);
        setInput('');
        scrollToBottom();
    };

    const scrollToBottom = () => {
        // scroll-into-view 通过 ID 跳转
        setScrollAnchor(messages[messages.length - 1]?.msgId);
    };

    return (
        <View style={{ paddingBottom: `${keyboardH + 60}px` }}>
            {/* 顶部：客服信息 */}
            {agent && <View className="agent-bar">{agent.name} 为您服务</View>}
            {queueInfo && <View className="queue-tip">前面还有 {queueInfo.position} 人</View>}

            {/* 消息列表 */}
            <ScrollView
                scrollY
                scrollIntoView={scrollAnchor}
                style={{ height: `calc(100vh - ${keyboardH + 60}px)` }}
                onScrollToUpper={loadHistory}   // 触顶加载更早历史
                upperThreshold={50}
            >
                {messages.map(m => (
                    <View key={m.msgId} id={m.msgId} className={`bubble ${m.fromType}`}>
                        {m.content.contentType === 'text' && <Text>{m.content.text}</Text>}
                        {m.content.contentType === 'image' && <Image src={m.content.url} />}
                        {m.status === 'failed' && <Text className="failed">发送失败</Text>}
                    </View>
                ))}
            </ScrollView>

            {/* 输入栏：跟随键盘上推 */}
            <View className="input-bar" style={{ bottom: `${keyboardH}px` }}>
                <Input
                    value={input}
                    onInput={e => setInput(e.detail.value)}
                    adjustPosition={false}
                    onFocus={() => Taro.onKeyboardHeightChange(r => setKeyboardH(r.height))}
                    onBlur={() => setKeyboardH(0)}
                />
                <Button onClick={handleSend}>发送</Button>
            </View>
        </View>
    );
}
```

#### 8.12.5 后端实现要点

后端是在线客服的"大脑"，关键职责和实现思路：

##### 1) 连接管理 + 在线状态

```typescript
// 服务端（Node.js + ws 库示例）
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

// 在线连接池：openid → connection
const onlineVisitors = new Map<string, WebSocket>();
// 在线客服：agentId → { connection, serving: 会话数 }
const onlineAgents = new Map<string, { ws: WebSocket; serving: number; maxServing: number }>();

wss.on('connection', (ws, req) => {
    const { openid, role } = parseQuery(req.url);
    if (role === 'visitor') {
        onlineVisitors.set(openid, ws);
    } else if (role === 'agent') {
        onlineAgents.set(openid, { ws, serving: 0, maxServing: 5 });
    }

    ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        handleMessage(msg, ws);
    });

    ws.on('close', () => {
        onlineVisitors.delete(openid);
        onlineAgents.delete(openid);
    });
});
```

##### 2) 会话路由（分配客服）

**三种路由策略对比：**

| 策略 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| **轮询** | 按顺序依次分给在线客服 | 公平 | 不考虑客服负载 |
| **最少会话** | 分给当前接待数最少的客服 | 负载均衡 | 新客服永远先被塞满 |
| **技能组** | 按客服技能（售后/售前）匹配 | 专业对口 | 需要维护技能标签 |

```typescript
// 推荐：技能组 + 最少会话
async function routeSession(sessionId: string, skillGroup: string) {
    // 1. 筛选：同技能组 + 在线 + 未满负载
    const candidates = [...onlineAgents.values()].filter(
        a => a.skills?.includes(skillGroup) && a.serving < a.maxServing
    );

    if (candidates.length === 0) {
        // 无空闲客服 → 进排队
        await enqueue(sessionId, skillGroup);
        return { status: 'queued' };
    }

    // 2. 选接待数最少的
    candidates.sort((a, b) => a.serving - b.serving);
    const agent = candidates[0];

    // 3. 建立会话
    agent.serving++;
    await db.session.update(sessionId, { agentId: agent.id, status: 'serving' });

    // 4. 通知双方
    sendToVisitor(sessionId, { type: 'assign', extra: { name: agent.name, avatar: agent.avatar } });
    sendToAgent(agent.id, { type: 'session_start', sessionId, visitorInfo });

    return { status: 'assigned', agentId: agent.id };
}
```

##### 3) 排队队列

```typescript
// Redis 实现排队（有序集合，score = 进入时间戳）
async function enqueue(sessionId: string, skillGroup: string) {
    await redis.zadd(`queue:${skillGroup}`, Date.now(), sessionId);
    const position = await redis.zrank(`queue:${skillGroup}`, sessionId);
    // 通知访客排队位置
    sendToVisitor(sessionId, { type: 'queue', extra: { position } });
}

// 客服结束一个会话后，从队列拉下一个
async function dequeue(skillGroup: string) {
    const [sessionId] = await redis.zpopmin(`queue:${skillGroup}`);
    if (sessionId) {
        await routeSession(sessionId, skillGroup);
        // 队列里所有人的位置都变了，重新通知
        await notifyQueuePositions(skillGroup);
    }
}
```

##### 4) 消息分发与持久化

```typescript
async function handleMessage(msg: WsMessage, ws: WebSocket) {
    switch (msg.type) {
        case 'ping':
            return ws.send(JSON.stringify({ type: 'pong' }));

        case 'ack':
            return;   // 客户端确认收到，可选标记已送达

        case 'chat': {
            // 1. 分配 seq（全局递增，用 Redis incr）
            msg.seq = await redis.incr('global_msg_seq');

            // 2. 落库
            await db.message.create({
                id: msg.msgId,
                sessionId: msg.sessionId,
                fromId: msg.from,
                fromType: msg.fromType,
                contentType: msg.content.contentType,
                content: JSON.stringify(msg.content),
                seq: msg.seq,
                createdAt: new Date(msg.timestamp),
            });

            // 3. 给发送方 ACK
            ws.send(JSON.stringify({ type: 'ack', msgId: msg.msgId }));

            // 4. 转发给接收方（访客发的 → 转给客服；客服发的 → 转给访客）
            const target = msg.fromType === 'visitor'
                ? (await db.session.findById(msg.sessionId)).agentId
                : (await db.session.findById(msg.sessionId)).visitorId;
            sendToUser(target, msg);
            return;
        }

        case 'history': {
            // 客户端补拉 lastSeq 之后的消息
            const missed = await db.message.find({
                sessionId: msg.sessionId,
                seq: { $gt: msg.extra.lastSeq },
            });
            ws.send(JSON.stringify({ type: 'history', sessionId: msg.sessionId, extra: { messages: missed } }));
            return;
        }
    }
}
```

##### 5) 离线消息

```typescript
// 访客不在线时，客服回复的消息要存下来，访客下次进入时拉取
async function sendToUser(userId: string, msg: WsMessage) {
    const conn = onlineVisitors.get(userId) ?? onlineAgents.get(userId)?.ws;
    if (conn?.readyState === WebSocket.OPEN) {
        conn.send(JSON.stringify(msg));
    } else {
        // 离线：标记为未送达，等用户上线补拉
        await db.message.update(msg.msgId, { delivered: false });
    }
}
```

#### 8.12.6 会话状态机

```
                  访客发起
                      │
                      ▼
                 ┌─────────┐  无空闲客服   ┌─────────┐
                 │ created │ ───────────▶ │ queued  │
                 └────┬────┘               └────┬────┘
                      │ 有空闲客服               │ 有客服空出
                      ▼                         │
                 ┌─────────┐ ◀─────────────────┘
                 │ serving │
                 └────┬────┘
                      │
        ┌─────────────┼─────────────┐
        │ 转接         │ 访客/客服关闭 │ 超时
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ transfer│   │  ended  │   │ timeout │
   └────┬────┘   └─────────┘   └─────────┘
        │ 重新分配
        └─▶ serving
```

#### 8.12.7 客服工作台核心功能

客服端是 Web 端（React/Vue），核心功能：

| 功能 | 实现要点 |
|------|---------|
| **会话列表** | 左侧列表展示正在接待的会话，未读高亮 |
| **多会话切换** | 一个客服同时接 3-5 个会话，切换时保留草稿 |
| **消息区** | 和访客端一致，气泡区分方向 |
| **快捷回复** | 预置话术库，点击插入 |
| **转接** | 选择其他客服/技能组转出 |
| **历史查看** | 调接口查该访客的历史会话 |
| **访客信息** | 右侧展示来源页面、设备、浏览轨迹 |
| **协同** | 邀请其他客服一起接入（多人会话） |

#### 8.12.8 完整实现的最小步骤清单

从零搭一个 MVP，按顺序：

```
1. 搭 WS 服务（Node + ws 库 / Socket.io）
2. 设计消息协议（参考 8.12.3）
3. 访客端：连接 → 发起会话 → 收发消息 → UI 渲染
4. 服务端：连接池 → 会话路由（先做轮询）→ 消息分发 → 落库
5. 客服端：工作台 → 接收会话 → 回复
6. 加排队队列（Redis zset）
7. 加心跳 + 重连 + 断线补拉
8. 加离线消息存储
9. 加已读回执 / 正在输入
10. 加转接 / 快捷回复 / 历史查询
11. 接入 AI 兜底（无人接待时 AI 先答，见 8.11）
12. 加监控（消息延迟、连接数、客服负载）
```

#### 8.12.9 优缺点与适配场景

**优点：**
- 实时双向，体验接近原生 IM
- 可承载图文、语音、卡片等富消息
- 客服可并发处理多会话，效率高于电话

**缺点：**
- 长连接维护复杂（断连、重连、心跳、状态同步）
- 小程序切后台 WS 被挂起，需补拉机制
- 消息一致性（去重、排序、已送达）实现成本高
- 客服资源调度（排队、负载均衡）需要单独设计

**适配场景：**
- 电商咨询、售后、售前导购
- SaaS 产品内嵌支持
- 金融/政务在线咨询
- 医疗在线问诊（需加图文/语音）

**局限性：**
- 小程序 WS 连接数受系统限制（一般够用，但要监控）
- 小程序后台运行 WS 会被挂起，**不能做客服主动推送**（除非走订阅消息）
- 音视频客服在小程序里受 `live-pusher/live-player` 组件限制，体验不如原生 App

### 8.13 快捷入口与"猜你所想"实现

这两个功能决定了客服的"第一印象"：用户进入对话窗口，能不能在 3 秒内找到自己想问的。本质都是**降低用户表达成本**，但实现路径差异很大。

#### 8.13.1 两个功能的定位差异

| 维度 | 快捷入口 | 猜你所想 |
|------|---------|---------|
| **触发时机** | 进入客服页就固定展示 | 进入页 / 用户输入时 / AI 回答后 |
| **数据来源** | 运营预置 + 页面上下文 | FAQ 库 + 用户行为 + AI 推理 |
| **个性化程度** | 弱（按页面分组） | 强（按用户上下文） |
| **技术复杂度** | 低（配置 + 渲染） | 中高（召回 + 排序 + 向量） |
| **目标** | 让用户"少打字、快定位" | 让用户"被理解、问到点上" |

#### 8.13.2 快捷入口实现

##### 1) 三种类型

```
类型一：全局固定入口（每个客服页都有）
  [查物流] [退款] [开发票] [转人工]

类型二：上下文入口（按来源页面动态切换）
  商品详情页进来 → [尺码咨询] [发货时间] [正品保障]
  订单页进来     → [催发货] [改地址] [申请退款]
  售后页进来     → [进度查询] [补充凭证] [投诉]

类型三：会话中入口（对话进行中持续展示在输入框上方）
  [常见问题] [快捷回复] [上传图片] [转人工]
```

##### 2) 数据结构

```typescript
// 快捷入口配置（后端运营后台维护，下发到前端）
interface QuickAction {
    id: string;
    text: string;                  // 按钮文案
    icon?: string;                 // 图标 URL
    action: QuickActionAction;     // 点击行为
    sort: number;                  // 展示顺序
    sourcePattern?: string;        // 来源页面匹配（上下文入口用）
    skillGroup?: string;           // 关联技能组（转人工时用）
    visible?: boolean;             // 上下线开关
}

type QuickActionAction =
    | { type: 'send'; text: string }                        // 直接发一条消息给客服/AI
    | { type: 'navigate'; url: string }                     // 跳转小程序页面
    | { type: 'webview'; url: string }                      // 打开 H5
    | { type: 'trigger_flow'; flowId: string }              // 触发业务流程（如退款流程）
    | { type: 'transfer_human'; skillGroup?: string }       // 直接转人工
    | { type: 'show_faq'; category: string };               // 展开某类 FAQ
```

##### 3) 后端配置与下发

运营在 CMS 配置不同场景的入口组合，前端按来源拉取：

```typescript
// GET /api/chat/quick-actions?source=product_detail&productId=xxx
{
    code: 0,
    data: {
        global: [                          // 全局固定入口
            { id: 'q1', text: '查物流', action: { type: 'send', text: '我要查物流' }, sort: 1 },
            { id: 'q2', text: '转人工', action: { type: 'transfer_human' }, sort: 99 },
        ],
        context: [                         // 当前页面专属入口
            { id: 'c1', text: '尺码咨询', action: { type: 'send', text: '这件衣服我穿多大码？' }, sort: 1 },
            { id: 'c2', text: '发货时间', action: { type: 'send', text: '什么时候发货？' }, sort: 2 },
        ],
    }
}
```

**关键设计**：
- 入口配置走运营后台，**不发版就能改**
- `sourcePattern` 支持通配（`product_*`、`order_*`）
- 高频入口要监控点击率（埋点），低 CTR 的下线

##### 4) 前端实现

```typescript
// pages/chat/index.tsx
const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
const [input, setInput] = useState('');

useEffect(() => {
    // 拉取本场景的快捷入口
    loadQuickActions();
}, []);

const loadQuickActions = async () => {
    const res = await api.getQuickActions({
        source: router.params.source,         // 进入客服页的来源
        productId: router.params.productId,   // 关联商品
    });
    setQuickActions([...res.global, ...res.context].sort((a, b) => a.sort - b.sort));
};

// 点击快捷入口
const handleQuickAction = (action: QuickAction) => {
    switch (action.action.type) {
        case 'send':
            // 直接走发送流程（复用 8.12.4 的 sendChat）
            setInput(action.action.text);
            handleSend();
            break;
        case 'navigate':
            Taro.navigateTo({ url: action.action.url });
            break;
        case 'webview':
            Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(action.action.url)}` });
            break;
        case 'transfer_human':
            api.transferToHuman({ sessionId, skillGroup: action.action.skillGroup });
            break;
        case 'trigger_flow':
            Taro.navigateTo({ url: `/pages/flow/index?id=${action.action.flowId}` });
            break;
        case 'show_faq':
            setFaqCategory(action.action.category);
            break;
    }
};

return (
    <View>
        {/* 快捷入口区：横向滚动 */}
        <ScrollView scrollX className="quick-bar">
            {quickActions.map(a => (
                <View key={a.id} className="quick-chip" onClick={() => handleQuickAction(a)}>
                    {a.icon && <Image src={a.icon} className="quick-icon" />}
                    <Text>{a.text}</Text>
                </View>
            ))}
        </ScrollView>

        {/* FAQ 弹层（show_faq 触发） */}
        {faqCategory && <FaqDrawer category={faqCategory} onClose={() => setFaqCategory(null)} />}
    </View>
);
```

```scss
/* 快捷入口样式 */
.quick-bar {
    white-space: nowrap;
    padding: 16rpx;
    background: #f7f8fa;
}
.quick-chip {
    display: inline-block;
    padding: 12rpx 24rpx;
    margin-right: 16rpx;
    background: #fff;
    border-radius: 32rpx;
    font-size: 26rpx;
    color: #333;
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.04);
}
```

#### 8.13.3 "猜你所想"实现

这是更智能的功能：根据上下文**主动推荐**用户可能想问的问题。核心是**召回 → 排序 → 展示**三步。

##### 1) 四种推荐策略对比

| 策略 | 原理 | 准确率 | 成本 | 适用 |
|------|------|--------|------|------|
| **规则匹配** | 来源页面 → 预设 FAQ 分组 | 中 | 极低 | 入门方案 |
| **关键词召回** | 用户已输入文字 → 模糊匹配 FAQ 标题 | 中高 | 低 | 输入联想 |
| **向量召回** | 用户上下文 embedding → 与 FAQ embedding 算相似度 | 高 | 中高（需向量化） | 通用推荐 |
| **AI 生成** | 大模型基于上下文生成候选问题 | 最高 | 高（每次调 LLM） | 高端方案 |

**实际项目推荐组合**：规则兜底 + 向量召回为主 + 热度排序，AI 生成作为可选增强。

##### 2) FAQ 知识库结构

```typescript
interface FAQ {
    id: string;
    question: string;              // 标准问题（"怎么退款？"）
    answer: string;                // 标准答案
    aliases: string[];             // 别名/问法变体（"如何退货"、"申请退款"）
    category: string;              // 分类（售后/物流/账户）
    sourcePatterns: string[];      // 适用来源（order_*、product_*）
    embedding?: number[];          // 向量化结果（维度由模型定，如 1536）
    hotScore: number;              // 热度（点击量加权）
    enabled: boolean;
}
```

**向量化时机**：FAQ 录入/修改时，调 embedding 接口把 `question + aliases` 转成向量，存到向量库（如 Milvus / PostgreSQL pgvector / Redis）。

##### 3) 推荐时机与流程

```
时机一：进入客服页（冷启动推荐）
  上下文 = 来源页面 + 商品信息 + 用户标签
       ↓
  规则召回（source 匹配） + 向量召回（上下文 embedding 相似）
       ↓
  合并去重 → 热度排序 → 取 Top 5
       ↓
  展示在对话区顶部："猜你想问"

时机二：用户输入时（实时联想）
  上下文 = 输入框文字
       ↓
  关键词召回（标题模糊匹配） + 向量召回（输入 embedding 相似）
       ↓
  取 Top 5 展示为下拉联想

时机三：AI 回答后（追问推荐）
  上下文 = 当前对话主题
       ↓
  大模型生成 3 个相关追问（或向量召回相关 FAQ）
       ↓
  展示在 AI 回答下方："您可能还想问"
```

##### 4) 完整实现：进入页推荐

```typescript
// 前端：进入客服页请求推荐
async function loadGuessYouLike() {
    const context = {
        source: router.params.source,           // 来源页面
        productId: router.params.productId,     // 当前商品
        orderId: router.params.orderId,         // 当前订单
        recentCategories: getUserRecentCats(),   // 用户近期关注分类
    };
    const res = await api.guessQuestions(context);
    setGuessList(res.questions);  // [{ id, question }, ...]
}

// UI：展示在对话区顶部
{guessList.length > 0 && (
    <View className="guess-section">
        <Text className="guess-title">猜你想问</Text>
        <View className="guess-list">
            {guessList.map(q => (
                <View key={q.id} className="guess-item" onClick={() => askFaq(q)}>
                    <Text>{q.question}</Text>
                </View>
            ))}
        </View>
    </View>
)}
```

##### 5) 后端：召回 + 排序

```typescript
// POST /api/chat/guess-questions
async function guessQuestions(ctx) {
    const { source, productId, orderId, recentCategories } = ctx.request.body;
    const candidates = new Map<string, { faq: FAQ; score: number }>();

    // 通道一：规则召回（来源页面匹配，召回率高）
    const ruleHits = await db.faq.find({
        sourcePatterns: { $contains: source },
        enabled: true,
    }).limit(20);
    ruleHits.forEach(f => {
        candidates.set(f.id, { faq: f, score: 0.6 });  // 规则召回基础分
    });

    // 通道二：向量召回（语义相似，泛化好）
    const contextText = await buildContextText({ source, productId, orderId });
    // 例如：来源"商品详情页" + 商品"iPhone 15 手机壳" → "iPhone 15 手机壳 商品详情页"
    const contextVec = await embeddingApi.embed(contextText);
    const vectorHits = await vectorDb.search(contextVec, { topK: 20 });
    vectorHits.forEach(v => {
        const existing = candidates.get(v.id);
        // 向量相似度（cosine，0~1）加权
        const score = v.score * 0.8;
        if (existing) existing.score = Math.max(existing.score, score);
        else candidates.set(v.id, { faq: v.faq, score });
    });

    // 通道三：用户历史偏好加权
    if (recentCategories?.length) {
        candidates.forEach(c => {
            if (recentCategories.includes(c.faq.category)) c.score += 0.1;
        });
    }

    // 排序：综合分 + 热度
    const ranked = [...candidates.values()]
        .map(c => ({
            ...c,
            finalScore: c.score * 0.7 + normalize(c.faq.hotScore) * 0.3,
        }))
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, 5);

    return ranked.map(r => ({ id: r.faq.id, question: r.faq.question }));
}
```

##### 6) 输入联想（实时推荐）

```typescript
// 防抖 + 向量召回
const [suggestList, setSuggestList] = useState<FAQ[]>([]);
const debounceRef = useRef<ReturnType<typeof setTimeout>>();

const onInputChange = (e) => {
    const text = e.detail.value;
    setInput(text);
    clearTimeout(debounceRef.current);
    if (!text.trim()) { setSuggestList([]); return; }

    debounceRef.current = setTimeout(async () => {
        // 通道一：关键词模糊匹配（快，本地或后端 LIKE）
        const keywordHits = await api.searchFaqByKeyword(text, { limit: 10 });
        // 通道二：向量召回（准，需调 embedding）
        const vec = await embeddingApi.embed(text);
        const vectorHits = await vectorDb.search(vec, { topK: 10 });

        // 合并去重 + 向量优先
        const merged = dedup([...vectorHits, ...keywordHits]).slice(0, 5);
        setSuggestList(merged);
    }, 250);  // 250ms 防抖
};

// UI：输入框下方联想列表
{suggestList.length > 0 && (
    <View className="suggest-dropdown">
        {suggestList.map(f => (
            <View key={f.id} onClick={() => { setInput(f.question); setSuggestList([]); }}>
                {f.question}
            </View>
        ))}
    </View>
)}
```

**性能要点**：
- 输入联想必须防抖（200-300ms），否则每敲一个字就请求
- embedding 接口有延迟（50-200ms），可对高频 query 做缓存
- 向量库查询要在服务端做，不能把全部 FAQ embedding 下发到小程序

##### 7) AI 追问推荐（增强方案）

```typescript
// AI 回答后，让大模型生成 3 个相关追问
async function generateFollowUps(conversation: Message[]) {
    const prompt = `基于以下对话，生成 3 个用户可能想问的追问，简洁口语化：
    ${conversation.map(m => `${m.fromType}: ${m.content.text}`).join('\n')}

    输出 JSON 数组：["问题1", "问题2", "问题3"]`;

    const result = await llm.complete(prompt);
    return JSON.parse(result);
}

// 展示在 AI 回答下方
{lastReply?.followUps?.length > 0 && (
    <View className="followups">
        <Text className="hint">您可能还想问</Text>
        {lastReply.followUps.map((q, i) => (
            <View key={i} className="followup-chip" onClick={() => sendQuestion(q)}>
                {q}
            </View>
        ))}
    </View>
)}
```

**成本权衡**：每次生成追问要调一次 LLM（约 0.01-0.1 元），高频场景可改为向量召回相关 FAQ，零成本。

##### 8) 数据闭环：点击埋点反哺推荐

```typescript
// 点击猜你想问的问题时埋点
const askFaq = (faq: { id: string; question: string }) => {
    track('guess_question_click', {
        faqId: faq.id,
        source: router.params.source,
        position: guessList.findIndex(g => g.id === faq.id),
        // 用于反哺热度和推荐权重
    });
    api.increaseFaqHotScore(faq.id);
    // 发送给客服/AI
    setInput(faq.question);
    handleSend();
};

// 后端定期（每天）用点击数据重算 hotScore
// CTR 高的 FAQ 排名上升，低的下沉
```

#### 8.13.4 方案选型建议

| 业务阶段 | 推荐方案 |
|---------|---------|
| MVP / 低成本 | 仅规则匹配（来源 → FAQ 分组） |
| 中等规模 | 规则 + 关键词召回 + 热度排序 |
| 大规模 / 高体验 | 规则 + 向量召回 + 热度 + AI 追问 |
| 已有 LLM 接入 | 直接用 AI 生成（最准但最贵） |

#### 8.13.5 优缺点与局限

**优点：**
- 大幅降低用户表达成本，提升首次解决率
- 数据闭环可持续优化推荐质量
- 减少转人工率（用户自助找到答案）

**缺点：**
- 向量方案需维护 embedding 流水线（FAQ 变更要重新向量化）
- 推荐不准会反噬体验（"猜的都不是我想问的"）
- 输入联想的延迟控制难（embedding 调用慢）

**局限：**
- 小程序无法本地做向量计算，全部依赖服务端
- 冷启动阶段（无点击数据）推荐质量差，需人工配置初始热度
- 多语言场景需要多套 embedding 模型

### 8.14 兼容性自检清单

| 检查项 | 方法 |
|-------|------|
| 真机表现 | 至少在 iOS + Android 各一台真机测试 |
| 低端机性能 | 用 Android 中低端机（4GB 内存）测流畅度 |
| 微信版本 | 测试最低支持的微信版本（用 `Taro.canIUse` 守卫） |
| 字体 | 中英文混排检查行高、对齐 |
| 1px 边框 | 检查所有分割线 |
| safe-area | iPhone X 系列测刘海和底部 |
| 键盘 | 输入框、textarea 测键盘遮挡 |
| 滚动 | 长列表、横向滚动、嵌套滚动 |
| 时间格式 | 检查 `new Date` 调用 |
| 原生组件 | 检查 video/map 上的弹窗层级 |
| 域名配置 | request/socket/upload/download 域名都在后台已配 |
| 并发请求 | 检查列表页/批量场景是否超过 10 个并发 |
| HTTPS 证书 | 证书未过期、链完整、域名匹配 |
| 超时处理 | 所有请求都有 timeout + 错误提示 |
| token 刷新 | 401 并发场景下只刷新一次 |
| 上传文件 | 不要手动设置 Content-Type |
| WebSocket | 有断连重连 + 心跳 |
| 埋点 | 不阻塞业务请求 |
| AI 流式输出 | 用 WebSocket 实现流式，不能用 wx.request 等 SSE |
| 键盘遮挡 | 聊天页输入框随键盘上推 + 列表自动滚底 |
| 长会话性能 | 虚拟列表 + 分页 + 流式 setData 合并（50-80ms） |
| WS 断连重连 | 心跳保活 + 指数退避 + 切前台重连 + 消息补拉 |
| 消息去重 | clientMsgId 幂等 + seq 排序 |
| 未读角标 | tabBar 角标 + 震动反馈 |
| 敏感词 | 用户输入 + AI 输出双端过滤 |

---

## 九、组件库选型

| 组件库 | 框架适配 | 特点 | 适用场景 |
|--------|---------|------|---------|
| **Taroify** | Taro (React) | 仿 Vant 设计，组件丰富 | Taro React 项目 |
| **NutUI** | Taro (React/Vue) | 京东出品，跨端支持好 | Taro 项目 |
| **Taro UI** | Taro (Vue) | Taro 官方，稳定 | Taro Vue 项目 |
| **Vant Weapp** | 微信原生 | 有赞出品，最成熟 | 原生微信小程序 |
| **uView** | uni-app | 组件最全 | uni-app 项目 |
| **ThorUI** | uni-app/原生 | 商业+免费版 | 企业级项目 |

---

## 十、优缺点与适用场景总结

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **微信原生开发** | 性能最优、跟进最新特性 | 单平台、语法学习成本 | 只做微信、追求极致性能 |
| **Taro (React)** | React 语法、多端覆盖、京东维护 | 跨端有兼容性坑 | React 团队、多端项目 |
| **Taro (Vue)** | Vue 语法、多端 | 生态不如 React 版 | Vue 团队 |
| **uni-app** | 多端最全、DCloud 生态 | 性能略逊原生 | 多端全覆盖（含 App） |
| **Remax** | React 语法、运行时灵活 | 多端支持不如 Taro | 轻量多端、React 团队 |
| **mpvue** | Vue 语法 | 已停止维护，不推荐 | 遗留项目 |

---

## 十一、局限性

1. **跨端框架的兼容性坑**：Taro/uni-app 编译到不同平台时，部分 CSS/JS API 行为不一致，需要条件编译处理
2. **性能损耗**：跨端框架相比原生有 5%-15% 的性能损耗，对性能要求极高的场景需用原生
3. **平台 API 差异**：即使跨端框架抽象了 API，深层差异（支付/登录/分享）仍需单独处理
4. **调试复杂度**：跨端项目需要分别在多个开发者工具中调试，环境切换繁琐
5. **包体积膨胀**：引入框架运行时会增加包体积，需注意 2MB 限制
6. **新特性滞后**：平台发布新 API 后，跨端框架跟进需要 1-2 个月
7. **审核规则多变**：各平台审核标准不透明且频繁更新，需持续关注
8. **微信生态绑定深**：微信小程序占市场份额最大，但政策变化（如开放数据、隐私合规）影响也最大

---

## 十二、总结

小程序开发的核心是**选对技术栈 + 规避性能陷阱 + 掌握平台规则**：

- **选型**：单平台原生，多端用 Taro（React）或 uni-app（Vue）
- **架构**：统一请求层（含 token 刷新）+ 状态管理（Zustand）+ 分包策略
- **登录**：理解 `wx.login` → code → 后端换 token 的完整流程，处理好授权拒绝
- **性能**：分包预下载、setData 优化、长列表虚拟化、图片压缩懒加载
- **踩坑**：包体积控制、真机调试、页面栈管理、授权引导、支付异常处理、审核合规
- **持续关注**：各平台更新日志、审核规则变化、跨端框架版本升级
