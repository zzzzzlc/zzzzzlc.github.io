---
title: 游戏开发方案对比：Cocos Creator vs Unity3D 从选型到实战
date: '2026-06-17'
tags:
  - 游戏开发
  - Cocos
  - Unity3D
  - 前端
  - 跨端
category: 前端进阶
summary: >-
  从"做个小游戏到底选 Cocos 还是 Unity？"的实际选型困境出发，深度对比 Cocos Creator 与 Unity3D 两大主流游戏引擎的架构原理、渲染管线、脚本系统、资源工作流、发布能力（H5/小程序/原生/iOS/Android）、性能表现与生态体系，揭示 Web 引擎与原生引擎的本质差异，覆盖 2D/3D 场景抉择、包体积优化、热更新、多人协作等工程实践，给出不同业务场景（休闲小游戏、中重度手游、H5 营销互动、教育互动课件）的选型建议与边界局限。
---

# 游戏开发方案对比：Cocos Creator vs Unity3D 从选型到实战

## 一、问题来源

当产品经理丢过来一个需求 ——「做个游戏，要能发到微信小游戏、H5、还要上 App Store」，技术团队几乎都会陷入同一个选型难题：

> **Cocos Creator 和 Unity3D，到底选哪个？**

**业务层面的痛点：**

1. **跨端要求苛刻**：同一个项目要同时输出 H5（浏览器）、微信小游戏、抖音小游戏、iOS App、Android App，五个目标端任何一个都不能少。
2. **包体积敏感**：微信小游戏主包限制 4MB、分包总大小限制 20MB，H5 首屏加载超过 3 秒用户就流失，原生 App 用户拒绝下载超过 100MB 的"小游戏"。
3. **开发团队背景参差**：前端工程师熟悉 JS/TS，看 Unity 的 C# 直摇头；游戏行业老兵觉得 Cocos 的组件化"不够硬核"，怀念 Unity 的完整生态。
4. **预算与人力有限**：中小团队常常只能押注一个引擎，押错就意味着推倒重来。
5. **渲染需求模糊**：老板嘴里的"3D 游戏"可能是《原神》级别，也可能只是 2.5D 卡牌特效，引擎选型天差地别。

**技术层面的痛点：**

- **渲染管线差异巨大**：Cocos 底层是 WebGL/WebGPU（H5）/Vulkan/Metal（原生），Unity 是成熟的 SRP（URP/HDRP），二者在 DrawCall 合批、光照模型、后处理上完全不是一套逻辑。
- **脚本范式不一致**：Cocos 用 TypeScript + 组件装饰器（`@ccclass`），Unity 用 C# + MonoBehavior 生命周期，迁移成本极高。
- **资源工作流不同**：Cocos 资源是 `.meta` + `.prefab` + JSON 场景描述，Unity 是 `.asset` + `.unity` + 二进制 SerializedFile，工具链互不兼容。
- **生态成熟度悬殊**：Unity Asset Store 有数十万资源，Cocos 商店资源量级小一个数量级。

本文将沿「**问题 → 方案 → 原理 → 优缺点 → 场景 → 局限**」的脉络，把这场选型之争讲透。

---

## 二、两大引擎的本质定位

### 2.1 Cocos Creator：Web 优先的轻量引擎

**前世今生**：
- 2010 年：Cocos2d-x 诞生（C++ 引擎，2D 为主）
- 2015 年：Cocos2d-JS（JS 绑定）
- 2016 年：Cocos Creator v1.0（编辑器化、TypeScript）
- 2020 年：Cocos Creator 3.0（重构为 3D 引擎，统一渲染管线）
- 2024 年：Cocos Creator 3.8（WebGPU 支持、原生渲染升级）

**定位**：**Web 引擎起家 → 反向覆盖原生**。优势战场是浏览器、小游戏、轻量化 3D。

**核心架构**：
```
┌─────────────────────────────────────┐
│  TypeScript 业务代码                  │
├─────────────────────────────────────┤
│  Cocos Component System（组件化）     │
├─────────────────────────────────────┤
│  引擎层（Scene / Node / Asset）       │
├─────────────────────────────────────┤
│  渲染抽象层（gfx）                    │
├──────────┬──────────┬────────────────┤
│ WebGL    │ WebGPU   │ Vulkan/Metal   │  ← 多后端
│ (H5)     │ (H5新)   │ (原生)          │
└──────────┴──────────┴────────────────┘
```

### 2.2 Unity3D：原生优先的全能引擎

