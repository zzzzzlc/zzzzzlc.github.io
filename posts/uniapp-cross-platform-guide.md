---
title: uni-app 多端开发从入门到精通：一套代码到全平台覆盖实战
date: '2025-12-30'
tags:
  - uni-app
  - 跨端
  - Vue
  - 小程序
  - 移动开发
category: 前端工程
summary: >-
  从"同一套业务要发到微信/支付宝/H5/App 多端，难道每个平台写一遍？"的痛点出发，系统讲解 uni-app
  的完整学习路径——环境搭建、项目结构、rpx 样式、页面路由、easycom 组件、Pinia 状态管理、网络封装、条件编译、各端能力调用（登录/支付/分享）、nvue
  原生渲染、性能优化、原生插件、云开发，以及常见踩坑与选型建议。
---

# uni-app 多端开发从入门到精通：一套代码到全平台覆盖实战

## 一、问题来源

移动端开发最让人头疼的，是**同一个业务要跑在太多平台上**：

**多端覆盖的痛点：**

- 微信小程序、支付宝小程序、抖音小程序、百度小程序、快应用……每个平台一套 API、一套开发者工具
- 还要发 H5（活动页、PC 站）、还要发 iOS/Android App
- 全做一遍：iOS（Swift）+ Android（Kotlin）+ H5（React）+ 各家小程序（原生 WXML），四个技术栈、四套代码、四倍人力
- 更痛苦的是：同一个 bug 要在四端各修一遍

**选型困惑：**

- 团队是 Vue 技术栈，Taro 偏 React，能不能用 Vue 写一次编译多端？
- 已经会 Vue 了，能不能直接上手，不用学小程序的 WXML/WXSS？
- 想做 App 又不想学 Swift/Kotlin，有没有"前端写 App"的方案？

**uni-app 解决的核心问题**：**用 Vue 语法写一次代码，编译到 10+ 个平台**（iOS、Android、H5、微信/支付宝/抖音/百度/QQ/快手小程序、快应用）。本文将从零开始，系统讲解从入门到精通的完整路径。

---

## 二、uni-app 是什么

### 2.1 核心理念

uni-app 是 DCloud 出品的跨端框架，核心理念：**「写一次代码，多端运行」**。

```
        你的 Vue 代码（.vue 文件）
              │
              ▼
      ┌───────────────────┐
      │  uni-app 编译器    │
      └───────────────────┘
              │
   ┌──────────┼──────────────────────┐
   ▼          ▼          ▼            ▼
 微信小程序  支付宝小程序   H5    iOS/Android App
   ▼          ▼
 抖音小程序  百度小程序 ...
```

### 2.2 技术特点

| 特点 | 说明 |
|------|------|
| **Vue 语法** | 用 Vue 3 + `<script setup>` 写，不学小程序语法 |
| **编译式** | 编译期转成各端原生代码（非运行时桥接，性能好） |
| **条件编译** | `#ifdef` 处理平台差异 |
| **原生组件** | 内置组件（view/text/image）映射各端原生组件 |
| **API 抽象** | `uni.xxx` 统一 API，编译到各端对应实现 |
| **nvue** | 原生渲染引擎，性能敏感页面用 |

### 2.3 uni-app vs Taro vs 原生

| 维度 | uni-app | Taro | 小程序原生 |
|------|---------|------|-----------|
| **语法** | Vue 3 / Vue 2 | React / Vue | WXML/WXSS/JS |
| **App 端** | 强（nvue + 5+ Runtime） | 弱（靠 RN） | 不支持 |
| **小程序覆盖** | 全平台 | 全平台 | 单平台 |
| **H5** | 支持 | 支持 | - |
| **生态** | DCloud 插件市场最大 | 京东生态 | 平台官方 |
| **性能** | 良好（编译优化） | 良好 | 最优 |
| **学习成本** | 低（会 Vue 即可） | 低（会 React/Vue） | 中 |
| **适合团队** | Vue 团队、要 App | React 团队 | 单平台深度 |

**选型一句话**：Vue 技术栈 + 要覆盖 App + 多小程序 → uni-app；React 技术栈 → Taro。

---

## 三、环境搭建与第一个项目

### 3.1 开发工具

uni-app 官方推荐用 **HBuilderX**（DCloud 自家 IDE，集成度最好），也可用 VS Code。

| 工具 | 优点 | 缺点 |
|------|------|------|
| **HBuilderX** | 官方、内置编译运行、一键发布各端 | 仅 Mac/Win，非开源 |
| **VS Code + CLI** | 通用、插件丰富 | 需手动配命令行运行 |

```bash
# 方式一：HBuilderX（推荐新手）
# 下载 https://www.dcloud.io/hbuilderx.html
# 新建 → 项目 → uni-app → 选模板

# 方式二：CLI（推荐进阶，便于 CI/CD）
npx degit dcloudio/uni-preset-vue#vite-ts my-app
cd my-app
npm install
npm run dev:h5           # 启动 H5
npm run dev:mp-weixin    # 编译微信小程序
```

### 3.2 项目结构（Vue3 + Vite + TS）

```
my-app/
├── src/
│   ├── pages/                  # 页面
│   │   ├── index/
│   │   │   └── index.vue
│   │   ├── list/
│   │   │   └── list.vue
│   │   └── detail/
│   │       └── detail.vue
│   ├── components/             # 组件（easycom 自动引入）
│   │   └── my-card/
│   │       └── my-card.vue
│   ├── store/                  # Pinia
│   │   └── user.ts
│   ├── api/                    # 接口
│   │   ├── request.ts
│   │   └── user.ts
│   ├── utils/
│   ├── static/                 # 静态资源（不参与编译）
│   │   ├── images/
│   │   └── tabbar/
│   ├── App.vue                 # 应用入口
│   ├── main.ts                 # 初始化
│   ├── pages.json              # 页面路由配置（核心！）
│   ├── manifest.json           # 应用配置（AppID、图标等）
│   └── uni.scss                # 全局样式变量
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 3.3 第一个页面

```vue
<!-- src/pages/index/index.vue -->
<template>
    <view class="container">
        <text class="title">{{ title }}</text>
        <button @click="handleClick">点击 {{ count }} 次</button>
        <image :src="logo" mode="aspectFit" />
    </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const title = ref('Hello uni-app');
const count = ref(0);
const logo = ref('/static/logo.png');

const handleClick = () => {
    count.value++;
    uni.vibrateShort();  // 震动反馈
    uni.showToast({ title: `点击了 ${count.value} 次`, icon: 'none' });
};
</script>

