import { useEffect, useId, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, ArrowUp, BookOpen, CalendarDays, Check, ChevronRight, CircleAlert, Database, Globe2, HeartPulse, Info, Pencil, Plus, RefreshCw, Server, ShieldCheck, University } from "lucide-react";
import { AdminShell } from "../Components/AdminShell.jsx";
import { UniversitiesManagement, ProgramsManagement, CategoriesManagement, ScrapingManagement } from "../Management/ManagementViews.jsx";
import { AdminLoginPage, AdminSettingsPage, AdminLogsPage } from "../Pages/AdminUtilityPages.jsx";
import { DataCollection } from "../Request/DataCollection.jsx";
import { fetchApiHealth } from "./Api-Healt.jsx";
import "./dashboard.css";

const number = new Intl.NumberFormat("en-US");
const activities = [
  { title: "TUP Taguig scraping completed", detail: "2,843 programs", time: "3 minutes ago", icon: Check, tone: "green", to: "/admin/scraping" },
  { title: "UMak scraping completed", detail: "1,205 programs", time: "12 minutes ago", icon: Check, tone: "green", to: "/admin/scraping" },
  { title: "New university added", detail: "STI College", time: "1 hour ago", icon: Plus, tone: "violet", to: "/admin/universities" },
  { title: "Program updated", detail: "BS Information Technology", time: "2 hours ago", icon: Pencil, tone: "blue", to: "/admin/programs" },
  { title: "Scraping failed", detail: "UP Diliman", time: "3 hours ago", icon: CircleAlert, tone: "red", to: "/admin/scraping" },
];
const demoUniversities = [
  { id: 1, name: "University of the Philippines", type: "Public", city: "Quezon City", programs: 56, initials: "UP", tone: "wine" },
  { id: 2, name: "Mapúa University", type: "Private", city: "Manila", programs: 42, initials: "MU", tone: "gold" },
  { id: 3, name: "De La Salle University", type: "Private", city: "Manila", programs: 38, initials: "DL", tone: "green" },
  { id: 4, name: "Ateneo de Manila University", type: "Private", city: "Quezon City", programs: 31, initials: "AD", tone: "blue" },
  { id: 5, name: "STI College", type: "Private", city: "Various", programs: 28, initials: "STI", tone: "violet" },
];
const trend = [410, 500, 680, 590, 500, 910, 740, 700, 990, 1060, 1160, 890, 930, 915, 1030, 925, 810, 1010, 1120, 1030, 1480, 1320, 1340, 1660, 1740];