**前世今生**：
- 2005 年：Unity 1.0（macOS，专注 Mac 游戏）
- 2007 年：跨平台扩展到 Web/iOS/Wii
- 2010 年代：Android、WebGL 输出
- 2018 年：SRP（Scriptable Render Pipeline）引入
- 2023 年：Unity 6（runtime fee 风波、新收费模式）
- 2025 年：Unity 6.2 LTS，WebGPU 预览

**定位**：**原生引擎起家 → 反向覆盖 Web**。优势战场是中重度手游、3A 级独立游戏、跨端大作。

**核心架构**：
```
┌─────────────────────────────────────┐
│  C# 业务代码（IL2CPP 编译）            │
├─────────────────────────────────────┤
│  MonoBehavior / ECS（DOTS）           │
├─────────────────────────────────────┤
│  引擎层（GameObject / Scene / Asset） │
├─────────────────────────────────────┤
│  SRP 渲染管线（URP / HDRP）           │
├──────────┬──────────┬────────────────┤
│ DirectX  │ Metal    │ Vulkan/WebGL   │
│ (Win)    │ (Apple)  │ (Linux/Web)     │
└──────────┴──────────┴────────────────┘
```

### 2.3 一句话区分

| 维度 | Cocos Creator | Unity3D |
|------|--------------|---------|
| 出身 | Web 优先 | 原生优先 |
| 主语言 | TypeScript | C# |
| 优势战场 | H5 / 小游戏 / 轻度 2D | 中重度手游 / 3D 大作 |
| 渲染抽象 | gfx（自研，统一接口） | SRP（URP/HDRP） |
| 资源格式 | JSON + 资源数据库 | SerializedFile + AssetBundle |
| 体积下限 | H5 主包 1MB 起 | H5 至少 10MB+ wasm |

---

## 三、核心机制深度对比

### 3.1 脚本系统：组件化范式

#### Cocos Creator

```typescript
const { ccclass, property } = cc._decorator;

@ccclass('PlayerController')
export class PlayerController extends cc.Component {
    @property(cc.Node)
    target: cc.Node = null;

    @property({ type: cc.Float, range: [0, 10] })
    speed: number = 5;

    update(dt: number) {
        // 每帧调用，dt 是基于游戏时钟的 delta time
        const dir = this.target.position.sub(this.node.position).normalize();
        this.node.position = this.node.position.add(dir.multiplyScalar(this.speed * dt));
    }
}
```

**关键特性**：
- 装饰器 `@ccclass` 注册类，`@property` 声明可编辑字段
- `update(dt)` 是帧驱动生命周期，时间步由引擎统一管理
- 无 GC 压力问题（V8/JavaScriptCore GC 自动），但热路径上要避免对象分配
- 类型系统严格（TS 强制），编译期可发现 80% 的接口错误

#### Unity3D

```csharp
using UnityEngine;

public class PlayerController : MonoBehaviour {
    [SerializeField] private Transform target;
    [Range(0f, 10f)] public float speed = 5f;

    void Update() {
        // Time.deltaTime 是基于渲染时钟的 delta time
        Vector3 dir = (target.position - transform.position).normalized;
        transform.position += dir * speed * Time.deltaTime;
    }
}
```

**关键特性**：
- 类继承 `MonoBehavior`，字段 `[SerializeField]` 暴露给 Inspector
- `Update()` 自动被引擎反射调用，无 `dt` 参数，用 `Time.deltaTime` 取
- C# 用 IL2CPP 编译为原生 AOT，运行性能比 JIT 快 2-5 倍
- GC 压力是 Unity 性能杀手，热路径要避免 `new`、用对象池
- DOTS（Data-Oriented Technology Stack）提供 ECS Burst 编译，性能再提升 10-50 倍（但学习曲线陡）

#### 对比

| 维度 | Cocos（TS） | Unity（C#） |
|------|------------|-------------|
| 类型安全 | TS 编译期 | C# 编译期 + 运行期 |
| 性能 | V8 JIT，略逊 IL2CPP | IL2CPP AOT，接近 C++ |
| 学习成本 | 前端友好，1 周上手 | 需学 C# + .NET，2-4 周 |
| 调试体验 | Chrome DevTools（极好） | Visual Studio / Rider（好） |
| 热重载 | 编辑器支持有限 | Edit mode 实时重载（极佳） |

---

### 3.2 渲染管线：DrawCall 与合批

#### Cocos 渲染流程

