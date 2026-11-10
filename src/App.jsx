import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoadingState } from "./components/Feedback.jsx";
import { Layout } from "./components/Layout.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { RouteScroll } from "./components/RouteScroll.jsx";
import { Seo } from "./components/Seo.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { MapPage } from "./pages/MapPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { ProgramDetailPage } from "./pages/ProgramDetailPage.jsx";
import { ProgramsPage } from "./pages/ProgramsPage.jsx";
import { SchoolDetailPage } from "./pages/SchoolDetailPage.jsx";
import { SchoolsPage } from "./pages/SchoolsPage.jsx";
import { AccountPolicyPage } from './pages/AccountPolicyPage.jsx';
import { ProtectedAdminRoute } from "./admin/Components/AdminAccess.jsx";
import { AboutPage } from './pages/AboutPage.jsx';
import { CollegeGuidesPage } from './pages/CollegeGuidesPage.jsx';

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>;
const lazyPage = (load, name) => lazy(async () => ({ default: (await load())[name] }));

const AssessmentPage = lazyPage(() => import("./pages/AssessmentPage.jsx"), "AssessmentPage");
const AuthPage = lazyPage(() => import("./pages/AuthPage.jsx"), "AuthPage");
const ComparisonPage = lazyPage(() => import("./pages/ComparisonPage.jsx"), "ComparisonPage");
const ContactPage = lazyPage(() => import("./pages/ContactPage.jsx"), "ContactPage");
const DashboardPage = lazyPage(() => import("./pages/DashboardPage.jsx"), "DashboardPage");
const ProfilePage = lazyPage(() => import("./pages/ProfilePage.jsx"), "ProfilePage");
const SavedPage = lazyPage(() => import("./pages/SavedPage.jsx"), "SavedPage");
const AdminLoginPage = lazyPage(() => import("./admin/Pages/AdminUtilityPages.jsx"), "AdminLoginPage");
const AdminOverviewPage = lazyPage(() => import("./admin/Dashboard/AdminOverviewPage.jsx"), "AdminOverviewPage");
const InstitutionAuthPage = lazyPage(() => import("./institution/InstitutionAuthPage.jsx"), "InstitutionAuthPage");
const InstitutionSettings = lazyPage(() => import("./institution/InstitutionSettings.jsx"), "InstitutionSettings");
const InstitutionWorkspace = lazyPage(() => import("./institution/InstitutionWorkspace.jsx"), "InstitutionWorkspace");

export function App() {
  return (
    <>
      <Seo />
      <Suspense fallback={<main className="page-shell container"><LoadingState label="Loading page…" /></main>}>
        <RouteScroll />
        <Routes>
          <Route path="admin/login" element={<AdminLoginPage />} />
          <Route path="admin/*" element={<ProtectedAdminRoute><AdminOverviewPage /></ProtectedAdminRoute>} />
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="schools" element={<SchoolsPage />} />
            <Route path="schools/:id" element={<SchoolDetailPage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="programs/:id" element={<ProgramDetailPage />} />
            <Route path="map" element={<MapPage />} />
            <Route path="assessment" element={protectedPage(<AssessmentPage />)} />
            <Route path="assessment/:id/results" element={protectedPage(<AssessmentPage />)} />
            <Route path="saved" element={protectedPage(<SavedPage />)} />
            <Route path="comparison" element={protectedPage(<ComparisonPage />)} />
            <Route path="compare-programs" element={protectedPage(<Navigate to="/comparison#program-comparison" replace />)} />
            <Route path="dashboard" element={protectedPage(<DashboardPage />)} />
            <Route path="profile" element={protectedPage(<ProfilePage />)} />
            <Route path="login" element={<AuthPage key="login" mode="login" />} />
            <Route path="register" element={<AuthPage key="register" mode="register" />} />
            <Route path="institution/login" element={<InstitutionAuthPage key="institution-login" />} />
            <Route path="institution/register" element={<InstitutionAuthPage key="institution-register" register />} />
            <Route path="institution" element={<InstitutionWorkspace />} />
            <Route path="institution/settings" element={<InstitutionSettings />} />
            <Route path="terms" element={<AccountPolicyPage kind="terms" />} />
            <Route path="privacy" element={<AccountPolicyPage kind="privacy" />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="guides" element={<CollegeGuidesPage />} />
            <Route path="guides/:slug" element={<CollegeGuidesPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
