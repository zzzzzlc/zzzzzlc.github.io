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
        name: "地图导航 · WebGIS",
        description: "基于 MapLibre GL + OpenStreetMap 的开源 WebGIS 导航应用，支持起点终点搜索、OSRM 路线规划（驾车/步行/骑行）、转向指示、多底图切换（OSM/Esri 卫星/CARTO 暗色），全程无需 API Key。",
        internalPath: "/amap",
        tags: ["React", "MapLibre GL", "WebGIS", "OSM"],
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
        name: "BPMN 流程设计",
        description: "基于 BPMN.js 的在线流程设计器，支持 BPMN 2.0 标准流程图绘制、导入导出 BPMN/SVG 文件、预置审批流程模板。",
        internalPath: "/bpmn-editor",
        tags: ["React", "BPMN.js", "Workflow"],
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
        name: "css实验室",
        description: "用于测试css样式",
        internalPath: "/css-test",
        tags: ["css"],
        language: "TypeScript",
    },
    {
        name: "影视频播放器",
        description: "在线影视频播放器，支持渐进式下载（mp4/webm/mp3）、HLS（m3u8，hls.js）、DASH（mpd，dash.js）流媒体与本地文件上传，自定义控件含进度拖拽、倍速、循环、音量、快进快退、画中画、全屏及键盘快捷键，视频音频双模式。",
        internalPath: "/media-player",
        tags: ["React", "HLS", "DASH", "Media"],
        language: "TypeScript",
    },
    {
        name: "实时金融 3D 行情",
        description: "基于 RxJS + Three.js + WebSocket 的实时金融可视化：mock WS server 推送行情，RxJS 负责流式节流与断线重连，Three.js 用 InstancedMesh 批量渲染 K线柱阵 + 价格波动曲面，按需渲染 + 动画延续使数据静默时 GPU 占用降至 ~0，解决高频数据下的可视化性能、自适应布局与交互动画三大工程问题。",
        internalPath: "/market-3d",
        tags: ["React", "Three.js", "WebSocket", "RxJS"],
        language: "TypeScript",
    },
    {
        name: "实时金融 2D 行情",
        description: "基于 RxJS + Canvas 2D + WebSocket 的实时金融图表：零图表库依赖手写 K线引擎，新 K线滑入、柱体生长、当前价线与坐标系全部 lerp 平滑，十字光标槽位 O(1) 命中，按需渲染 + 动画延续使数据静默时近零开销；与 3D 版共享同一 mock 数据源与 RxJS 流层。",
        internalPath: "/market-2d",
        tags: ["React", "Canvas", "WebSocket", "RxJS"],
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
