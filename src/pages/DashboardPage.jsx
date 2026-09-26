import { ArrowRight, BookOpen, ClipboardCheck, Eye, Heart, RotateCcw, Scale, School, Sparkles } from "lucide-react";
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
  const [retakeUnavailable, setRetakeUnavailable] = useState(false);
  useEffect(() => {
    Promise.all([api("/dashboard"), api("/assessments")]).then(([summary, history]) => { setDashboard(summary); setAssessments(history.data); }).catch((requestError) => setError(requestError.message));
  }, []);
  if (!dashboard && !error) return <section className="page-shell container"><LoadingState label="Loading your dashboard..." /></section>;
  return (
    <section className="page-shell dashboard-page">
      <div className="container">
        <div className="dashboard-welcome"><div><span className="section-kicker">Student dashboard</span><h1>Welcome back, {user.firstName || user.fullName.split(" ")[0]}.</h1><p>Continue exploring and keep your best-fit options organized.</p></div>{dashboard?.latestAssessment ? <Link className="primary-btn" to={`/assessment/${dashboard.latestAssessment.assessmentId}/results`}><Sparkles size={17} /> View results</Link> : <Link className="primary-btn" to="/assessment"><Sparkles size={17} /> Take assessment</Link>}</div>
        <ErrorMessage message={error} />
        {dashboard && <><div className="dashboard-stats"><Link to="/saved"><Heart /><span><small>Saved schools</small><strong>{dashboard.counts.savedSchools}</strong></span></Link><Link to="/saved"><BookOpen /><span><small>Saved programs</small><strong>{dashboard.counts.savedPrograms}</strong></span></Link><Link to="/assessment"><ClipboardCheck /><span><small>Assessments</small><strong>{dashboard.counts.assessments}</strong></span></Link></div>
          <div className="dashboard-grid"><section className="content-card"><div className="card-heading"><div><span className="section-kicker">Latest direction</span><h2>{dashboard.latestAssessment?.primaryDirection ?? "No assessment yet"}</h2></div><Sparkles /></div>{dashboard.latestAssessment ? <><p>Your assessment is complete. Revisit your recommendations whenever you like.</p><div className="dashboard-assessment-actions"><Link className="text-btn inline-link" to={`/assessment/${dashboard.latestAssessment.assessmentId}/results`}>View results <ArrowRight size={14} /></Link><button className="text-btn inline-link" type="button" onClick={() => setRetakeUnavailable(true)}>{retakeUnavailable ? "Unavailable" : "Retake assessment"} <RotateCcw size={14} /></button></div>{retakeUnavailable && <p className="retake-notice" role="status">Retakes will require payment and are unavailable right now.</p>}</> : <><p>Complete the short profile assessment to unlock personalized program and school recommendations.</p><Link className="primary-btn compact" to="/assessment">Start now</Link></>}</section>
            <section className="content-card"><span className="section-kicker">Quick actions</span><div className="quick-action-list"><Link to="/schools"><School /> <span><strong>Browse schools</strong><small>Search and filter institutions</small></span><ArrowRight /></Link><Link to="/programs"><BookOpen /> <span><strong>Explore programs</strong><small>Review careers and requirements</small></span><ArrowRight /></Link><Link to="/comparison"><Scale /> <span><strong>Compare options</strong><small>Review schools and programs together</small></span><ArrowRight /></Link></div></section></div>
          <section className="content-card visited-schools-card"><div className="card-heading"><div><span className="section-kicker">Browsing activity</span><h2>Your five most visited schools</h2></div><Eye /></div>{dashboard.mostVisitedSchools?.length ? <div className="visited-school-list">{dashboard.mostVisitedSchools.map((school, index) => <Link to={`/schools/${school.id}`} key={school.id}><span className="visited-school-position">{index + 1}</span><span className="visited-school-copy"><strong>{school.name}</strong><small>{school.city} · {school.schoolType}</small></span><span className="visited-school-count"><Eye size={13} /> {school.visitCount} {school.visitCount === 1 ? "visit" : "visits"}</span><ArrowRight size={15} /></Link>)}</div> : <div className="empty-inline visited-schools-empty">Schools you open will appear here. <Link to="/schools">Explore the directory</Link> to get started.</div>}</section>
          <section className="content-card history-card"><div className="card-heading"><div><span className="section-kicker">Assessment history</span><h2>Your previous results</h2></div></div>{assessments.length ? <div className="history-list">{assessments.map((assessment) => <Link to={`/assessment/${assessment.id}/results`} key={assessment.id}><span className="history-icon"><ClipboardCheck /></span><span className="history-copy"><strong>{assessment.primaryDirection}</strong><small>{new Date(assessment.completedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</small><span className="history-school-caption"><School size={12} /> Nearest suggested school: <b>{assessment.recommendedSchool?.name ?? "No school available"}</b>{assessment.recommendedSchool?.distanceKm != null && <em>≈ {assessment.recommendedSchool.distanceKm} km</em>}</span></span><span className="history-result-link">See past assessment results <ArrowRight size={14} /></span></Link>)}</div> : <div className="empty-inline">No completed assessments yet.</div>}</section></>}
      </div>
    </section>
  );
}
