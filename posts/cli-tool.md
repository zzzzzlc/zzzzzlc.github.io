---
title: "前端 CLI 工具定制化开发实战"
date: "2026-04-22"
tags: ["CLI", "Node.js", "前端工程化", "工具开发"]
category: "技术"
summary: "从 CLI 基础概念讲起，详解 Node.js 开发命令行工具的核心模块，并通过实战从零开发一个项目脚手架 CLI 工具，覆盖命令解析、交互问答、模板生成、npm 发布全流程。"
---

# 前端 CLI 工具定制化开发实战

CLI（Command Line Interface）工具是前端工程化的基石。从 `create-react-app` 到 `vite`，优秀的 CLI 工具能极大提升开发效率。本文将带你从零开发一个完整的 CLI 工具。

## 一、CLI 工具概述

### 1. 常见前端 CLI 工具

| 工具 | 用途 |
|------|------|
| `create-react-app` | React 项目脚手架 |
| `vue create` | Vue 项目脚手架 |
| `vite` | 构建工具 + 项目创建 |
| `npm / pnpm / yarn` | 包管理 |
| `eslint` | 代码检查 |
| `prettier` | 代码格式化 |
| `tsc` | TypeScript 编译 |
| `commitlint` | Git 提交信息规范 |

### 2. 为什么需要自定义 CLI

- **团队项目模板统一** — 新项目无需手动复制配置
- **自动化重复流程** — 一键生成组件、页面、API 模块
- **统一部署/发布流程** — 避免人工操作失误
- **提升团队效率** — 将最佳实践固化到工具中

## 二、Node.js CLI 核心基础

### 1. 入口与参数获取

```javascript
#!/usr/bin/env node

// process.argv 是最基础的参数获取方式
// 命令：node cli.js create my-app --template react
console.log(process.argv);
// [
//   '/path/to/node',        // Node 路径
//   '/path/to/cli.js',      // 脚本路径
//   'create',               // 参数1：命令
//   'my-app',               // 参数2：项目名
//   '--template',           // 参数3：选项名
//   'react'                 // 参数4：选项值
// ]

// 手动解析参数
const args = process.argv.slice(2);
const command = args[0];
```

### 2. package.json 配置

```json
{
    "name": "my-cli",
    "version": "1.0.0",
    "description": "我的 CLI 工具",
    "bin": {
        "my-cli": "./bin/cli.js"
    },
    "files": ["bin", "lib", "templates"],
    "dependencies": {
        "commander": "^12.0.0",
        "inquirer": "^9.0.0",
        "chalk": "^5.0.0",
        "ora": "^8.0.0"
    }
}
```

**`bin` 字段** 是关键 — 它告诉 npm 安装时创建一个全局命令链接。

### 3. 入口文件

```javascript
#!/usr/bin/env node
// bin/cli.js

const { program } = require("commander");

program
    .name("my-cli")
    .description("项目脚手架工具")
    .version("1.0.0");

program
    .command("create <name>")
    .description("创建新项目")
    .option("-t, --template <template>", "项目模板", "react")
    .action((name, options) => {
        console.log(`创建项目: ${name}, 模板: ${options.template}`);
    });

program.parse();
```

## 三、核心模块详解

### 1. Commander — 命令解析

```javascript
const { program, Command } = require("commander");

// 基础命令
program
    .command("create <name>")
    .description("创建新项目")
    .action((name) => { /* ... */ });

// 带选项的命令
program
    .command("build")
    .description("构建项目")
    .option("-m, --mode <mode>", "构建模式", "production")
    .option("--minify", "压缩代码")
    .option("--sourcemap", "生成 sourcemap")
    .action((options) => {
        console.log(options);
        // { mode: 'production', minify: false, sourcemap: false }
    });

// 可变参数
program
    .command("lint <files...>")
    .action((files) => {
        console.log("检查文件:", files);
    });

// 子命令
const generate = program.command("generate");
generate
    .command("component <name>")
    .action((name) => console.log(`生成组件: ${name}`));
generate
    .command("page <name>")
    .action((name) => console.log(`生成页面: ${name}`));
// 用法：my-cli generate component Button

// 钩子
program
    .command("deploy")
    .option("-e, --env <env>", "部署环境")
    .hook("preAction", () => console.log("部署前检查..."))
    .hook("postAction", () => console.log("部署完成"))
    .action((options) => console.log(`部署到 ${options.env}`));
```

