import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { feedbackReleasePlugin } from "./build/feedback-release.js";
import { localPreview } from "./build/local-preview.js";

export default defineConfig(({ mode }) => ({
  plugins: [react(), feedbackReleasePlugin(), mode === "local-preview" && localPreview()],
  server: {
    port: 5173,
    host: "127.0.0.1"
  }
}));
