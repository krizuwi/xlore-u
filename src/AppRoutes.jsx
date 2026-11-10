import { App } from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { EngagementProvider } from "./context/EngagementContext.jsx";
import { FeedbackExperienceProvider } from "./context/FeedbackExperienceContext.jsx";
import { PublicPageData } from "./context/PublicPageData.js";
import { UnsavedChangesProvider } from "./context/UnsavedChangesContext.jsx";

export function appRoutes(snapshot) {
  return [{ path: "*", element:
    <PublicPageData.Provider value={snapshot}>
      <AuthProvider><UnsavedChangesProvider><EngagementProvider><FeedbackExperienceProvider>
        <App />
      </FeedbackExperienceProvider></EngagementProvider></UnsavedChangesProvider></AuthProvider>
    </PublicPageData.Provider>
  }];
}
