---
title: 小程序开发踩坑指南：七大类高频问题的根因、方案对比与避坑清单
date: '2026-08-28'
tags:
  - 小程序
  - 微信小程序
  - 性能优化
  - 前端工程
  - 踩坑
category: 前端工程
summary: >-
  小程序的坑不是散落的偶然事件，而是「双线程架构 + 平台管控」决定的必然模式。本文按开发链路把高频坑拆成七大类——框架与运行环境限制、性能瓶颈、网络请求、组件通信与页面跳转、兼容性、发布审核、与后端协作——每个坑按「现象 → 根因 → 多方案对比 → 适配场景 → 局限性」展开，覆盖 setData 通信开销、包体积与分包策略、请求队列、EventChannel、同层渲染、隐私接口与备案、内容安全校验、防重复提交等，最后给出开发前必查清单。
---

# 小程序开发踩坑指南：七大类高频问题的根因、方案对比与避坑清单

小程序的坑看起来五花八门，实际上绝大多数都能追溯到两个根：**双线程架构**（决定了性能与能力的坑）和**平台管控**（决定了审核与合规的坑）。理解这两个根，坑就从「玄学」变成「可推导」。本文按开发链路组织七大类问题，每个坑按「现象 → 根因 → 多方案对比 → 适配场景 → 局限性」展开。

> 本文以微信小程序为主线（占存量 90% 的问题），支付宝/抖音小程序差异仅点到为止。技术栈选型（原生 vs Taro vs uni-app）、状态管理选型、客服系统等在[《小程序开发解决方案与常见问题》](/post/mini-program-development)中已有展开，本文不重复。

---

## 一、框架与运行环境限制：一切坑的总根源

### 1.1 双线程模型：为什么「小程序不是网页」

**现象**：不能操作 DOM、`window`/`document` 部分 API 缺失、`setData` 「卡」、`eval`/`new Function` 直接报错。

**根因**：小程序的架构从设计上就把「逻辑」和「渲染」隔离在两个线程：

```
┌────────────────────────────────────────────────────┐
│                     微信客户端 (Native)              │
│                                                    │
│  ┌──────────────┐    序列化数据    ┌──────────────┐ │
│  │   逻辑层      │ ─────────────→ │    渲染层     │ │
│  │ (JsCore/V8)  │ ←───────────── │  (WebView)   │ │
│  │  运行你的 JS   │   Native 中转   │  渲染 WXML    │ │
│  └──────────────┘               └──────────────┘ │
│        ↑                ↑                ↑        │
│   wx.request 等 API    消息桥接        WXSS 渲染    │
│   由 Native 注入实现   (线程通信开销)               │
└────────────────────────────────────────────────────┘
```

- **逻辑层**跑你的 JS（iOS 用 JavaScriptCore，Android 用 V8），**没有 WebView 环境**——所以没有 `window`、`document`，自然也没有 DOM 操作；
- **渲染层**是一个个 WebView，只负责把 WXML/WXSS 画出来，**不执行你的业务 JS**；
- 两个线程之间的唯一桥梁是 **Native 层的消息通信**，`setData` 的本质是「逻辑层序列化数据 → Native 转发 → 渲染层重渲染」。**每一次 setData 都是一次跨线程通信**——这是第二大类所有性能坑的根源；
- 禁止 `eval`/`new Function`/`Function('...')` 是安全管控（防止动态注入执行任意代码），连带影响：很多依赖动态代码的模板引擎、动态配置 DSL 方案在小程序里无法直接使用。

**衍生限制与解法对比**：

| 限制 | 表现 | 解法 | 局限 |
| --- | --- | --- | --- |
| 无 DOM/BOM | 三方库（jQuery、echarts 全量版）不可用 | 用小程序适配版库（echarts-for-weixin）或 Canvas/Skyline 方案 | 库需专人维护适配 |
| 视图层无法执行逻辑 | WXML 里不能调用 JS 函数格式化数据 | **wxs**（渲染层脚本，WXML 中可直接调用） | wxs 与逻辑层隔离、不能调 wx API，iOS 下性能好 Android 略差 |
| 动态代码禁止 | 动态配置、模板字符串渲染失效 | 预编译成静态 WXML + 条件渲染 | 失去「服务端下发界面」的灵活性 |
| CSS 支持不完整 | 通配符 `*`、属性选择器不支持；`position: sticky` 老基础库不支持；部分 flex 子属性表现异常 | 只用官方支持的选择器；sticky 升级基础库或用 scroll-view + sticky-header 组件 | 老版本用户覆盖不足时不能依赖新特性 |

