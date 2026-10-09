import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { EngagementProvider } from "./context/EngagementContext.jsx";
import { applyTheme, readTheme } from "./lib/theme.js";
import "./index.css";

applyTheme(readTheme());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EngagementProvider><App /></EngagementProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
