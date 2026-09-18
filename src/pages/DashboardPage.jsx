import { ArrowRight, BookOpen, ClipboardCheck, Heart, Scale, School, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api("/dashboard"), api("/assessments")]).then(([summary, history]) => { setDashboard(summary); setAssessments(history.data); }).catch((requestError) => setError(requestError.message));
  }, []);
  if (!dashboard && !error) return <section className="page-shell container"><LoadingState label="Loading your dashboard..." /></section>;
  return (
    <section className="page-shell dashboard-page">
      <div className="container">
        <div className="dashboard-welcome"><div><span className="section-kicker">Student dashboard</span><h1>Welcome back, {user.fullName.split(" ")[0]}.</h1><p>Continue exploring and keep your best-fit options organized.</p></div><Link className="primary-btn" to="/assessment"><Sparkles size={17} /> Take assessment</Link></div>
        <ErrorMessage message={error} />
        {dashboard && <><div className="dashboard-stats"><Link to="/saved"><Heart /><span><small>Saved schools</small><strong>{dashboard.counts.savedSchools}</strong></span></Link><Link to="/saved"><BookOpen /><span><small>Saved programs</small><strong>{dashboard.counts.savedPrograms}</strong></span></Link><Link to="/assessment"><ClipboardCheck /><span><small>Assessments</small><strong>{dashboard.counts.assessments}</strong></span></Link></div>
          <div className="dashboard-grid"><section className="content-card"><div className="card-heading"><div><span className="section-kicker">Latest direction</span><h2>{dashboard.latestAssessment?.primaryDirection ?? "No assessment yet"}</h2></div><Sparkles /></div>{dashboard.latestAssessment ? <><p>Your latest profile is ready. Revisit its recommendations or retake the assessment as your interests develop.</p><Link className="text-btn inline-link" to={`/assessment`}>Retake assessment <ArrowRight size={14} /></Link></> : <><p>Complete the short profile assessment to unlock personalized program and school recommendations.</p><Link className="primary-btn compact" to="/assessment">Start now</Link></>}</section>
            <section className="content-card"><span className="section-kicker">Quick actions</span><div className="quick-action-list"><Link to="/schools"><School /> <span><strong>Browse schools</strong><small>Search and filter institutions</small></span><ArrowRight /></Link><Link to="/programs"><BookOpen /> <span><strong>Explore programs</strong><small>Review careers and requirements</small></span><ArrowRight /></Link><Link to="/comparison"><Scale /> <span><strong>Compare options</strong><small>Review up to three schools</small></span><ArrowRight /></Link></div></section></div>
          <section className="content-card history-card"><div className="card-heading"><div><span className="section-kicker">Assessment history</span><h2>Your previous results</h2></div></div>{assessments.length ? <div className="history-list">{assessments.map((assessment) => <div key={assessment.id}><span className="history-icon"><ClipboardCheck /></span><span><strong>{assessment.primaryDirection}</strong><small>{new Date(assessment.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</small></span><span className="match-pill">Complete</span></div>)}</div> : <div className="empty-inline">No completed assessments yet.</div>}</section></>}
      </div>
    </section>
  );
}
