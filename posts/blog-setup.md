---
title: "MD 插件"
date: "2026-04-22"
tags: ["Vite", "React", "Markdown", "技术"]
category: "技术"
summary: "介绍如何通过自定义 Vite 插件，在构建时解析 Markdown 文件并生成虚拟模块，实现静态博客。"
---
# Vite 插件 MD文档解析

本文介绍本博客的核心技术方案：通过自定义 Vite 插件实现 Markdown 文件的构建时处理。

## 整体思路

核心流程如下：

1. 将博客文章以 `.md` 文件存放在 `posts/` 目录
2. 每篇文章包含 YAML frontmatter 元数据（标题、日期、标签等）
3. Vite 插件在构建时解析所有文章，编译 Markdown 为 HTML
4. 通过虚拟模块（Virtual Module）将数据注入到 React 组件中

## Frontmatter 格式

每篇文章的头部使用 YAML 格式的 frontmatter：

```yaml
---
title: "文章标题"
date: "2026-04-22"
tags: ["标签1", "标签2"]
category: "分类"
summary: "文章摘要"
---
```

## 插件实现要点

### 虚拟模块

插件定义了两种虚拟模块：

- `virtual:blog-index` — 导出所有文章的元数据列表
- `virtual:blog-post:*` — 导出单篇文章的 frontmatter 和 HTML 内容

### Markdown 编译

使用 `unified` 生态进行 Markdown 处理：

```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(markdownContent);
```

## 优势

- **零运行时开销** — Markdown 在构建时编译，不在客户端解析
- **SEO 友好** — 构建产物是静态 HTML
- **简单可靠** — 无需数据库，文章就是文件

> 这种方案特别适合部署在 GitHub Pages 上的个人博客。
