import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, ArrowRight, CalendarDays, CheckCircle2, Clock3, Database,
  ExternalLink, Globe2, Play, RefreshCw, ShieldAlert, Sparkles,
} from "lucide-react";
import { useAdminResource } from "../../lib/adminApi.js";
import "./ScraperOverview.css";

const number = new Intl.NumberFormat("en-US");
const date = value => value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

function Status({ value }) {
  const tone = value === "completed" || value === "success" || value === "unchanged" ? "success" : value === "failed" ? "danger" : value === "partial" ? "warning" : "neutral";
  return <span className={`so-status so-${tone}`}><i />{value || "Not checked"}</span>;
}

function Metric({ icon: Icon, label, value, detail, tone }) {
  return <div className="so-metric"><span className={`so-metric-icon so-icon-${tone}`}><Icon size={20} strokeWidth={2} /></span><span className="so-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function ActivityChart({ rows, range, metric }) {
  const byDay = new Map(rows.map(row => [new Date(row.date).toDateString(), Number(row[metric]) || 0]));
  const days = Array.from({ length: range }, (_, index) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - range + index + 1);
    return { key: day.toDateString(), label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: byDay.get(day.toDateString()) ?? 0 };
  });
  const max = Math.max(1, ...days.map(day => day.value));
  const x = index => 42 + (index / Math.max(1, range - 1)) * 648;
  const y = value => 204 - value / max * 154;
  const line = days.map((day, index) => `${index ? "L" : "M"} ${x(index)} ${y(day.value)}`).join(" ");
  const area = `${line} L ${x(range - 1)} 204 L 42 204 Z`;
  const ticks = range === 7 ? days : days.filter((_, index) => index === 0 || index === range - 1 || index % 5 === 0);
  return <div className="so-chart-wrap"><svg viewBox="0 0 720 252" className="so-chart" role="img" aria-label={`Daily records ${metric}: ${days.map(day => `${day.label} ${day.value}`).join(", ")}`}>
    <defs><linearGradient id="so-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2866f3" stopOpacity=".23" /><stop offset="100%" stopColor="#2866f3" stopOpacity="0" /></linearGradient></defs>
    {[0, 1, 2, 3].map(index => <g key={index}><line className="so-chart-grid" x1="42" x2="690" y1={204 - index * 51.3} y2={204 - index * 51.3} /><text x="32" y={208 - index * 51.3} textAnchor="end">{number.format(Math.round(max * index / 3))}</text></g>)}
    <path className="so-chart-area" d={area} /><path className="so-chart-line" d={line} />
    {days.map((day, index) => <circle key={day.key} className="so-chart-point" cx={x(index)} cy={y(day.value)} r={range === 7 ? 4 : 2.5}><title>{day.label}: {day.value} records {metric}</title></circle>)}
    {ticks.map(day => <text key={day.key} x={x(days.indexOf(day))} y="235" textAnchor={days.indexOf(day) === 0 ? "start" : days.indexOf(day) === range - 1 ? "end" : "middle"}>{day.label}</text>)}
  </svg></div>;
}

