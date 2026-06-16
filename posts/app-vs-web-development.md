---
title: App 开发与常规页面开发的区别：从技术栈到工程化的全方位对比
date: '2026-06-13'
tags:
  - App 开发
  - 前端
  - 跨端
  - 工程化
category: 前端基础
summary: >-
  从「为什么同一个功能要写两遍」和「老板说做个 App，到底该用哪种技术栈」的实际困惑出发，系统对比原生 App、混合 App、跨平台 App、Web 页面、小程序五种方案的技术架构、开发模式、能力边界、性能特征、发版流程、成本与适配场景，帮助你在不同业务诉求下做出合理选型。
---

# App 开发与常规页面开发的区别：从技术栈到工程化的全方位对比

## 一、问题来源

在实际工作中，前端同学经常会遇到这样的困惑：

**业务侧的痛点：**

- 产品经理说「这个功能 H5 已经有了，能不能包成 App？」——结果是套了个壳，体验一塌糊涂
- 老板说「做个 App」，但没说清楚是 iOS + Android 双端原生，还是一套代码跨平台，还是直接做 Web App
- 同一个功能，H5 版本已经上线，App 版本却要等一个月才能发版审核通过
- 用户反馈「App 里点链接跳出去就回不来了」，而 H5 页面加载慢得像上个世纪

**技术侧的痛点：**

- 写惯了浏览器里的页面，转去做 App，发现连「网络请求」都要重新学一套 API
- 不知道 RN（React Native）、Flutter、Uni-app、Taro 这些跨端方案到底有什么本质区别
- 同样的业务逻辑，Web 用 fetch，iOS 用 URLSession，Android 用 OkHttp，Android 还要分 Java 和 Kotlin，维护成本爆炸
- App 的发版要过应用商店审核，H5 发版只要发 CDN，流程差异巨大，不知道如何取舍

这些问题的根源在于：**App 开发和常规页面开发，虽然在 UI 层面看起来都是「画界面 + 调接口」，但底层运行环境、能力边界、工程化流程、性能模型都存在根本性差异**。理解这些差异，才能做出正确的选型和架构决策。

---

## 二、本质区别：运行环境与能力边界

在讨论具体方案前，先厘清 App 和 Web 页面在**运行环境**上的根本区别，这是所有技术差异的源头。

### 2.1 运行容器对比

| 维度 | 常规 Web 页面 | 原生 App |
|------|--------------|---------|
| 运行环境 | 浏览器（Safari/Chrome/WebView） | 操作系统进程 |
| 代码载体 | HTML/CSS/JS（解释执行） | 编译后的二进制（机器码） |
| UI 渲染 | 浏览器渲染引擎（Blink/WebKit） | 系统原生 UI 框架（UIKit/View/Compose） |
| JS 引擎 | V8 / JavaScriptCore | 可选（JSCore/V8/Hermes）或无 |
| 沙箱限制 | 强（同源策略、权限受限） | 弱（拿到系统权限就能用） |
| 文件系统 | 受限（只能访问特定目录） | 完整（沙箱目录 + 申请权限后可扩展） |
| 离线能力 | 弱（Service Worker 有缓存上限） | 强（本地数据库无限制） |

### 2.2 系统能力访问

这是 App 相对 Web 最大的优势：

| 能力 | Web 页面 | App |
|------|---------|-----|
| 摄像头/麦克风 | 需用户授权，部分浏览器支持 | 完整支持，可深度集成 |
| 推送通知 | Web Push（iOS 支持有限） | 原生推送（APNs/FCM） |
| 后台运行 | 几乎不行（Service Worker 受限） | 完整后台任务 |
| 蓝牙/NFC | Web Bluetooth（兼容性差） | 完整支持 |
| 本地存储 | localStorage 5MB / IndexedDB 几百 MB | 无限制 |
| 文件读写 | 受限（File System Access API 实验性） | 完整 |
| 传感器（陀螺仪/加速计） | DeviceMotion（精度有限） | 完整、低延迟 |
| 进程保活 | 不行 | 可以前台服务/后台任务保活 |

**关键结论**：如果你的业务需要「后台持续定位」「蓝牙连接硬件设备」「高性能图形渲染」「强推送能力」，基本只能做 App；如果只是内容展示 + 表单 + 简单交互，Web 页面足够。

### 2.3 性能模型

