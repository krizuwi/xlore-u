import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { LoadingState } from "../../components/Feedback.jsx";

export function ProtectedAdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-shell container"><LoadingState label="Checking admin access..." /></div>;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (user.role !== "admin" || user.email?.toLowerCase() !== "unicourse02@gmail.com" || !user.emailVerified) {
    return <main className="page-shell container"><h1>Admin access required</h1><p>Sign in with the authorized administrator account to open this page.</p><Link className="primary-btn" to="/admin/login">Admin sign in</Link></main>;
  }
  return children;
}
