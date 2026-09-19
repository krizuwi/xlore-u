import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { Seo } from "./components/Seo.jsx";
import { AssessmentPage } from "./pages/AssessmentPage.jsx";
import { AuthPage } from "./pages/AuthPage.jsx";
import { ComparisonPage } from "./pages/ComparisonPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { MapPage } from "./pages/MapPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { ProgramsPage } from "./pages/ProgramsPage.jsx";
import { SavedPage } from "./pages/SavedPage.jsx";
import { SchoolDetailPage } from "./pages/SchoolDetailPage.jsx";
import { SchoolsPage } from "./pages/SchoolsPage.jsx";

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>;

export function App() {
  return (
    <>
      <Seo />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="schools" element={<SchoolsPage />} />
          <Route path="schools/:id" element={<SchoolDetailPage />} />
          <Route path="programs" element={<ProgramsPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="assessment" element={protectedPage(<AssessmentPage />)} />
          <Route path="assessment/:id/results" element={protectedPage(<AssessmentPage />)} />
          <Route path="saved" element={protectedPage(<SavedPage />)} />
          <Route path="comparison" element={protectedPage(<ComparisonPage />)} />
          <Route path="compare-programs" element={protectedPage(<ComparisonPage programOnly />)} />
          <Route path="dashboard" element={protectedPage(<DashboardPage />)} />
          <Route path="login" element={<AuthPage mode="login" />} />
          <Route path="register" element={<AuthPage mode="register" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