function DataGrowth() {
  const [category, setCategory] = useState("Programs");
  const [highlight, setHighlight] = useState(null);
  const id = useId();
  const max = category === "Universities" ? 200 : category === "All data" ? 4000 : 2000;
  const scale = category === "Universities" ? 0.09 : category === "All data" ? 1.9 : 1;
  const points = trend.map((value, index) => ({ value: Math.round(value * scale), x: 54 + index / (trend.length - 1) * 636, y: 218 - value * scale / max * 190 }));
  const path = points.map(({ x, y }, index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
  const selected = highlight !== null ? points[highlight] : null;
  return <section className="ad-card ad-growth" aria-labelledby="growth-title">
    <div className="ad-card-heading"><div><h2 id="growth-title">Data Growth</h2><p>Scraped data over the last 30 days <span className="ad-demo-label">Demo trend</span></p></div><label className="ad-chart-select"><span className="ad-sr-only">Data growth category</span><select value={category} onChange={(event) => { setCategory(event.target.value); setHighlight(null); }}><option>Programs</option><option>Universities</option><option>All data</option></select></label></div>
    <div className="ad-chart-container"><svg viewBox="0 0 720 254" className="ad-chart" role="group" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>{category}: sample data growth over 30 days. Hover or focus a point to inspect its value.</title>
      <defs><linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#635bff" stopOpacity="0.17" /><stop offset="100%" stopColor="#635bff" stopOpacity="0.015" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((index) => <g key={index} aria-hidden="true"><line x1="54" x2="690" y1={218 - index * 47.5} y2={218 - index * 47.5} className="ad-chart-grid" /><text x="35" y={222 - index * 47.5} textAnchor="end">{number.format(max * index / 4)}</text></g>)}
      <path d={`${path} L 690 218 L 54 218 Z`} fill={`url(#${id}-area)`} /><path d={path} className="ad-chart-line" />
      {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="7" className={`ad-chart-point${highlight === index ? " is-selected" : ""}`} tabIndex={index % 4 === 0 ? 0 : undefined} role="img" aria-label={`Day ${Math.round(index * 29 / 24) + 1}: ${point.value} ${category.toLowerCase()}`} onMouseEnter={() => setHighlight(index)} onMouseLeave={() => setHighlight(null)} onFocus={() => setHighlight(index)} onBlur={() => setHighlight(null)} />)}
      {["Day 1", "Day 8", "Day 15", "Day 22", "Day 30"].map((label, index) => <text key={label} x={54 + index * 159} y="245" textAnchor={index === 0 ? "start" : index === 4 ? "end" : "middle"}>{label}</text>)}
      {selected && <g className="ad-chart-tooltip" aria-hidden="true"><rect x={Math.min(598, Math.max(55, selected.x - 45))} y={Math.max(0, selected.y - 38)} width="92" height="28" rx="5" /><text x={Math.min(598, Math.max(55, selected.x - 45)) + 46} y={Math.max(0, selected.y - 38) + 18} textAnchor="middle">{number.format(selected.value)} records</text></g>}
    </svg></div>
  </section>;
}

function MetricCard({ label, value, icon: Icon, tone, detail, trend: increase, to, loading, isDemo }) {
  return <Link className="ad-card ad-metric" to={to}><span className={`ad-metric-icon ad-tone-${tone}`}><Icon size={23} strokeWidth={1.65} /></span><div className="ad-metric-copy"><span className="ad-metric-label">{label}</span><strong className={loading ? "ad-loading-text" : undefined}>{loading ? "···" : value}</strong><span className={`ad-metric-detail${increase ? " ad-positive" : ""}`}>{increase && <ArrowUp size={13} />}{increase && <b>{increase}</b>}<span>{detail}</span></span></div>{isDemo && <span className="ad-metric-source">Demo</span>}</Link>;
}

function Dashboard({ searchQuery }) {
  const [collection, setCollection] = useState({ loading: true, data: null, error: "" });
  const [health, setHealth] = useState({ loading: true, data: null, error: "" });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    DataCollection({ signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setCollection({ data, loading: false, error: "" });
    }).catch((error) => {
      if (!controller.signal.aborted) setCollection({ data: null, loading: false, error: error.message });
    });
    async function loadHealth() {
      try {
        const data = await fetchApiHealth({ signal: controller.signal });
        if (!controller.signal.aborted) setHealth({ data, loading: false, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setHealth({ data: null, loading: false, error: error.message });
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(loadHealth, 30000);
      }
    }
    loadHealth();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [refresh]);
  const query = searchQuery.trim().toLowerCase();
  const matchingActivities = activities.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query));
  const matchingUniversities = demoUniversities.filter((item) => `${item.name} ${item.type} ${item.city}`.toLowerCase().includes(query));
  const checks = Object.entries(health.data?.checks ?? {});
  const healthy = checks.filter(([, check]) => check.status === "healthy").length;
  const hasCatalog = Boolean(collection.data);
  const now = new Date();
  const healthValue = health.data ? `${Math.round(healthy / checks.length * 100)}%` : "—";
  return <div className="ad-dashboard">
    <div className="ad-page-heading"><div><h1>Dashboard</h1><p>Overview of your system, data, and activities.</p></div><div className="ad-date"><span><CalendarDays size={19} /></span><div>Today<time dateTime={now.toISOString().slice(0, 10)}>{now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time></div></div></div>
    <div className="ad-metrics">
      <MetricCard label="Total Universities" value={number.format(collection.data?.universityCount ?? 124)} icon={University} tone="violet" detail={hasCatalog ? "in the live catalog" : "from last month"} trend={hasCatalog ? null : "12%"} to="/admin/universities" loading={collection.loading} isDemo={!collection.loading && !hasCatalog} />
      <MetricCard label="Total Programs" value={number.format(collection.data?.programCount ?? 482)} icon={BookOpen} tone="purple" detail={hasCatalog ? "in the live catalog" : "from last month"} trend={hasCatalog ? null : "8%"} to="/admin/programs" loading={collection.loading} isDemo={!collection.loading && !hasCatalog} />
      <MetricCard label="Total Catalog Data" value={number.format(collection.data?.totalRecords ?? 12840)} icon={Database} tone="blue" detail={hasCatalog ? "university & program records" : "from last month"} trend={hasCatalog ? null : "24%"} to="/admin/scraping" loading={collection.loading} isDemo={!collection.loading && !hasCatalog} />
      <MetricCard label="System Health" value={healthValue} icon={HeartPulse} tone="green" detail={health.loading ? "Checking services…" : health.data ? `${healthy} of ${checks.length} services operational` : "Live status unavailable"} to="/admin#system-health" loading={health.loading} />
    </div>
    <div className="ad-primary-grid"><DataGrowth /><section className="ad-card ad-activity" aria-labelledby="activity-title"><div className="ad-card-heading"><div><h2 id="activity-title">Recent Activity</h2><p>Latest updates <span className="ad-demo-label">Demo activity</span></p></div><Link className="ad-text-link" to="/admin/logs">View all</Link></div><ul className="ad-activity-list">{matchingActivities.map(({ title, detail, time, icon: Icon, tone, to }) => <li key={title}><Link to={to}><span className={`ad-activity-icon ad-tone-${tone}`}><Icon size={15} strokeWidth={2.2} /></span><span><strong>{title}</strong><span>{detail}<span className="ad-dot">·</span>{time}</span></span></Link></li>)}</ul>{!matchingActivities.length && <p className="ad-empty">No activity matches “{searchQuery}”.</p>}</section></div>
    <div className="ad-section-heading"><div><h2>Your workspace</h2><p>A closer look at your catalog and collection pipeline.</p></div><Link className="ad-text-link" to="/admin/universities">Manage catalog <ArrowRight size={14} /></Link></div>
    <div className="ad-secondary-grid">
      <section className="ad-card ad-universities" aria-labelledby="universities-title"><div className="ad-card-heading"><div><h2 id="universities-title">Universities</h2><p>Institutions in your catalog <span className="ad-demo-label">Demo data</span></p></div><Link className="ad-add-link" to="/admin/universities"><Plus size={14} />Manage universities</Link></div><div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>University</th><th>Type</th><th>Programs</th><th>Status</th></tr></thead><tbody>{matchingUniversities.map((school) => <tr key={school.id}><td><Link to="/admin/universities"><span className={`ad-school-logo ad-school-${school.tone}`}>{school.initials}</span><span><strong>{school.name}</strong><small>{school.city}</small></span></Link></td><td><span className="ad-type">{school.type}</span></td><td>{school.programs}</td><td><span className="ad-status"><span />Active</span></td></tr>)}</tbody></table>{!matchingUniversities.length && <p className="ad-empty">No universities match “{searchQuery}”.</p>}</div><div className="ad-card-bottom"><span>{matchingUniversities.length} sample universities</span><Link to="/admin/universities">View all universities <ChevronRight size={14} /></Link></div></section>
      <section className="ad-card ad-health" id="system-health" aria-labelledby="health-title"><div className="ad-card-heading"><div><h2 id="health-title">System Health</h2><p>Connected services, at a glance.</p></div><button type="button" className="ad-icon-button" title="Refresh live data" aria-label="Refresh live data" disabled={collection.loading || health.loading} onClick={() => { setCollection((current) => ({ ...current, loading: true })); setHealth((current) => ({ ...current, loading: true })); setRefresh((current) => current + 1); }}><RefreshCw size={16} /></button></div>
        <div className={`ad-health-banner${health.data?.status === "ok" ? " is-healthy" : ""}`}><ShieldCheck size={24} /><div><strong>{health.loading ? "Checking your system" : health.data?.status === "ok" ? "All systems operational" : health.error ? "Unable to reach services" : "Some services need attention"}</strong><span>{health.loading ? "Connecting to your live services." : health.error ? "Check your backend connection and try again." : "Live service checks refresh every 30 seconds."}</span></div></div>
        <ul className="ad-service-list">{[{ key: "database", label: "Database", description: "University and program catalog", icon: Database }, { key: "assessment", label: "Assessment API", description: "Student assessment service", icon: Server }, { key: "scraping", label: "Scraper", description: "Data collection pipeline", icon: Globe2 }].map(({ key, label, description, icon: Icon }) => {
          const check = health.data?.checks[key];
          const status = health.loading ? "Checking" : !check ? "Unknown" : check.status === "healthy" ? "Healthy" : "Unhealthy";
          return <li key={key}><span className="ad-service-icon"><Icon size={18} /></span><span><strong>{label}</strong><small>{description}</small></span><span className={`ad-service-status${status === "Healthy" ? " is-healthy" : status === "Unhealthy" ? " is-unhealthy" : ""}`}><i />{status}</span></li>;
        })}</ul>
        {health.data && <details className="ad-route-checks"><summary>View API route checks <ChevronRight size={14} /></summary><ul>{Object.entries(health.data.routes).map(([route, check]) => <li key={route}><code>{route}</code><span>{check.status === "skipped" ? `Skipped: ${check.reason}` : `${check.status} · ${check.responseTime} ms`}</span></li>)}</ul></details>}
        <div className="ad-card-bottom"><span><span className="ad-live-dot" />Live monitoring</span><Link to="/admin/scraping">Manage scraper <ChevronRight size={14} /></Link></div>
      </section>
    </div>
    {(collection.error || health.error) && <div className="ad-data-note" role="status"><Info size={15} /><span>{collection.error ? "Live catalog unavailable. Cards marked Demo show sample values." : "Catalog totals are live."} {health.error && "System health could not be loaded."} Preview edits are saved only in this browser.</span></div>}
  </div>;
}

export function AdminOverviewPage() {
  const [search, setSearch] = useState({ path: "", query: "" });
  const { pathname } = useLocation();
  const searchQuery = search.path === pathname ? search.query : "";
  if (pathname.replace(/\/$/, "") === "/admin/login") return <AdminLoginPage />;
  return <AdminShell searchQuery={searchQuery} onSearchChange={(query) => setSearch({ path: pathname, query })}><Routes>
    <Route index element={<Dashboard searchQuery={searchQuery} />} />
    <Route path="universities" element={<UniversitiesManagement searchQuery={searchQuery} />} />
    <Route path="programs" element={<ProgramsManagement searchQuery={searchQuery} />} />
    <Route path="categories" element={<CategoriesManagement searchQuery={searchQuery} />} />
    <Route path="scraping" element={<ScrapingManagement searchQuery={searchQuery} />} />
    <Route path="settings" element={<AdminSettingsPage />} />
    <Route path="logs" element={<AdminLogsPage searchQuery={searchQuery} />} />
    <Route path="*" element={<div className="ad-card ad-not-found"><CircleAlert size={32} /><h1>Page not found</h1><p>This admin page doesn't exist.</p><Link className="ad-add-link" to="/admin">Return to dashboard</Link></div>} />
  </Routes></AdminShell>;
}
