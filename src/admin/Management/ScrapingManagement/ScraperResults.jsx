import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
const pageSize = 15;

function DataPagination({ page, total, onPageChange, label }) {
  if (total <= pageSize) return null;
  const totalPages = Math.ceil(total / pageSize);
  const firstPageButton = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPageButton + index);
  return <nav className="sr-pagination" aria-label={`${label} pages`}>
    <span>Showing {count.format((page - 1) * pageSize + 1)}–{count.format(Math.min(page * pageSize, total))} of {count.format(total)}</span>
    <div><button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1}>Previous</button>
      {pages.map(number => <button key={number} type="button" className={number === page ? "is-active" : ""} aria-label={`${label} page ${number}`} aria-current={number === page ? "page" : undefined} onClick={() => onPageChange(number)}>{number}</button>)}
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>Next</button></div>
    <small>Page {page} of {totalPages} · {pageSize} per page</small>
  </nav>;
}

function Status({ value }) {
  const label = value === "completed" || value === "success" ? "Success" :
    value === "partial" ? "Partial success" : value === "unchanged" ? "Unchanged" : "Failed";
  const tone = value === "completed" || value === "success" || value === "unchanged" ? "success" : value === "partial" ? "warning" : "danger";
  return <span className={`sr-status sr-${tone}`}><span />{label}</span>;
}

function Heading({ children, subtitle, actions }) {
  return <header className="sr-heading"><div><nav className="sr-breadcrumb" aria-label="Breadcrumb"><Link to="/admin">Dashboard</Link><span>/</span><Link to="/admin/scraping/overview">Scraper Overview</Link><span>/</span><Link to="/admin/scraping/results">Run Results</Link></nav><h1><span className="sr-heading-icon"><FileSearch size={24} /></span>{children}</h1><p>{subtitle}</p></div><div className="sr-heading-actions">{actions}</div></header>;
}