**wxs 示例**（高频格式化不进 setData 的正确姿势）：

```xml
<!-- utils/fmt.wxs -->
module.exports = {
  price: function (cent) { return (cent / 100).toFixed(2) }
}

<!-- 页面 WXML 直接调用，不占用逻辑层通信 -->
<wxs src="../utils/fmt.wxs" module="fmt" />
<text>￥{{ fmt.price(order.amount) }}</text>
```

**适配场景**：金额/时间/文案格式化、纯展示计算放 wxs；涉及状态判断的业务逻辑仍放逻辑层。**局限性**：wxs 语法是 ES5 子集（不支持 ES6+），且与逻辑层不共享内存，不要在 wxs 里做复杂计算。

### 1.2 生命周期：与 Vue/React 「形似神异」

| 小程序 | 页面组件 | 最近似的 Web 概念 | 易错点 |
| --- | --- | --- | --- |
| `onLoad` | — | 路由进入（一次性） | 只触发一次，适合取参数、发首屏请求 |
| `onShow` | — | `visibilitychange` | **每次返回该页面都触发**，这里发请求要防重复（见 7.2） |
| `onReady` | `ready` | `mounted` | 首次渲染完成，取节点信息（createSelectorQuery）须在此之后 |
| `onHide` | — | `visibilitychange` | 忘记在这里停轮询/清定时器 → 内存泄漏 + 后台耗电 |
| `onUnload` | `detached` | `unmount` | 忘记清理定时器/事件监听，页面栈关闭后仍持有引用 |

高频坑：`onShow` 里刷新数据没做「请求去重」，用户在页面间来回切换导致请求风暴；`setInterval` 没在 `onUnload` 清理，iOS 长时间运行后内存告警白屏。

### 1.3 包体积限制：超限是在告诉你「架构该分层了」

硬性限制（微信现行）：

- 单个主包 / 单个分包 ≤ **2MB**；
- 整个小程序（主包 + 所有分包）≤ **30MB**（早期 20MB，已放宽）；
- 单个文件不做限制但会被总包约束，图片字体是超限重灾区。

**多方案对比**：

| 方案 | 做法 | 优点 | 缺点 | 适配场景 |
| --- | --- | --- | --- | --- |
| 资源外置（首选） | 图片/字体/音视频全量走 CDN | 立竿见影，包体只留代码 | 首次加载依赖网络 | 所有项目，第一条就做它 |
| **普通分包** | 按业务域拆 `subpackages` | 主包变小 → 冷启动快 | 分包内不能引用主包外的其他分包 | 业务模块边界清晰的中型项目 |
| **独立分包** | `independent: true`，不依赖主包资源 | 可脱离主包**独立启动**，冷启动极快 | 不能 `require` 主包代码与主包公共样式 | 活动/营销页、扫码直达页 |
| **分包预下载** | `preloadRule` 指定进入某页时预下载分包 | 用户无感进入分包页 | 占用用户网络，需 Wifi/All 策略 | 高频跳转链路 |
| 图片压缩 | webp、雪碧图、iconfont 替代小图标 | 兼容性极好 | 需构建流程配合 | 所有项目 |

```json
// app.json —— 分包 + 预下载示例
{
  "pages": ["pages/index/index"],
  "subpackages": [
    { "root": "packageActivity", "pages": ["pages/seckill/seckill"], "independent": true },
    { "root": "packageOrder", "pages": ["pages/list/list", "pages/detail/detail"] }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "wifi",
      "packages": ["packageOrder"]
    }
  },
  "lazyCodeLoading": "requiredComponents"
}
```

`lazyCodeLoading: "requiredComponents"`（按需注入）是官方提供的启动优化开关：只注入当前页面用到的组件代码而非全量注入，**新项目默认开**。

**局限性**：分包解决「放得下」和「启动快」，但拆分会带来跨包通信、公共组件复用（可用分包异步化 `componentPlaceholder` 化解）的复杂度；独立分包因为不加载主包，全局登录态、globalData 都不可直接用，必须单独设计。

