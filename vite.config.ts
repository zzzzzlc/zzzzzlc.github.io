import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { markdownPlugin } from "./plugins/markdown";

export default defineConfig({
    base: "/",
    server: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    },
    build: {
        outDir: "dist",
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
    ],
});
