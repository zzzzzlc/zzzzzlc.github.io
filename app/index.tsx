import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
/* jetbrains-mono 的 package.json exports 未暴露 ./400.css 子路径，须走相对路径 */
import "../node_modules/@fontsource/jetbrains-mono/400.css";
import "../node_modules/@fontsource/jetbrains-mono/600.css";
import './index.css';

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

