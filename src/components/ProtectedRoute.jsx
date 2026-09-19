import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { LoadingState } from "./Feedback.jsx";

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-shell container"><LoadingState label="Checking your account..." /></div>;
  if (!user) return <Navigate to="/login" replace state={{
    from: `${location.pathname}${location.search}${location.hash}`,
    message: "Sign in or create an account to continue."
  }} />;
  return children;
}
