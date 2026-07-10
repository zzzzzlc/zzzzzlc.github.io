import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import "../node_modules/@fontsource/jetbrains-mono/400.css";
import "../node_modules/@fontsource/jetbrains-mono/600.css";
import './index.css';

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

