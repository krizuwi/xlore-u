import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getPageMetadata } from "../lib/page-metadata.js";

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    document.head.appendChild(element);
  }
  return element;
}

function updateCanonical(url) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!url) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = url;
}

export function usePageMetadata(data, skip = false) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (skip) return;
    const metadata = getPageMetadata(pathname, data);
    document.title = metadata.title;

    ensureMeta('meta[name="description"]', { name: "description" }).content = metadata.description;
    ensureMeta('meta[name="robots"]', { name: "robots" }).content = metadata.robots;
    ensureMeta('meta[property="og:title"]', { property: "og:title" }).content = metadata.title;
    ensureMeta('meta[property="og:description"]', { property: "og:description" }).content = metadata.description;
    if (metadata.canonicalUrl) ensureMeta('meta[property="og:url"]', { property: "og:url" }).content = metadata.canonicalUrl;
    else document.head.querySelector('meta[property="og:url"]')?.remove();
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" }).content = metadata.title;
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" }).content = metadata.description;
    updateCanonical(metadata.canonicalUrl);
  }, [pathname, data, skip]);
}

export function Seo() {
  const { pathname } = useLocation();
  usePageMetadata(undefined, /^\/(schools|programs)\/[^/]+\/?$/.test(pathname));
  return null;
}
