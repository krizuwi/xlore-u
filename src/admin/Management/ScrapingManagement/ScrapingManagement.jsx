import { UnsavedForm } from "../../../components/UnsavedForm.jsx";
import { useUnsavedChanges } from "../../../context/UnsavedChangesContext.jsx";
import { useState } from "react";
import { CirclePlay } from "lucide-react";
import { adminWrite, useAdminResource } from "../../lib/adminApi.js";
import { Notice } from "../LiveCatalogShared.jsx";
import { Badge, Dialog, Empty, PageHeading } from "../shared.jsx";
import "../management.css";

export function ScrapingManagement() {
  const { requestDiscard } = useUnsavedChanges();
  const resource = useAdminResource("/scraping");
  const { sources = [], runs = [], settings } = resource.data ?? {};
  const [modal, setModal] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const schools = [...new Map(sources.filter(s => s.enabled).map(s => [s.schoolId, s.school])).entries()];
  async function write(path, method, body) {
    setBusy(true); setError(""); setNotice("");
    try { const result = await adminWrite(path, method, body); resource.refresh(); return result; }
    catch (err) { setError(err.message); return null; } finally { setBusy(false); }
  }
  async function start(event) {
    event.preventDefault();
    const result = await write("/scraping/run", "POST", { schoolId: new FormData(event.currentTarget).get("schoolId") });
    if (result) { setNotice(result.skipped ? result.reason : `Collection ${result.status}: ${result.checked} sources checked, ${result.changed} changes saved.`); setModal(false); }
  }
  async function save(event) {
    event.preventDefault();
    const result = await write("/settings", "PATCH", Object.fromEntries(new FormData(event.currentTarget)));
    if (result) { setNotice("Collection schedule and timeout saved."); return true; }
  }
  return <section className="am-page"><PageHeading title="Scraping Management" section="Scraping" description="Collect catalog updates from configured university sources." action="New Scraping Job" onAction={() => { setError(""); setModal(true); }} dataLabel="Live collection" />
    <Notice>{notice}</Notice><Notice error>{error || resource.error}</Notice>
    <div className="am-card"><div className="am-card-toolbar"><h2>Collection history</h2><button className="am-button am-button-secondary" disabled={busy || resource.loading} onClick={() => requestDiscard(resource.refresh)}>Refresh</button></div>
      {resource.loading && <p className="am-loading">Loading collection history…</p>}
      <div className="am-table-scroll"><table className="am-table"><thead><tr><th>Started</th><th>Trigger</th><th>Status</th><th>Sources checked</th><th>Records discovered</th><th>Changes</th><th>Details</th></tr></thead><tbody>{runs.map(run => <tr key={run.id}><td>{new Date(run.startedAt).toLocaleString()}</td><td>{run.triggerType}</td><td><Badge>{run.status}</Badge></td><td>{run.sourcesChecked}</td><td>{run.records}</td><td>{run.changes}</td><td>{run.error || (run.finishedAt ? "Finished" : "In progress")}</td></tr>)}</tbody></table></div>{!resource.loading && !runs.length && <Empty title="No collection runs yet" subtitle="Start a job for a university with an enabled source." />}
    </div>
    <div className="am-card"><div className="am-card-toolbar"><h2>University sources</h2><p>Enable or disable the configured sources used by collection jobs.</p></div><div className="am-table-scroll"><table className="am-table"><thead><tr><th>University</th><th>Source</th><th>Latest status</th><th>Enabled</th></tr></thead><tbody>{sources.map(source => <tr key={source.id}><td>{source.school}</td><td><a href={source.url} target="_blank" rel="noreferrer">{source.type.replaceAll("_", " ")}</a></td><td>{source.status || "Not checked"}{source.error && <p>{source.error}</p>}</td><td><input type="checkbox" aria-label={`Enable ${source.type} for ${source.school}`} checked={source.enabled} disabled={busy} onChange={async e => { const result = await write(`/scraping/sources/${source.id}`, "PATCH", { enabled: e.target.checked }); if (result) setNotice(result.message); }} /></td></tr>)}</tbody></table></div></div>
    {settings && <UnsavedForm className="am-card am-config-form" onSubmit={save} key={`${settings.frequency}-${settings.timeout}`}><h2>Collection settings</h2><p className="am-description">Automatic updates run while the backend scheduler is active. Sources are collected sequentially to respect university websites.</p><label className="am-field">Schedule<select name="frequency" defaultValue={settings.frequency} disabled={busy}><option>Daily</option><option>Weekly</option><option>Manual only</option></select></label><label className="am-field">Page timeout in seconds<input type="number" name="timeout" min="5" max="60" step="1" required defaultValue={settings.timeout} disabled={busy} /></label><button className="am-button" disabled={busy}>{busy ? "Saving…" : "Save collection settings"}</button></UnsavedForm>}
    {modal && <Dialog title="Start catalog collection" onClose={() => { if (!busy) setModal(false); }}><UnsavedForm onSubmit={start}><div className="am-dialog-body"><label className="am-field">University<select name="schoolId" required disabled={busy || !schools.length}>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><p className="am-description">This collects real updates from this university's enabled sources and saves changes to the catalog.</p>{!schools.length && <p>No enabled sources are available.</p>}<Notice error>{error}</Notice>{busy && <p role="status">Collecting updates… This may take a few minutes.</p>}</div><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" disabled={busy} onClick={() => setModal(false)}>Cancel</button><button className="am-button" disabled={busy || !schools.length}><CirclePlay size={15} />{busy ? "Collecting…" : "Start collection"}</button></div></UnsavedForm></Dialog>}
  </section>;
}