---

## 二、性能问题：90% 的卡顿来自 setData 用法

### 2.1 setData 的通信开销

**现象**：滑动/输入/动画一开就掉帧，开发者工具流畅真机卡成 PPT。

**根因**：回到 1.1 的双线程图——每次 `setData` 都是「JS 序列化 → Native 中转 → WebView 反序列化 → 重渲染」的跨线程往返。三个放大器：

1. **频率高**：把 `setData` 放进 `touchmove`/轮询回调，每秒几十次跨线程通信；
2. **数据大**：传整个大对象/长数组，序列化与传输开销线性增长；
3. **路径深**：`this.setData({ list })` 全量覆盖 vs `this.setData({ 'list[3].status': 1 })` 局部更新，diff 成本差一个量级。

**规则化**（多方案对比）：

| 手段 | 做法 | 收益 |
| --- | --- | --- |
| 合并调用 | 高频数据变化先攒再发（16ms 节流批量 flush） | 通信次数从 N → 1 |
| 局部路径更新 | `setData({ 'list[2].checked': true })` | 传输量与 diff 范围最小化 |
| 纯展示数据用 wxs | 格式化逻辑放渲染层 | 完全绕开通信 |
| 动画不进 setData | 用 CSS transition/animation 或 `this.animate()` | 动画帧率与通信解耦 |
| 界面无关数据不进 data | 挂 `this.xxx`（非渲染用途的中间态） | 零通信 |

```js
// utils/batchSetData.js —— 高频更新合并器
export function createBatchSetter(page, flushInterval = 32) {
  let pending = {}
  let timer = null
  return {
    set(patch) {
      Object.assign(pending, patch)
      if (timer) return
      timer = setTimeout(() => {
        page.setData(pending)
        pending = {}
        timer = null
      }, flushInterval)
    },
    destroy() { if (timer) { clearTimeout(timer); timer = null } },
  }
}
// 使用：页面 onHide/onUnload 时 destroy()
```

**硬限制**：单次 `setData` 数据量上限 **1MB**；`data` 总量与传输频率都建议控制在远低于此（经验值：单次 < 100KB、非动画场景 > 100ms 间隔）。

### 2.2 长列表渲染

**方案对比**：

| 方案 | 原理 | 优点 | 缺点 | 适配场景 |
| --- | --- | --- | --- | --- |
| 分页加载 | `onReachBottom` 拉下一页 | 实现最简单 | 列表无限增长，节点多了照样卡 | 千条以内、快速上线 |
| `recycle-view`（官方） | 视口外节点回收复用 | 托管复杂度、性能好 | 需固定/可推断高度，接入有成本 | 千条以上通用流 |
| 自实现虚拟列表 | scroll-view + 高度占位 + 可视窗口切片 | 完全可控 | 自己填坑（不定高、快速滚动白屏） | 有特殊交互定制需求 |
| `lazy-load` 图片 | 图片进入视口才加载 | 减少首屏网络/解码 | 不减节点数 | 配合上述任一方案 |

**选择建议**：先分页 + 图片懒加载；数据量可见会破千就直接上 `recycle-view`，不要在「自实现虚拟列表」上重复造轮子——不定高列表的测量坑足够吃一周。

### 2.3 图片

高频坑与解法：

- **未压缩原图直出**：上传时用 `wx.compressImage`，展示走 CDN 裁剪参数（如阿里 OSS `?x-oss-process=image/resize,w_750/format,webp`），按容器尺寸要图而不是原图缩放；
- **image 组件默认 300×225 且不缩放**：忘记写 `mode` 导致拉伸变形——信息流缩略图用 `mode="aspectFill"`，详情大图用 `mode="widthFix"`；
- **长图内存爆掉**：几千像素高的长图在低端安卓机直接内存告警，长图切片或改用 webview 方案。

### 2.4 Canvas

- 老接口（`wx.createContext`）性能差且已不推荐；**新代码一律 `type="2d"`**（同层渲染 + 接口对齐 Web 标准）；
- 高频绘制（帧动画/粒子）考虑 **OffscreenCanvas**（离屏绘制，不占渲染层）或 WebGL（three.js 有小程序适配版 threejs-miniprogram）；
- 坑：canvas 在 `scroll-view`/`swiper` 内受同层渲染时机影响（见 5.3），真机与工具表现不一致，**必须真机回归**。

