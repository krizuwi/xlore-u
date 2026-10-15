import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Braces, CheckCircle2, CircleAlert, Clock3, Database, FileSearch, RefreshCw, Search, ShieldAlert, Table2 } from "lucide-react";
import { useAdminResource } from "../../lib/adminApi.js";
import "./ScraperResults.css";

const count = new Intl.NumberFormat("en-US");
const date = value => value ? new Date(value).toLocaleString() : "Not recorded";
const duration = (start, end) => {
  if (!start || !end) return "Not recorded";
  const seconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
};
const titleCase = value => value ? value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "Not recorded";

function Status({ value }) {
  const label = value === "completed" || value === "success" ? "Success" :
    value === "partial" ? "Partial success" : value === "unchanged" ? "Unchanged" : "Failed";
  const tone = value === "completed" || value === "success" || value === "unchanged" ? "success" : value === "partial" ? "warning" : "danger";
  return <span className={`sr-status sr-${tone}`}><span />{label}</span>;
}

function Heading({ children, subtitle, actions }) {
  return <header className="sr-heading"><div><nav className="sr-breadcrumb" aria-label="Breadcrumb"><Link to="/admin">Dashboard</Link><span>/</span><Link to="/admin/scraping/overview">Scraper Overview</Link><span>/</span><Link to="/admin/scraping/results">Run Results</Link></nav><h1><span className="sr-heading-icon"><FileSearch size={24} /></span>{children}</h1><p>{subtitle}</p></div><div className="sr-heading-actions">{actions}</div></header>;
}

