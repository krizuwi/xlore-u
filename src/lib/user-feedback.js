export const feedbackLabels = {
  assessment: "Assessment", comparison: "Compare", map: "Map", school: "School pages"
};

export function feedbackPage(pathname) {
  if (/^\/assessment(?:\/[^/]+\/results)?\/?$/.test(pathname)) return { section: "assessment", schoolId: null };
  if (/^\/(?:comparison|compare-programs)\/?$/.test(pathname)) return { section: "comparison", schoolId: null };
  if (/^\/map\/?$/.test(pathname)) return { section: "map", schoolId: null };
  const match = pathname.match(/^\/schools\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/?$/i);
  return match ? { section: "school", schoolId: match[1] } : null;
}

export function feedbackExit(previousPath, nextPath) {
  const previous = feedbackPage(previousPath), next = feedbackPage(nextPath);
  if (!previous || previousPath === nextPath) return null;
  // Internal transitions, including browsing another school, are not finished sections.
  if (previous.section === next?.section) return null;
  return previous;
}

export function createFeedbackExperienceTracker() {
  const completed = new Set();
  const key = (userId, pathname) => JSON.stringify([userId, pathname]);
  return {
    complete(userId, pathname) {
      if (userId && feedbackPage(pathname)) completed.add(key(userId, pathname));
    },
    consume(userId, pathname) {
      const visit = key(userId, pathname);
      const ready = completed.has(visit);
      completed.delete(visit);
      return ready;
    }
  };
}

export function feedbackDismissKey(userId, releaseId, section) {
  return `xlore-feedback:${userId}:${releaseId}:${section}`;
}

export function shouldPromptFeedback(status, section, dismissed = false) {
  return Boolean(status?.releaseId) && !status.submittedSections?.includes(section) && !dismissed;
}
