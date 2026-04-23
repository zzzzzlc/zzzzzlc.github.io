import React, { Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Spin } from "antd";
import routes from "./importLazy";

const router = createBrowserRouter(routes);

function Router() {
    return (
        <Suspense fallback={
            <div style={{ textAlign: 'center', padding: 100 }}>
                <Spin size="large" />
            </div>
        }>
            <RouterProvider router={router} />
        </Suspense>
    );
}

export default Router;
