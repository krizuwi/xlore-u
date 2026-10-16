import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, CalendarClock, CheckCircle2, CirclePlay, Clock3, GitMerge, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { UnsavedForm } from "../../../components/UnsavedForm.jsx";
import { useUnsavedChanges } from "../../../context/UnsavedChangesContext.jsx";
import { adminWrite, useAdminResource } from "../../lib/adminApi.js";
import { Notice } from "../LiveCatalogShared.jsx";
import { SourceCollectionStatus } from "./SourceCollectionStatus.jsx";
import { useScrapingRun } from "../../Components/ScrapingRunContext.jsx";
import "../management.css";
import "./AutomationModule.css";

const modes = [
  { id: "standard", title: "Standard", icon: Settings2, description: "Read degree links, structured page data, and supported public listings.", detail: "Checks linked degree pages when a listing title needs clarification." },
  { id: "ai", title: "AI scraping", icon: Bot, description: "Use direct degree discovery first, then ScrapeGraphAI when needed.", detail: "Skips hosted extraction when official links provide program titles." },
  { id: "hybrid", title: "Hybrid", icon: GitMerge, description: "Try direct discovery and the page parser, then AI when needed.", detail: "Retries failed public listings and blocked program pages through ScrapeGraphAI." },
];

export function AutomationModule() {
  const { requestDiscard } = useUnsavedChanges();
  const resource = useAdminResource("/scraping");
  const { settings, sources = [], runs = [], capabilities = {} } = resource.data ?? {};
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const { running: runBusy, latestRun, runCollection } = useScrapingRun();
  const [sourceBusy, setSourceBusy] = useState(null);
  const lastRunId = latestRun?.runId;
  const mode = selected ?? settings?.scrapingMode ?? "standard";
  const aiReady = Boolean(capabilities.aiScraping);
  const schools = [...new Map(sources.filter(source => source.enabled).map(source => [source.schoolId, source.school])).entries()];
  useEffect(() => { if (lastRunId) resource.refresh(); }, [lastRunId]);
  async function save(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await adminWrite("/settings", "PATCH", values);
      setNotice("Automation settings saved.");
      resource.refresh();
      return true;
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function runNow(event) {
    event.preventDefault();
    setError(""); setNotice("");
    const schoolName = event.currentTarget.elements.schoolId.selectedOptions[0]?.textContent?.trim() || 'the university';
    try {
      const schoolId = new FormData(event.currentTarget).get("schoolId");
      const result = await runCollection(schoolId, schoolName);
      if (result?.errors?.length) setError(result.errors.join(", "));
    } catch (err) { setError(err.message); }
  }
  async function toggleSource(source, enabled) {
    setSourceBusy(source.id); setError(""); setNotice("");
    try {
      const result = await adminWrite(`/scraping/sources/${source.id}`, "PATCH", { enabled });
      setNotice(result.message);
      resource.refresh();
    } catch (err) { setError(err.message); }
    finally { setSourceBusy(null); }
  }
  return <div className="automation-module">
    <header className="auo-heading"><div><div className="auo-breadcrumb"><Link to="/admin">Dashboard</Link><span>/</span><Link to="/admin/scraping/overview">Scraper Overview</Link><span>/</span>Automation</div><h1><span><CalendarClock size={25} /></span>Automation</h1><p>Choose how university sources are collected and when jobs run.</p></div><button type="button" className="auo-refresh" onClick={() => requestDiscard(resource.refresh)} disabled={busy || resource.loading}><RefreshCw size={16} />Refresh</button></header>
    <Notice>{notice}</Notice><Notice error>{error || resource.error}</Notice>
    {!aiReady && ["ai", "hybrid"].includes(settings?.scrapingMode) && <p className="auo-provider-warning" role="alert">The saved AI mode is paused because SGAI_API_KEY is missing. Restore the key on the backend or choose Standard and save.</p>}
    <div className="auo-summary"><div><span className="auo-summary-icon"><ShieldCheck size={20} /></span><span><strong>{sources.filter(source => source.enabled).length} enabled sources</strong><small>from {sources.length} configured university sources</small></span></div><div><span className="auo-summary-icon"><Clock3 size={20} /></span><span><strong>{settings?.frequency ?? "—"} schedule</strong><small>Last run: {runs[0] ? new Date(runs[0].startedAt).toLocaleString() : "none recorded"}</small></span></div><div><span className="auo-summary-icon"><Bot size={20} /></span><span><strong>{aiReady ? "ScrapeGraphAI key configured" : "ScrapeGraphAI key missing"}</strong><small>{aiReady ? "AI and Hybrid modes selectable" : "Set SGAI_API_KEY on the backend"}</small></span></div></div>
    {settings ? <UnsavedForm className="auo-form" key={`${settings.scrapingMode ?? "standard"}-${settings.frequency}-${settings.timeout}`} onSubmit={save}>
      <section className="auo-card"><div className="auo-card-head"><span className="auo-step">01</span><div><h2>Collection mode</h2><p>Select the extraction approach for scheduled and manual jobs.</p></div></div><div className="auo-modes">{modes.map(option => {
        const Icon = option.icon;
        const disabled = option.id !== "standard" && !aiReady;
        return <label className={`auo-mode${mode === option.id ? " is-selected" : ""}${disabled ? " is-unavailable" : ""}`} key={option.id}><input type="radio" name="scrapingMode" value={option.id} checked={mode === option.id} disabled={disabled || busy} onChange={() => setSelected(option.id)} /><span className="auo-mode-icon"><Icon size={23} /></span><span className="auo-mode-copy"><strong>{option.title}</strong><small>{option.description}</small><em>{disabled ? "Unavailable until an AI provider is configured" : option.detail}</em></span><span className="auo-radio-mark"><CheckCircle2 size={20} /></span></label>;
      })}</div><p className="auo-mode-note">AI extraction applies to program catalog sources. School profiles keep the standard metadata parser. The hosted result must identify the configured university and match known program aliases before saving; hosted API usage may consume credits.</p></section>
      <section className="auo-card"><div className="auo-card-head"><span className="auo-step">02</span><div><h2>Schedule and limits</h2><p>Control how often enabled sources are checked.</p></div></div><div className="auo-fields"><label>Collection schedule<select name="frequency" defaultValue={settings.frequency} disabled={busy}><option>Daily</option><option>Weekly</option><option>Manual only</option></select><small>Scheduled jobs run only while the long-lived backend scheduler is active.</small></label><label>Direct page timeout in seconds<input type="number" name="timeout" min="5" max="60" step="1" required defaultValue={settings.timeout} disabled={busy} /><small>Applies to each official page and article-list request before AI fallback.</small></label></div></section>
      <div className="auo-actions"><p>Changes apply to future collection jobs.</p><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save automation settings"}</button></div>
    </UnsavedForm> : <div className="auo-card auo-loading">{resource.loading ? "Loading automation settings…" : "Automation settings are unavailable."}</div>}
    <section className="auo-card auo-control-card">
      <div className="auo-card-head"><span className="auo-step">03</span><div><h2>Run a collection now</h2><p>Use the saved collection mode for one university's enabled sources.</p></div></div>
      <form className="auo-manual-form" onSubmit={runNow}><label>University<select name="schoolId" required disabled={runBusy || !schools.length}>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><button type="submit" disabled={runBusy || !schools.length}><CirclePlay size={16} />{runBusy ? "Collecting..." : "Start collection"}</button></form>
      {!schools.length && <p className="auo-control-note">Enable a source below before starting a manual run.</p>}
      {lastRunId && <Link className="auo-result-link" to={`/admin/scraping/results/${lastRunId}`}>View this run's collected data and outcome <ArrowRight size={15} /></Link>}
    </section>
    <section className="auo-card auo-control-card" id="source-controls"><div className="auo-card-head"><span className="auo-step">04</span><div><h2>University sources</h2><p>Choose which configured sources can run. Their latest status is shown below.</p></div></div><div className="auo-source-list">{sources.map(source => <div className="auo-source-row" key={source.id}><div><strong>{source.school}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.type.replaceAll("_", " ")} - {source.url}</a></div><SourceCollectionStatus source={source} /><label className="auo-source-toggle"><input type="checkbox" aria-label={`Enable ${source.type} for ${source.school}`} checked={source.enabled} disabled={sourceBusy !== null || runBusy} onChange={event => toggleSource(source, event.target.checked)} />Enabled</label></div>)}{!resource.loading && !sources.length && <p className="auo-control-note">No university sources are configured.</p>}</div></section>
    <div className="auo-footer-links"><Link to="/admin/scraping/results">View run results <ArrowRight size={15} /></Link><Link to="/admin/scraping/overview">Back to overview <ArrowRight size={15} /></Link></div>
  </div>;
}
