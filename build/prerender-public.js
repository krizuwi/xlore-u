import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { campusGuidance } from "../src/lib/college-guides.js";
import { getPageMetadata, publicPaths, SITE_URL } from "../src/lib/page-metadata.js";
import { fetchPublicCatalog } from "./public-catalog.js";

const template = await readFile("dist/index.html", "utf8");
const entities = { "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" };
const escapeHtml = value => value.replace(/[&"<>]/g, char => entities[char]);

function renderHtml(pathname, data, markup) {
  const { title, description, canonicalUrl, robots } = getPageMetadata(pathname, data);
  const canonical = escapeHtml(canonicalUrl);
  const snapshot = JSON.stringify({ pathname, data }).replace(/</g, "\\u003c");
  return template
    .replace(/<title>.*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/?>/, () => `<meta name="robots" content="${robots}" />`)
    .replace(/(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*/g, (_, start) => start + escapeHtml(description))
    .replace(/(<meta (?:name|property)="(?:og:title|twitter:title)" content=")[^"]*/g, (_, start) => start + escapeHtml(title))
    .replace("</head>", () => `<link rel="canonical" href="${canonical}" /><meta property="og:url" content="${canonical}" /></head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${markup}</div><script type="application/json" id="xlore-public-data">${snapshot}</script>`);
}

const [featured, schools, programs, filters] = await Promise.all([
  fetchPublicCatalog("/schools?limit=3&sort=rating"),
  fetchPublicCatalog("/schools?limit=8"),
  fetchPublicCatalog("/programs?limit=12"),
  fetchPublicCatalog("/schools/meta/filters")
]);

const pages = new Map(publicPaths.map(path => [path, null]));
pages.set("/", { schools: featured.data });
pages.set("/schools", { catalog: schools, filters });
pages.set("/programs", { catalog: programs, filters });

const schoolIds = new Set([...Object.keys(campusGuidance), ...featured.data.map(school => school.id), ...schools.data.map(school => school.id)]);
const detailPaths = [
  ...Array.from(schoolIds, id => `/schools/${id}`),
  ...programs.data.map(program => `/programs/${program.id}`)
];
for (let i = 0; i < detailPaths.length; i += 5) {
  const batch = detailPaths.slice(i, i + 5);
  const records = await Promise.all(batch.map(fetchPublicCatalog));
  batch.forEach((path, index) => {
    if (records[index]) pages.set(path, records[index]);
  });
}

const vite = await createServer({
  configFile: false,
  mode: "production",
  plugins: [react()],
  server: { middlewareMode: true, ws: false },
  appType: "custom"
});
try {
  const { renderPublicPage } = await vite.ssrLoadModule("/src/render-public-page.jsx");
  await writeFile("dist/app.html", template);
  for (const [pathname, data] of pages) {
    const markup = await renderPublicPage(SITE_URL + pathname, { pathname, data });
    const output = join("dist", pathname === "/" ? "index.html" : pathname.slice(1) + ".html");
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, renderHtml(pathname, data, markup));
  }
  const urls = Array.from(pages.keys(), path => `  <url><loc>${SITE_URL}${path}</loc></url>`).join("\n");
  await writeFile("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.info(`Rendered ${pages.size} public pages and their sitemap.`);
} finally {
  await vite.close();
}