| 指标 | Web 页面 | App |
|------|---------|-----|
| 启动速度 | 受网络影响大（首屏 1-3s） | 快（冷启动 0.5-1s） |
| 渲染性能 | 受 JS 单线程限制 | 可多线程 + GPU 加速 |
| 内存上限 | 浏览器 tab 有限制（约几百 MB） | 几个 GB（系统决定） |
| 动画流畅度 | 复杂动画容易卡（60fps 难保证） | 60fps/120fps 稳定 |
| 离线可用 | 需 PWA 配置 | 天然离线 |

---

## 三、五种主流方案对比

了解本质区别后，来看实际有哪些方案，以及它们如何在「App 体验」和「Web 开发效率」之间做权衡。

### 3.1 方案全景图

按「接近原生体验」和「开发效率」两个维度划分：

```
开发效率高 ←————————————————————————————→ 开发效率低（多端重复开发）

  Web 页面（H5）
       ↑
   PWA（渐进式 Web 应用）
       ↑
   小程序（微信/支付宝/字节）
       ↑
   跨平台 App（RN / Flutter / Uni-app）
       ↑
   混合 App（Hybrid / Cordova / Ionic）
       ↑
   原生 App（iOS Swift / Android Kotlin）
       ↑
原生体验好
```

### 3.2 方案逐个详解

#### 方案 1：常规 Web 页面（H5）

**技术栈**：HTML + CSS + JavaScript（React/Vue/Angular）

**架构**：
```
用户浏览器
    ↓
浏览器内核（Blink/WebKit）
    ↓
渲染 DOM + 执行 JS
    ↓
HTTP 请求后端 API
```

**优点：**
- 开发效率最高，一套代码所有设备访问
- 发版即时（部署到 CDN 即生效），无需审核
- 迭代快，A/B 测试方便
- 用户无需安装，扫码/链接即用
- SEO 友好（SSR/SSG 方案）

**缺点：**
- 受浏览器能力限制，无法访问深度系统 API
- 弱网下体验差（首屏白屏）
- 无法在桌面常驻图标（PWA 部分解决）
- 无法后台运行
- 受同源策略、Cookie/Storage 限制

**适配场景：**
- 内容型产品（资讯、博客、官网）
- 营销活动页、H5 落地页
- 后台管理系统、B 端工具
- 不需要深度系统集成的工具类应用

**局限性：**
- 重交互、重图形（如游戏、视频剪辑）性能不够
- 强依赖网络的场景体验差

#### 方案 2：PWA（Progressive Web App）

**技术栈**：Web 技术 + Service Worker + Web Manifest

**架构**：
```
Web 页面 + Service Worker（离线缓存）
        + Web App Manifest（添加到桌面）
        + Push API（推送）
```

**优点：**
- 仍用 Web 技术开发，复用前端技能
- 可「添加到桌面」，模拟 App 图标
- Service Worker 提供离线能力
- 支持推送（Android 完整，iOS 16.4+ 需手动安装后支持）

**缺点：**
- iOS 上限制多，体验不如原生
- 系统能力仍受限（蓝牙、NFC 兼容性差）
- 用户安装意愿低（需手动从浏览器「添加到主屏幕」）
- 商店分发渠道缺失，曝光有限

**适配场景：**
- 轻量级工具应用（待办、笔记）
- 已有 Web 站点想提升留存
- 不想投入 App 开发成本又想要「类 App」体验

**局限性：**
- 无法上架 App Store/Google Play（除非用 TWA 包装）
- iOS 体验打折扣，不推荐作为主力方案

#### 方案 3：原生 App（Native App）

**技术栈**：
- iOS：Swift / Objective-C + UIKit / SwiftUI
- Android：Kotlin / Java + Jetpack Compose / View

**架构**：
```
编译后的二进制
    ↓
直接调用系统 API（UIKit/Android SDK）
    ↓
原生 UI 框架渲染
```

**优点：**
- 性能最强，启动快、动画流畅
- 完整访问所有系统能力（摄像头、传感器、推送、后台）
- 体验最贴近系统（手势、动画、原生组件）
- 上架商店，分发渠道稳定
- 安全性高（可加密、防反编译）

**缺点：**
- 开发成本最高，iOS + Android 要写两套代码
- 需要学习 Swift / Kotlin，前端技能难复用
- 发版慢，需经过商店审核（iOS 1-7 天，Google Play 1-3 天）
- 包体积大，用户下载成本高
- 版本碎片化严重（用户不更新，老版本 bug 难修复）