```
Scene Graph 遍历
    ↓
RenderData 收集（每个 Sprite/Mesh 上传顶点）
    ↓
Batching（同材质合批，触发自定义合批）
    ↓
DrawCall（gfx 抽象层封装）
    ↓
WebGL / Vulkan / Metal 后端
```

**关键设计**：
- **MeshRenderer / Sprite**：基础图元
- **UI 系统**：内置富文本、按钮、列表，单 DrawCall 合批 UI
- **材质系统**：基于 Effect（.effect 文件，类似 ShaderLab），支持自定义 Shader
- **2D 优势**：原生支持 Spine 骨骼、DragonBones、TiledMap
- **3D 能力**：PBR、IBL、阴影、后处理都有，但 HDRP 级别的电影级渲染不如 Unity

**性能天花板**：
- 中端手机 H5：500-1000 DrawCall / 60FPS（中等场景）
- 中端手机原生：3000-5000 DrawCall / 60FPS（接近 Unity 中重度）

#### Unity 渲染流程（以 URP 为例）

```
Culling（剔除：视锥/遮挡/层级）
    ↓
Sorting（排序：透明 / 不透明 / 渲染队列）
    ↓
SRP Batcher（同 Shader 合批，不动材质即可）
    ↓
DrawCall（GfxDevice 抽象）
    ↓
DX/Metal/Vulkan 后端
```

**关键设计**：
- **SRP Batcher**：Unity 2019+ 的杀手锏，同 Shader 的所有材质合为一次 CPU 提交，CPU 开销降低 5-10 倍
- **GPU Instancing**：同 Mesh 同 Material 的多个实例合并提交
- **DOTS + Jobs System**：多线程渲染数据准备，扛住万级同屏单位（如 RTS 大场面）
- **AssetBundle / Addressables**：资源动态加载、热更新、按需下载

**性能天花板**：
- 中端手机原生：5000-10000 DrawCall / 60FPS（重度 3D 场景）
- WebGL：受 wasm 启动 + GC 拖累，性能折半，且包体积大

#### 渲染对比

| 维度 | Cocos | Unity |
|------|-------|-------|
| H5 启动速度 | 快（1-3MB 主包） | 慢（10-30MB wasm） |
| 2D 性能 | 优秀（专为 2D 设计） | 良好（要靠 Sprite Atlas 优化） |
| 3D 性能 | 良好 | 优秀（SRP Batcher + DOTS） |
| Shader 复杂度 | 中等（.effect） | 极高（ShaderLab + HLSL/URP Shader Graph） |
| 后处理 | 基础（Bloom/AA/SSAO） | 丰富（URP/HDRP 完整后处理栈） |

---

### 3.3 资源工作流

#### Cocos Creator

```
project/
├── assets/
│   ├── scenes/
│   │   └── main.scene       # 场景：JSON 描述
│   ├── prefabs/
│   │   └── player.prefab    # 预制体：JSON 引用
│   ├── textures/
│   │   └── hero.png         # 资源本体
│   │   └── hero.png.meta    # 元数据（uuid、import 设置）
│   └── scripts/
│       └── PlayerController.ts
└── library/                 # 自动生成的导入缓存
```

**关键点**：
- `.meta` 文件存 uuid 和导入设置，必须 commit 到 git
- 资源依赖通过 uuid 引用，重命名/移动安全
- 构建 H5/小游戏时，资源会被压缩 + 加密为 `.json` + `.bin`
- **热更新**：原生平台用 `jsb.AssetsManager`，对比 manifest 版本号下载差量

#### Unity3D

```
project/
├── Assets/
│   ├── Scenes/
│   │   └── Main.unity       # 场景：YAML 序列化
│   ├── Prefabs/
│   │   └── Player.prefab    # 预制体：YAML
│   ├── Textures/
│   │   └── hero.png         # 资源本体
│   │   └── hero.png.meta    # GUID 引用
│   └── Scripts/
│       └── PlayerController.cs
├── Library/                 # 自动生成（git ignore）
└── Packages/
    └── manifest.json        # UPM 包管理
```

**关键点**：
- 同样是 `.meta` + GUID 引用体系
- **AssetBundle**：把资源打成 bundle，运行时加载；老式方案
- **Addressables**：2018+ 推荐方案，统一资源寻址 + 异步加载 + 内存管理
- **热更新**：原生平台用 Addressables + CDN 即可实现差量更新；H5/WebGL 热更天然支持

#### 共同问题：资源引用丢失