### 2.5 启动性能（补充：多数团队漏掉的一环）

| 手段 | 说明 |
| --- | --- |
| `lazyCodeLoading: "requiredComponents"` | 按需注入，减少启动时执行的代码量 |
| 初始渲染缓存 | 配置后二次打开直接渲染上次快照，白屏时间大幅缩短 |
| 数据预拉取 | 在 `app.json` 配 `preloadData`（或用「周期性更新」），启动时 Native 并行拉首屏数据，与 JS 初始化并行 |
| 主包瘦身 | 首页必须的代码才留主包，其余分包化 |

---

## 三、网络请求：管控环境下的工程化

### 3.1 域名白名单与 HTTPS（上线前后行为不一致的重灾区）

**规则**：`request`/`uploadFile`/`downloadFile` 的目标域名必须在 mp 后台**分别**配置为合法域名；域名必须 HTTPS（证书有效、TLS ≥ 1.2）且**已 ICP 备案**；协议、端口、子域名都要精确匹配。

**典型事故**：开发时工具勾了「不校验合法域名」一切正常 → 线上全员请求失败。**规避**：开发阶段就不勾选绕过（用测试环境正式域名），提审前用「预览/真机调试」完整回归一遍（这两个通道走线上域名校验）。

### 3.2 并发上限 10：请求队列

`wx.request` 全局最多 10 个并发，超出直接 fail。页面首屏十几个请求齐发就触雷。**方案对比**：

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| 后端合并接口（BFF 聚合首屏） | 并发数从根上减少，总耗时 = 最慢接口 | 需要后端配合改造 |
| 前端请求队列（并发限流） | 纯前端可控，通用 | 排队增加总耗时，只是不炸 |
| 非关键请求延后 | 首屏更快 | 埋点/配置类请求需要错误兜底 |

```ts
// utils/requestQueue.ts —— 并发限流器（上限可配）
interface Task { run: () => Promise<void> }

export function createRequestQueue(limit = 8): { push(task: Task): void } {
  const queue: Task[] = []
  let active = 0

  const next = (): void => {
    if (active >= limit || queue.length === 0) return
    active++
    const task = queue.shift()
    if (!task) { active--; return }
    task.run().finally(() => { active--; next() })
  }

  return {
    push(task: Task): void {
      queue.push(task)
      next()
    },
  }
}
```

### 3.3 其他高频网络坑

| 坑 | 现象 | 解法 |
| --- | --- | --- |
| 默认超时 60s | 弱网下用户面对「无限转圈」 | `wx.request` 显式传 `timeout: 10000`，全局请求封装统一配置 |
| 跨域 | 浏览器思维找 CORS 配置 | 小程序没有跨域概念，只有**域名白名单**；服务端无需配 CORS |
| 弱网体验差 | 请求失败整页空白 | storage 缓存兜底（上次数据先渲染 + 骨架屏），网络恢复再刷新 |
| 上传大文件失败 | `wx.uploadFile` 超时/中断 | 前端压缩 + 分片上传（后端提供分片合并接口），保存分片进度做断点续传 |

---

## 四、组件通信与页面跳转

### 4.1 通信方案选型（补齐：不止 props 和事件）

| 方案 | 通路 | 优点 | 缺点 | 适配场景 |
| --- | --- | --- | --- | --- |
| properties + triggerEvent | 父→子传值，子→父事件 | 官方范式、单向数据流清晰 | 跨层级要层层透传（props drilling） | 基础组件封装 |
| selectComponent | 直接拿子组件实例调方法 | 简单直接 | 破坏单向数据流，耦合紧 | 极少数命令式场景（如调子组件 scroll 方法） |
| **EventChannel** | 页面↔页面 | 官方通道，`navigateTo` 时双向传值，类型明确 | 仅 `navigateTo` 有效；`redirectTo` 后原页面销毁即断 | 详情页提交后回列表页刷新并传结果 |
| globalData | 全局共享 | 零依赖 | 非响应式（改了不自动更新视图）、易污染 | 登录态等低频变更的全局只读数据 |
| 状态管理库 | 全局响应式 | 跨页面组件统一订阅更新 | 引入依赖与心智模型 | 多页面强联动的复杂应用（选型见姊妹篇） |
| storage | 持久化 | 重启仍在 | 异步 API、非响应式 | 持久缓存，不作通信用 |