export function ScraperOverview() {
  const scraping = useAdminResource("/scraping");
  const growth = useAdminResource("/growth");
  const [range, setRange] = useState(7);
  const [metric, setMetric] = useState("discovered");
  const { sources = [], runs = [], settings } = scraping.data ?? {};
  const recent = runs.filter(run => run.status !== "running").slice(0, 20);
  const successful = recent.filter(run => run.status === "completed").length;
  const enabled = sources.filter(source => source.enabled);
  const failing = sources.filter(source => source.enabled && (source.status === "failed" || source.diagnostic?.code === "access_blocked"));
  const latest = runs[0];
  const discovered = runs.reduce((total, run) => total + (Number(run.records) || 0), 0);
  const refresh = () => { scraping.refresh(); growth.refresh(); };
  return <div className="scraper-overview">
    <header className="so-heading"><div><div className="so-breadcrumb"><Link to="/admin">Dashboard</Link><span>/</span> Scraper Overview</div><div className="so-title-line"><span className="so-title-icon"><Activity size={25} /></span><div><h1>Scraper Overview</h1><p>University catalog collection at a glance.</p></div></div></div><div className="so-heading-actions"><span className="so-date"><CalendarDays size={15} />{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><button type="button" className="so-refresh" onClick={refresh} disabled={scraping.loading || growth.loading}><RefreshCw size={16} />Refresh</button><Link className="so-primary" to="/admin/scraping/automation"><Play size={15} fill="currentColor" />Run collection</Link></div></header>
    {(scraping.error || growth.error) && <div className="so-error" role="alert"><ShieldAlert size={17} />{scraping.error || growth.error}</div>}
    <section className="so-hero" aria-label="Collection summary"><div className="so-hero-copy"><span className="so-kicker"><Sparkles size={14} /> CATALOG INTELLIGENCE</span><h2>Know what your collector<br />is doing right now.</h2><p>Track sources, records, and recent runs using live catalog data.</p><div className="so-hero-actions"><Link to="/admin/scraping/results">View run results <ArrowRight size={16} /></Link><Link to="/admin/logs">View activity logs</Link></div></div><div className="so-hero-status"><span>Latest collection</span><strong>{latest ? date(latest.startedAt) : scraping.loading ? "Loading…" : "No runs yet"}</strong><Status value={latest?.status} /><small>{latest ? `${latest.sourcesSucceeded} of ${latest.sourcesChecked} sources succeeded` : "Start a collection job to see results here."}</small></div></section>
    <div className="so-metrics"><Metric icon={Globe2} tone="blue" label="Enabled sources" value={scraping.loading ? "—" : number.format(enabled.length)} detail={`${sources.length} configured total`} /><Metric icon={Database} tone="indigo" label="Records discovered" value={scraping.loading ? "—" : number.format(discovered)} detail={`Across the latest ${runs.length} runs`} /><Metric icon={CheckCircle2} tone="green" label="Completed runs" value={recent.length ? `${Math.round(successful / recent.length * 100)}%` : "—"} detail={`Of the latest ${recent.length} finished runs`} /><Metric icon={ShieldAlert} tone="amber" label="Sources needing attention" value={scraping.loading ? "—" : number.format(failing.length)} detail="Enabled sources with failed checks" /></div>
    <div className="so-main-grid"><section className="so-card so-activity"><div className="so-card-head"><div><h2>Collection activity</h2><p>Daily catalog records from recent runs.</p></div><div className="so-chart-controls"><select aria-label="Chart metric" value={metric} onChange={event => setMetric(event.target.value)}><option value="discovered">Discovered</option><option value="changed">Changed</option></select><select aria-label="Chart date range" value={range} onChange={event => setRange(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></div></div>{growth.loading && !growth.data ? <p className="so-empty">Loading activity…</p> : <ActivityChart rows={growth.data?.data ?? []} range={range} metric={metric} />}</section>
      <section className="so-card so-health"><div className="so-card-head"><div><h2>Source health</h2><p>Status of configured university sources.</p></div><Link to="/admin/scraping/automation#source-controls" className="so-link">Manage <ArrowRight size={14} /></Link></div><div className="so-health-list"><div><span className="so-health-dot so-good" />Successful or unchanged<strong>{scraping.loading && !scraping.data ? "—" : sources.filter(source => ["success", "unchanged"].includes(source.status)).length}</strong></div><div><span className="so-health-dot so-bad" />Failed checks<strong>{scraping.loading && !scraping.data ? "—" : sources.filter(source => source.status === "failed").length}</strong></div><div><span className="so-health-dot so-muted" />Not checked yet<strong>{scraping.loading && !scraping.data ? "—" : sources.filter(source => !source.status).length}</strong></div><div><span className="so-health-dot so-off" />Disabled<strong>{scraping.loading && !scraping.data ? "—" : sources.filter(source => !source.enabled).length}</strong></div></div><Link className="so-schedule" to="/admin/scraping/automation"><Clock3 size={17} /><span><strong>Collection automation</strong><small>{settings?.frequency ?? "Not available"} · {settings?.timeout ?? "—"}s page timeout</small></span><ArrowRight size={15} /></Link></section></div>
    <div className="so-bottom-grid"><section className="so-card"><div className="so-card-head"><div><h2>Recent runs</h2><p>The five latest catalog collection jobs.</p></div><Link to="/admin/scraping/results" className="so-link">View all <ArrowRight size={14} /></Link></div><div className="so-table-wrap"><table className="so-table"><thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Sources</th><th>Records</th></tr></thead><tbody>{runs.slice(0, 5).map(run => <tr key={run.id}><td>{date(run.startedAt)}</td><td>{run.triggerType}</td><td><Status value={run.status} /></td><td>{run.sourcesSucceeded}/{run.sourcesChecked}</td><td>{number.format(Number(run.records) || 0)}</td></tr>)}</tbody></table></div>{!scraping.loading && !runs.length && <p className="so-empty">No collection runs recorded yet.</p>}</section>
      <section className="so-card"><div className="so-card-head"><div><h2>Needs attention</h2><p>Enabled sources with a failed check.</p></div><Link to="/admin/scraping/automation#source-controls" className="so-link">Review <ArrowRight size={14} /></Link></div><div className="so-alert-list">{failing.slice(0, 4).map(source => <div key={source.id}><span className="so-alert-icon"><ShieldAlert size={16} /></span><span><strong>{source.school}</strong><small>{source.diagnostic?.code === "access_blocked" ? "Blocked by website" : source.error || "Latest collection failed"}</small></span><a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open source for ${source.school}`}><ExternalLink size={15} /></a></div>)}{scraping.loading && !scraping.data && <p className="so-empty">Loading source diagnostics…</p>}{!scraping.loading && !scraping.error && !failing.length && <div className="so-all-clear"><CheckCircle2 size={22} /><strong>No failed enabled sources</strong><span>Source diagnostics will appear here when a check fails.</span></div>}</div></section></div>
  </div>;
}
