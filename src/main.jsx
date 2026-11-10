import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { appRoutes } from "./AppRoutes.jsx";
import { applyTheme, readTheme } from "./lib/theme.js";
import "./index.css";

applyTheme(readTheme());

// A data router provides reliable blocking for both links and browser Back.
// The existing descendant Routes retain all student and admin URLs.
const pageData = document.getElementById("xlore-public-data");
const router = createBrowserRouter(appRoutes(pageData ? JSON.parse(pageData.textContent) : null));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
