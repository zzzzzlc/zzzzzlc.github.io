import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { markdownPlugin } from "./plugins/markdown";

export default defineConfig({
    base: "/",
    server: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
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
                    if (id.includes('node_modules/@ant-design/icons')) return 'antd-icons';
                    if (id.includes('node_modules/antd')) return 'antd';
                    if (id.includes('node_modules')) return 'vendor';
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
        visualizer({
            filename: "stats.html",
            template: "treemap",
            gzipSize: true,
            brotliSize: true,
            open: false,
        }),
    ],
});