function ResultList() {
  const resource = useAdminResource("/scraping/runs");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const runs = resource.data?.runs ?? [];
  const finished = runs.length;
  const successful = runs.filter(run => run.status === "completed").length;
  const issues = runs.filter(run => ["partial", "failed"].includes(run.status)).length;
  const visible = runs.filter(run => {
    if (filter === "success" && run.status !== "completed") return false;
    if (filter === "issues" && !["partial", "failed"].includes(run.status)) return false;
    return `${run.id} ${run.mode ?? ""} ${run.error ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  return <div className="sr-page">
    <Heading subtitle="Inspect completed collection jobs, returned data, and failures." actions={<><button className="sr-button sr-button-light" onClick={resource.refresh} disabled={resource.loading}><RefreshCw size={15} />Refresh</button><Link className="sr-button sr-button-primary" to="/admin/scraping/automation">New collection <ArrowRight size={15} /></Link></>}>Run Results</Heading>
    {resource.error && <p className="sr-alert" role="alert"><ShieldAlert size={17} />{resource.error}</p>}
    <div className="sr-stats"><div><span><Database size={17} /></span><small>Finished runs</small><strong>{count.format(finished)}</strong></div><div><span><CheckCircle2 size={17} /></span><small>Successful</small><strong>{count.format(successful)}</strong></div><div><span><CircleAlert size={17} /></span><small>Need review</small><strong>{count.format(issues)}</strong></div></div>
    <section className="sr-card"><div className="sr-list-heading"><div><h2>Collection history</h2><p>Open a run to see each source and what it returned.</p></div><label className="sr-search"><Search size={15} /><span className="sr-visually-hidden">Search runs</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search run ID, mode, or error" /></label></div>
      <div className="sr-filters" role="group" aria-label="Filter results">{[["all", "All", finished], ["success", "Successful", successful], ["issues", "Need review", issues]].map(([key, label, total]) => <button key={key} type="button" className={filter === key ? "is-active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{total}</span></button>)}</div>
      {resource.loading && !resource.data ? <p className="sr-empty">Loading completed runs…</p> : visible.length ? <div className="sr-table-wrap"><table className="sr-table"><thead><tr><th>Started</th><th>Outcome</th><th>Mode</th><th>Sources</th><th>Returned</th><th>Changed</th><th>Duration</th><th><span className="sr-visually-hidden">Details</span></th></tr></thead><tbody>{visible.map(run => <tr key={run.id}><td><strong>{date(run.startedAt)}</strong><small>{run.triggerType} · {run.id.slice(0, 8)}</small></td><td><Status value={run.status} /></td><td>{titleCase(run.mode)}</td><td>{run.sourcesSucceeded}/{run.sourcesChecked}</td><td>{count.format(Number(run.records) || 0)}</td><td>{count.format(Number(run.changes) || 0)}</td><td>{duration(run.startedAt, run.finishedAt)}</td><td><Link className="sr-row-link" to={`/admin/scraping/results/${run.id}`} aria-label={`View run ${run.id}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div> : <p className="sr-empty">{finished ? "No runs match these filters." : "No finished scraper runs yet. Start a collection to see its result here."}</p>}
    </section>
  </div>;
}

function CollectedData({ run, sources, changes }) {
  const [view, setView] = useState("table");
  const records = sources.flatMap(source => (Array.isArray(source.returnedItems) ? source.returnedItems : []).map(item => ({
    sourceId: source.sourceId,
    university: source.school,
    sourceType: source.type,
    sourceUrl: source.url,
    ...item,
  })));
  const payload = {
    run: { id: run.id, mode: run.mode, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt },
    sources: sources.map(source => ({
      sourceId: source.sourceId,
      university: source.school,
      sourceType: source.type,
      sourceUrl: source.url,
      status: source.status,
      recordsDiscovered: source.records,
      recordsChanged: source.changes,
      error: source.error,
      collectedData: Array.isArray(source.returnedItems) ? source.returnedItems : [],
    })),
    savedChanges: changes,
  };
  return <section className="sr-card sr-data" aria-label="Collected data">
    <div className="sr-data-head"><div><h2>Collected data <span>{records.length}</span></h2><p>Normalized records returned by each source in this run.</p></div><div className="sr-data-tabs" role="group" aria-label="Data format"><button type="button" className={view === "table" ? "is-active" : ""} aria-pressed={view === "table"} onClick={() => setView("table")}><Table2 size={14} />Table</button><button type="button" className={view === "json" ? "is-active" : ""} aria-pressed={view === "json"} onClick={() => setView("json")}><Braces size={14} />JSON</button></div></div>
    {view === "table" ? records.length ? <div className="sr-table-wrap"><table className="sr-table sr-data-table"><thead><tr><th>University</th><th>Type</th><th>Collected value</th><th>Catalog match</th><th>Additional data</th></tr></thead><tbody>{records.map((item, index) => <tr key={`${item.sourceId}-${index}`}><td>{item.university}</td><td>{titleCase(item.kind)}</td><td><strong>{item.title}</strong></td><td>{item.kind === "program" ? <>{item.catalogName ?? "None"}<small>{item.existing ? "Existing program" : "New program"}</small></> : "—"}</td><td className="sr-data-extra">{[item.description, item.address].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody></table></div> : <p className="sr-empty">{sources.length ? "No new records were extracted in this run. Select JSON to inspect source statuses and saved changes." : "Detailed collected data was not recorded for this older run. Select JSON to inspect its saved changes."}</p> : <pre className="sr-json" aria-label="Collected data as JSON"><code>{JSON.stringify(payload, null, 2)}</code></pre>}
  </section>;
}

function SourceResult({ source }) {
  return <article className="sr-source"><div className="sr-source-head"><div><span className="sr-source-type">{titleCase(source.type)}</span><h3>{source.school}</h3><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a></div><Status value={source.status} /></div>
    <div className="sr-source-numbers"><span><strong>{count.format(Number(source.records) || 0)}</strong> returned</span><span><strong>{count.format(Number(source.changes) || 0)}</strong> saved changes</span><span><Clock3 size={13} />{duration(source.startedAt, source.finishedAt)}</span></div>
    {source.error && <p className="sr-source-error" role="alert"><CircleAlert size={15} />{source.error}</p>}
    {source.status === "unchanged" ? <p className="sr-muted">The page matched the previous successful version, so no new extraction was saved.</p> : source.status === "failed" ? <p className="sr-muted">This source returned no usable catalog records. Existing catalog data was preserved.</p> : <p className="sr-muted">{Array.isArray(source.returnedItems) ? source.returnedItems.length : 0} normalized records are shown in Collected data above.</p>}
  </article>;
}

function ChangeLog({ changes }) {
  if (!changes.length) return null;
  return <details className="sr-card sr-changes"><summary>Saved catalog changes <span>{changes.length}</span></summary><ul>{changes.map(change => <li key={change.id}><strong>{titleCase(change.action)} {titleCase(change.entityType)}</strong><span>{change.field ? `${titleCase(change.field)} · ` : ""}{change.newValue?.name ?? change.newValue?.schoolId ?? "Catalog record updated"}</span><small>{date(change.changedAt)}</small></li>)}</ul></details>;
}

function ResultDetail({ runId }) {
  const resource = useAdminResource(`/scraping/runs/${runId}`);
  const { run, sources = [], changes = [] } = resource.data ?? {};
  return <div className="sr-page">
    <Heading subtitle="Source by source output from a finished collection job." actions={<><Link className="sr-button sr-button-light" to="/admin/scraping/results"><ArrowLeft size={15} />All results</Link><button className="sr-button sr-button-light" onClick={resource.refresh} disabled={resource.loading}><RefreshCw size={15} />Refresh</button></>}>Run Details</Heading>
    {resource.error && <p className="sr-alert" role="alert"><ShieldAlert size={17} />{resource.error}</p>}
    {!run ? <p className="sr-card sr-empty">{resource.loading ? "Loading run details…" : "This run could not be loaded."}</p> : <>
      <section className={`sr-outcome sr-outcome-${run.status}`}><div><span className="sr-outcome-label">COLLECTION RESULT · {run.id}</span><h2>{run.status === "completed" ? "Collection succeeded" : run.status === "partial" ? "Some sources need review" : "Collection failed"}</h2><p>{run.sourcesSucceeded} of {run.sourcesChecked} sources succeeded. Started {date(run.startedAt)}.</p></div><Status value={run.status} /></section>
      <div className="sr-stats sr-detail-stats"><div><span><Database size={17} /></span><small>Records returned</small><strong>{count.format(Number(run.records) || 0)}</strong></div><div><span><CheckCircle2 size={17} /></span><small>Changes saved</small><strong>{count.format(Number(run.changes) || 0)}</strong></div><div><span><Clock3 size={17} /></span><small>Duration</small><strong>{duration(run.startedAt, run.finishedAt)}</strong></div><div><span><FileSearch size={17} /></span><small>Mode</small><strong>{titleCase(run.mode)}</strong></div></div>
      {run.error && <section className="sr-card sr-summary-error"><h2><CircleAlert size={18} />Error summary</h2><p>{run.error}</p></section>}
      <CollectedData key={run.id} run={run} sources={sources} changes={changes} />
      <div className="sr-section-heading"><div><h2>Source results</h2><p>What each university source returned during this run.</p></div><span>{sources.length} recorded</span></div>
      {sources.length ? <div className="sr-source-list">{sources.map(source => <SourceResult key={source.sourceId} source={source} />)}</div> : <div className="sr-card sr-empty">{run.sourcesChecked ? "This run predates detailed source snapshots. Its totals and any error summary are shown above." : "No sources were checked in this run."}</div>}
      <ChangeLog changes={changes} />
    </>}
  </div>;
}

export function ScraperResults() {
  const { runId } = useParams();
  return runId ? <ResultDetail key={runId} runId={runId} /> : <ResultList />;
}