### 2. Inquirer — 交互式问答

```javascript
const inquirer = require("inquirer");

// 基础问答
const answers = await inquirer.prompt([
    {
        type: "input",
        name: "projectName",
        message: "项目名称?",
        default: "my-project",
        validate: (input) => {
            if (!input.trim()) return "项目名称不能为空";
            if (!/^[a-z][a-z0-9-]*$/.test(input)) return "只能使用小写字母、数字和连字符";
            return true;
        },
    },
    {
        type: "list",
        name: "framework",
        message: "选择框架?",
        choices: [
            { name: "React", value: "react" },
            { name: "Vue", value: "vue" },
            { name: "Angular", value: "angular" },
        ],
    },
    {
        type: "checkbox",
        name: "features",
        message: "选择功能?",
        choices: [
            { name: "TypeScript", value: "typescript", checked: true },
            { name: "Router", value: "router" },
            { name: "Pinia/Redux", value: "store" },
            { name: "ESLint + Prettier", value: "lint", checked: true },
        ],
    },
    {
        type: "confirm",
        name: "gitInit",
        message: "初始化 Git 仓库?",
        default: true,
    },
]);

// answers = {
//   projectName: "my-app",
//   framework: "react",
//   features: ["typescript", "lint"],
//   gitInit: true
// }
```

### 3. Chalk — 终端样式

```javascript
const chalk = require("chalk");

// 基础颜色
console.log(chalk.blue("信息提示"));
console.log(chalk.green("成功!"));
console.log(chalk.yellow("警告"));
console.log(chalk.red("错误"));

// 组合样式
console.log(chalk.bold.bgBlue.white(" 白底蓝字加粗 "));

// 模板字面量
console.log(chalk`{blue CLI} {green v1.0.0} {gray 准备就绪}`);

// 条件着色
const success = chalk.green.bold;
const error = chalk.red.bold;
console.log(success("构建成功!"));
console.log(error("构建失败!"));

// 实际使用
console.log(chalk.cyan("\n  创建项目:") + chalk.green(" my-app"));
console.log(chalk.gray("  → 使用 React 模板"));
console.log(chalk.gray("  → 启用 TypeScript"));
console.log(chalk.green("\n  ✔ 项目创建成功!\n"));
```

### 4. Ora — 加载动画

```javascript
const ora = require("ora");

// 基础用法
const spinner = ora("正在安装依赖...").start();

setTimeout(() => {
    spinner.succeed("依赖安装完成");
}, 3000);

// 不同状态
spinner.start("处理中...");
spinner.succeed("成功!");       // ✔
spinner.fail("失败!");         // ✖
spinner.warn("警告!");         // ⚠
spinner.info("提示");          // ℹ

// 自定义样式
const customSpinner = ora({
    text: "编译中...",
    spinner: "dots",            // 动画类型
    color: "cyan",
}).start();

// 带进度的任务
async function installDeps(projectDir) {
    const spinner = ora("安装依赖中...").start();
    try {
        await execCommand("npm install", { cwd: projectDir });
        spinner.succeed("依赖安装完成");
    } catch (err) {
        spinner.fail("依赖安装失败");
        throw err;
    }
}
```

### 5. 其他实用模块

```javascript
// fs-extra — 增强的文件操作
const fs = require("fs-extra");
await fs.copy("./templates/react", "./my-app");
await fs.ensureDir("./my-app/src/components");
await fs.writeJson("./my-app/package.json", pkg, { spaces: 2 });

// ejs — 模板引擎
const ejs = require("ejs");
const result = await ejs.renderFile("./templates/package.json.ejs", {
    projectName: "my-app",
    framework: "react",
    typescript: true,
});

// execa — 更好的子进程
const execa = require("execa");
await execa("git", ["init"], { cwd: projectPath });
await execa("npm", ["install"], { cwd: projectPath });

// glob — 文件匹配
const glob = require("glob");
const files = glob.sync("**/*.ejs", { cwd: templateDir });

// chalk + gradient-string
const gradient = require("gradient-string");
console.log(gradient.rainbow("Welcome to My CLI!"));
```

