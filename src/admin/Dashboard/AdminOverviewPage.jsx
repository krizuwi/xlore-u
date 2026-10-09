import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, BookOpen, CircleAlert, Database, HeartPulse, RefreshCw, ShieldCheck, University } from "lucide-react";
import { AdminShell } from "../Components/AdminShell.jsx";
import { UniversitiesManagement, ProgramsManagement, CategoriesManagement, ScrapingManagement } from "../Management/ManagementViews.jsx";
import { AdminSettingsPage, AdminLogsPage } from "../Pages/AdminUtilityPages.jsx";
import { AssessmentManagement } from "../Pages/AssessmentManagement.jsx";
import { useAdminResource } from "../lib/adminApi.js";
import { fetchApiHealth } from "./Api-Healt.jsx";
import { useLiveRefresh } from "../../context/EngagementContext.jsx";
import "./dashboard.css";

const number = new Intl.NumberFormat("en-US");

function CollectionActivity() {
  const resource = useAdminResource("/growth");
  const [metric, setMetric] = useState("changed");
  const rows = resource.data?.data ?? [];
  const max = Math.max(1, ...rows.map(r => Number(r[metric])));
  const points = rows.map((row, index) => ({ ...row, x: 54 + index / Math.max(1, rows.length - 1) * 636, y: 218 - Number(row[metric]) / max * 190 }));
  const path = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  return <section className="ad-card ad-growth"><div className="ad-card-heading"><div><h2>Collection activity</h2><p>Recorded catalog collection over the last 30 days.</p></div><select aria-label="Collection activity metric" value={metric} onChange={e => setMetric(e.target.value)}><option value="changed">Records changed</option><option value="discovered">Records discovered</option></select></div>
    {resource.error ? <p role="alert">{resource.error}</p> : resource.loading ? <p className="am-loading">Loading collection history…</p> : !rows.length ? <p className="am-loading">No collection activity recorded in this period.</p> :
      <div className="ad-chart-container"><svg viewBox="0 0 720 254" className="ad-chart" role="img" aria-label={`Daily records ${metric}`}>
        {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="54" x2="690" y1={218 - i * 47.5} y2={218 - i * 47.5} className="ad-chart-grid" /><text x="35" y={222 - i * 47.5} textAnchor="end">{number.format(Math.round(max * i / 4))}</text></g>)}
        <path d={path} className="ad-chart-line" />{points.map(point => <circle key={point.date} cx={point.x} cy={point.y} r="4" className="ad-chart-point"><title>{new Date(point.date).toLocaleDateString()}: {point[metric]} records {metric}</title></circle>)}
        {points.filter((_, index) => index === 0 || index === points.length - 1).map(point => <text key={point.date} x={point.x} y="245" textAnchor={point.x < 300 ? "start" : "end"}>{new Date(point.date).toLocaleDateString()}</text>)}
      </svg></div>}
  </section>;
}
function Metric({ label, value, icon: Icon, to, tone }) {
  return <Link className="ad-card ad-metric" to={to}><span className={`ad-metric-icon ad-tone-${tone}`}><Icon size={23} /></span><div className="ad-metric-copy"><span className="ad-metric-label">{label}</span><strong>{value === undefined ? "—" : number.format(value)}</strong><span className="ad-metric-detail">Live catalog</span></div></Link>;
}
function Dashboard() {
  const schools = useAdminResource("/schools"), programs = useAdminResource("/programs"), logs = useAdminResource("/logs");
  const [health, setHealth] = useState({ data: null, error: "", loading: true }), [revision, setRevision] = useState(0);
  useLiveRefresh(async signal => {
    const data = await fetchApiHealth({ signal });
    if (!signal.aborted) setHealth({ data, error: "", loading: false });
  }, { enabled: !health.loading });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try { const data = await fetchApiHealth({ signal: controller.signal }); if (!controller.signal.aborted) setHealth({ data, error: "", loading: false }); }
      catch (err) { if (!controller.signal.aborted) setHealth({ data: null, error: err.message, loading: false }); }
    }
    load();
    return () => controller.abort();
  }, [revision]);
  const checks = Object.entries(health.data?.checks ?? {}), healthy = checks.filter(([, c]) => c.status === "healthy").length;
  const errors = [schools.error, programs.error, logs.error].filter(Boolean);
  return <div className="ad-dashboard"><div className="ad-page-heading"><div><h1>Dashboard</h1><p>Live catalog records and administrator activity.</p></div><span>{new Date().toLocaleDateString()}</span></div>
    {errors.length > 0 && <p role="alert" className="ad-data-note">{errors.join(" ")}</p>}
    <div className="ad-metrics"><Metric label="Total Universities" value={schools.data?.data.length} icon={University} tone="violet" to="/admin/universities" /><Metric label="Total Programs" value={programs.data?.data.length} icon={BookOpen} tone="purple" to="/admin/programs" /><Metric label="Total Catalog Records" value={schools.data && programs.data ? schools.data.data.length + programs.data.data.length : undefined} icon={Database} tone="blue" to="/admin/scraping" /><Link className="ad-card ad-metric" to="/admin#system-health"><span className="ad-metric-icon ad-tone-green"><HeartPulse size={23} /></span><div className="ad-metric-copy"><span className="ad-metric-label">System health</span><strong>{checks.length ? `${healthy}/${checks.length}` : "—"}</strong><span className="ad-metric-detail">Services responding</span></div></Link></div>
    <div className="ad-primary-grid"><CollectionActivity /><section className="ad-card ad-activity"><div className="ad-card-heading"><div><h2>Recent activity</h2><p>Saved changes and collection runs.</p></div><Link className="ad-text-link" to="/admin/logs">View all</Link></div><ul className="ad-activity-list">{(logs.data?.data ?? []).slice(0, 5).map(item => <li key={item.id}><Link to="/admin/logs"><span className="ad-activity-icon ad-tone-blue"><Database size={15} /></span><span><strong>{item.title}</strong><span>{item.detail} · {new Date(item.createdAt).toLocaleString()}</span></span></Link></li>)}</ul>{!logs.loading && !logs.data?.data.length && <p className="ad-empty">No activity recorded yet.</p>}</section></div>
    <div className="ad-secondary-grid"><section className="ad-card ad-universities"><div className="ad-card-heading"><div><h2>Universities</h2><p>Current directory records.</p></div><Link className="ad-add-link" to="/admin/universities">Manage universities<ArrowRight size={14} /></Link></div><div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>University</th><th>Type</th><th>Programs</th><th>Status</th></tr></thead><tbody>{(schools.data?.data ?? []).slice(0, 5).map(s => <tr key={s.id}><td>{s.name}</td><td>{s.type}</td><td>{s.programs}</td><td>{s.status}</td></tr>)}</tbody></table></div></section>
      <section className="ad-card ad-health" id="system-health"><div className="ad-card-heading"><h2>System health</h2><button className="ad-icon-button" aria-label="Refresh live data" onClick={() => { setRevision(v => v + 1); schools.refresh(); programs.refresh(); logs.refresh(); }}><RefreshCw size={16} /></button></div><div className={`ad-health-banner${health.data?.status === "ok" ? " is-healthy" : ""}`}><ShieldCheck size={24} /><div><strong>{health.loading ? "Checking services…" : health.data?.status === "ok" ? "All systems operational" : "Some services need attention"}</strong><span>{health.error || "Service checks refresh every 15 seconds while you’re active."}</span></div></div><ul className="ad-service-list">{checks.map(([name, check]) => <li key={name}><span><strong>{name}</strong><small>{check.responseTime} ms</small></span><span className={`ad-service-status${check.status === "healthy" ? " is-healthy" : " is-unhealthy"}`}>{check.status}</span></li>)}</ul>{health.data && <details className="ad-route-checks"><summary>View API route checks</summary><ul>{Object.entries(health.data.routes).map(([route, check]) => <li key={route}><code>{route}</code><span>{check.status === "skipped" ? check.reason : `${check.status} · ${check.responseTime} ms`}</span></li>)}</ul></details>}</section></div>
  </div>;
}
export function AdminOverviewPage() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }); else window.scrollTo(0, 0); }, [pathname, hash]);
  return <AdminShell><Routes><Route index element={<Dashboard />} /><Route path="universities" element={<UniversitiesManagement />} /><Route path="programs" element={<ProgramsManagement />} /><Route path="categories" element={<CategoriesManagement />} /><Route path="scraping" element={<ScrapingManagement />} /><Route path="assessment" element={<AssessmentManagement />} /><Route path="settings" element={<AdminSettingsPage />} /><Route path="logs" element={<AdminLogsPage />} /><Route path="*" element={<div className="ad-card ad-not-found"><CircleAlert size={32} /><h1>Page not found</h1><Link to="/admin">Return to dashboard</Link></div>} /></Routes></AdminShell>;
}
