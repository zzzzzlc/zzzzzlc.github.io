import React from "react";
import type { RouteObject } from "react-router";


const routes: RouteObject[] = [
    {
        id: "ai",
        Component: React.lazy(() => import("../pages/AI")),
    },
    {
        id: "编辑器",
        children: [
            {
                id: "code编辑器",
                Component: React.lazy(() => import("../pages/editor/CodeEditor")),
            },
            {
                id: "富文本编辑器",
                Component: React.lazy(() => import("../pages/editor/RichTextEditor")),
            },
        ]
    }
]
export default routes;