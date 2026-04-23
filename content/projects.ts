export interface Project {
    name: string;
    description: string;
    url?: string;
    internalPath?: string;
    tags: string[];
    language?: string;
}

const projects: Project[] = [
    {
        name: "水印工具",
        description: "在线水印生成工具，支持页面水印、图片水印下载、内容区域水印，可自定义文本、颜色、旋转、透明度等参数。",
        internalPath: "/watermark",
        tags: ["React", "antd", "Canvas"],
        language: "TypeScript",
    },
    {
        name: "主题定制",
        description: "在线主题定制工具，可自定义主色调、功能色、字号、圆角、字体，实时预览并导出 CSS 变量。",
        internalPath: "/theme",
        tags: ["React", "antd", "CSS"],
        language: "TypeScript",
    },
    {
        name: "高德地图",
        description: "基于高德地图 JS API 的地图应用，支持地点搜索、城市定位、多图层切换（标准/卫星/暗色）。",
        internalPath: "/amap",
        tags: ["React", "高德地图", "地图"],
        language: "TypeScript",
    },
    {
        name: "3D 模型查看器",
        description: "基于 Three.js 的 3D 模型查看器，支持上传 GLB/GLTF/OBJ/STL 模型，实时渲染与交互。",
        internalPath: "/three-viewer",
        tags: ["React", "Three.js", "WebGL"],
        language: "TypeScript",
    },
    {
        name: "AI 对话",
        description: "基于 OpenAI API 的智能对话助手，支持多轮对话。",
        internalPath: "/ai",
        tags: ["React", "OpenAI", "ChatUI"],
        language: "TypeScript",
    },
    {
        name: "SVG 绘制",
        description: "在线 SVG 编辑器，实时编辑 SVG 代码并预览生成图案，内置多个示例模板。",
        internalPath: "/svg-editor",
        tags: ["React", "SVG", "Monaco Editor"],
        language: "TypeScript",
    },
    {
        name: "Canvas 画板",
        description: "基于 HTML5 Canvas 的在线绘图工具，支持画笔、形状绘制、撤销重做、导出图片。",
        internalPath: "/canvas",
        tags: ["React", "Canvas", "TypeScript"],
        language: "TypeScript",
    },
    {
        name: "代码编辑器",
        description: "基于 Monaco Editor 的在线代码编辑器，支持多语言语法高亮、自动补全、代码格式化等功能。",
        internalPath: "/editor/code-editor",
        tags: ["React", "Monaco Editor", "TypeScript"],
        language: "TypeScript",
    },
    {
        name: "zzzzzlc.github.io",
        description: "个人博客网站，使用 React + Vite + antd 构建，Markdown 文章在构建时编译。",
        url: "https://github.com/zzzzzlc/zzzzzlc.github.io",
        tags: ["React", "TypeScript", "Vite", "antd"],
        language: "TypeScript",
    },
];

export default projects;
