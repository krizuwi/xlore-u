import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bot, Building2, CalendarClock, CheckCircle2, CirclePlay, Clock3, GitMerge, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { UnsavedForm } from "../../../components/UnsavedForm.jsx";
import { api } from "../../../lib/api.js";
import { useUnsavedChanges } from "../../../context/UnsavedChangesContext.jsx";
import { adminWrite, useAdminResource } from "../../lib/adminApi.js";
import { Notice } from "../LiveCatalogShared.jsx";
import { Dialog } from "../shared.jsx";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { requestDiscard, markClean } = useUnsavedChanges();
  const resource = useAdminResource("/scraping");
  const universitiesResource = useAdminResource("/schools");
  const universities = universitiesResource.data?.data ?? [];
  const { settings, sources: serverSources = [], runs = [], capabilities = {} } = resource.data ?? {};
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [collectionStep, setCollectionStep] = useState(() => searchParams.has("addSourceFor") ? "new" : null);
  const [collectionError, setCollectionError] = useState("");
  const [addingUniversity, setAddingUniversity] = useState(false);
  const [sourceSchoolId, setSourceSchoolId] = useState(() => searchParams.get("addSourceFor") ?? "");
  const [programUrl, setProgramUrl] = useState({ schoolId: "", value: "" });
  const [resultsBusy, setResultsBusy] = useState(false);
  const { running: runBusy, latestRun, runCollection } = useScrapingRun();
  const [sourceBusy, setSourceBusy] = useState({});
  const [sourceOverrides, setSourceOverrides] = useState({});
  const [sourceAnnouncement, setSourceAnnouncement] = useState("");
  const sources = serverSources.map(source => ({ ...source,
    enabled: Object.hasOwn(sourceOverrides, source.id) ? sourceOverrides[source.id] : source.enabled }));
  const lastRunId = latestRun?.runId;
  const mode = selected ?? settings?.scrapingMode ?? "standard";
  const aiReady = Boolean(capabilities.aiScraping);
  const schools = [...new Map(sources.filter(source => source.enabled).map(source => [source.schoolId, source.school])).entries()];
  const currentSchoolId = schools.some(([schoolId]) => schoolId === selectedSchoolId) ? selectedSchoolId : schools[0]?.[0] ?? "";
  const currentSchoolName = schools.find(([schoolId]) => schoolId === currentSchoolId)?.[1] ?? "";
  const currentSourceSchoolId = universities.some(school => school.id === sourceSchoolId) ? sourceSchoolId : universities[0]?.id ?? "";
  const sourceUniversity = universities.find(school => school.id === currentSourceSchoolId);
  const sourceWebsiteReady = /^https:\/\//i.test(sourceUniversity?.website ?? "");
  const existingProgramUrl = sources.find(source => source.schoolId === currentSourceSchoolId && source.type === "program_catalog")?.url ?? "";
  const currentProgramUrl = programUrl.schoolId === currentSourceSchoolId ? programUrl.value : existingProgramUrl;
  useEffect(() => { if (lastRunId) resource.refresh(); }, [lastRunId]);
  useEffect(() => {
    setSourceOverrides(current => {
      const next = { ...current };
      for (const source of serverSources) {
        if (Object.hasOwn(next, source.id) && next[source.id] === source.enabled) delete next[source.id];
      }
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [serverSources]);
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
    const schoolId = new FormData(event.currentTarget).get("schoolId");
    setCollectionStep(null);
    try {
      const result = await runCollection(schoolId, schoolName);
      if (result?.errors?.length) setError(result.errors.join(", "));
    } catch (err) { setError(err.message); }
  }
  function closeCollection() {
    setCollectionStep(null);
    if (searchParams.has("addSourceFor")) setSearchParams({}, { replace: true });
  }
  async function addUniversity(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setAddingUniversity(true); setCollectionError("");
    try {
      const values = Object.fromEntries(new FormData(form));
      const result = await adminWrite("/scraping/sources", "POST", values);
      markClean(form);
      setSelectedSchoolId(result.schoolId);
      closeCollection();
      setProgramUrl({ schoolId: "", value: "" });
      setNotice(result.message);
      resource.refresh();
    } catch (err) { setCollectionError(err.message); }
    finally { setAddingUniversity(false); }
  }
  async function showCollectedData() {
    if (!currentSchoolId) return;
    setResultsBusy(true); setError(""); setNotice("");
    try {
      const { runs: schoolRuns = [] } = await api(`/admin/scraping/runs?schoolId=${encodeURIComponent(currentSchoolId)}`);
      if (!schoolRuns.length) {
        setNotice(`No collected data is available for ${currentSchoolName} yet.`);
        return;
      }
      const query = new URLSearchParams({ schoolId: currentSchoolId, schoolName: currentSchoolName });
      navigate(`/admin/scraping/results/${schoolRuns[0].id}?${query}`);
    } catch (err) { setError(err.message); }
    finally { setResultsBusy(false); }
  }
  async function toggleSource(source, enabled) {
    setSourceBusy(current => ({ ...current, [source.id]: true }));
    setSourceOverrides(current => ({ ...current, [source.id]: enabled }));
    setError("");
    try {
      await adminWrite(`/scraping/sources/${source.id}`, "PATCH", { enabled });
      setSourceAnnouncement(`${source.type.replaceAll("_", " ")} for ${source.school} ${enabled ? "enabled" : "disabled"}.`);
      resource.refresh();
    } catch (err) {
      setSourceOverrides(current => { const next = { ...current }; delete next[source.id]; return next; });
      setError(err.message);
    } finally {
      setSourceBusy(current => { const next = { ...current }; delete next[source.id]; return next; });
    }
  }
  return <div className="automation-module">
    <header className="auo-heading"><div><div className="auo-breadcrumb"><Link to="/admin">Dashboard</Link><span>/</span><Link to="/admin/scraping/overview">Scraper Overview</Link><span>/</span>Automation</div><h1><span><CalendarClock size={25} /></span>Automation</h1><p>Choose how university sources are collected and when jobs run.</p></div><button type="button" className="auo-refresh" onClick={() => requestDiscard(resource.refresh)} disabled={busy || resource.loading}><RefreshCw size={16} />Refresh</button></header>
    <Notice>{notice}</Notice><Notice error>{error || resource.error}</Notice><span className="auo-visually-hidden" role="status">{sourceAnnouncement}</span>
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
      <div className="auo-card-head"><span className="auo-step">03</span><div><h2>Run a collection</h2><p>Collect an existing university or add a new university source.</p></div></div>
      <div className="auo-manual-form"><label>University<select value={currentSchoolId} onChange={event => setSelectedSchoolId(event.target.value)} disabled={runBusy || resultsBusy || !schools.length}>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><button type="button" onClick={() => { setCollectionError(""); setCollectionStep("choice"); }} disabled={runBusy || resultsBusy}><CirclePlay size={16} />{runBusy ? "Collecting..." : "Run collection"}</button><button type="button" className="auo-show-results" onClick={showCollectedData} disabled={runBusy || resultsBusy || !schools.length}><ArrowRight size={16} />{resultsBusy ? "Loading data..." : "Show collected data"}</button></div>
      {!schools.length && <p className="auo-control-note">Add a university source, or enable an existing source below.</p>}
    </section>
    <section className="auo-card auo-control-card" id="source-controls"><div className="auo-card-head"><span className="auo-step">04</span><div><h2>University sources</h2><p>Choose which configured sources can run. Their latest status is shown below.</p></div></div><div className="auo-source-list">{sources.map(source => <div className="auo-source-row" key={source.id}><div><strong>{source.school}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.type.replaceAll("_", " ")} - {source.url}</a></div><SourceCollectionStatus source={source} /><label className="auo-source-toggle checkbox-row"><input type="checkbox" aria-label={`Enable ${source.type} for ${source.school}`} checked={source.enabled} disabled={Boolean(sourceBusy[source.id]) || runBusy} onChange={event => toggleSource(source, event.target.checked)} /><span>Enabled</span></label></div>)}{!resource.loading && !sources.length && <p className="auo-control-note">No university sources are configured.</p>}</div></section>
    <div className="auo-footer-links"><Link to="/admin/scraping/results">View run results <ArrowRight size={15} /></Link><Link to="/admin/scraping/overview">Back to overview <ArrowRight size={15} /></Link></div>
    {collectionStep && <Dialog title={collectionStep === "choice" ? "Choose a collection path" : collectionStep === "existing" ? "Collect an existing university" : "Add a university source"} onClose={() => { if (!addingUniversity) closeCollection(); }} wide={collectionStep === "new"}>
      {collectionStep === "choice" && <div className="auo-collection-choice"><p>Choose how to begin. Automated collection uses the saved {settings?.scrapingMode ?? "standard"} mode.</p><div>
        <button type="button" onClick={() => setCollectionStep("existing")} disabled={!schools.length}><CirclePlay size={22} /><strong>Collect an existing university</strong><span>Run the enabled sources of a university already configured for collection.</span><ArrowRight size={16} /></button>
        <button type="button" onClick={() => setCollectionStep("new")}><Building2 size={22} /><strong>Add a university source</strong><span>Choose a university in the system and add its official program catalog page.</span><ArrowRight size={16} /></button>
      </div>{!schools.length && <small>No enabled sources are available yet. Add a university source to get started.</small>}</div>}
      {collectionStep === "existing" && <form className="auo-collection-form" onSubmit={runNow}><p>Run the saved {settings?.scrapingMode ?? "standard"} collection mode for one university's enabled sources.</p><label>University<select name="schoolId" value={currentSchoolId} onChange={event => setSelectedSchoolId(event.target.value)} required>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><div className="auo-dialog-actions"><button type="button" onClick={() => setCollectionStep("choice")}><ArrowLeft size={15} />Back</button><button type="submit" className="is-primary" disabled={!currentSchoolId || runBusy}><CirclePlay size={15} />Start collection</button></div></form>}
      {collectionStep === "new" && <UnsavedForm className="auo-collection-form" onSubmit={addUniversity}><fieldset disabled={addingUniversity}>
        <p>Select a university already in the system. Its name, location, and official website will be used for the new sources.</p>
        <label>University<select name="schoolId" value={currentSourceSchoolId} onChange={event => { setSourceSchoolId(event.target.value); setProgramUrl({ schoolId: "", value: "" }); setCollectionError(""); }} required disabled={universitiesResource.loading || !universities.length}>{universities.map(school => <option key={school.id} value={school.id}>{school.name} · {school.city}</option>)}</select></label>
        {universitiesResource.loading && <p className="auo-add-note">Loading universities…</p>}
        <Notice error>{universitiesResource.error}</Notice>
        {sourceUniversity && <div className="auo-university-summary"><div><span>Type</span><strong>{sourceUniversity.type}</strong></div><div><span>Location</span><strong>{sourceUniversity.city}{sourceUniversity.address ? ` · ${sourceUniversity.address}` : ""}</strong></div><div><span>Official website</span><strong>{sourceUniversity.website || "Not set"}</strong></div></div>}
        {sourceUniversity && !sourceWebsiteReady && <p className="auo-add-note">This university needs an HTTPS official website before sources can be added. <Link to={`/admin/universities?edit=${sourceUniversity.id}&returnTo=automation`}>Edit university details</Link>.</p>}
        {sourceWebsiteReady && <label>Program catalog URL<input name="programUrl" type="url" value={currentProgramUrl} onChange={event => setProgramUrl({ schoolId: currentSourceSchoolId, value: event.target.value })} placeholder={`${sourceUniversity.website.replace(/\/$/, "")}/programs`} maxLength={2000} required /></label>}
        {existingProgramUrl && currentProgramUrl === existingProgramUrl && <small className="auo-add-note">An existing catalog URL is filled in. Saving it will enable the source.</small>}
        <small className="auo-add-note">The catalog must use the university's official domain. Its saved website will be used for the profile source.</small>
        <Link className="auo-add-university-link" to="/admin/universities?add=1&returnTo=automation">University not listed? Add it in Universities</Link>
        <Notice error>{collectionError}</Notice>
        <div className="auo-dialog-actions"><button type="button" onClick={event => requestDiscard(() => setCollectionStep("choice"), event.currentTarget.closest("form"))} disabled={addingUniversity}><ArrowLeft size={15} />Back</button><button type="submit" className="is-primary" disabled={addingUniversity || !sourceWebsiteReady || !currentProgramUrl}>{addingUniversity ? "Adding source…" : "Save university source"}</button></div>
      </fieldset></UnsavedForm>}
    </Dialog>}
  </div>;
}