```js
// 页面A：跳转并监听回传
wx.navigateTo({
  url: '/packageOrder/pages/detail/detail?id=1',
  events: {
    orderConfirmed(payload) { this.refreshList(payload) },
  },
  success(res) {
    res.eventChannel.emit('init', { from: 'list', filter: 'pending' })
  },
})

// 页面B：接收并回传
const channel = this.getOpenerEventChannel()
channel.on('init', (data) => this.initPage(data))
// 确认后
channel.emit('orderConfirmed', { orderId: 123 })
```

### 4.2 页面栈 10 层上限

**现象**：列表 → 详情 → 列表 → 详情……第 10 次 `navigateTo` 后无反应，真机无任何提示。

**根因**：`navigateTo` 是「压栈」，页面栈上限 10 层。

| 解法 | 语义 | 适配场景 |
| --- | --- | --- |
| `redirectTo` | 关当前页再开新页（栈深不变） | 「列表→详情→列表」无限循环链路 |
| `navigateBack` | 回退 | 详情页操作完成返回 |
| `reLaunch` | 清空栈重开 | 登出、支付完成回到首页 |
| 栈深守卫封装 | 跳转前检查 `getCurrentPages().length`，≥10 自动降级 `redirectTo` | 通用兜底，写进路由工具函数 |

### 4.3 tabBar 跳转

**现象**：`navigateTo` 跳 tabBar 页面「成功但没反应」。tabBar 页面（配置在 `tabBar.list` 里的）必须用 `wx.switchTab`，且**不能带 query 参数**（参数需求用全局状态或 storage 传递）。自定义 tabBar 则是另一套 `custom-tab-bar` 组件方案，坑在「每个 tabBar 页都要同步选中态」。

---

## 五、兼容性：真机差异不玄学，分类处理

### 5.1 渲染差异

| 差异 | 表现 | 解法 |
| --- | --- | --- |
| iOS WKWebView vs 安卓 chromium | 同一段 CSS 两个渲染引擎表现不同：字体基线、`box-shadow` 模糊半径、默认字体 | 关键样式显式声明（font-family 兜底、阴影用半透明边框替代）；样式用 rpx + flex 为主，少用奇技淫巧 |
| 1rpx 细线丢失 | 1rpx 在部分 dpr 机型被取整为 0 | 设计稿 750 上的 hairline 用 0.5px + `transform: scaleY(0.5)`，或 `box-shadow` 模拟 |
| 键盘顶起页面 | iOS `input` 聚焦整页上推，安卓仅滚动视口 | `adjust-position="{{false}}"` + 手动监听 `bindkeyboardheightchange` 布局 |
| 低端安卓掉帧 | 动画卡顿、长列表滚动卡 | 降级策略：`wx.getDeviceInfo().benchmarkLevel` 检测机型档位，低端机关闭重动效/降图片质量 |

### 5.2 API 版本兼容

**现象**：新 API 在低版本微信/基础库上 `undefined`，直接白屏报错。

**规则**：凡是非上古稳定 API，先判断再用——`wx.canIUse('getLocation.scope')` 判能力、`if (wx.xxx)` 判存在、`getApp().baseInfo.SDKVersion` 比版本号。同时在 mp 后台设置**最低基础库版本**，低于该版本提示升级微信。注意 `getSystemInfoSync` 已被官方拆分废弃，新代码用 `getWindowInfo`/`getDeviceInfo`/`getAppBaseInfo`。

### 5.3 安全区与原生组件层级（补齐：两个高频「真机才现形」坑）

**安全区**：iPhone 刘海/灵动龙、安卓全面屏手势条会遮挡内容。解法：自定义 navigationStyle 时用 `safe-area-inset-bottom`（WXSS 支持 `env()`），或 `wx.getWindowInfo().safeArea` 手动计算 padding。

**原生组件层级**：`video`/`map`/`canvas`/`live-player` 曾是「层级最高、盖不住」的组件，弹窗浮层被视频穿透是经典事故。现状：基础库 2.4.4+ 已全面**同层渲染**（原生组件融入普通节点树，可用普通 view 覆盖），但**同层渲染有时机问题**——组件创建初期/极端机型仍可能穿透，保险做法是弹层用 `cover-view` 兜底或对 video 暂时隐藏。canvas 在 scroll-view/swiper 内的同层渲染在部分安卓机型闪烁，此类页面**必须真机回归**。

