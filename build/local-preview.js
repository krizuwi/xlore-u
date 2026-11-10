import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { publicCatalogOrigin, publicCatalogRoute } from "./public-catalog.js";

export function localPreview() {
  return {
    name: "xlore-local-preview",
    configurePreviewServer({ middlewares }) {
      middlewares.use("/api", async (req, res) => {
        const path = "/api" + req.url;
        if (req.method !== "GET" || !publicCatalogRoute.test(path.split("?")[0])) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "This preview provides public catalog access only." } }));
          return;
        }
        try {
          const result = await fetch(publicCatalogOrigin + path, {
            signal: AbortSignal.timeout(10000),
            redirect: "error"
          });
          const body = await result.arrayBuffer();
          res.writeHead(result.status, { "Content-Type": result.headers.get("content-type") ?? "application/octet-stream" });
          res.end(new Uint8Array(body));
        } catch {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "The public catalog could not be reached." } }));
        }
      });
      middlewares.use(async (req, res, next) => {
        const { pathname, search } = new URL(req.url, "http://localhost");
        if (!["GET", "HEAD"].includes(req.method) || pathname === "/" || extname(pathname)) return next();
        const route = pathname.replace(/\/$/, "");
        if ((await stat(join("dist", route + ".html")).catch(() => null))?.isFile()) {
          if (route === pathname) return next();
          res.writeHead(308, { Location: route + search });
          res.end();
          return;
        }
        try {
          const shell = await readFile("dist/app.html");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(req.method === "HEAD" ? undefined : shell);
        } catch (error) {
          next(error);
        }
      });
    }
  };
}