两者都会遇到「prefab 里引用的资源被删除，prefab 引用变成 null」的悲剧。预防手段：
- 资源删除前用编辑器工具扫描引用
- 用 git hook 拦截可疑删除
- 定期 commit `.meta` 文件，避免 UUID 漂移

---

### 3.4 发布能力矩阵

| 目标平台 | Cocos Creator | Unity3D |
|---------|---------------|---------|
| 微信小游戏 | ★★★★★（首选） | ★★（要 minified wasm，包体紧） |
| 抖音小游戏 | ★★★★★ | ★★ |
| H5 浏览器 | ★★★★★ | ★★★（WebGL2，启动慢） |
| iOS App | ★★★★ | ★★★★★ |
| Android App | ★★★★ | ★★★★★ |
| Windows/Mac 桌面 | ★★★ | ★★★★★ |
| Steam 主机 | ★★（不推荐） | ★★★★★（认证支持） |
| PS5/Xbox/Switch | ×（需商务授权） | ★★★★★ |

**Cocos 小游戏优势的本质**：引擎底层用 WebGL 风格 API 适配微信小游戏的 Canvas/WebGL，几乎是「原生支持」；Unity 是把整个 IL2CPP runtime 编译为 wasm，再用 WebGL 跑，启动慢、包体大、内存吃紧。

---

## 四、性能基准实测（参考量级）

> 以下数据来自社区公开 benchmark 与项目实战经验，仅供参考，实际数据取决于场景复杂度、设备型号、构建配置。

### 4.1 启动时间（中端 Android，H5）

| 引擎 | 包大小 | 首屏可交互时间 |
|------|--------|---------------|
| Cocos Creator（小项目） | 1.5MB | 0.8s |
| Cocos Creator（中型项目） | 4MB | 1.8s |
| Unity WebGL（小项目） | 12MB | 4.5s |
| Unity WebGL（中型项目） | 25MB | 9s |

### 4.2 同屏 DrawCall 上限（中端手机，60FPS）

| 场景类型 | Cocos（原生） | Unity（URP） |
|---------|---------------|--------------|
| 2D UI 元素 | 800 | 1500（SRP Batcher） |
| 简单 3D 角色（1k tris） | 200 | 500（GPU Instancing） |
| 大场景建筑（10k tris） | 50 | 150 |

### 4.3 内存占用

| 引擎 | 基础内存 | 单场景增量 |
|------|---------|-----------|
| Cocos（H5） | 50MB | 5-20MB |
| Cocos（原生） | 80MB | 10-30MB |
| Unity（WebGL） | 200MB | 30-100MB |
| Unity（原生） | 150MB | 20-80MB |

---

## 五、典型场景的选型决策

### 5.1 场景一：微信小游戏（休闲三消、放置卡牌）

**推荐**：**Cocos Creator**

**理由**：
- 微信小游戏对包体限制极严（主包 4MB），Unity WebGL 几乎无法塞下
- Cocos 与微信生态深度集成（开放数据域、广告、订阅消息原生支持）
- 启动速度直接决定留存率，1 秒 vs 5 秒 = 20% 用户流失差距
- TS 开发效率高，2D 工具链成熟

**反例**：Unity 微信小游戏方案确实存在，但需要 Unity 2022+ + 微信小游戏导出插件，且 wasm 仍要分片加载、首屏白屏 3-5 秒，不推荐用于超休闲品类。

### 5.2 场景二：3D 中重度手游（MMO、开放世界）

**推荐**：**Unity3D**

**理由**：
- 3D 渲染深度、光照、后处理远超 Cocos
- DOTS + Jobs 可扛住万级单位（如 RTS、塔防海量化）
- Addressables 资源管理成熟，几十 GB 资源的项目也能驾驭
- 海外发行必备：Unity 是 PlayStation/Xbox/Switch 官方授权引擎

**反例**：Cocos 3D 能力近年来突飞猛进，对标 Unity URP，但 HDRP 级别的电影级渲染、Ray Tracing 仍是空白。3D 大项目慎选 Cocos。

### 5.3 场景三：H5 营销互动（抽奖、互动广告、传播裂变）

**推荐**：**Cocos Creator**（甚至 Laya/PixiJS 等更轻量方案）

**理由**：
- 必须秒开，3 秒白屏用户全流失
- 单次会话短（几十秒到几分钟），不需要重度图形
- 包体小，CDN 成本低，流量主友好
- 一键导出 H5，部署静态 CDN 即可