<style lang="scss" scoped>
.container {
    padding: 40rpx;
    text-align: center;
}
.title {
    font-size: 36rpx;
    color: #333;
    margin-bottom: 40rpx;
}
</style>
```

### 3.4 运行到各端

```bash
npm run dev:h5              # H5：浏览器自动打开
npm run dev:mp-weixin       # 微信小程序：生成 dist/dev/mp-weixin，用微信开发者工具打开
npm run dev:mp-alipay       # 支付宝小程序
npm run dev:app             # App：需 HBuilderX 真机运行
npm run build:mp-weixin     # 生产构建
```

---

## 四、核心概念

### 4.1 pages.json — 页面路由配置

这是 uni-app 的**核心配置文件**，类似 Next.js 的路由约定但需手动声明：

```json
{
    "pages": [
        { "path": "pages/index/index", "style": { "navigationBarTitleText": "首页" } },
        { "path": "pages/list/list", "style": { "navigationBarTitleText": "列表" } },
        { "path": "pages/detail/detail", "style": { "navigationBarTitleText": "详情" } }
    ],
    "subPackages": [                          // 分包
        {
            "root": "pages/sub",
            "pages": [{ "path": "order/index", "style": {} }]
        }
    ],
    "globalStyle": {
        "navigationBarTextStyle": "black",
        "navigationBarTitleText": "我的应用",
        "navigationBarBackgroundColor": "#FFFFFF",
        "backgroundColor": "#F8F8F8"
    },
    "tabBar": {
        "color": "#999",
        "selectedColor": "#007AFF",
        "list": [
            { "pagePath": "pages/index/index", "text": "首页", "iconPath": "static/tabbar/home.png", "selectedIconPath": "static/tabbar/home-active.png" },
            { "pagePath": "pages/list/list", "text": "列表", "iconPath": "static/tabbar/list.png", "selectedIconPath": "static/tabbar/list-active.png" }
        ]
    },
    "preloadRule": {                           // 分包预下载
        "pages/index/index": {
            "network": "all",
            "packages": ["pages/sub"]
        }
    }
}
```

### 4.2 路由跳转

```typescript
// 保留当前页，跳转到新页（页面栈最多 10 层）
uni.navigateTo({ url: '/pages/detail/detail?id=123' });

// 关闭当前页，跳转
uni.redirectTo({ url: '/pages/detail/detail?id=123' });

// 关闭所有页面，打开新页（适合返回首页）
uni.reLaunch({ url: '/pages/index/index' });

// 切换 tabBar 页
uni.switchTab({ url: '/pages/index/index' });

// 返回上一页
uni.navigateBack({ delta: 1 });
```

```typescript
// 目标页接收参数
import { onLoad } from '@dcloudio/uni-app';

