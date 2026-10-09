import { createHash } from "node:crypto";
import { HttpError } from "../utils/http-error.js";

// Release identity comes from the server and a manifest on a configured frontend,
// never from the feedback body. Either project's redeployment opens a new cycle.
export function createFeedbackReleaseResolver({ env = process.env, fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map();
  const backend = `${env.VERCEL_DEPLOYMENT_ID || env.VERCEL_URL || "local-feedback-v1"}\n${env.FEEDBACK_RELEASE || ""}`;
  const allowed = (env.FRONTEND_URL || "http://localhost:5173").split(",").map(s => s.trim());
  return async origin => {
    const trusted = allowed.includes(origin) ? origin : allowed[0];
    const target = new URL(trusted);
    let frontend = "local";
    if (env.VERCEL || env.NODE_ENV === "production") {
      if (target.protocol !== "https:") throw new HttpError(503, "Feedback release configuration is unavailable.");
      let entry = cache.get(trusted);
      if (!entry || entry.expires <= now()) {
        if (!entry?.pending) {
          entry = { value: entry?.value, expires: 0 };
          entry.pending = (async () => {
            try {
              const response = await fetcher(new URL("/feedback-release.json", target), {
                cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000)
              });
              // Supports deploying the backend before the new frontend manifest.
              if (response.status === 404) return "legacy";
              if (!response.ok) throw new Error("Manifest unavailable");
              if (!response.headers.get("content-type")?.includes("application/json")) return "legacy";
              const text = await response.text();
              if (text.length > 512) throw new Error("Manifest too large");
              const value = JSON.parse(text).release;
              if (typeof value !== "string" || !/^[a-zA-Z0-9._:-]{1,180}$/.test(value)) throw new Error("Invalid manifest");
              return value;
            } catch {
              if (entry.value) return entry.value;
              throw new HttpError(503, "Feedback is temporarily unavailable. Please try again later.");
            }
          })();
          cache.set(trusted, entry);
        }
        try { entry.value = await entry.pending; entry.expires = now() + 60_000; }
        finally { entry.pending = null; }
      }
      frontend = entry.value;
    }
    return `feedback-${createHash("sha256").update(`${backend}\n${frontend}`).digest("hex").slice(0, 32)}`;
  };
}

export const getFeedbackRelease = createFeedbackReleaseResolver();
