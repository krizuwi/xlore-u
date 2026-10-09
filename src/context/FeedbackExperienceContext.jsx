import { createContext, useContext, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { createFeedbackExperienceTracker } from "../lib/user-feedback.js";

const FeedbackExperienceContext = createContext(null);

export function FeedbackExperienceProvider({ children }) {
  const tracker = useRef(null);
  if (!tracker.current) tracker.current = createFeedbackExperienceTracker();
  return <FeedbackExperienceContext.Provider value={tracker.current}>{children}</FeedbackExperienceContext.Provider>;
}

export function useFeedbackExperienceTracker() {
  return useContext(FeedbackExperienceContext);
}

// Pages report successful use, never opening a popup while the section is active.
export function useFeedbackCompletion(ready) {
  const tracker = useFeedbackExperienceTracker();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const userId = user?.role !== "admin" ? user?.id : null;
  useEffect(() => {
    if (ready && userId) tracker?.complete(userId, pathname);
  }, [ready, userId, pathname, tracker]);
}
