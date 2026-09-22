import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://xlore-u-beta.vercel.app";
const DEFAULT_TITLE = "Xlore U | Find Your Best-Fit College";
const DEFAULT_DESCRIPTION = "Find colleges and degree programs in Metro Manila. Compare tuition, locations, scholarships, and programs with Xlore U.";

const pageMetadata = {
  "/": {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION
  },
  "/schools": {
    title: "Metro Manila Colleges and Universities | Xlore U",
    description: "Search colleges and universities in Metro Manila by location, tuition, school type, programs, ratings, and scholarships."
  },
  "/programs": {
    title: "College Degree Programs in Metro Manila | Xlore U",
    description: "Explore college degree programs including information technology, computer science, engineering, business, nursing, and more."
  },
  "/map": {
    title: "Map of Colleges in Metro Manila | Xlore U",
    description: "Find colleges and universities in Manila, Quezon City, Taguig, and nearby Metro Manila cities on an interactive map."
  },
  "/profile": {
    title: "Profile Settings | Xlore U",
    description: "Manage your private Xlore U account details, address, and password."
  },
  "/dashboard": {
    title: "Student Dashboard | Xlore U",
    description: "Review your saved schools, assessment history, and recent college exploration activity."
  },
  "/assessment": {
    title: "College Profile Assessment | Xlore U",
    description: "Explore programs and schools connected to your interests through the Xlore U assessment."
  },
  "/saved": {
    title: "Saved Schools and Programs | Xlore U",
    description: "Review the schools and college programs saved to your Xlore U account."
  },
  "/comparison": {
    title: "Compare Schools | Xlore U",
    description: "Compare selected schools by programs, tuition, accreditation, scholarships, and location."
  },
  "/compare-programs": {
    title: "Compare College Programs | Xlore U",
    description: "Compare program offerings across your selected schools."
  },
  "/login": {
    title: "Sign In | Xlore U",
    description: "Sign in to your Xlore U student account."
  },
  "/register": {
    title: "Create an Account | Xlore U",
    description: "Create an Xlore U account to save, compare, and revisit college options."
  }
};

const privateRoutes = [
  "/assessment",
  "/saved",
  "/comparison",
  "/compare-programs",
  "/dashboard",
  "/profile",
  "/login",
  "/register"
];

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    document.head.appendChild(element);
  }
  return element;
}

function ensureCanonical() {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  return element;
}

export function Seo() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isSchoolDetail = /^\/schools\/[^/]+$/.test(pathname);
    const isProgramDetail = /^\/programs\/[^/]+$/.test(pathname);
    const isPrivate = privateRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    let metadata = pageMetadata[pathname];
    if (!metadata && isSchoolDetail) {
      metadata = {
        title: "College and University Details | Xlore U",
        description: "Review this institution's programs, tuition, location, accreditation, and scholarship information on Xlore U."
      };
    }
    if (!metadata && isProgramDetail) {
      metadata = {
        title: "College Program Details | Xlore U",
        description: "Review a college program's description, admission requirements, career opportunities, and offering institutions on Xlore U."
      };
    }
    if (!metadata && pathname.startsWith("/assessment/") && pathname.endsWith("/results")) {
      metadata = {
        title: "Assessment Results | Xlore U",
        description: "Review your saved Xlore U assessment results and suggested schools and programs."
      };
    }
    if (!metadata) {
      metadata = {
        title: "Page Not Found | Xlore U",
        description: DEFAULT_DESCRIPTION
      };
    }
    const canonicalUrl = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;

    document.title = metadata.title;

    ensureMeta('meta[name="description"]', { name: "description" }).content = metadata.description;
    ensureMeta('meta[name="robots"]', { name: "robots" }).content = isPrivate
      ? "noindex, nofollow"
      : "index, follow, max-image-preview:large";
    ensureMeta('meta[property="og:title"]', { property: "og:title" }).content = metadata.title;
    ensureMeta('meta[property="og:description"]', { property: "og:description" }).content = metadata.description;
    ensureMeta('meta[property="og:url"]', { property: "og:url" }).content = canonicalUrl;
    ensureMeta('meta[name="twitter:title"]', { name: "twitter:title" }).content = metadata.title;
    ensureMeta('meta[name="twitter:description"]', { name: "twitter:description" }).content = metadata.description;
    ensureCanonical().href = canonicalUrl;
  }, [pathname]);

  return null;
}