**适配场景：**
- 高性能要求的应用（游戏、视频剪辑、3D 渲染）
- 强系统集成需求（蓝牙硬件、IoT、车机）
- 高频核心业务（微信、抖音、淘宝主端）
- 对安全性要求高的金融、政务应用

**局限性：**
- 小团队、初创项目成本难以承受
- 双端维护，人力消耗大

#### 方案 4：混合 App（Hybrid App）

**技术栈**：Web 技术 + 原生壳（Cordova / Ionic / Capacitor）

**架构**：
```
原生 App 壳
    ↓
内嵌 WebView（加载本地或远程 H5）
    ↓
通过 JSBridge 桥接调用原生能力
    ↓
H5 渲染 UI
```

**关键机制——JSBridge**：
```javascript
// H5 调用原生能力
window.NativeBridge.callHandler('takePhoto', { quality: 'high' }, (result) => {
    console.log('拍照结果：', result.base64);
});

// 原生调用 H5
window.NativeBridge.registerHandler('onPushReceived', (data) => {
    // 处理推送
});
```

**优点：**
- 复用前端技能（HTML/CSS/JS），开发效率高
- 一套代码多端运行
- 发版灵活（H5 部分可热更新，绕过商店审核）
- 桥接原生能力，能调用摄像头、推送等

**缺点：**
- 性能比原生差（WebView 渲染开销）
- 体验受 WebView 版本影响（Android 上 WebView 碎片化严重）
- 复杂交互卡顿（列表滚动、动画）
- 桥接通信有性能损耗，频繁调用导致卡顿
- 调试困难（H5 + 原生两层）

**适配场景：**
- 业务变化频繁、需要快速迭代的应用
- 内容型 App（资讯、电商详情页）
- 已有大量 H5 资产想包装成 App
- 团队以前端为主，原生资源有限

**局限性：**
- 不适合性能敏感场景
- 需要维护 JSBridge 协议

#### 方案 5：跨平台 App（React Native / Flutter / Uni-app）

这是目前的主流选择，用一套代码生成接近原生的体验。

##### 5.1 React Native（RN）

**技术栈**：React + JavaScript/TypeScript + RN 组件

**架构（新架构 Fabric）**：
```
JS 线程（React 逻辑）
    ↓
Bridge / JSI（C++ 通信层）
    ↓
Shadow Thread（计算布局）
    ↓
Main Thread（渲染原生组件）
```

**特点**：
- 用 React 写 UI，最终渲染为原生组件（不是 WebView）
- 通过 JSI（新架构）实现 JS 与原生的同步通信
- 生态成熟，社区大，第三方库丰富
- 支持 Hot Reload，开发体验好

**优点：**
- 接近原生性能（不走 WebView）
- 前端技能直接复用
- 跨 iOS/Android 一套代码
- 可与原生模块混编（性能关键部分用原生）

**缺点：**
- 仍比原生慢（JS 与原生通信有开销）
- 依赖原生模块，遇到不支持的特性需要自己写原生代码
- 包体积较大
- 新老架构切换期，部分老库不兼容

##### 5.2 Flutter

**技术栈**：Dart 语言 + Flutter 框架 + Skia/Impeller 渲染引擎

**架构**：
```
Dart 代码
    ↓
Flutter Framework（Widgets）
    ↓
Skia / Impeller（自绘渲染引擎）
    ↓
直接绘制到屏幕（不依赖原生 UI 组件）
```

**特点**：
- **自绘引擎**，不使用系统原生 UI 组件，UI 高度一致
- 性能接近原生（60fps/120fps 稳定）
- Dart 语言 AOT 编译为机器码
- 一套代码可同时编译 iOS / Android / Web / 桌面

**优点：**
- 性能最佳（自绘 + AOT）
- UI 一致性极强（双端完全一样）
- 开发效率高（Hot Reload）
- 同时支持移动端 + Web + 桌面

**缺点：**
- Dart 语言学习成本（非主流语言）
- 包体积大（要打包 Skia 引擎，约 5-10MB 起步）
- 与原生模块交互较繁琐（需通过 Platform Channel）
- 生态比 RN 略小，国内资料相对少
- 文字渲染、辅助功能（无障碍）依赖原生适配

##### 5.3 Uni-app / Taro（小程序优先）

