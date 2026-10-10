export const DASHBOARD_SLIDE_MS = 5000;
export const RANKING_SOURCE = "https://www.gmanetwork.com/news/topstories/nation/964949/35-ph-universities-make-it-to-2026-qs-asia-rankings/story/";

export function buildDashboardSlides(showcase = {}, latestAssessment = null) {
  const slides = [];
  const usedSchools = new Set();
  function addSchools(schools, kind, label, description) {
    const seen = new Set();
    for (const school of schools ?? []) {
      if (!school?.id || seen.has(school.id)) continue;
      seen.add(school.id);
      usedSchools.add(school.id);
      slides.push({ id: `${kind}:${school.id}`, kind, label, school, title: school.name,
        description, to: `/schools/${school.id}`, action: "Explore school" });
    }
  }
  if (latestAssessment) {
    addSchools(showcase.recommendedSchools?.slice(0, 2), "recommended", "From your assessment",
      "Explore a school offering programs from your assessment results. Review admission requirements before applying.");
  } else {
    const backgroundSchool = showcase.discoverySchools?.find(school => school.campusPhotos?.length)
      ?? showcase.featuredSchool;
    slides.push({ id: "assessment", kind: "assessment", label: "Your next step", school: backgroundSchool,
      title: "Find your college direction", description: "Take your one-time assessment to discover programs and schools that match your interests.",
      to: "/assessment", action: "Assessment now" });
  }
  addSchools(showcase.recentSchools?.slice(0, 2), "recent", "Recently viewed", "Pick up where you left off and take another look around this campus.");
  if (showcase.featuredSchool) {
    addSchools([showcase.featuredSchool], "ranked", "Top-ranked institution · Metro Manila campus",
      "University of the Philippines is #1 in the Philippines and #104 in QS Asia 2026. Featured campus: UP Diliman.");
  }
  const discoveries = (showcase.discoverySchools ?? []).filter(school => !usedSchools.has(school.id));
  addSchools((discoveries.length ? discoveries : showcase.discoverySchools)?.slice(0, 3), "discovery", "Discover a campus",
    "A fresh school to explore from our directory. Discover its programs, facilities, and opportunities.");
  if (!slides.length) slides.push({ id: "directory", kind: "directory", label: "Keep exploring", title: "Your next chapter starts here",
    description: "Browse the school directory and revisit your assessment results to compare your options.", to: "/schools", action: "Explore schools" });
  return slides;
}
