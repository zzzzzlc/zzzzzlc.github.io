import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    server: {
        port: 3000,
    },
    build: {
        outDir: "dist",
    },
    plugins: [
        // Add your plugins here
        react(),
    ],
});