import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return <section className="page-shell container"><div className="empty-state large-empty"><Compass className="empty-icon" /><h1>Page not found</h1><p>The page you requested does not exist.</p><Link className="primary-btn empty-action" to="/">Return home</Link></div></section>;
}
