import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { EngagementProvider } from "./context/EngagementContext.jsx";
import { FeedbackExperienceProvider } from "./context/FeedbackExperienceContext.jsx";
import { UnsavedChangesProvider } from "./context/UnsavedChangesContext.jsx";
import { applyTheme, readTheme } from "./lib/theme.js";
import "./index.css";

applyTheme(readTheme());

// A data router provides reliable blocking for both links and browser Back.
// The existing descendant Routes retain all student and admin URLs.
const router = createBrowserRouter([{ path: "*", element:
  <AuthProvider><UnsavedChangesProvider><EngagementProvider><FeedbackExperienceProvider><App /></FeedbackExperienceProvider></EngagementProvider></UnsavedChangesProvider></AuthProvider>
}]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