---

## 六、发布与审核：合规是硬门槛

### 6.1 上线前置条件（很多团队的认知缺口）

| 事项 | 说明 |
| --- | --- |
| ICP 备案 | **2023 年 9 月起新注册小程序必须完成备案才能上架**，存量小程序也需限期完成，否则不能发版。备案周期 1~3 周，务必排进项目计划 |
| 隐私保护指引 | 2023-09-15 起，调用**隐私接口**（`chooseMedia`、`getLocation`、`chooseAddress` 等）前必须在小程序后台配置《用户隐私保护指引》并在代码中处理授权时机（`wx.requirePrivacyAuthorize` / `onNeedPrivacyAuthorization`），否则接口直接静默失败 |
| 类目与资质 | 选错类目或缺少资质文件（如电商需 ICP 许可证、社交需相关备案）直接拒审 |
| 测试账号 | 审核要提供可体验全部功能的演示账号，账号过期或功能残缺是高频拒因 |

### 6.2 高频拒审原因

1. **登录/用户信息不规范**：强制授权手机号才能用基础功能；`getUserProfile` 已废弃，头像昵称改用「头像昵称填写能力」（button open-type）；手机号快速验证组件是**收费服务**（约 0.03 元/次），计费与频控要提前规划；
2. **虚拟支付**：iOS 端购买虚拟商品（会员、课程、游戏币）**不允许微信支付**，必须走 IAP 或引导安卓端购买——苹果税红线，屡试屡拒；
3. **内容安全缺失**：UGC（发帖/评论/头像昵称）未接内容安全检测（见 7.3），被抽到直接下架；
4. **诱导行为**：强制分享后解锁、分享文案带诱导词、二维码跳转外部（含个人微信号导流）；
5. **体验问题**：页面白屏、明显 bug、webview 打开就是一张二维码海报。

### 6.3 体验版与正式版不一致

| 差异源 | 规避 |
| --- | --- |
| 环境变量未切换 | 构建注入 env（dev/staging/prod），禁止手改代码切环境 |
| 域名/白名单 | 测试环境域名也要配进后台合法域名 |
| 基础库版本 | 开发者工具「切换基础库版本」覆盖最低~最高区间回归 |
| 代码版本 | 提审版本 ≠ 开发版：以「预览」二维码 + 体验版做最终验收 |

### 6.4 发布节奏（补齐：出事了怎么办）

- **分阶段发布**：提审通过后不必全量，按 5% → 20% → 50% → 100% 灰度，观察崩溃/投诉再放量；
- **版本回退**：线上事故可一键回退到上个线上版本（代码层面立即止血，再排查）；
- **强制更新**：`wx.getUpdateManager()` 监听版本更新，`onUpdateReady` 后提示用户重启应用，避免新旧版本缓存混跑：

```js
// app.js onLaunch
const updater = wx.getUpdateManager()
updater.onUpdateReady(() => {
  wx.showModal({
    title: '更新提示',
    content: '新版本已就绪，是否重启应用？',
    success(res) { if (res.confirm) updater.applyUpdate() },
  })
})
```

---

## 七、与后端协作：把问题消灭在接口设计期

### 7.1 接口返回格式统一

**现象**：有的接口 `{code, data, msg}`，有的裸数组，有的成功返回 200 有的业务错误也 200——前端每接一个接口写一套适配。**规则**：统一 response schema（`{ code, data, message }`，HTTP 状态码只表达传输层），请求层统一拦截 code 分发（登录失效、业务错误、内容审核失败各自的跳转/提示策略），组件只拿 `data`。

### 7.2 防重复提交（弱网重灾区）

小程序在地铁/电梯弱网下，用户看不到 loading 就会连点。**双层防御**：

- **前端**：按钮 `loading`/`disabled` + 请求锁（提交中直接 return）+ 请求层针对 POST 默认开启「同 URL 在途去重」；
- **后端**：**幂等键**——前端生成 `Idempotency-Key`（uuid）随表单提交，后端同一键重复请求返回首次结果。只有后端幂等才是真正的安全，前端只是体验优化。

