# zzzzzlc.github.io

> 个人技术博客 + 在线工具集 — 基于 React 19 + Vite + TypeScript + antd 构建。

[在线预览](https://zzzzzlc.github.io/) · [博客分类](https://zzzzzlc.github.io/categories) · [项目工具集](https://zzzzzlc.github.io/projects)

## 项目简介

这是一个集「技术博客」与「在线工具集」于一体的个人站点：

- **技术博客**：60+ 篇原创技术文章，使用 Markdown 编写，**构建时编译**为静态 HTML，支持分类、标签、目录跳转与草稿。
- **在线工具集**：集成十余个独立可用的前端工具——3D 模型查看器、WebGIS 地图导航、BPMN 流程设计器、流媒体播放器等，全部开源、无需 API Key 即可体验。

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 框架 | React 19、TypeScript 5.9 |
| 构建 | Vite 7 |
| UI 组件 | antd 6、@ant-design/icons |
| 路由 | react-router 7（全量懒加载） |
| Markdown | unified + remark + gray-matter（自定义 Vite 插件，构建时编译） |
| 3D / 图形 | Three.js |
| 地图 / WebGIS | MapLibre GL + OSRM + OpenStreetMap |
| 流程图 | bpmn-js（BPMN 2.0） |
| 代码编辑器 | Monaco Editor |
| 流媒体 | hls.js、dashjs |
| AI | OpenAI、@chatui/core |

## 在线工具集

| 工具 | 路径 | 说明 |
| --- | --- | --- |
| 3D 模型查看器 | [/three-viewer](https://zzzzzlc.github.io/three-viewer) | Three.js 渲染，支持上传 GLB/GLTF/OBJ/STL 并实时交互 |
| 地图导航 · WebGIS | [/amap](https://zzzzzlc.github.io/amap) | MapLibre GL + OSRM 路线规划（驾车/步行/骑行），多底图切换，无需 Key |
| BPMN 流程设计 | [/bpmn-editor](https://zzzzzlc.github.io/bpmn-editor) | bpmn.js 流程图绘制，支持 BPMN/SVG 导入导出与模板 |
| 影视频播放器 | [/media-player](https://zzzzzlc.github.io/media-player) | 渐进式下载 / HLS / DASH 流媒体，自定义控件与快捷键 |
| Canvas 画板 | [/canvas](https://zzzzzlc.github.io/canvas) | HTML5 Canvas 绘图，画笔/形状/撤销重做/导出图片 |
| SVG 绘制 | [/svg-editor](https://zzzzzlc.github.io/svg-editor) | Monaco 实时编辑 SVG 代码并预览，内置示例模板 |
| 代码编辑器 | [/editor/code-editor](https://zzzzzlc.github.io/editor/code-editor) | Monaco 多语言语法高亮、自动补全、格式化 |
| 水印工具 | [/watermark](https://zzzzzlc.github.io/watermark) | 页面/图片/区域水印，自定义文本、颜色、旋转、透明度 |
| 主题定制 | [/theme](https://zzzzzlc.github.io/theme) | 自定义主色/功能色/字号/圆角，实时预览并导出 CSS 变量 |
| AI 对话 | [/ai](https://zzzzzlc.github.io/ai) | 基于 OpenAI API 的多轮对话助手 |
| CSS 实验室 | [/css-test](https://zzzzzlc.github.io/css-test) | CSS 样式试验场 |

## 博客系统

文章以 Markdown 形式存放于 [`posts/`](./posts)，通过 frontmatter 声明元信息：

```yaml
---
title: 文章标题
date: '2026-04-26'
tags:
  - DevOps
category: 工程化
summary: 文章摘要，用于列表展示。
draft: false   # 设为 true 则不会被发布
---
```

- 由 [`plugins/markdown.ts`](./plugins/markdown.ts) 在构建时编译为 HTML，并通过虚拟模块按需加载，开发期新增 / 删除文章自动热更新。
- `/post/:slug` 查看文章详情，`/categories` 按分类浏览。

## 项目结构

```
zzzzzlc.github.io/
├── app/
│   ├── pages/          # 页面（每个页面遵循 components/hooks/services/types/utils 分层）
│   ├── router/         # react-router 路由配置（懒加载）
│   ├── theme/          # 主题 Provider 与动画
│   ├── models/         # 全局状态
│   └── app.tsx
├── component/          # 全局通用组件与布局（BlogLayout）
├── content/            # 站点内容数据（projects 等）
├── posts/              # Markdown 博客文章
├── plugins/            # Vite 插件（markdown 编译、自动导入）
├── server/             # 本地服务端（aiagent / fileserver / login）
├── utils/              # 工具函数
└── vite.config.ts
```

**代码分层规范**：页面按 `components`(UI) / `hooks`(逻辑) / `services`(API) / `types`(类型) / `utils`(工具) 分层；网络请求统一经由 service 层，组件内不直接调用网络库。

## 本地开发

环境要求：**Node ≥ 20**、**pnpm**。

```bash
pnpm install      # 安装依赖
pnpm dev          # 启动开发服务器（默认 3000 端口）
pnpm build        # 类型检查 + 生产构建，产物输出到 dist/
pnpm preview      # 本地预览构建产物
pnpm lint         # ESLint 代码检查
```

路径别名：`@components` → `component/`、`@pages` → `app/pages/`、`@content` → `content/`。

## 部署

推送到 `main` 分支后，[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) 会自动执行 `pnpm build` 并部署到 **GitHub Pages**（Node 20 + pnpm）。SPA 路由通过将 `index.html` 复制为 `404.html` 实现客户端路由兜底。

## License

[MIT](./LICENSE)