**反例**：Unity WebGL 在 H5 营销场景几乎无生存空间，仅适合品牌大制作的"互动宣传片"。

### 5.4 场景四：教育互动课件（K12 数学动画、儿童绘本）

**推荐**：**Cocos Creator**

**理由**：
- 课件需要嵌入到 Web 平台（学习 App、Web 端），Cocos H5 跑得动
- TS 团队易招募，前端工程师转岗成本低
- 国内教育公司（如猿辅导、好未来）大量使用 Cocos 课件
- 多端同步：H5 + 原生 App + 平板适配

**反例**：Unity 不适合教育场景的轻交互、强内容形态，反而拖累开发。

### 5.5 场景五：Steam 独立游戏（PC 单机）

**推荐**：**Unity3D**

**理由**：
- Steam 生态对 Unity 友好，官方 SDK 集成完善
- 桌面级硬件性能允许 HDRP 拉满，画面表现力天花板高
- 独立游戏开发者社区资源丰富（《Hollow Knight》《Cuphead》都是 Unity）
- Cocos 桌面端发行案例稀少，发行商接纳度低

---

## 六、工程实践要点

### 6.1 包体积优化

#### Cocos
- **代码裁剪**：构建时勾选 `Engine module clips`，移除未使用的引擎模块（如不用物理引擎就关掉）
- **资源压缩**：纹理用 ASTC（原生）/ WebP（H5），音频用 MP3/OGG
- **分包加载**：主包仅含首屏资源，其他走分包按需加载
- **Tree Shaking**：业务代码用 Rollup 自动裁剪未引用模块

#### Unity
- **Stripping Level**：IL2CPP 时选 High Stripping，移除未使用代码
- **Addressables Groups**：分组打包，按地址加载
- **AssetBundle Compression**：LZ4 比 LZMA 解压快、CPU 低
- **Code Generation**：WebGL 用 Tiny Runtime Mode 减小 wasm

### 6.2 热更新实现

#### Cocos（原生平台）
```typescript
// 1. 检查 manifest 版本
const localManifest = jsb.AssetsManager.getLocalManifest();
const remoteManifest = 'https://cdn.example.com/game/version.manifest';

const am = new jsb.AssetsManager('game', remoteManifest);
am.setEventCallback((event) => {
    if (event.getEventCode() === jsb.EventAssetsManager.UPDATE_FINISHED) {
        // 重启游戏加载新版本
        jsb.AssetsManager.reloadGame();
    }
});
am.update();
```

#### Unity（Addressables + CDN）
```csharp
// 启动时检查 catalog 更新
AsyncOperationHandle checkHandle = Addressables.CheckForCatalogUpdates(false);
await checkHandle.Task;
if (checkHandle.Result.Count > 0) {
    var updateHandle = Addressables.UpdateCatalogs(checkHandle.Result);
    await updateHandle.Task;
    // 下载资源 bundle
    var downloadHandle = Addressables.DownloadDependenciesAsync("game_assets");
    await downloadHandle.Task;
}
```

### 6.3 多端代码组织

#### Cocos 条件编译
```typescript
// 微信小游戏特定代码
if (sys.platform === sys.Platform.WECHAT_GAME) {
    wx.login({ success: (res) => { /* ... */ } });
}

// 原生 iOS 特定
if (sys.platform === sys.Platform.IOS) {
    // 调用原生 OC 接口
    native.bridge.send('...');
}
```

#### Unity 平台宏定义
```csharp
#if UNITY_IOS
    // iOS 特定代码
#elif UNITY_ANDROID
    // Android 特定代码
#elif UNITY_WEBGL
    // WebGL 特定代码
#endif
```

### 6.4 团队协作

| 工程实践 | Cocos Creator | Unity3D |
|---------|---------------|---------|
| 版本控制 | git（强制 LFS 存大资源） | git + LFS / Plastic SCM |
| 资源冲突 | `.meta` 频繁冲突，约定先 pull 再 commit | Scene/Prefab merge 工具（Unity Smart Merge） |
| 多人编辑场景 | 不支持 | Unity Muse 协同编辑（限 5 人） |
| CI/CD | Jenkins + Cocos Creator 命令行构建 | Jenkins + Unity BatchMode |

---

## 七、生态与社区对比

