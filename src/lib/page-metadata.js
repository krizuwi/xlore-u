import { guideSummaries } from "./college-guides.js";

export const SITE_URL = "https://www.xloreu.com";
const DEFAULT_TITLE = "Xlore U | Find Your Best-Fit College";
const DEFAULT_DESCRIPTION = "Find colleges and degree programs in Metro Manila. Compare tuition, locations, scholarships, and programs with Xlore U.";

const pageMetadata = {
  "/guides": { title: "College Planning Guides | Xlore U", description: "Compare Metro Manila campuses, plan a college budget, and turn your assessment results into a shortlist." },
  ...Object.fromEntries(guideSummaries.map(guide => [`/guides/${guide.slug}`, {
    title: `${guide.title} | Xlore U`, description: guide.description
  }])),
  '/about': { title: 'About Us | Xlore U', description: 'Meet the STI College Global City student team helping senior high school students explore colleges and programs in Metro Manila.' },
  '/contact': { title: 'Contact Admin | Xlore U', description: 'Send a private account or support question to the Xlore U administrator.' },
  '/admin/messages': { title: 'Contact Messages | Xlore U', description: 'Review private student and institution support requests.' },
  '/institution': { title: 'Institution Workspace | Xlore U', description: 'Manage your approved school profile, programs, and school posts.' },
  '/institution/settings': { title: 'Institution Account Settings | Xlore U', description: 'Update your linked institution name and secure your account password.' },
  '/institution/login': { title: 'Institution Sign In | Xlore U', description: 'Sign in to your Xlore U institution account.' },
  '/institution/register': { title: 'Register Institution | Xlore U', description: 'Request a verified institution account for one school.' },
  '/admin/institutions': { title: 'Institution Management | Xlore U', description: 'Review school claims and moderate institution community content.' },
  '/terms': { title: 'Terms of Use | Xlore U', description: 'Read the account terms for the Xlore U college-exploration service.' },
  '/privacy': { title: 'Privacy Policy | Xlore U', description: 'Learn what information Xlore U uses and how to manage optional home-location sharing.' },
  "/admin": {
    title: "Admin Overview | Xlore U",
    description: "Manage university data collection, scraping jobs, and catalog quality."
  },
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
    title: "Compare Schools and Programs | Xlore U",
    description: "Compare schools and their program offerings side by side by tuition, accreditation, scholarships, and location."
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

export const publicPaths = ["/", "/schools", "/programs", "/map", "/guides", "/about", "/terms", "/privacy",
  ...guideSummaries.map(guide => `/guides/${guide.slug}`)];

export function getPageMetadata(path, data) {
  const pathname = path.replace(/\/+$/, "") || "/";
  const isSchoolDetail = /^\/schools\/[^/]+$/.test(pathname);
  const isProgramDetail = /^\/programs\/[^/]+$/.test(pathname);
  let metadata = Object.hasOwn(pageMetadata, pathname) ? pageMetadata[pathname] : null;
  const adminPage = {
    universities: "Universities Management",
    programs: "Programs Management",
    categories: "Category Management",
    scraping: "Scraper Overview",
    "scraping/overview": "Scraper Overview",
    "scraping/automation": "Scraper Automation",
    "scraping/results": "Scraper Run Results",
    assessment: "Assessment Management",
    settings: "Admin Settings",
    logs: "Admin Logs",
    login: "Admin Access",
  }[pathname.replace(/\/+$/, "").replace(/^\/admin\//, "")];
  if (!metadata && /^\/admin\/scraping\/results\/[^/]+$/.test(pathname)) {
    metadata = { title: "Scraper Run Details | Xlore U Admin", description: "Review the outcome and collected data from a university scraper run." };
  }
  if (!metadata && pathname.startsWith("/admin/") && adminPage) {
    metadata = { title: `${adminPage} | Xlore U Admin`, description: "Manage and review the Xlore U university and program catalog." };
  }
  if (!metadata && isSchoolDetail) {
    metadata = {
      title: data?.name ? `${data.name} | Xlore U` : "College and University Details | Xlore U",
      description: data?.name ? `Explore programs, admissions, tuition, and financial aid information for ${data.name} on Xlore U.` : "Explore programs, admissions, tuition, and financial aid for this campus."
    };
  }
  if (!metadata && isProgramDetail) {
    metadata = {
      title: data?.name ? `${data.name} | Xlore U` : "College Program Details | Xlore U",
      description: data?.name ? `Review the requirements, possible careers, and schools offering ${data.name} on Xlore U.` : "Review program requirements, possible careers, and schools."
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
  const indexable = publicPaths.includes(pathname) || Boolean(data?.id && (isSchoolDetail || isProgramDetail));
  return {
    ...metadata,
    canonicalUrl: indexable ? SITE_URL + pathname : null,
    robots: indexable ? "index, follow, max-image-preview:large" : "noindex, follow"
  };
}