## 四、实战：开发项目脚手架 CLI

### 1. 项目结构

```
my-cli/
├── bin/
│   └── cli.js              # CLI 入口
├── lib/
│   ├── commands/
│   │   ├── create.js       # create 命令
│   │   └── generate.js     # generate 命令
│   ├── utils/
│   │   ├── logger.js       # 日志工具
│   │   ├── template.js     # 模板处理
│   │   └── exec.js         # 命令执行
│   └── constants.js        # 常量定义
├── templates/
│   ├── react/
│   │   ├── package.json.ejs
│   │   ├── src/
│   │   │   └── index.tsx.ejs
│   │   └── ...
│   └── vue/
│       └── ...
├── package.json
└── README.md
```

### 2. 入口文件

```javascript
#!/usr/bin/env node
// bin/cli.js

const { program } = require("commander");
const chalk = require("chalk");
const create = require("../lib/commands/create");
const generate = require("../lib/commands/generate");

program
    .name("my-cli")
    .description("前端项目脚手架工具")
    .version(require("../package.json").version)
    .usage("<command> [options]");

// create 命令
program
    .command("create <name>")
    .description("创建新项目")
    .option("-t, --template <template>", "指定模板 (react|vue)")
    .option("--no-git", "跳过 Git 初始化")
    .option("--no-install", "跳过依赖安装")
    .action(create);

// generate 命令
program
    .command("generate <type> <name>")
    .alias("g")
    .description("生成代码 (component|page|api)")
    .action(generate);

// 处理未知命令
program.on("command:*", () => {
    console.log(chalk.red(`未知命令: ${program.args.join(" ")}`));
    console.log(chalk.gray("运行 my-cli --help 查看可用命令"));
    process.exit(1);
});

program.parse(process.argv);

// 无参数时显示帮助
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
```

### 3. create 命令核心逻辑

```javascript
// lib/commands/create.js

const path = require("path");
const fs = require("fs-extra");
const inquirer = require("inquirer");
const chalk = require("chalk");
const ora = require("ora");
const ejs = require("ejs");
const glob = require("glob");
const execa = require("execa");

const logger = require("../utils/logger");
const TEMPLATES_DIR = path.join(__dirname, "../../templates");

async function create(name, options) {
    const targetDir = path.resolve(name);

    // 1. 检查目录是否已存在
    if (fs.existsSync(targetDir)) {
        const { overwrite } = await inquirer.prompt([{
            type: "confirm",
            name: "overwrite",
            message: `目录 ${name} 已存在，是否覆盖?`,
            default: false,
        }]);
        if (!overwrite) process.exit(0);
        await fs.remove(targetDir);
    }

    // 2. 交互式收集配置
    const config = await inquirer.prompt([
        {
            type: "list",
            name: "template",
            message: "选择项目模板?",
            default: options.template,
            choices: [
                { name: "React + TypeScript", value: "react" },
                { name: "Vue 3 + TypeScript", value: "vue" },
            ],
            when: !options.template,
        },
        {
            type: "checkbox",
            name: "features",
            message: "选择功能?",
            choices: [
                { name: "Router", value: "router", checked: true },
                { name: "状态管理", value: "store" },
                { name: "ESLint + Prettier", value: "lint", checked: true },
                { name: "Husky + Commitlint", value: "gitHooks" },
            ],
        },
        {
            type: "list",
            name: "packageManager",
            message: "选择包管理器?",
            choices: ["pnpm", "npm", "yarn"],
            default: "pnpm",
        },
    ]);

    const template = config.template || options.template || "react";

    // 3. 复制并渲染模板
    const spinner = ora("正在创建项目...").start();
    try {
        await renderTemplate(template, targetDir, {
            name,
            ...config,
            template,
            features: config.features || [],
        });
        spinner.succeed("项目创建成功");
    } catch (err) {
        spinner.fail("项目创建失败");
        throw err;
    }

    // 4. 安装依赖
    if (options.install !== false) {
        const installSpinner = ora("安装依赖中...").start();
        try {
            await execa(config.packageManager, ["install"], { cwd: targetDir });
            installSpinner.succeed("依赖安装完成");
        } catch (err) {
            installSpinner.warn("依赖安装失败，请手动执行");
        }
    }

    // 5. 初始化 Git
    if (options.git !== false) {
        try {
            await execa("git", ["init"], { cwd: targetDir });
            await execa("git", ["add", "."], { cwd: targetDir });
            await execa("git", ["commit", "-m", "init: project created by my-cli"], { cwd: targetDir });
        } catch { /* ignore */ }
    }

    // 6. 输出结果
    console.log();
    logger.success(`项目 ${chalk.cyan(name)} 创建成功!`);
    console.log();
    console.log(chalk.gray("  cd " + name));
    console.log(chalk.gray(`  ${config.packageManager} dev`));
    console.log();
}

async function renderTemplate(templateName, targetDir, data) {
    const templateDir = path.join(TEMPLATES_DIR, templateName);
    if (!fs.existsSync(templateDir)) {
        throw new Error(`模板 ${templateName} 不存在`);
    }

    const files = glob.sync("**/*", {
        cwd: templateDir,
        dot: true,        // 包含 .dotfile
        nodir: true,
    });

    for (const file of files) {
        const srcPath = path.join(templateDir, file);
        const destPath = path.join(targetDir, file.replace(/\.ejs$/, ""));

        await fs.ensureDir(path.dirname(destPath));

        if (file.endsWith(".ejs")) {
            // EJS 模板：渲染后写入
            const content = await ejs.renderFile(srcPath, data);
            await fs.writeFile(destPath, content, "utf-8");
        } else {
            // 普通文件：直接复制
            await fs.copy(srcPath, destPath);
        }
    }
}

module.exports = create;
```

