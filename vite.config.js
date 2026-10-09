import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { feedbackReleasePlugin } from "./build/feedback-release.js";

export default defineConfig({
  plugins: [react(), feedbackReleasePlugin()],
  server: {
    port: 5173,
    host: "127.0.0.1"
  }
});
