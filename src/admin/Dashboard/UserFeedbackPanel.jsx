import { useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, RefreshCw, Star } from "lucide-react";
import { useAdminResource } from "../lib/adminApi.js";
import { feedbackLabels } from "../../lib/user-feedback.js";
import "./UserFeedbackPanel.css";

export function UserFeedbackPanel() {
  const [section, setSection] = useState(""), [rating, setRating] = useState("");
  const [current, setCurrent] = useState(false), [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), current: current ? "1" : "0" });
  if (section) params.set("section", section);
  if (rating) params.set("rating", rating);
  const resource = useAdminResource(`/feedback?${params}`);
  const summary = resource.data?.summary, pagination = resource.data?.pagination;
  const rows = resource.data?.data ?? [];
  const filter = (setter, value) => { setter(value); setPage(1); };
  return <section className="ad-card ad-feedback" id="user-feedback" aria-labelledby="ad-feedback-title">
    <div className="ad-card-heading"><div><h2 id="ad-feedback-title"><MessageSquare size={18} /> User feedback</h2><p>One rating per user, per section, per update. These are user experience ratings—not school rankings.</p></div>
      <button className="ad-icon-button" type="button" aria-label="Refresh user feedback" onClick={resource.refresh}><RefreshCw size={16} /></button></div>
    <div className="ad-feedback-filters">
      <label>Section<select value={section} onChange={e => filter(setSection, e.target.value)}><option value="">All sections</option>{Object.entries(feedbackLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Stars<select value={rating} onChange={e => filter(setRating, e.target.value)}><option value="">All ratings</option>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} {value === 1 ? "star" : "stars"}</option>)}</select></label>
      <label className="ad-feedback-release-filter"><input type="checkbox" checked={current} onChange={e => filter(setCurrent, e.target.checked)} /> Current update only</label>
    </div>
    {resource.error ? <div className="ad-feedback-error" role="alert">{resource.error}<button type="button" className="text-btn" onClick={resource.refresh}>Try again</button></div> : resource.loading ? <p className="ad-empty" role="status">Loading feedback…</p> : <>
      <div className="ad-feedback-summary">
        <div><span>Average rating</span><strong>{summary?.average == null ? "—" : `${Number(summary.average).toFixed(1)} / 5`}</strong><small>{summary?.total ?? 0} submitted {summary?.total === 1 ? "rating" : "ratings"} matching these filters</small></div>
        <div className="ad-feedback-distribution" aria-label="Rating distribution">{[5, 4, 3, 2, 1].map(stars => {
          const count = summary?.distribution.find(item => item.rating === stars)?.count ?? 0;
          return <div key={stars}><span>{stars} <Star size={11} aria-hidden="true" /></span><progress value={count} max={Math.max(1, summary?.total ?? 0)} aria-label={`${stars} stars: ${count} ratings`} /><b>{count}</b></div>;
        })}</div>
      </div>
      {!rows.length ? <p className="ad-empty">No feedback matches these filters yet.</p> : <ul className="ad-feedback-list">{rows.map(item => <li key={item.id}>
        <div className="ad-feedback-item-heading"><div><span className="tag">{feedbackLabels[item.section] ?? item.section}</span>{item.schoolName && <strong className="ad-feedback-school">{item.schoolName}</strong>}</div><span className="ad-feedback-rating" aria-label={`${item.rating} out of 5 stars`}><Star size={14} aria-hidden="true" /> {item.rating}/5</span></div>
        <p className="ad-feedback-comment">{item.comment || "No comment provided."}</p>
        <div className="ad-feedback-meta"><span><strong>{item.userName}</strong> · {item.userEmail}</span><span>{new Date(item.createdAt).toLocaleString()} · Update {item.releaseId.slice(-8)}</span></div>
      </li>)}</ul>}
      {pagination && pagination.pages > 1 && <div className="ad-feedback-pagination"><button type="button" className="secondary-btn" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}><ChevronLeft size={15} /> Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button type="button" className="secondary-btn" disabled={pagination.page >= pagination.pages} onClick={() => setPage(pagination.page + 1)}>Next <ChevronRight size={15} /></button></div>}
    </>}
  </section>;
}