function ResultList({ schoolId, schoolName, query, searchParams, setSearchParams }) {
  const rawPage = Number(searchParams.get("page") || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const filter = ["success", "issues"].includes(searchParams.get("status")) ? searchParams.get("status") : "all";
  const search = searchParams.get("search") ?? "";
  const apiParams = new URLSearchParams({ page: String(page), status: filter });
  if (schoolId) apiParams.set("schoolId", schoolId);
  if (search.trim()) apiParams.set("search", search.trim());
  const resource = useAdminResource(`/scraping/runs?${apiParams}`);
  const payload = resource.data?.request?.page === page &&
    resource.data.request.status === filter && resource.data.request.search === search.trim() &&
    (resource.data.request.schoolId ?? "") === schoolId ? resource.data : null;
  const updateQuery = (key, value) => setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    return next;
  }, { replace: key === "search" });
  const runs = payload?.runs ?? [];
  const { finished = 0, successful = 0, issues = 0 } = payload?.summary ?? {};
  const { total = 0, totalPages = 1, page: currentPage = page, pageSize = 15 } = payload ?? {};
  const start = total ? (currentPage - 1) * pageSize + 1 : 0;
  const end = total ? Math.min(currentPage * pageSize, total) : 0;
  const firstPageButton = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPageButton + index);
  return <div className="sr-page">
    <Heading subtitle={schoolId ? `Collection jobs involving ${schoolName || "the selected university"}. Table totals and outcomes cover each whole job.` : "Inspect completed collection jobs, returned data, and failures."} actions={<><button className="sr-button sr-button-light" onClick={resource.refresh} disabled={resource.loading}><RefreshCw size={15} />Refresh</button>{schoolId && <Link className="sr-button sr-button-light" to="/admin/scraping/results">All universities</Link>}<Link className="sr-button sr-button-primary" to="/admin/scraping/automation">New collection <ArrowRight size={15} /></Link></>}>Run Results</Heading>
    {resource.error && <p className="sr-alert" role="alert"><ShieldAlert size={17} />{resource.error}</p>}
    <div className="sr-stats"><div><span><Database size={17} /></span><small>Finished runs</small><strong>{count.format(finished)}</strong></div><div><span><CheckCircle2 size={17} /></span><small>Successful</small><strong>{count.format(successful)}</strong></div><div><span><CircleAlert size={17} /></span><small>Need review</small><strong>{count.format(issues)}</strong></div></div>
    <section className="sr-card"><div className="sr-list-heading"><div><h2>Collection history</h2><p>Open a run to see each source and what it returned.</p></div><label className="sr-search"><Search size={15} /><span className="sr-visually-hidden">Search runs</span><input value={search} maxLength={100} onChange={event => updateQuery("search", event.target.value)} placeholder="Search run ID, mode, or error" /></label></div>
      <div className="sr-filters" role="group" aria-label="Filter results">{[["all", "All", finished], ["success", "Successful", successful], ["issues", "Need review", issues]].map(([key, label, total]) => <button key={key} type="button" className={filter === key ? "is-active" : ""} aria-pressed={filter === key} onClick={() => updateQuery("status", key === "all" ? "" : key)}>{label}<span>{total}</span></button>)}</div>
      {!payload ? <p className="sr-empty">{resource.error ? "Collection history could not be loaded." : "Loading completed runs…"}</p> : runs.length ? <div className="sr-table-wrap"><table className="sr-table"><thead><tr><th>Started</th><th>Outcome</th><th>Mode</th><th>Sources</th><th>Returned</th><th>Changed</th><th>Duration</th><th><span className="sr-visually-hidden">Details</span></th></tr></thead><tbody>{runs.map(run => <tr key={run.id}><td><strong>{date(run.startedAt)}</strong><small>{run.triggerType} · {run.id.slice(0, 8)}</small></td><td><Status value={run.status} /></td><td>{titleCase(run.mode)}</td><td>{run.sourcesSucceeded}/{run.sourcesChecked}</td><td>{count.format(Number(run.records) || 0)}</td><td>{count.format(Number(run.changes) || 0)}</td><td>{duration(run.startedAt, run.finishedAt)}</td><td><Link className="sr-row-link" to={`/admin/scraping/results/${run.id}${query}`} aria-label={`View run ${run.id}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div> : <p className="sr-empty">{finished ? "No runs match these filters." : schoolId ? "No finished collection runs were found for this university." : "No finished scraper runs yet. Start a collection to see its result here."}</p>}
      {total > 0 && <nav className="sr-pagination" aria-label="Collection history pages"><span>Showing {count.format(start)}–{count.format(end)} of {count.format(total)} runs</span><div><button type="button" onClick={() => updateQuery("page", String(currentPage - 1))} disabled={currentPage <= 1 || resource.loading}>Previous</button>{pages.map(number => <button key={number} type="button" className={number === currentPage ? "is-active" : ""} aria-label={`Page ${number}`} aria-current={number === currentPage ? "page" : undefined} onClick={() => updateQuery("page", String(number))} disabled={resource.loading}>{number}</button>)}<button type="button" onClick={() => updateQuery("page", String(currentPage + 1))} disabled={currentPage >= totalPages || resource.loading}>Next</button></div><small>Page {currentPage} of {totalPages} · {pageSize} per page</small></nav>}
    </section>
  </div>;
}

function CollectedData({ run, sources, changes }) {
  const [view, setView] = useState("table");
  const [requestedPage, setPage] = useState(1);
  const records = sources.flatMap(source => (Array.isArray(source.returnedItems) ? source.returnedItems : []).map(item => ({
    sourceId: source.sourceId,
    university: source.school,
    sourceType: source.type,
    sourceUrl: source.url,
    ...item,
  })));
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageRecords = records.slice((page - 1) * pageSize, page * pageSize);
  const payload = {
    run: { id: run.id, mode: run.mode, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt },
    pagination: { page, pageSize, totalRecords: records.length, totalPages },
    sources: sources.map(source => ({
      sourceId: source.sourceId,
      university: source.school,
      sourceType: source.type,
      sourceUrl: source.url,
      status: source.status,
      recordsDiscovered: source.records,
      recordsChanged: source.changes,
      error: source.error,
      collectedData: pageRecords.filter(record => record.sourceId === source.sourceId),
    })),
    savedChanges: changes,
  };
  return <section className="sr-card sr-data" aria-label="Collected data">
    <div className="sr-data-head"><div><h2>Collected data <span>{records.length}</span></h2><p>Normalized records returned by each source in this run.</p></div><div className="sr-data-tabs" role="group" aria-label="Data format"><button type="button" className={view === "table" ? "is-active" : ""} aria-pressed={view === "table"} onClick={() => setView("table")}><Table2 size={14} />Table</button><button type="button" className={view === "json" ? "is-active" : ""} aria-pressed={view === "json"} onClick={() => setView("json")}><Braces size={14} />JSON</button></div></div>
    {view === "table" ? records.length ? <div className="sr-table-wrap"><table className="sr-table sr-data-table"><thead><tr><th>University</th><th>Type</th><th>Collected value</th><th>Catalog match</th><th>Additional data</th></tr></thead><tbody>{pageRecords.map((item, index) => <tr key={`${item.sourceId}-${(page - 1) * pageSize + index}`}><td>{item.university}</td><td>{titleCase(item.kind)}</td><td><strong>{item.title}</strong></td><td>{item.kind === "program" ? <>{item.catalogName ?? "None"}<small>{item.existing ? "Existing program" : "New program"}</small></> : "—"}</td><td className="sr-data-extra">{[item.description, item.address].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody></table></div> : <p className="sr-empty">{sources.length ? "No new records were extracted in this run. Select JSON to inspect source statuses and saved changes." : "Detailed collected data was not recorded for this older run. Select JSON to inspect its saved changes."}</p> : <pre className="sr-json" aria-label="Collected data as JSON"><code>{JSON.stringify(payload, null, 2)}</code></pre>}
    <DataPagination page={page} total={records.length} onPageChange={setPage} label="Collected data" />
  </section>;
}

function SourceResult({ source, runId, query }) {
  const items = Array.isArray(source.returnedItems) ? source.returnedItems : [];
  return <article className="sr-source"><div className="sr-source-head"><div><span className="sr-source-type">{titleCase(source.type)}</span><h3>{source.school}</h3><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a></div><Status value={source.status} /></div>
    <div className="sr-source-numbers"><span><strong>{count.format(Number(source.records) || 0)}</strong> returned</span><span><strong>{count.format(Number(source.changes) || 0)}</strong> saved changes</span><span><Clock3 size={13} />{duration(source.startedAt, source.finishedAt)}</span></div>
    {source.error && <p className="sr-source-error" role="alert"><CircleAlert size={15} />{source.error}</p>}
    {items.length ? <Link className="sr-returned-link" to={`/admin/scraping/results/${runId}/sources/${source.sourceId}${query}`}><Database size={15} />Show collected data<span>{count.format(items.length)}</span><ArrowRight size={15} /></Link> :
      <p className="sr-muted">{source.status === "unchanged" ? "The page matched the previous successful version, so no new extraction was saved." : source.status === "failed" ? "This source returned no usable catalog records. Existing catalog data was preserved." : Number(source.records) ? "This source reports returned records, but their detailed data was not recorded." : "No records were returned by this source."}</p>}
  </article>;
}

function ChangeLog({ changes }) {
  if (!changes.length) return null;
  return <details className="sr-card sr-changes"><summary>Saved catalog changes <span>{changes.length}</span></summary><ul>{changes.map(change => <li key={change.id}><strong>{titleCase(change.action)} {titleCase(change.entityType)}</strong><span>{change.field ? `${titleCase(change.field)} · ` : ""}{change.newValue?.name ?? change.newValue?.schoolId ?? "Catalog record updated"}</span><small>{date(change.changedAt)}</small></li>)}</ul></details>;
}

function ResultDetail({ runId, schoolId, schoolName, query }) {
  const resource = useAdminResource(`/scraping/runs/${runId}${schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : ""}`);
  const { run, sources = [], changes = [] } = resource.data ?? {};
  return <div className="sr-page">
    <Heading subtitle={schoolId ? `Source results for ${schoolName || "the selected university"}. The job outcome and duration cover the whole run.` : "Source by source output from a finished collection job."} actions={<><Link className="sr-button sr-button-light" to={`/admin/scraping/results${query}`}><ArrowLeft size={15} />{schoolId ? "University results" : "All results"}</Link><button className="sr-button sr-button-light" onClick={resource.refresh} disabled={resource.loading}><RefreshCw size={15} />Refresh</button></>}>Run Details</Heading>
    {resource.error && <p className="sr-alert" role="alert"><ShieldAlert size={17} />{resource.error}</p>}
    {!run ? <p className="sr-card sr-empty">{resource.loading ? "Loading run details…" : "This run could not be loaded."}</p> : <>
      <section className={`sr-outcome sr-outcome-${run.status}`}><div><span className="sr-outcome-label">COLLECTION RESULT · {run.id}</span><h2>{run.status === "completed" ? "Collection succeeded" : run.status === "partial" ? "Some sources need review" : "Collection failed"}</h2><p>{run.sourcesSucceeded} of {run.sourcesChecked} sources succeeded. Started {date(run.startedAt)}.</p></div><Status value={run.status} /></section>
      <div className="sr-stats sr-detail-stats"><div><span><Database size={17} /></span><small>Records returned{schoolId ? " for university" : ""}</small><strong>{count.format(schoolId ? sources.reduce((total, source) => total + (Number(source.records) || 0), 0) : Number(run.records) || 0)}</strong></div><div><span><CheckCircle2 size={17} /></span><small>Changes saved{schoolId ? " for university" : ""}</small><strong>{count.format(schoolId ? sources.reduce((total, source) => total + (Number(source.changes) || 0), 0) : Number(run.changes) || 0)}</strong></div><div><span><Clock3 size={17} /></span><small>Duration</small><strong>{duration(run.startedAt, run.finishedAt)}</strong></div><div><span><FileSearch size={17} /></span><small>Mode</small><strong>{titleCase(run.mode)}</strong></div></div>
      {run.error && <section className="sr-card sr-summary-error"><h2><CircleAlert size={18} />Error summary</h2><p>{run.error}</p></section>}
      <CollectedData key={run.id} run={run} sources={sources} changes={changes} />
      <div className="sr-section-heading"><div><h2>Source results</h2><p>What each university source returned during this run.</p></div><span>{sources.length} recorded</span></div>
      {sources.length ? <div className="sr-source-list">{sources.map(source => <SourceResult key={source.sourceId} source={source} runId={runId} query={query} />)}</div> : <div className="sr-card sr-empty">{run.sourcesChecked ? "This run predates detailed source snapshots. Its totals and any error summary are shown above." : "No sources were checked in this run."}</div>}
      <ChangeLog changes={changes} />
    </>}
  </div>;
}

function SourceCollectedData({ runId, sourceId, schoolId, query }) {
  const resource = useAdminResource(`/scraping/runs/${runId}${schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : ""}`);
  const { run, sources = [], changes = [] } = resource.data ?? {};
  const source = sources.find(item => item.sourceId === sourceId);
  return <div className="sr-page">
    <Heading subtitle="Inspect the records returned by this source in table or JSON format." actions={<><Link className="sr-button sr-button-light" to={`/admin/scraping/results/${runId}${query}`}><ArrowLeft size={15} />Run Details</Link><button className="sr-button sr-button-light" onClick={resource.refresh} disabled={resource.loading}><RefreshCw size={15} />Refresh</button></>}>Collected Data</Heading>
    {resource.error && <p className="sr-alert" role="alert"><ShieldAlert size={17} />{resource.error}</p>}
    {!run ? <p className="sr-card sr-empty">{resource.loading ? "Loading collected data…" : "This run could not be loaded."}</p> : !source ? <p className="sr-card sr-empty">This source was not found in the run.</p> : <>
      <section className="sr-source sr-source-summary"><div className="sr-source-head"><div><span className="sr-source-type">{titleCase(source.type)}</span><h3>{source.school}</h3><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a></div><Status value={source.status} /></div>
        <div className="sr-source-numbers"><span><strong>{count.format(Number(source.records) || 0)}</strong> returned</span><span><strong>{count.format(Number(source.changes) || 0)}</strong> saved changes</span><span><Clock3 size={13} />{duration(source.startedAt, source.finishedAt)}</span></div>
        {source.error && <p className="sr-source-error" role="alert"><CircleAlert size={15} />{source.error}</p>}
      </section>
      <CollectedData key={`${runId}-${sourceId}`} run={run} sources={[source]} changes={changes.filter(change => change.sourceId === sourceId)} />
    </>}
  </div>;
}

export function ScraperResults() {
  const { runId, sourceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const schoolId = searchParams.get("schoolId") ?? "";
  const schoolName = searchParams.get("schoolName") ?? "";
  const query = searchParams.size ? `?${searchParams}` : "";
  return sourceId ? <SourceCollectedData key={`${runId}-${sourceId}-${schoolId}`} runId={runId} sourceId={sourceId} schoolId={schoolId} query={query} /> :
    runId ? <ResultDetail key={`${runId}-${schoolId}`} runId={runId} schoolId={schoolId} schoolName={schoolName} query={query} /> :
      <ResultList schoolId={schoolId} schoolName={schoolName} query={query} searchParams={searchParams} setSearchParams={setSearchParams} />;
}