| 维度 | Cocos Creator | Unity3D |
|------|---------------|---------|
| 中文社区 | 极活跃（国内主导） | 活跃（国内大） |
| 英文社区 | 一般 | 极活跃（全球第一） |
| 官方文档质量 | 中文优质、英文一般 | 中英文都极完善 |
| 资源商店 | 数千款（多为国产） | 数十万款（全球） |
| 商业模式 | 编辑器免费、按收入分成（年流水 > 10 万美元） | Personal 免费、Pro 按订阅、新收费模式争议大 |
| 学习曲线 | 平缓（1-2 周入门） | 中等（1-3 月入门） |
| 招聘市场 | 国内中大型（游戏/教育/营销） | 国内大型（游戏/出海/独立） |

---

## 八、局限性与坑

### 8.1 Cocos Creator 的局限

1. **3D 渲染深度有限**：复杂后处理（光追、SSR、体积云）不及 Unity HDRP
2. **生态规模**：资源商店远小于 Unity，复杂插件常需自研
3. **编辑器性能**：超大场景（10 万 Node）编辑器卡顿明显
4. **海外认可度低**：欧美市场对 Cocos 项目接纳度低，出海不利
5. **TS 类型推导**：装饰器元数据在某些反射场景受限
6. **原生插件生态**：iOS/Android 原生插件稀少，对接第三方 SDK 需自写 wrapper

### 8.2 Unity3D 的局限

1. **H5/小游戏天然劣势**：wasm 包体大、启动慢、内存吃紧
2. **收费争议**：2023 年 Runtime Fee 风波后改为订阅制，中小团队成本敏感
3. **资源膨胀**：项目动辄几十 GB，构建产物大
4. **学习门槛高**：C# + .NET + 引擎各子系统，新人 6 个月才熟练
5. **包体优化复杂**：Stripping / IL2CPP / Addressables 配置项繁多，容易出错
6. **WebGL 兼容性**：某些 iOS Safari 版本对 wasm 限制多（如内存上限）

---

## 九、选型决策树

```
你的项目是？
│
├─→ 必须发微信/抖音小游戏？
│     ├─→ 是 → Cocos Creator（强推）
│     └─→ 否 ↓
│
├─→ 主要是 H5 营销/教育互动？
│     ├─→ 是 → Cocos Creator（或更轻的 PixiJS/Laya）
│     └─→ 否 ↓
│
├─→ 是 3D 中重度手游 / 主机大作？
│     ├─→ 是 → Unity3D（HDRP + DOTS）
│     └─→ 否 ↓
│
├─→ 团队是纯前端背景（不会 C#）？
│     ├─→ 是 → Cocos Creator
│     └─→ 否 ↓
│
├─→ 必须出海欧美市场？
│     ├─→ 是 → Unity3D
│     └─→ 否 ↓
│
└─→ 都不符合 → 项目复杂度评估：
        ├─→ 简单 2D 休闲 → Cocos
        └─→ 重度 3D 大作 → Unity
```

---

## 十、结论

**Cocos Creator 与 Unity3D 不是「谁取代谁」的关系，而是「各占山头」**：

- **Cocos 的天花板**在 H5、小游戏、轻度 3D，是中国移动互联网生态（微信、抖音、教育）的产物
- **Unity 的天花板**在中重度 3D、主机大作、全球化发行，是 AAA 级别工业流水线的标配

**最终选型的核心三问**：

1. **目标平台是什么？**（小游戏 → Cocos；主机 → Unity）
2. **图形复杂度多高？**（2D/轻度 3D → Cocos；重度 3D/HDRP → Unity）
3. **团队的语言栈和招聘市场在哪？**（前端为主 → Cocos；C# 可招 → Unity）

如果三个问题里有两个指向 Cocos，选 Cocos；反之选 Unity。**强行用错引擎的代价远高于学新引擎的成本**——见过用 Unity 做 H5 营销的项目，5MB wasm 启动 4 秒白屏，月活流失 30%；也见过用 Cocos 做 3D MMO 的项目，渲染深度不够只能砍需求砍到亲妈都不认识。

---

## 参考资料

- [Cocos Creator 官方文档](https://docs.cocos.com/creator/manual/zh/)
- [Unity3D 官方文档](https://docs.unity3d.com/Manual/index.html)
- [Unity SRP Batcher 详解](https://docs.unity3d.com/Manual/SRPBatcher.html)
- [微信小游戏 Unity 适配方案](https://github.com/wechat-miniprogram/minigame-unity-webgl-transform)
- [Cocos Creator 3.8 发布说明](https://www.cocos.com/creator)
- [Unity DOTS（ECS + Jobs + Burst）入门](https://docs.unity3d.com/Packages/com.unity.entities@latest)