**技术栈**：Vue（Uni-app）/ React（Taro）+ 各小程序平台

**特点**：
- 一套代码编译到多个小程序平台（微信/支付宝/字节/百度）+ H5 + App
- 国内生态，符合国情
- 编译式，非运行时跨端

**优点：**
- 一次开发，多端覆盖（小程序 + H5 + App）
- 国内文档、组件库齐全（uView、Vant Weapp）
- 接入微信生态方便（登录、支付、分享）

**缺点：**
- App 端体验不如 RN/Flutter（底层基于 WebView + Weex/5+）
- 各平台 API 差异需用条件编译处理
- 性能受小程序平台限制

**跨平台方案对比表：**

| 维度 | React Native | Flutter | Uni-app |
|------|-------------|---------|---------|
| 语言 | JS/TS | Dart | Vue/JS |
| 渲染方式 | 原生组件 | 自绘（Skia） | WebView + nvue |
| 性能 | 接近原生 | 最佳（接近原生） | 一般（App 端弱） |
| 双端一致性 | 较好 | 极高 | 较好 |
| Web 支持 | 官方支持 | 官方支持 | 原生支持 |
| 桌面支持 | 社区方案 | 官方支持 | 不支持 |
| 学习成本 | 低（前端友好） | 中（学 Dart） | 低（Vue 友好） |
| 包体积 | 中（~10MB） | 大（~5-10MB） | 小 |
| 生态 | 大 | 大（Google 力推） | 国内大，国外小 |
| 适合团队 | 前端团队 | 愿意学新语言 | 国内全端覆盖 |

---

## 四、工程化流程差异

App 和 Web 在工程化流程上差异巨大，这是很多团队容易忽视的成本点。

### 4.1 发版流程对比

**Web 发版：**
```
开发 → 代码合并 → CI 构建 → 部署 CDN → 用户刷新即用
                    ↑
            全程分钟级
```

**App 发版：**
```
开发 → 代码合并 → CI 构建 → 打包 IPA/APK →
    → 提交商店审核（1-7 天）→ 上架 → 用户手动/自动更新
                                            ↑
                                    老用户可能不更新
```

**关键差异：**
- Web 发版即时，App 发版有审核延迟
- Web 用户永远用最新版，App 用户版本碎片化
- Web 出 bug 改完立即上线，App 要重新提审
- 这也是为什么 App 都想方设法做**热更新**（动态化方案）

### 4.2 热更新（动态化）

由于 App 发版慢，业内发展出多种热更新方案：

| 方案 | 原理 | 代表 |
|------|------|------|
| H5 壳 | 关键页面用 H5，改 H5 即可 | 早期淘宝、美团 |
| Lua 脚本 | 嵌入 Lua 解释器，下载脚本执行 | 游戏行业 |
| React Native | 下载新 JS Bundle 替换 | Facebook、微软 |
| 动态化框架 | 自研 DSL + 解释器 | 美团 Walle、阿里 Tangram、腾讯动态化 |
| Flutter | 官方不支持，需自研（如 MTFlutter） | 美团 |

**注意**：苹果对热更新有政策限制，过度使用（如下发可执行二进制）可能被拒审。

### 4.3 包体积与分发

| 维度 | Web | App |
|------|-----|-----|
| 用户安装 | 无需安装 | 需下载几十 MB 到几百 MB |
| 分发渠道 | URL（扫码/链接） | 应用商店（ASO 优化） |
| 用户获取成本 | 低 | 高（需引导下载） |
| 留存率 | 低（无图标，易流失） | 高（图标常驻） |

### 4.4 调试与监控

**Web 调试**：Chrome DevTools，所见即所得，刷新即重试。

**App 调试**：
- iOS：Xcode + Instruments，需真机连接
- Android：Android Studio + Profiler
- RN：Flipper / React Native Debugger
- Flutter：Flutter DevTools

**监控**：
- Web：性能监控相对成熟（Web Vitals）
- App：崩溃监控（Bugly / Firebase Crashlytics / Sentry）、ANR 监控、性能埋点更复杂

---

## 五、技术栈与代码组织对比

以「调用摄像头并上传」这个常见需求为例，对比各方案的代码差异。

### 5.1 Web 实现

```javascript
// 浏览器原生 API
async function takePhoto() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // 显示视频流、抓帧、上传...
    const formData = new FormData();
    formData.append('photo', blob);
    await fetch('/api/upload', { method: 'POST', body: formData });
}
```