### 4. generate 命令

```javascript
// lib/commands/generate.js

const path = require("path");
const fs = require("fs-extra");
const chalk = require("chalk");
const ejs = require("ejs");
const logger = require("../utils/logger");

const TEMPLATES = {
    component: {
        description: "组件",
        files: [
            { template: "component/index.tsx.ejs", output: "src/components/<%= name %>/index.tsx" },
            { template: "component/style.css.ejs", output: "src/components/<%= name %>/style.css" },
        ],
    },
    page: {
        description: "页面",
        files: [
            { template: "page/index.tsx.ejs", output: "src/pages/<%= name %>/index.tsx" },
        ],
    },
    api: {
        description: "API 模块",
        files: [
            { template: "api/index.ts.ejs", output: "src/api/<%= name %>.ts" },
        ],
    },
};

async function generate(type, name) {
    const templateConfig = TEMPLATES[type];

    if (!templateConfig) {
        logger.error(`未知类型: ${type}，可选: ${Object.keys(TEMPLATES).join(", ")}`);
        process.exit(1);
    }

    const cwd = process.cwd();

    for (const file of templateConfig.files) {
        const outputPath = path.join(cwd, ejs.render(file.output, { name }));
        const templatePath = path.join(__dirname, `../templates/generators/${file.template}`);

        if (fs.existsSync(outputPath)) {
            logger.warn(`文件已存在，跳过: ${outputPath}`);
            continue;
        }

        await fs.ensureDir(path.dirname(outputPath));
        const content = await ejs.renderFile(templatePath, { name, type });
        await fs.writeFile(outputPath, content, "utf-8");
        logger.success(`生成: ${chalk.cyan(outputPath)}`);
    }
}

module.exports = generate;
```

### 5. 日志工具

```javascript
// lib/utils/logger.js

const chalk = require("chalk");

module.exports = {
    info: (msg) => console.log(chalk.blue("ℹ"), msg),
    success: (msg) => console.log(chalk.green("✔"), msg),
    warn: (msg) => console.log(chalk.yellow("⚠"), msg),
    error: (msg) => console.log(chalk.red("✖"), msg),
};
```

### 6. EJS 模板示例

```ejs
<!-- templates/react/package.json.ejs -->
{
    "name": "<%= name %>",
    "version": "1.0.0",
    "type": "module",
    "scripts": {
        "dev": "vite",
        "build": "tsc && vite build"<% if (features.includes('lint')) { %>,
        "lint": "eslint .",
        "format": "prettier --write ."<% } %>
    },
    "dependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0"<% if (features.includes('router')) { %>,
        "react-router": "^7.0.0"<% } %>
    }
}
```

