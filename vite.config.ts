import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { markdownPlugin } from "./plugins/markdown";

export default defineConfig({
    base: "/",
    server: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
        // 文章管理页的本地 CRUD 服务（pnpm admin:server），仅 dev 使用
        proxy: {
            '/api': {
                target: 'http://localhost:8788',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: "dist",
        target: "es2022",
        cssCodeSplit: true,
        modulePreload: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/three')) return 'three';
                    // react 系与 antd 全家桶绑定同一 chunk：antd 与 react-dom 互相引用，
                    // 分属不同 chunk 会触发 circular chunk，导致运行时初始化失败（页面 NO_FCP）。
                    // 懒加载页面的重库(hls/dash/maplibre/bpmn/chatui)不归类，由 Rollup 按
                    // dynamic import 自动拆到各自 chunk，避免首屏被迫下载。
                    if (
                        id.includes('node_modules/react/') ||
                        id.includes('node_modules/react-dom/') ||
                        id.includes('node_modules/react-router') ||
                        id.includes('node_modules/scheduler') ||
                        id.includes('node_modules/react-is') ||
                        id.includes('node_modules/cookie') ||
                        id.includes('node_modules/set-cookie-parser') ||
                        id.includes('node_modules/antd') ||
                        id.includes('node_modules/@ant-design/') ||
                        id.includes('node_modules/@rc-component')
                    ) {
                        return 'vendor';
                    }
                },
            },
        },
    },
    resolve: {
        alias: {
            "@components": path.resolve(__dirname, "component"),
            "@pages": path.resolve(__dirname, "app/pages"),
            "@content": path.resolve(__dirname, "content"),
        },
    },
    plugins: [
        react(),
        markdownPlugin(),
        // 体积分析报告(treemap)：仅在 ANALYZE=true 时生成，避免日常构建的额外开销
        // 用法：ANALYZE=true pnpm build → 项目根 stats.html
        process.env.ANALYZE ? visualizer({
            filename: "stats.html",
            template: "treemap",
            gzipSize: true,
            brotliSize: true,
            open: false,
        }) : false,
    ],
});