onLoad((options) => {
    console.log(options.id);  // '123'
});
```

### 4.3 生命周期

uni-app 的生命周期分**应用级、页面级、组件级**：

```typescript
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app';
import { onLoad, onShow as onPageShow, onReady, onHide as onPageHide, onUnload, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app';

// === App.vue ===
onLaunch(() => console.log('应用启动（只触发一次）'));
onShow(() => console.log('应用进入前台'));
onHide(() => console.log('应用进入后台'));

// === 页面 ===
onLoad((options) => console.log('页面加载', options));
onPageShow(() => console.log('页面显示'));
onReady(() => console.log('页面初次渲染完成'));
onPageHide(() => console.log('页面隐藏'));
onUnload(() => console.log('页面卸载'));
onReachBottom(() => console.log('触底，加载更多'));
onPullDownRefresh(() => {
    console.log('下拉刷新');
    setTimeout(() => uni.stopPullDownRefresh(), 1000);
});
```

| 生命周期 | 触发时机 | 用途 |
|---------|---------|------|
| `onLoad` | 页面加载（可拿参数） | 初始化数据 |
| `onShow` | 页面显示（每次切回都触发） | 刷新数据 |
| `onReady` | 首次渲染完成 | 操作 DOM（小程序少用） |
| `onHide` | 页面隐藏 | 暂停定时器 |
| `onUnload` | 页面卸载 | 清理资源 |
| `onReachBottom` | 触底 | 分页加载 |
| `onPullDownRefresh` | 下拉刷新 | 拉取最新数据 |

---

## 五、样式与 rpx

### 5.1 rpx 单位（必懂）

uni-app 的核心样式单位是 **rpx**（responsive pixel）：

```
设计稿宽度统一按 750px 计算（无论物理设备多宽）
1rpx = (屏幕宽度 / 750) px

iPhone 6（375pt）：1rpx = 0.5px  → 1px = 2rpx
iPad（768pt）：   1rpx = 1.024px
```

**换算口诀**：设计稿标注多少 px，代码里写 `px × 2` 的 rpx。

```scss
/* 设计稿：宽 375px，标题字号 18px */
.title {
    font-size: 36rpx;  /* 18px × 2 */
    padding: 32rpx 24rpx;  /* 上下 16px，左右 12px */
}
```

### 5.2 内置 SCSS 变量

```scss
/* src/uni.scss — 全局变量，所有 .vue 自动引入 */
$uni-color-primary: #007AFF;
$uni-color-success: #4CD964;
$uni-color-warning: #F5A623;
$uni-color-error: #DD524D;
$uni-text-color: #333;
$uni-font-size-base: 28rpx;
$uni-spacing-row-base: 20rpx;
$uni-border-color: #e5e5e5;
```

```vue
<style lang="scss" scoped>
.card {
    color: $uni-text-color;            /* 直接用全局变量 */
    border: 1rpx solid $uni-border-color;
}
</style>
```

### 5.3 flex 布局（多端通用）

小程序和 App 不支持完整的 Grid，**flex 是最稳的布局方案**：

```scss
/* 经典：上下固定 + 中间滚动 */
.page {
    display: flex;
    flex-direction: column;
    height: 100vh;
}
.header { flex-shrink: 0; }          /* 不压缩 */
.content { flex: 1; overflow-y: auto; }
.footer { flex-shrink: 0; }

/* 经典：左右居中 */
.center {
    display: flex;
    justify-content: center;
    align-items: center;
}
```

### 5.4 样式避坑

```scss
/* 1. image 默认有底部间隙 */
image { display: block; }

/* 2. 文字超出省略 */
.ellipsis {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

/* 3. iOS 安全区域（刘海屏/Home 条） */
.safe-bottom {
    padding-bottom: calc(env(safe-area-inset-bottom) + 20rpx);
    /* App 端用：padding-bottom: constant(safe-area-inset-bottom); 兼容旧版 */
}

/* 4. 1px 细线（rpx 会更细） */
.hairline { border-top: 1rpx solid #eee; }

/* 5. 不要用 * 选择器（小程序不支持） */
/* ❌ * { box-sizing: border-box; } */
/* ✅ */
view, text, image { box-sizing: border-box; }
```

---

## 六、组件系统与 easycom

### 6.1 easycom 自动引入（核心特性）

uni-app 的 easycom 机制：**符合命名规范的组件，无需 import 和注册，直接在模板用**。

```
规范：src/components/组件名/组件名.vue
     src/components/my-card/my-card.vue  → 模板里直接 <my-card />
```

```vue
<!-- src/components/my-card/my-card.vue -->
<template>
    <view class="card">
        <slot />
    </view>
</template>

<!-- 任何页面直接用，无需 import -->
<template>
    <my-card>
        <text>内容</text>
    </my-card>
</template>
```

**easycom 配置（pages.json）：**

```json
{
    "easycom": {
        "autoscan": true,
        "custom": {
            "^uni-(.*)": "@dcloudio/uni-ui/lib/uni-$1/uni-$1.vue",
            "^u-(.*)": "uview-plus/components/u-$1/u-$1.vue"
        }
    }
}
```

这样 `uni-badge`、`u-button` 都能自动引入第三方组件库。

### 6.2 自定义组件

```vue
<!-- src/components/user-avatar/user-avatar.vue -->
<template>
    <view class="avatar" @click="handleClick">
        <image :src="url || defaultAvatar" mode="aspectFill" class="img" />
        <text v-if="showName" class="name">{{ name }}</text>
    </view>
</template>

<script setup lang="ts">
interface Props {
    url?: string;
    name?: string;
    showName?: boolean;
    size?: number;  // rpx
}

const props = withDefaults(defineProps<Props>(), {
    showName: false,
    size: 80,
    name: '',
});

const emit = defineEmits<{
    (e: 'click', data: { name: string }): void;
}>();

const defaultAvatar = '/static/default-avatar.png';

const handleClick = () => {
    emit('click', { name: props.name });
};
</script>

<style lang="scss" scoped>
.avatar {
    display: flex;
    align-items: center;
    .img {
        width: v-bind('size + "rpx"');  /* Vue 3 v-bind CSS */
        height: v-bind('size + "rpx"');
        border-radius: 50%;
    }
}
</style>
```

### 6.3 内置组件（高频）

| 组件 | 用途 | 对应各端 |
|------|------|---------|
| `<view>` | 容器（div） | 各端原生容器 |
| `<text>` | 文本（span） | 各端文本组件 |
| `<image>` | 图片 | 各端 image |
| `<button>` | 按钮（注意默认样式） | 各端 button |
| `<input>` | 输入框 | 各端 input |
| `<scroll-view>` | 滚动容器 | 各端 scroll-view |
| `<swiper>` | 轮播 | 各端 swiper |
| `<picker>` | 选择器 | 各端 picker |
| `<web-view>` | 内嵌网页 | 各端 webview |
| `<rich-text>` | 富文本 | 各端 rich-text |

---

## 七、状态管理（Pinia）

### 7.1 安装与使用

```bash
npm install pinia
```

```typescript
// src/store/user.ts
import { defineStore } from 'pinia';

interface UserInfo {
    openid: string;
    nickname: string;
    avatar: string;
    token: string;
}

export const useUserStore = defineStore('user', {
    state: (): UserInfo & { isLoggedIn: boolean } => ({
        openid: '',
        nickname: '',
        avatar: '',
        token: '',
        isLoggedIn: false,
    }),
    getters: {
        displayName: (state) => state.nickname || '未登录用户',
    },
    actions: {
        setUser(info: Partial<UserInfo>) {
            Object.assign(this, info);
            this.isLoggedIn = true;
            this.persist();
        },
        logout() {
            this.$reset();
            uni.removeStorageSync('user');
        },
        persist() {
            uni.setStorageSync('user', JSON.stringify(this.$state));
        },
        restore() {
            const saved = uni.getStorageSync('user');
            if (saved) Object.assign(this.$state, JSON.parse(saved));
        },
    },
});
```

```typescript
// src/main.ts
import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

export function createApp() {
    const app = createSSRApp(App);
    const pinia = createPinia();
    app.use(pinia);
    return { app, pinia };  // 注意：要返回 pinia
}
```

### 7.2 在组件中使用

```vue
<template>
    <view>
        <text>{{ userStore.displayName }}</text>
        <button @click="handleLogin">登录</button>
    </view>
</template>

<script setup lang="ts">
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

// 启动时恢复
userStore.restore();

const handleLogin = async () => {
    const { code } = await uni.login();
    const res = await api.login(code);
    userStore.setUser(res);
};
</script>
```

---

## 八、网络请求封装

### 8.1 统一请求层

```typescript
// src/api/request.ts
const BASE_URL = 'https://api.example.com';

interface RequestOptions {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: Record<string, unknown>;
    header?: Record<string, string>;
    loading?: boolean;
}

let isRefreshing = false;
let pendingQueue: Array<(token: string) => void> = [];

export async function request<T = unknown>(options: RequestOptions): Promise<T> {
    const { url, method = 'GET', data, header = {}, loading = false } = options;

    if (loading) uni.showLoading({ title: '加载中', mask: true });

    const token = uni.getStorageSync('token');
    if (token) header.Authorization = `Bearer ${token}`;

    try {
        const res = await uni.request({
            url: url.startsWith('http') ? url : BASE_URL + url,
            method,
            data,
            header: { 'Content-Type': 'application/json', ...header },
            timeout: 10000,
        });

        if (loading) uni.hideLoading();

        if (res.statusCode === 401) {
            const newToken = await refreshToken();
            if (newToken) return request<T>({ ...options, loading: false });
            uni.reLaunch({ url: '/pages/login/login' });
            throw new Error('登录已过期');
        }

        if (res.statusCode >= 400) throw new Error(`请求失败: ${res.statusCode}`);

        const body = res.data as { code: number; message: string; data: T };
        if (body.code !== 0) {
            uni.showToast({ title: body.message, icon: 'none' });
            throw new Error(body.message);
        }
        return body.data;
    } catch (err) {
        if (loading) uni.hideLoading();
        uni.showToast({ title: '网络异常', icon: 'none' });
        throw err;
    }
}

async function refreshToken(): Promise<string | null> {
    if (isRefreshing) {
        return new Promise(resolve => pendingQueue.push(resolve));
    }
    isRefreshing = true;
    try {
        const res = await uni.request({
            url: BASE_URL + '/auth/refresh',
            method: 'POST',
            data: { refreshToken: uni.getStorageSync('refresh_token') },
        });
        const { accessToken, refreshToken } = (res.data as any).data;
        uni.setStorageSync('token', accessToken);
        uni.setStorageSync('refresh_token', refreshToken);
        pendingQueue.forEach(cb => cb(accessToken));
        pendingQueue = [];
        return accessToken;
    } catch {
        return null;
    } finally {
        isRefreshing = false;
    }
}
```

### 8.2 API 定义

```typescript
// src/api/user.ts
import { request } from './request';

export const userApi = {
    login: (code: string) =>
        request<{ token: string; openid: string }>({
            url: '/auth/login',
            method: 'POST',
            data: { code },
        }),

    getInfo: () =>
        request<{ nickname: string; avatar: string }>({ url: '/user/info' }),

    update: (data: { nickname?: string; avatar?: string }) =>
        request<void>({ url: '/user/update', method: 'POST', data }),
};
```

---

## 九、条件编译（核心！多端差异）

这是 uni-app 的**灵魂特性**：用注释语法在不同平台编译不同代码。

### 9.1 三种语法

```vue
<!-- 模板 -->
<template>
    <view>
        <!-- #ifdef H5 -->
        <view>仅在 H5 显示</view>
        <!-- #endif -->

        <!-- #ifdef MP-WEIXIN -->
        <view>仅在微信小程序显示</view>
        <!-- #endif -->

        <!-- #ifndef H5 -->
        <view>除 H5 外都显示</view>
        <!-- #endif -->

        <!-- #ifdef MP-WEIXIN || MP-ALIPAY -->
        <view>微信或支付宝显示</view>
        <!-- #endif -->
    </view>
</template>

<script setup lang="ts">
// #ifdef H5
console.log('H5 环境');
// #endif

// #ifdef MP-WEIXIN
console.log('微信小程序');
// #endif

// #ifdef APP-PLUS
console.log('App 环境');
// #endif
</script>

<style lang="scss">
/* #ifdef H5 */
.h5-only { color: red; }
/* #endif */

/* #ifdef APP-PLUS */
.app-only { color: blue; }
/* #endif */
</style>
```

### 9.2 平台标识

| 标识 | 平台 |
|------|------|
| `H5` | H5（浏览器） |
| `MP-WEIXIN` | 微信小程序 |
| `MP-ALIPAY` | 支付宝小程序 |
| `MP-BAIDU` | 百度小程序 |
| `MP-TOUTIAO` | 抖音小程序 |
| `MP-QQ` | QQ 小程序 |
| `MP-KUAISHOU` | 快手小程序 |
| `APP-PLUS` | App（5+ Runtime / nvue） |
| `APP-PLUS-NVUE` | App 的 nvue 页面 |
| `MP` | 所有小程序 |

### 9.3 实战：跨端 API 抽象

```typescript
// src/utils/platform.ts

// 统一登录（不同平台 API 不同）
export function login(): Promise<string> {
    return new Promise((resolve, reject) => {
        // #ifdef MP-WEIXIN
        uni.login({ provider: 'weixin' }).then(res => resolve(res.code));
        // #endif

        // #ifdef MP-ALIPAY
        uni.login({ scopes: 'auth_base' }).then(res => resolve(res.authCode));
        // #endif

        // #ifdef H5
        // H5 用自定义登录
        const token = getUrlParam('token') || localStorage.getItem('token');
        if (token) resolve(token);
        else reject(new Error('未登录'));
        // #endif

        // #ifdef APP-PLUS
        uni.login({ provider: 'weixin' }).then(res => resolve(res.code));
        // #endif
    });
}

// 统一支付
export function pay(params: { provider: string; orderInfo: string }): Promise<void> {
    return new Promise((resolve, reject) => {
        uni.requestPayment({
            // #ifdef MP-WEIXIN
            provider: 'wxpay',
            // #endif
            // #ifdef MP-ALIPAY
            provider: 'alipay',
            // #endif
            // #ifdef APP-PLUS
            provider: params.provider,
            // #endif
            ...params,
            success: () => resolve(),
            fail: (err) => reject(err),
        });
    });
}
```

### 9.4 平台判断（运行时）

```typescript
// 条件编译是编译期，运行时判断用：
// #ifdef H5
const isH5 = true;
// #else
const isH5 = false;
// #endif

// 或用 cross-env 注入
const platform = process.env.UNI_PLATFORM;  // 'h5' | 'mp-weixin' | 'app-plus'
```

---

## 十、各端能力调用

### 10.1 登录流程（以微信为例）

```typescript
async function wxLogin() {
    // 1. 获取 code
    const { code } = await uni.login({ provider: 'weixin' });

    // 2. 换 token（后端调 code2Session）
    const { token, openid } = await userApi.login(code);
    uni.setStorageSync('token', token);

    // 3. 获取用户信息（需用户授权）
    // uni.getUserProfile 已废弃，新版用头像昵称填写能力
    // 推荐用 button open-type="chooseAvatar" 获取头像
}

// 4. 检查 session
uni.checkSession({
    success: () => console.log('session 有效'),
    fail: () => wxLogin(),  // 失效重新登录
});
```

### 10.2 支付

```typescript
async function createAndPay(orderId: string) {
    // 1. 后端创建订单，返回支付参数
    const payParams = await orderApi.create(orderId);

    // 2. 调起支付
    try {
        await uni.requestPayment({
            provider: 'wxpay',  // 或 'alipay'
            timeStamp: payParams.timeStamp,
            nonceStr: payParams.nonceStr,
            package: payParams.package,
            signType: payParams.signType as 'MD5' | 'HMAC-SHA256',
            paySign: payParams.paySign,
        });
        uni.showToast({ title: '支付成功' });
    } catch (err: any) {
        if (err.errMsg?.includes('cancel')) {
            uni.showToast({ title: '已取消', icon: 'none' });
        } else {
            uni.showToast({ title: '支付失败', icon: 'none' });
        }
    }
}
```

### 10.3 分享

```typescript
// 页面中开启分享（onShareAppMessage）
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';

onShareAppMessage(() => ({
    title: '快来看看这个好物',
    path: '/pages/detail/detail?id=123',
    imageUrl: '/static/share.png',
}));

onShareTimeline(() => ({
    title: '好物推荐',
    query: 'id=123',
    imageUrl: '/static/share.png',
}));
```

```vue
<!-- App 端分享到第三方 -->
<button open-type="share">分享给好友</button>

<!-- 或主动调起 -->
<script setup>
const share = () => {
    uni.share({
        provider: 'weixin',
        scene: 'WXSceneSession',  // WXSceneSession | WXSceneTimeline
        type: 0,  // 0 图文，1 纯文字，5 小程序
        title: '分享标题',
        summary: '分享摘要',
        href: 'https://example.com',
        imageUrl: '/static/share.png',
        success: () => uni.showToast({ title: '分享成功' }),
    });
};
</script>
```

### 10.4 推送

```typescript
// App 端推送（uni-push）
import { onPushMessage } from '@dcloudio/uni-app';

// 注册推送
uni.getPushClientId({
    success: (res) => {
        console.log('clientId:', res.cid);
        // 上报给后端，后端用 cid 推送
        userApi.bindPushCid(res.cid);
    },
});

// 监听推送消息
onPushMessage((res) => {
    if (res.type === 'click') {
        // 用户点击通知栏消息
        const payload = JSON.parse(res.data.payload);
        uni.navigateTo({ url: payload.path });
    } else if (res.type === 'receive') {
        // 应用在前台收到消息
        console.log('收到推送', res.data);
    }
});
```

### 10.5 存储

```typescript
// 同步
uni.setStorageSync('key', 'value');
const val = uni.getStorageSync('key');
uni.removeStorageSync('key');
uni.clearStorageSync();

// 异步
uni.setStorage({ key: 'key', data: 'value' });
uni.getStorage({ key: 'key', success: (res) => console.log(res.data) });

// 存对象（自动序列化）
uni.setStorageSync('user', JSON.stringify(user));
const user = JSON.parse(uni.getStorageSync('user'));
```

---

## 十一、nvue 原生渲染（进阶）

### 11.1 什么时候用 nvue

nvue（native vue）用**原生渲染引擎**（Weex 改进版）渲染，不走 WebView。

| 场景 | 用 vue 还是 nvue |
|------|-----------------|
| 普通业务页面 | vue（WebView 够用） |
| 长列表（直播弹幕、商品流） | nvue（流畅） |
| 复杂动画、地图全屏覆盖 | nvue |
| 视频播放页 | nvue（video 性能好） |
| 文字密集型（文章详情） | vue（nvue 文字排版差） |

### 11.2 nvue 的限制

```vue
<!-- xxx.nvue -->
<template>
    <!-- 注意：nvue 不支持普通 CSS，必须用 flex！ -->
    <view class="root">
        <text class="title">nvue 页面</text>
    </view>
</template>

<style>
/* nvue 样式限制： */
/* 1. 默认 flex 布局，flex-direction 默认 column */
/* 2. 不支持简写：不能用 margin: 0 auto，要 margin-left/right */
/* 3. 文字必须包在 <text> 里，<view> 里的文字不显示 */
/* 4. 不支持 float、position: fixed（要用 plus.nativeObj） */
/* 5. 不支持 *、标签选择器，只能用 class */
.root {
    flex: 1;
}
.title {
    font-size: 32rpx;
    color: #333;
}
</style>
```

### 11.3 混合开发策略

```
pages.json：
{
    "pages": [
        { "path": "pages/index/index" },                    // vue 页
        { "path": "pages/live/live", "style": { "navigationStyle": "custom" } }  // nvue 页
    ]
}

策略：
- 95% 页面用 vue（开发效率高）
- 5% 性能敏感页用 nvue（列表、动画、视频）
- nvue 和 vue 页面间可正常跳转传参
```

---

## 十二、性能优化

### 12.1 减少包体积

```json
// pages.json 分包
{
    "subPackages": [
        { "root": "pages/activity", "pages": [{ "path": "double11/index" }] },
        { "root": "pages/sub", "pages": [{ "path": "order/index" }] }
    ],
    "preloadRule": {
        "pages/index/index": { "network": "all", "packages": ["pages/activity"] }
    }
}
```

```scss
/* 静态资源外置 */
/* ❌ 把大图放 static/ 会被打包进包 */
/* ✅ 大图传 CDN，代码里用 URL */
/* 仅小图标（< 4KB）放 static/，会被 base64 内联 */
```

### 12.2 图片优化

```vue
<template>
    <!-- 懒加载 -->
    <image
        :src="optimizedUrl"
        lazy-load
        mode="aspectFill"
        :style="{ width: '100rpx', height: '100rpx' }"
    />
</template>

<script setup>
const props = defineProps<{ url: string; width?: number }>();

// CDN 动态缩放
const optimizedUrl = computed(() => {
    const w = props.width || 200;
    return `${props.url}?imageView2/2/w/${w * 2}/format/webp`;  // ×2 适配高清屏
});
</script>
```

### 12.3 列表优化

```vue
<!-- 长列表用 recycle-list（nvue）或分页加载（vue） -->
<template>
    <!-- nvue 专用：recycle-list（高性能） -->
    <recycle-list :list="list" :itemType="itemType">
        <cell v-for="(item, i) in list" :key="i">
            <text>{{ item.name }}</text>
        </cell>
    </recycle-list>

    <!-- vue 端：分页 + 触底加载 -->
    <scroll-view scroll-y @scrolltolower="loadMore">
        <view v-for="item in list" :key="item.id">{{ item.name }}</view>
    </scroll-view>
</template>
```

### 12.4 setData / 响应式优化

```typescript
// uni-app 基于 Vue 3，避免 reactive 大对象
// ❌ 整个 list 放 ref，每改一项触发整个 diff
const list = ref<Item[]>([]);

// ✅ 用 shallowRef + 手动触发，或拆分
const list = shallowRef<Item[]>([]);
const updateItem = (index: number, data: Partial<Item>) => {
    list.value[index] = { ...list.value[index], ...data };
    list.value = [...list.value];  // 浅拷贝触发更新
};
```

### 12.5 首屏优化

```typescript
// 1. 骨架屏（避免白屏）
// 2. 首屏数据预取（后端 SSR 或客户端 prefetch）
// 3. 分包异步加载非首屏组件
const Comp = defineAsyncComponent(() => import('./Heavy.vue'));
```

---

## 十三、原生插件与云开发

### 13.1 原生插件（App 端）

App 端如果 uni-app 内置能力不够，可集成原生插件：

```
方式一：DCloud 插件市场（https://ext.dcloud.net.cn/）
  - 搜索插件 → 购买/下载 → 在 HBuilderX 中配置到 manifest.json → 打包

方式二：自己开发原生插件（UTS / 原生 SDK）
  - UTS（uni-app TypeScript）：用 TS 写调用原生 API
  - 适合：蓝牙、相机深度集成、第三方 SDK 接入
```

```typescript
// UTS 调用原生（Android/iOS）
// src/uni_modules/xxx/utssdk/app-android/index.uts
export function callNative(): string {
    // 直接调 Android API
    const context = UTSAndroid.getUniActivity()!;
    return context.getPackageName();
}
```

### 13.2 uniCloud 云开发

DCloud 自家 Serverless，免后端开发：

```typescript
// uniCloud-aliyun/cloudfunctions/user/login/index.obj.js
module.exports = async (event) => {
    const { code } = event;
    // 调用微信 code2Session
    const { openid } = await uniCloud.httpclient(
        `https://api.weixin.qq.com/sns/jscode2session?...&js_code=${code}`
    );
    // 生成 token
    const token = jwt.sign({ openid }, SECRET);
    // 写入数据库
    const db = uniCloud.database();
    await db.collection('users').doc(openid).set({ openid, createdAt: Date.now() });
    return { token, openid };
};
```

```typescript
// 前端调用云函数
const res = await uniCloud.callFunction({
    name: 'user-login',
    data: { code },
});
console.log(res.result);  // { token, openid }
```

**uniCloud 适用场景**：快速验证 MVP、个人项目、轻量业务。复杂业务（高并发、复杂事务）仍建议自建后端。

---

## 十四、常见问题与踩坑

### 14.1 HBuilderX 与 CLI 项目互转

HBuilderX 创建的项目是「非 CLI」结构，依赖 HBuilderX 编译；CLI 项目用 `npm run dev/build`。

| 维度 | HBuilderX 项目 | CLI 项目 |
|------|---------------|---------|
| 目录 | 有 `manifest.json` 在根目录 | 在 `src/` 下 |
| 编译 | HBuilderX 内置 | `vite`/`webpack` |
| CI/CD | 不友好 | 友好 |
| 第三方 npm 包 | 支持但配置繁琐 | 原生支持 |
| 建议 | 新手、快速原型 | **团队协作、生产项目** |

### 14.2 App 端 WebView 与原生通信

```typescript
// App 端 web-view 加载 H5，H5 调用 uni 方法
// H5 页面引入：https://js.cdn.aliyun.dcloud.net/dev/uni-app/uni.webview.1.5.5.js

// H5 中：
uni.postMessage({
    data: { action: 'login', token: 'xxx' },  // 只在特定时机触发（后退、销毁、分享）
});
uni.navigateTo({ url: '/pages/native-page' });

// App 端监听：
<web-view :src="url" @message="onMessage" />
const onMessage = (e) => {
    console.log(e.detail.data);  // [{ action: 'login', token: 'xxx' }]
};
```

### 14.3 各端差异速查

| 能力 | H5 | 微信小程序 | App |
|------|-----|-----------|-----|
| localStorage | ✅ | uni.setStorageSync | plus.storage |
| 拨打电话 | `<a href="tel:">` | `uni.makePhoneCall` | `uni.makePhoneCall` |
| 复制剪贴板 | `navigator.clipboard` | `uni.setClipboardData` | `uni.setClipboardData` |
| 扫码 | 需第三方库 | `uni.scanCode` | `uni.scanCode` |
| 蓝牙 | Web Bluetooth（兼容差） | `uni.openBluetoothAdapter` | `plus.bluetooth` |
| 推送 | Web Push（受限） | 订阅消息 | uni-push |
| 本地通知 | ❌ | ❌ | plus.push |

### 14.4 调试技巧

```bash
# H5：Chrome DevTools 直接调
# 微信小程序：微信开发者工具（必装）
# 支付宝小程序：支付宝小程序开发者工具
# App：HBuilderX 真机调试 / vConsole

# vConsole（移动端调试面板）
npm install vconsole
# 在 main.ts 中
// #ifdef H5 || APP-PLUS
import VConsole from 'vconsole';
new VConsole();
// #endif
```

### 14.5 上架发布

| 平台 | 流程 | 周期 |
|------|------|------|
| H5 | 部署到服务器 / CDN | 即时 |
| 微信小程序 | 微信开发者工具上传 → 后台提审 | 1-7 天 |
| 支付宝小程序 | IDE 上传 → 后台提审 | 1-3 天 |
| iOS App | HBuilderX 云打包 → App Store Connect 提审 | 1-7 天 |
| Android App | 云打包 → 应用市场（华为/小米/OPPO/VIVO） | 1-3 天 |

---

## 十五、组件库与生态

| 库 | 特点 | 适用 |
|----|------|------|
| **uni-ui** | 官方，跨端最稳 | 所有项目基础 |
| **uView Plus** | 组件最全，Vue3 支持 | 大型项目 |
| **uni-ui（DCloud）** | 轻量 | 小项目 |
| **ThorUI** | 商业 + 免费版 | 企业项目 |
| **ColorUI** | 纯样式库 | 快速美化 |
| **uni-forms** | 表单验证 | 表单场景 |

```bash
# uView Plus（推荐 Vue3 项目）
npm install uview-plus
```

```json
// pages.json easycom 配置
{
    "easycom": {
        "custom": {
            "^u-(.*)": "uview-plus/components/u-$1/u-$1.vue"
        }
    }
}
```

---

## 十六、Vue3 与 Vue2 写法对比

uni-app 同时支持 Vue2 和 Vue3，但 Vue3 是官方主推方向（性能更好、TypeScript 支持更完善）。本节系统对比两者在 uni-app 中的写法差异，方便从 Vue2 迁移或选型。

### 16.1 应用入口

这是最直观的差异，**uni-app 的 Vue3 入口与标准 Vue3 不同**（要用 `createSSRApp` 而非 `createApp`）：

```typescript
// === Vue2：main.js ===
import Vue from 'vue';
import App from './App.vue';

Vue.prototype.$api = api;        // 全局挂载
Vue.config.productionTip = false;

App.mpType = 'app';              // uni-app 特有：声明这是 app 类型
const app = new Vue({
    ...App,
});
app.$mount();
```

```typescript
// === Vue3：main.ts ===
import { createSSRApp } from 'vue';   // ⚠️ uni-app 必须用 createSSRApp，不是 createApp
import App from './App.vue';
import { createPinia } from 'pinia';

export function createApp() {
    const app = createSSRApp(App);
    app.use(createPinia());
    app.config.globalProperties.$api = api;   // 全局挂载
    return { app };                            // ⚠️ 必须返回 { app }
}
```

**关键坑**：
- uni-app 的 Vue3 **必须用 `createSSRApp`**，用 `createApp` 会导致小程序端生命周期失效
- `createApp` 函数必须 `return { app }`，不能直接 `app.mount('#app')`
- 全局属性从 `Vue.prototype` 改为 `app.config.globalProperties`

### 16.2 组件写法：Options API vs Composition API

```vue
<!-- === Vue2：Options API === -->
<template>
    <view class="counter">
        <text>{{ count }} × {{ factor }} = {{ result }}</text>
        <button @click="increment">+1</button>
    </view>
</template>

<script>
export default {
    name: 'Counter',
    props: {
        factor: { type: Number, default: 2 },
    },
    data() {
        return { count: 0 };
    },
    computed: {
        result() { return this.count * this.factor; },
    },
    watch: {
        count(newVal) {
            if (newVal > 10) uni.showToast({ title: '太大了', icon: 'none' });
        },
    },
    methods: {
        increment() { this.count++; },
    },
    mounted() {
        console.log('组件挂载完成');
    },
};
</script>
```

```vue
<!-- === Vue3：<script setup> + Composition API === -->
<template>
    <view class="counter">
        <text>{{ count }} × {{ factor }} = {{ result }}</text>
        <button @click="increment">+1</button>
    </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';

// props：编译宏，无需 import
const props = withDefaults(defineProps<{ factor?: number }>(), {
    factor: 2,
});

// 响应式数据
const count = ref(0);

// 计算属性
const result = computed(() => count.value * props.factor);

// 侦听器
watch(count, (newVal) => {
    if (newVal > 10) uni.showToast({ title: '太大了', icon: 'none' });
});

// 方法
const increment = () => count.value++;

// 生命周期
onMounted(() => {
    console.log('组件挂载完成');
});
</script>
```

**核心差异表：**

| 维度 | Vue2（Options API） | Vue3（Composition API） |
|------|---------------------|------------------------|
| 数据 | `data() { return {} }` | `ref()` / `reactive()` |
| 访问响应式值 | `this.count` | `count.value`（ref） |
| 方法 | `methods: { fn() {} }` | 直接声明 `const fn = () => {}` |
| 计算属性 | `computed: { result() {} }` | `const result = computed(() => {})` |
| 侦听 | `watch: { count() {} }` | `watch(count, () => {})` |
| props | `props: { x: Number }` | `defineProps<{ x?: number }>()` |
| emit | `this.$emit('xxx')` | `const emit = defineEmits()` |
| 生命周期 | `mounted()` | `onMounted(() => {})` |
| this | 有 | **无**（setup 中没有 this） |

### 16.3 响应式原理差异

这是 Vue3 性能更好的根本原因：

```
Vue2：Object.defineProperty
  - 劫持对象已有属性
  - ❌ 无法检测新增/删除属性（需 Vue.set / this.$set）
  - ❌ 无法监听数组索引和 length 变化（需重写数组方法）
  - 深度监听需要一次性递归（性能差）

Vue3：Proxy
  - 代理整个对象
  - ✅ 新增/删除属性自动响应
  - ✅ 数组索引/length 直接监听
  - ✅ 惰性响应式（访问时才递归，性能好）
```

```vue
<!-- Vue2 的坑：新增属性不响应 -->
<template>
    <view>{{ obj.name }}</view>
    <button @click="addName">添加</button>
</template>

<script>
// Vue2
export default {
    data() {
        return { obj: {} };
    },
    methods: {
        addName() {
            // ❌ 视图不更新
            this.obj.name = '张三';
            // ✅ 必须用 Vue.set
            this.$set(this.obj, 'name', '张三');
        },
    },
};
</script>

<script setup lang="ts">
import { reactive } from 'vue';
// Vue3
const obj = reactive<{ name?: string }>({});
const addName = () => {
    obj.name = '张三';   // ✅ 直接赋值，自动响应
};
</script>
```

### 16.4 ref vs reactive 的选择

```typescript
import { ref, reactive } from 'vue';

// ref：基本类型 + 需要整体替换的对象
const count = ref(0);              // 基本类型
const user = ref({ name: '张三' }); // 需要整体替换时用 ref
user.value = { name: '李四' };      // ✅ 整体替换

// reactive：对象/数组，不需要整体替换
const state = reactive({
    list: [],
    loading: false,
});
state.list.push('item');           // ✅ 直接操作

// 经验法则：
// - 基本类型 → ref
// - 对象且需要整体替换 → ref
// - 对象/数组作为状态容器 → reactive
// - 不确定就用 ref（最通用）
```

```typescript
// 解构会丢失响应性（reactive 的坑）
const state = reactive({ count: 0, name: '张三' });
const { count, name } = state;  // ❌ 解构后不再响应

// ✅ 用 toRefs 保持响应
import { toRefs } from 'vue';
const { count, name } = toRefs(state);  // ✅ 每个 ref 都响应

// ref 解构没问题
const user = ref({ name: '张三', age: 18 });
// 注意 ref 解构对象本身也丢失响应，要用 reactive 或 toRefs
```

### 16.5 生命周期对照

| Vue2 | Vue3（setup 中） | 说明 |
|------|------------------|------|
| `beforeCreate` | setup() 本身 | setup 在 beforeCreate 之前执行 |
| `created` | setup() 本身 | 数据初始化写在 setup 顶部 |
| `beforeMount` | `onBeforeMount` | 挂载前 |
| `mounted` | `onMounted` | 挂载完成 |
| `beforeUpdate` | `onBeforeUpdate` | 更新前 |
| `updated` | `onUpdated` | 更新完成 |
| `beforeDestroy` | `onBeforeUnmount` | **改名**：destroy → unmount |
| `destroyed` | `onUnmounted` | 卸载完成 |
| `errorCaptured` | `onErrorCaptured` | 错误捕获 |

**uni-app 特有生命周期**（页面级，两边都需要从 `@dcloudio/uni-app` 导入）：

```typescript
// Vue3 中使用 uni-app 生命周期
import { onLoad, onShow, onReady, onHide, onUnload, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app';

onLoad((options) => {
    console.log('页面加载', options);
});
onShow(() => console.log('页面显示'));
onReachBottom(() => loadMore());

// Vue2 中是写在 options 里
export default {
    onLoad(options) {},
    onShow() {},
    onReachBottom() {},
};
```

### 16.6 组件通信

```vue
<!-- === Vue2 === -->
<script>
export default {
    props: { title: String },
    data() { return { count: 0 }; },
    methods: {
        notify() {
            // 触发事件
            this.$emit('change', this.count);
        },
    },
    // 跨组件通信：eventBus
    mounted() {
        this.$bus.$on('refresh', this.load);
    },
    beforeDestroy() {
        this.$bus.$off('refresh', this.load);  // 必须手动解绑
    },
};
</script>
```

```vue
<!-- === Vue3 === -->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

// props
const props = defineProps<{ title?: string }>();

// emit
const emit = defineEmits<{
    (e: 'change', count: number): void;
}>();

const count = ref(0);
const notify = () => emit('change', count.value);

// 跨组件通信：mitt 库（推荐）或 provide/inject
import mitt from 'mitt';
const bus = mitt();
onMounted(() => bus.on('refresh', load));
onBeforeUnmount(() => bus.off('refresh', load));  // 同样要解绑
</script>
```

```typescript
// provide/inject（Vue3 推荐方式，替代 eventBus）
// 父组件
import { provide, ref } from 'vue';
const theme = ref('light');
provide('theme', theme);   // 提供响应式数据

// 子组件（任意层级）
import { inject } from 'vue';
const theme = inject<Ref<string>>('theme', ref('light'));
```

### 16.7 v-model 差异

```vue
<!-- === Vue2：v-model 是 :value + @input 的语法糖 === -->
<!-- 父组件 -->
<my-input v-model="text" />

<!-- 子组件 -->
<script>
export default {
    props: ['value'],
    methods: {
        onInput(e) { this.$emit('input', e.target.value); },
    },
};
</script>

<!-- === Vue3：v-model 是 :modelValue + @update:modelValue 的语法糖 === -->
<!-- 父组件 -->
<my-input v-model="text" />              <!-- 单个 -->
<my-input v-model:text="text" v-model:count="count" />  <!-- ✅ 多个 v-model -->

<!-- 子组件 -->
<script setup>
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();
const onInput = (e) => emit('update:modelValue', e.detail.value);
</script>
```

### 16.8 全局 API 差异

```typescript
// === Vue2 ===
import Vue from 'vue';

// 全局组件
Vue.component('MyComp', { /* ... */ });

// 全局指令
Vue.directive('focus', { inserted(el) { el.focus(); } });

// 全局过滤器（Vue3 废弃）
Vue.filter('currency', val => '¥' + val);

// 全局方法
Vue.prototype.$http = axios;
// 使用：this.$http.get(...)

// 插件
Vue.use(MyPlugin);
```

```typescript
// === Vue3 ===
import { createSSRApp } from 'vue';

export function createApp() {
    const app = createSSRApp(App);

    // 全局组件
    app.component('MyComp', { /* ... */ });

    // 全局指令
    app.directive('focus', {
        mounted(el: HTMLElement) { el.focus(); },   // 指令钩子也改名了
    });

    // ❌ 全局过滤器废弃，用 computed 或工具函数替代
    // app.config.globalProperties.$filters = { currency: v => '¥' + v };

    // 全局方法
    app.config.globalProperties.$http = axios;
    // 使用：const { proxy } = getCurrentInstance()!; proxy.$http.get(...)

    // 插件
    app.use(MyPlugin);
    return { app };
}
```

**指令钩子改名对照：**

| Vue2 | Vue3 |
|------|------|
| `bind` | `beforeMount` |
| `inserted` | `mounted` |
| `update` | `updated`（语义变化） |
| `componentUpdated` | `updated` |
| `unbind` | `unmounted` |

### 16.9 自定义指令在 uni-app 中的限制

```typescript
// ⚠️ uni-app 注意：指令在小程序端几乎无效！
// 小程序没有 DOM，指令只在 H5 和 App（nvue）端可用

// app.directive('lazy', ...) 只在 H5 生效
// 小程序端做图片懒加载要用 image 组件的 lazy-load 属性
// 复杂 DOM 操作在小程序端要换成组件方案

// 通用建议：uni-app 项目里少用自定义指令，用组件封装代替
```

### 16.10 Teleport 与 Fragment

```vue
<!-- === Vue3 新增：Teleport（传送门）=== -->
<!-- 把内容渲染到指定节点（如 body） -->
<!-- ⚠️ uni-app 小程序端不支持 Teleport（无 DOM 树概念），仅 H5 可用 -->
<template>
    <view>
        <button @click="show = true">弹窗</button>
        <teleport to="body" v-if="show">
            <view class="modal">弹窗内容</view>
        </teleport>
    </view>
</template>

<!-- === Vue3 新增：Fragment（多根节点）=== -->
<!-- Vue2 模板必须有单个根节点，Vue3 支持多个根节点 -->
<!-- ✅ Vue3 合法 -->
<template>
    <view>头部</view>
    <view>内容</view>
    <view>底部</view>
</template>

<!-- ⚠️ uni-app 小程序端对 Fragment 支持不完美，建议仍用单根节点包裹 -->
<template>
    <view>
        <view>头部</view>
        <view>内容</view>
    </view>
</template>
```

### 16.11 状态管理：Vuex vs Pinia

```typescript
// === Vue2 + Vuex ===
// store/index.js
import Vue from 'vue';
import Vuex from 'vuex';
Vue.use(Vuex);

export default new Vuex.Store({
    state: { count: 0, user: null },
    getters: { doubleCount: state => state.count * 2 },
    mutations: {
        INCREMENT(state) { state.count++; },
        SET_USER(state, user) { state.user = user; },
    },
    actions: {
        async login({ commit }, code) {
            const user = await api.login(code);
            commit('SET_USER', user);
        },
    },
});

// 组件中使用
this.$store.state.count;
this.$store.getters.doubleCount;
this.$store.commit('INCREMENT');
this.$store.dispatch('login', code);

// mapState / mapGetters 辅助
import { mapState, mapActions } from 'vuex';
export default {
    computed: {
        ...mapState(['count']),
        ...mapGetters(['doubleCount']),
    },
    methods: {
        ...mapActions(['login']),
    },
};
```

```typescript
// === Vue3 + Pinia（推荐）===
// store/counter.ts
import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', {
    state: () => ({ count: 0 }),
    getters: { doubleCount: state => state.count * 2 },
    actions: {
        increment() { this.count++; },
        async login(code: string) {
            const user = await api.login(code);
            this.user = user;  // ✅ 直接改，不用 mutation
        },
    },
});

// 组件中使用（更简洁，无 this.$store）
import { useCounterStore } from '@/store/counter';
import { storeToRefs } from 'pinia';

const counter = useCounterStore();
// 解构 state 要用 storeToRefs（否则丢响应）
const { count, doubleCount } = storeToRefs(counter);
// action 可以直接解构
const { increment } = counter;

increment();
counter.count++;          // ✅ 直接修改
```

**Vuex vs Pinia 对比：**

| 维度 | Vuex | Pinia |
|------|------|-------|
| mutations | ✅ 必需（改 state 必须经 mutation） | ❌ 废弃（直接改） |
| 模块化 | `modules` 嵌套，路径长 | 每个 store 独立，扁平 |
| TypeScript | 支持弱，需大量类型声明 | 原生支持，类型推导完善 |
| 体积 | 较大 | ~1KB |
| DevTools | ✅ | ✅ |
| 异步 | action | action（更直观） |
| 学习成本 | 中（mutations/getters/actions 概念多） | 低 |

### 16.12 Tree Shaking 与按需引入

```typescript
// Vue2：整个 Vue 实例挂载，Tree Shaking 支持差
import Vue from 'vue';   // 全量引入

// Vue3：全局 API 改为函数式，支持 Tree Shaking
import { createSSRApp, ref, computed, watch, onMounted } from 'vue';
// 只打包用到的，未用的 API 不进 bundle
```

**对 uni-app 包体积的影响**：Vue3 项目通常比 Vue2 项目小 10-30%，对小程序 2MB 限制更友好。

### 16.13 迁移建议

**新项目**：直接用 Vue3 + Vite + TS，没有理由用 Vue2。

**老项目迁移**：

```bash
# 用官方迁移工具检查兼容性
npx @vue/compat-cli  # Vue2 项目跑兼容模式
```

迁移要点：
1. `main.js` → `main.ts`，改 `createSSRApp`
2. 组件改 `<script setup>`（可选，Options API 在 Vue3 仍可用）
3. Vuex → Pinia（推荐但非强制，Vuex4 支持 Vue3）
4. 检查 `this.$set` / `Vue.set`，Vue3 已废弃（直接赋值）
5. 检查 eventBus 实现，Vue3 实例不再有 `$on/$emit/$off`
6. 全局过滤器改为 computed 或全局方法
7. 自定义指令钩子改名（`bind→beforeMount` 等）

### 16.14 一句话总结对比

| 维度 | Vue2 | Vue3 |
|------|------|------|
| 入口 | `new Vue()` | `createSSRApp()`（uni-app） |
| 写法 | Options API | Composition API + `<script setup>` |
| 响应式 | `defineProperty`（有新增属性坑） | `Proxy`（自动响应） |
| this | 有 | setup 中无 |
| 状态管理 | Vuex | Pinia |
| 多 v-model | ❌ | ✅ |
| Tree Shaking | 弱 | 强（包更小） |
| TS 支持 | 弱 | 原生 |
| 性能 | 一般 | 提升 30-50% |

**结论**：uni-app 新项目**无脑选 Vue3**，除非维护历史项目。Vue3 的 Composition API 配合 `<script setup>` + TypeScript 是当前最佳实践，Pinia 替代 Vuex 让状态管理更直观。

---

## 十七、优缺点与适用场景

### 优点

- **一套代码多端**：Vue 语法写一次，编译 10+ 平台，复用率 80-95%
- **Vue 友好**：会 Vue 即可上手，不用学小程序语法
- **App 能力强**：nvue + 原生插件，App 端体验接近原生
- **生态完善**：DCloud 插件市场、uniCloud、HBuilderX 全套工具链
- **国内文档好**：中文文档齐全，社区活跃

### 缺点

- **性能损耗**：相比原生小程序有 5-15% 损耗
- **多端差异坑**：API 在不同平台行为不完全一致
- **nvue 学习成本**：限制多，样式与 vue 差异大
- **App 端体积大**：内置 Runtime 增加包体积
- **平台新特性滞后**：微信出新 API，uni-app 跟进需 1-2 月

### 适用场景

| 场景 | 是否推荐 uni-app |
|------|----------------|
| 中小企业全端覆盖（小程序 + H5 + App） | ✅ 强烈推荐 |
| 个人开发者 / 创业 MVP | ✅ 推荐 |
| Vue 技术团队 | ✅ 推荐 |
| 仅做微信小程序（深度优化） | ❌ 用原生 |
| 高性能游戏 / 视频剪辑 | ❌ 用原生 + 游戏引擎 |
| React 技术团队 | ❌ 用 Taro |

### 局限性

1. **跨端不可能 100%**：复杂业务仍需条件编译处理 10-20% 差异
2. **平台政策绑定**：微信审核规则变化需持续跟进
3. **App 端依赖 DCloud**：云打包服务、Runtime 都依赖厂商
4. **大型项目编译慢**：多端构建耗时长，需优化构建配置
5. **调试复杂**：多端需多个开发者工具切换
6. **TS 支持不完美**：部分 API 类型定义不全，需手动声明

---

## 十八、学习路径建议

```
入门（1-2 周）：
  ├─ 理解 rpx、pages.json、生命周期
  ├─ 写出 CRUD 列表 + 详情 + 表单
  └─ 跑通 H5 + 微信小程序两端

进阶（2-4 周）：
  ├─ 掌握条件编译、跨端 API 抽象
  ├─ Pinia 状态管理 + 持久化
  ├─ 网络请求封装（token 刷新、拦截器）
  └─ 集成 uni-ui / uView 组件库

精通（1-2 月）：
  ├─ nvue 原生渲染（列表、动画、视频）
  ├─ 性能优化（分包、懒加载、虚拟列表）
  ├─ 原生插件 / UTS 调原生能力
  ├─ uniCloud 云开发
  └─ 各端发布上架完整流程

架构级：
  ├─ 多端差异化架构设计
  ├─ 组件库 / 工具库沉淀
  └─ CI/CD 多端自动构建发布
```

---

## 十九、总结

uni-app 的核心价值是**用 Vue 语法 + 一套代码解决多端覆盖的成本问题**：

- **入门门槛低**：会 Vue 即可，rpx + pages.json + 内置组件
- **核心能力**：条件编译（`#ifdef`）处理多端差异，是 uni-app 的灵魂
- **架构要点**：统一请求层 + Pinia 状态管理 + 分包策略
- **性能关键**：分包预下载、图片优化、长列表虚拟化、nvue 原生渲染
- **能力扩展**：原生插件（UTS）、uniCloud、nvue 三大进阶方向
- **踩坑**：各端 API 差异、nvue 样式限制、App 端体积控制

**一句话选型**：Vue 技术栈 + 需要覆盖小程序 + H5 + App 多端 + 团队不想学原生 → uni-app 是性价比最高的方案。
