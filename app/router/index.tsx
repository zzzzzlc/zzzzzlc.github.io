import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router";



const router = createBrowserRouter([]);
function Router() {
    return <RouterProvider router={router} />;
}
export default Router; 