```ejs
<!-- templates/generators/component/index.tsx.ejs -->
import React from 'react';
import './style.css';

interface <%= name %>Props {
    children?: React.ReactNode;
}

export default function <%= name %>({ children }: <%= name %>Props) {
    return (
        <div className="<%= name.toLowerCase() %>">
            {children}
        </div>
    );
}
```

## 五、发布到 npm

### 1. 准备发布

```json
// package.json
{
    "name": "@yourname/my-cli",
    "version": "1.0.0",
    "description": "前端项目脚手架",
    "bin": {
        "my-cli": "./bin/cli.js"
    },
    "files": ["bin", "lib", "templates"],
    "keywords": ["cli", "scaffold", "react", "vue"],
    "license": "MIT",
    "repository": {
        "type": "git",
        "url": "https://github.com/yourname/my-cli"
    },
    "engines": {
        "node": ">=18.0.0"
    }
}
```

### 2. 发布流程

```bash
# 登录 npm
npm login

# 发布（首次）
npm publish --access public

# 发布新版本
npm version patch    # 1.0.0 → 1.0.1（修复）
npm version minor    # 1.0.1 → 1.1.0（新功能）
npm version major    # 1.1.0 → 2.0.0（破坏性变更）
npm publish
```

### 3. 本地测试

```bash
# 在 CLI 项目目录下创建全局链接
npm link

# 之后可以在任意目录使用
my-cli create test-app
my-cli generate component Button

# 测试完成后取消链接
npm unlink -g @yourname/my-cli
```

## 六、进阶优化

### 1. 远程模板支持

```javascript
// 从 GitHub 仓库拉取模板
async function downloadTemplate(repo, targetDir) {
    const { download } = require("download-git-repo");
    const spinner = ora("下载模板中...").start();

    return new Promise((resolve, reject) => {
        download(repo, targetDir, { clone: false }, (err) => {
            if (err) {
                spinner.fail("模板下载失败");
                reject(err);
            } else {
                spinner.succeed("模板下载完成");
                resolve();
            }
        });
    });
}

// 使用：my-cli create my-app --template github:user/template-react
```

### 2. 版本更新检测

```javascript
const { checkForUpdates } = require("../utils/update");

async function checkUpdate() {
    const update = await checkForUpdates("my-cli");
    if (update) {
        console.log(chalk.yellow(`
            更新可用: ${chalk.gray(update.current)} → ${chalk.green(update.latest)}
            运行: npm install -g my-cli
        `));
    }
}

// 使用 update-notifier 库
const updateNotifier = require("update-notifier");
const pkg = require("../package.json");
updateNotifier({ pkg }).notify();
```

### 3. 配置文件支持

```javascript
// my-cli.config.js — 用户自定义配置
// 查找配置文件
const cosmiconfig = require("cosmiconfig");
const explorer = cosmiconfig("my-cli");

async function getConfig() {
    const result = await explorer.search();
    return result?.config || {};
}

// 配置文件内容
module.exports = {
    template: "react",
    packageManager: "pnpm",
    features: ["typescript", "router", "lint"],
    registry: "https://registry.npmmirror.com",
};
```

## 七、完整开发流程总结

```
1. 初始化项目
   mkdir my-cli && cd my-cli && npm init -y

2. 安装依赖
   npm install commander inquirer chalk ora ejs fs-extra glob

3. 开发
   bin/cli.js      → 入口，注册命令
   lib/commands/   → 各命令实现
   lib/utils/      → 工具函数
   templates/      → 项目模板（EJS）

4. 本地测试
   npm link → my-cli create test-app

5. 发布
   npm publish --access public

6. 迭代
   npm version minor && npm publish
```

## 总结

开发 CLI 工具的核心思路是：**解析命令 → 收集配置 → 处理模板 → 执行操作 → 输出结果**。

关键模块选择：
- **commander** — 命令定义与参数解析
- **inquirer** — 交互式问答
- **chalk** — 终端美化
- **ora** — 进度动画
- **ejs** — 模板渲染
- **fs-extra** — 文件操作

一个好的 CLI 工具应该做到：命令简洁直觉、交互友好、错误提示清晰、模板可扩展。从简单的项目脚手架开始，逐步添加远程模板、插件系统、配置文件等能力，就能打造出团队级的工程化工具。
