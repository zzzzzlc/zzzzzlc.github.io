import React from "react";
import type { RouteObject } from "react-router";
import BlogLayout from "../../component/layout/BlogLayout";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <BlogLayout />,
        children: [
            {
                index: true,
                id: "首页",
                element: React.createElement(React.lazy(() => import("../pages/Home"))),
            },
            {
                path: "post/:slug",
                id: "文章详情",
                element: React.createElement(React.lazy(() => import("../pages/BlogPost"))),
            },
            {
                path: "categories",
                id: "分类",
                element: React.createElement(React.lazy(() => import("../pages/Categories"))),
            },
            {
                path: "projects",
                id: "项目",
                element: React.createElement(React.lazy(() => import("../pages/Projects"))),
            },
            {
                path: "about",
                id: "关于",
                element: React.createElement(React.lazy(() => import("../pages/About"))),
            },
            {
                path: "editor/code-editor",
                id: "代码编辑器",
                element: React.createElement(React.lazy(() => import("../pages/editor/CodeEditor"))),
            },
            {
                path: "ai",
                id: "AI 对话",
                element: React.createElement(React.lazy(() => import("../pages/AI"))),
            },
            {
                path: "canvas",
                id: "Canvas 画板",
                element: React.createElement(React.lazy(() => import("../pages/canvas"))),
            },
            {
                path: "svg-editor",
                id: "SVG 绘制",
                element: React.createElement(React.lazy(() => import("../pages/svg-editor"))),
            },
            {
                path: "three-viewer",
                id: "3D 查看器",
                element: React.createElement(React.lazy(() => import("../pages/three-viewer"))),
            },
            {
                path: "amap",
                id: "高德地图",
                element: React.createElement(React.lazy(() => import("../pages/amap"))),
            },
            {
                path: "theme",
                id: "主题定制",
                element: React.createElement(React.lazy(() => import("../pages/theme"))),
            },
            {
                path: "watermark",
                id: "水印工具",
                element: React.createElement(React.lazy(() => import("../pages/watermark"))),
            },
        ],
    },
];

export default routes;