### 5.2 iOS 原生（Swift）

```swift
import AVFoundation
import UIKit

class CameraController: UIViewController, UIImagePickerControllerDelegate {
    func takePhoto() {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = self
        present(picker, animated: true)
    }

    func imagePickerController(_ picker: UIImagePickerController,
                               didFinishPickingMediaWithInfo info: [String: Any]) {
        let image = info[.originalImage] as? UIImage
        let data = image?.jpegData(compressionQuality: 0.8)
        upload(data: data!)
    }

    func upload(data: Data) {
        var request = URLRequest(url: URL(string: "https://api.example.com/upload")!)
        request.httpMethod = "POST"
        // URLSession 上传...
    }
}
```

### 5.3 React Native 实现

```tsx
import { launchCamera } from 'react-native-image-picker';

async function takePhoto() {
    const result = await launchCamera({ mediaType: 'photo', quality: 0.8 });
    if (result.assets?.[0]) {
        const formData = new FormData();
        formData.append('photo', {
            uri: result.assets[0].uri,
            type: 'image/jpeg',
            name: 'photo.jpg',
        });
        await fetch('https://api.example.com/upload', {
            method: 'POST',
            body: formData,
        });
    }
}
```

**对比结论**：
- Web 最简洁，但受能力限制
- 原生最强大，但代码繁琐、双端不一致
- RN 在简洁性和能力之间取得平衡，是前端团队做 App 的首选

---

## 六、选型决策矩阵

根据业务诉求，给出选型建议：

### 6.1 按业务类型选型

| 业务类型 | 推荐方案 | 理由 |
|---------|---------|------|
| 资讯/博客/官网 | Web（H5） | 内容驱动，无需系统集成 |
| 营销活动页 | Web（H5） | 短周期、易传播 |
| 电商详情页 | Web（H5） | 频繁变化、SEO 需求 |
| 后台管理系统 | Web（H5） | 桌面端，B 端工具 |
| 工具型 App（天气、待办） | RN / Flutter | 中等性能，快速迭代 |
| 社交/内容 App（小红书类） | RN（核心页）+ 原生（性能页） | 混合架构，平衡性能和效率 |
| 高性能 App（游戏、剪辑） | 原生 + 游戏引擎 | 性能至上 |
| 强系统集成（IoT、车机） | 原生 | 蓝牙/传感器深度集成 |
| 微信生态业务 | 小程序 | 接入微信流量 |
| 全端覆盖（小团队） | Uni-app / Flutter | 一套代码多端 |

### 6.2 按团队构成选型

| 团队构成 | 推荐方案 |
|---------|---------|
| 纯前端团队 | RN / Uni-app / Web |
| 有原生工程师 | 原生 + RN 混合 |
| 全栈小团队 | Flutter（一套语言搞定多端） |
| 大厂多端团队 | 各端原生 + 自研动态化框架 |

### 6.3 按预算与周期选型

| 资源情况 | 推荐方案 |
|---------|---------|
| 预算低、周期短 | Web / 小程序 |
| 预算中、要 App | RN / Flutter（一套代码） |
| 预算高、要最佳体验 | 原生双端 |

---

## 七、实际架构：混合架构是主流

真实的大型 App 几乎都不是纯单一方案，而是**混合架构**：

```
                    典型大型 App 架构
┌────────────────────────────────────────────┐
│  原生外壳（启动、路由、Tab 切换）              │
├────────────────────────────────────────────┤
│  首页/核心页：原生或 Flutter/RN              │
│  （启动性能关键，体验要求高）                  │
├────────────────────────────────────────────┤
│  业务详情页：RN / Flutter                    │
│  （频繁迭代，跨端复用）                       │
├────────────────────────────────────────────┤
│  活动营销页：WebView 内嵌 H5                  │
│  （快速上线，无需发版）                       │
├────────────────────────────────────────────┤
│  动态化卡片：自研 DSL                         │
│  （运营配置，无需开发介入）                    │
└────────────────────────────────────────────┘
```

**典型代表：**
- **美团**：原生外壳 + RN 业务页 + H5 活动页 + 自研动态化
- **淘宝**：原生 + Weex（阿里自研）+ H5
- **小红书**：原生核心 + Flutter 部分页面
- **字节系（抖音/今日头条）**：原生 + 自研动态化框架 + H5