### 7.3 内容安全（不做会被封禁）

任何 UGC（用户昵称、评论、图片、语音转文字）都必须过微信内容安全接口，否则被举报后轻则下架整改、重则封禁：

| 接口 | 用途 | 要点 |
| --- | --- | --- |
| `security.msgSecCheck` | 文本检测 | v2 需传用户 openid；命中违规返回具体标签 |
| `security.mediaCheckAsync` | 图片/音频异步检测 | 异步回调，发布时先「审核中」状态，回调后再放行 |
| 云开发 `security.imgSecCheck` | 图片同步检测 | 云调用免 access_token，小图快检 |

检测时机：提交时同步拦截 + 展示前异步兜底（对抗「提交时正常、展示时违规」的时间差）。

### 7.4 登录态与 token 续期

小程序登录链路（`wx.login` 拿 code → 后端换 openid/session_key → 颁发自家 token）在姊妹篇已有完整实现。补充协作约定两条：

- token 过期应由**请求层统一刷新重放**（401 拦截 + 单飞刷新），而不是每个页面自己处理；
- session_key **绝不下发到前端**，解密手机号等操作必须由后端完成。

---

## 八、开发前必查清单（补充完善版）

原文 12 项保留，补齐为「带验收要点」的检查表：

| # | 事项 | 验收要点 |
| --- | --- | --- |
| 1 | 域名备案 + HTTPS + 白名单 | request/upload/download 三类域名都配齐；证书链完整；预览模式真机验证 |
| 2 | 主包/分包规划 | 主包 < 1.5MB 留余量；活动页独立分包；高频链路配 preloadRule |
| 3 | 状态管理方案 | 简单应用 globalData 即可；跨页联动才上状态库，别过度设计 |
| 4 | UI 适配 | 安全区 `env()` 处理；hairline 方案确定；低端机降级策略 |
| 5 | 图片管线 | CDN 裁剪参数约定；webp；`lazy-load`；`mode` 明确 |
| 6 | 长列表方案 | 预估数据量级，超千条直接 recycle-view |
| 7 | 请求层封装 | 统一 timeout/错误码分发/并发队列/401 刷新 |
| 8 | 内容安全 | UGC 入口全部过检；异步检测的「审核中」状态设计 |
| 9 | 登录态管理 | code 换 token 链路；session_key 不出后端；过期静默续期 |
| 10 | 环境变量 | 构建注入三套环境；提审前 prod 校验清单 |
| 11 | 发布流程 | 备案完成；隐私指引配置；灰度计划；回退预案；UpdateManager |
| 12 | 监控告警 | 接入小程序「运营中心」性能/错误监控或自建埋点（wx.onError / onUnhandledRejection 上报） |

---

## 九、总结：坑的「根因 → 领域」映射

| 根因 | 衍生的坑 | 领域 |
| --- | --- | --- |
| 双线程通信模型 | setData 卡顿、wxs 存在的意义、动画掉帧、跨线程传大对象慢 | 性能 |
| 非 WebView 逻辑层 | 无 DOM/BOM、库不兼容、动态代码禁止 | 框架 |
| WebView 渲染层 | CSS 支持不全、双端渲染差异、同层渲染时机 | 兼容性 |
| 平台管控 | 域名白名单、备案、隐私接口、虚拟支付、内容安全、审核 | 发布 |
| 资源受限环境 | 并发 10、包体积 2MB、storage 10MB、页面栈 10 层、低端安卓 | 限制 |
| 弱网移动场景 | 上传失败、重复提交、超时策略、缓存兜底 | 协作 |

**适配场景回顾**：本文方案以微信原生小程序为基准；用 Taro/uni-app 开发时，这些坑 90% 依然存在（它们编译后仍跑在小程序运行时里），额外多一层「框架层差异坑」（条件编译、跨端 API 不一致），在姊妹篇与[《Taro 与 uni-app 选型》](/post/taro-vs-uniapp)中展开。

**局限性**：平台规则（包限制、隐私政策、审核标准、计费）随时间调整，本文数字以 2026 年中的微信官方文档为准，落地前请以官方文档为最终依据；性能经验值（setData 100ms/100KB 等）是社区与官方建议的综合，不同机型水位不同，应以自己业务的真机 profiler 数据为准。
