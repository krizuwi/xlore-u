export const publicCatalogOrigin = "https://xlore-u-api.vercel.app";

export const publicCatalogRoute = /^\/api\/(?:schools(?:\/meta\/filters)?|programs|(?:schools|programs)\/[a-f\d-]{36}|school-media\/[a-zA-Z\d/_-]+(?:\.[a-zA-Z\d]+)?)$/;

export async function fetchPublicCatalog(path) {
  const response = await fetch(publicCatalogOrigin + "/api" + path, {
    signal: AbortSignal.timeout(15000),
    redirect: "error"
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public catalog request failed (${response.status}) for ${path}`);
  return response.json();
}