**这种混合架构的工程化要点：**
1. 统一的路由分发（H5/RN/原生之间无缝跳转）
2. 统一的登录态、埋点、监控
3. 统一的 JSBridge 协议
4. 性能预算管理（不同方案各有性能门槛）
5. 容器化（每个业务方独立开发、独立发版）

---

## 八、Web 与 App 趋势：边界在模糊

### 8.1 Web 越来越像 App

- **PWA**：让 Web 有离线、推送、桌面图标能力
- **WebAssembly**：让 Web 能跑 C++/Rust，性能接近原生
- **File System Access API**：Web 可以读写本地文件
- **WebGPU**：Web 上做高性能图形计算
- **Capacitor / Tauri**：把 Web 包装成桌面/移动 App，体验接近原生

### 8.2 App 越来越像 Web

- **动态化框架**：App 通过下发配置/脚本动态生成 UI
- **小程序**：本质是「App 内的 Web 容器」
- **React Native / Flutter for Web**：App 框架反向编译到 Web

### 8.3 选型的未来趋势

- **轻量业务**：Web + PWA 足够
- **中等复杂度**：Flutter / RN（一套代码多端）
- **核心体验**：原生 + 动态化框架
- **微信生态**：小程序 + Web

---

## 九、常见误区与避坑

### 9.1 「H5 加个壳就是 App 了」

**错**。直接把 H5 包成 App（Hybrid）会有几个问题：
- 弱网下白屏，体验差
- WebView 性能差，列表滚动卡
- iOS/Android WebView 兼容性问题
- 用户感知到「这不是真正的 App」，留存低

**正确做法**：核心页用原生或 RN/Flutter，H5 仅用于活动页、营销页。

### 9.2 「跨平台 = 完全一套代码」

**错**。所有跨平台方案都需要处理：
- 平台差异（iOS/Android 设计规范不同）
- 条件编译（不同平台调不同 API）
- 原生模块（部分功能需写原生代码）
- UI 适配（沉浸式状态栏、安全区域、刘海屏）

实际项目中，跨平台大概能复用 70-90% 代码，剩余 10-30% 仍需平台特定处理。

### 9.3 「上了 RN/Flutter 就不用学原生了」

**错**。复杂项目一定会遇到：
- 性能优化（需要看原生 Profiler）
- 三方库问题（需要看原生源码）
- 原生模块开发（无现成库时）
- 集成推送、支付、统计等原生 SDK

跨平台方案降低门槛，但没消除对原生知识的需求。

### 9.4 「App 发版太慢，所以全用 H5」

**片面**。要分场景：
- 高频核心页：值得发版，保证体验
- 低频运营页：H5 合适
- 用户首屏：必须原生（启动速度关键）

---

## 十、总结与选型建议

### 10.1 核心差异一句话总结

| 维度 | Web 页面 | App |
|------|---------|-----|
| 本质 | 浏览器内的解释执行 | 系统进程的编译执行 |
| 能力 | 受沙箱限制 | 完整系统能力 |
| 性能 | 中（受网络和单线程限制） | 高（多线程、GPU） |
| 发版 | 即时 | 慢（审核 + 用户更新） |
| 成本 | 低（一套代码） | 高（双端 + 维护） |
| 体验 | 一般 | 优秀（贴近系统） |

### 10.2 给不同角色的建议

**前端工程师想做 App**：
- 入门首选 React Native（技能复用率高）
- 想多端覆盖选 Flutter（含 Web + 桌面）
- 国内全端覆盖选 Uni-app（含小程序）

**产品经理做选型**：
- 流量主要来自微信：先做小程序
- 想长期留存用户：做 App（RN/Flutter 性价比高）
- 预算有限、验证 MVP：先做 H5，验证后再投入 App

**技术 Leader 做架构**：
- 不要追求「一种方案打天下」
- 核心页原生/RN/Flutter + 营销页 H5 + 卡片动态化
- 优先建设路由分发、登录态、埋点、JSBridge 等基础设施

### 10.3 一句话决策

> **能用 Web 解决的就别做 App，做 App 就别图省事纯套 H5 壳，跨平台方案（RN/Flutter）是大多数中等复杂度业务的最优解，混合架构是大型 App 的必然选择。**

理解 App 开发和常规页面开发的本质差异，不是为了「二选一」，而是为了在不同业务场景下做出最合理的技术选型，让每一端的技术栈都发挥最大价值。
