import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Download, FolderClosed, GitCompareArrows, Plus, Save, X } from "lucide-react";
import { Dialog, PageHeading, SearchField, handleTabKey, usePreviewData } from "../Management/shared.jsx";
import { CatalogStatus, ComparisonTable, RecordIcon, WorkspaceNotice } from "./WorkspaceShared.jsx";
import { downloadRecords, recordMatches, savedSeed, useAdminCatalog } from "./workspaceData.js";
import "../Management/management.css";

const kinds = ["Universities", "Programs"];

export function AdminComparisonPage({ searchQuery = "" }) {
  const { state } = useLocation();
  const initial = Array.isArray(state?.records) ? state.records.slice(0, 3) : [];
  const [kind, setKind] = useState(initial[0]?.kind || "Universities");
  const [selection, setSelection] = useState([initial[0] || null, initial[1] || null, initial[2] || null]);
  const [showThird, setShowThird] = useState(initial.length > 2);
  const [query, setQuery] = useState("");
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = usePreviewData("saved-records-v1", savedSeed);
  const catalog = useAdminCatalog();
  const records = selection.filter(Boolean);
  const options = [...new Map([...catalog.records, ...records].map((record) => [record.id, record])).values()]
    .filter((record) => record.kind === kind && [query, searchQuery].every((value) => recordMatches(record, value)));
  function changeKind(value) {
    setKind(value); setSelection([null, null, null]); setDifferencesOnly(false); setQuery("");
  }
  function saveComparison(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.get("name").trim()) return;
    setSaved((current) => [{ id: crypto.randomUUID(), name: data.get("name").trim(), kind: "Comparisons", source: records.every((record) => record.source === "Live catalog") ? "Live catalog snapshot" : "Contains demo data", records, notes: data.get("notes").trim(), savedAt: new Date().toISOString() }, ...current]);
    setSaving(false); setNotice("Comparison saved. Open Saved Data to review or export it later.");
  }
  return <section className="am-page ax-page"><PageHeading title="Comparison" section="Comparison" description="Review universities and programs side by side, then save your findings." dataLabel="Catalog review" />
    <div className="ax-comparison-intro"><span className="ax-stat-icon is-purple"><GitCompareArrows size={24} /></span><div><h2>A clearer view of your catalog</h2><p>Choose up to three records. Differences are highlighted so you can quickly spot what needs a closer look.</p></div><Link className="am-button am-button-secondary" to="/admin/saved"><FolderClosed size={15} />Saved Data <span className="ax-count">{saved.filter((item) => item.kind === "Comparisons").length}</span></Link></div>
    {notice && <WorkspaceNotice onClose={() => setNotice("")}>{notice}</WorkspaceNotice>}
    <div className="am-card"><div className="am-tabs ax-tabs" role="tablist" aria-label="Compare record type">{kinds.map((item) => <button role="tab" id={`comparison-tab-${item}`} aria-controls="comparison-panel" tabIndex={kind === item ? 0 : -1} aria-selected={kind === item} onKeyDown={(event) => handleTabKey(event, kinds, kind, changeKind)} className={kind === item ? "is-active" : undefined} key={item} onClick={() => changeKind(item)}>{item}</button>)}</div><div id="comparison-panel" role="tabpanel" aria-labelledby={`comparison-tab-${kind}`}>
    <div className="am-card-toolbar"><SearchField value={query} onChange={setQuery} placeholder={`Find ${kind.toLowerCase()} to compare...`} /><div className="ax-button-row"><button className="am-button am-button-secondary" disabled={records.length < 2} onClick={() => { downloadRecords(records, "xlore-u-comparison.json"); setNotice("Comparison exported as JSON."); }}><Download size={14} />Export</button><button className="am-button" disabled={records.length < 2} onClick={() => setSaving(true)}><Save size={14} />Save comparison</button></div></div>
    <div className="ax-compare-selectors">{selection.slice(0, showThird ? 3 : 2).map((record, index) => <div className={`ax-compare-selector${record ? " has-record" : ""}`} key={index}><div className="ax-compare-selector-heading"><RecordIcon kind={kind} /><span>{kind === "Universities" ? "University" : "Program"} {index + 1}</span>{record && <button type="button" className="am-icon-button" aria-label={`Remove ${record.name} from comparison`} onClick={() => setSelection((current) => current.map((item, position) => position === index ? null : item))}><X size={15} /></button>}</div><label><span className="ad-sr-only">Choose {kind === "Universities" ? "university" : "program"} {index + 1}</span><select value={record?.id || ""} onChange={(event) => { const chosen = options.find((item) => item.id === event.target.value) || null; setSelection((current) => current.map((item, position) => position === index ? chosen : item)); }}><option value="">Choose a record</option>{record && !options.some((item) => item.id === record.id) && <option value={record.id}>{record.name}</option>}{options.map((item) => <option key={item.id} value={item.id} disabled={selection.some((chosen, position) => position !== index && chosen?.id === item.id)}>{item.name}{item.details.University ? ` — ${item.details.University}` : ""}</option>)}</select></label><small>{record ? record.source : catalog.loading ? "Loading catalog options…" : `${options.length} matching records`}</small></div>)}{!showThird && <button className="ax-add-comparison" onClick={() => setShowThird(true)}><Plus size={23} /><span>Add a third {kind === "Universities" ? "university" : "program"}</span></button>}</div>
    <div className="ax-compare-toolbar"><span>{records.length} of 3 records selected</span><label><input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} disabled={records.length < 2} />Only differences</label><button className="ax-text-button" disabled={!records.length} onClick={() => { setSelection([null, null, null]); setDifferencesOnly(false); }}>Clear selection</button></div>
    {searchQuery && records.length >= 2 && <p className="ax-search-context">Top-bar search filters available records and comparison details. Selected records stay in place.</p>}
    <ComparisonTable records={records} differencesOnly={differencesOnly} query={searchQuery} /></div></div>
    <CatalogStatus loading={catalog.loading} errors={catalog.errors} onRefresh={catalog.refresh} />
    <p className="am-bottom-note">A catalog comparison for administrative review. Sample figures are labeled; saved snapshots retain the values shown when saved.</p>
    {saving && <Dialog title="Save Comparison" onClose={() => setSaving(false)}><form onSubmit={saveComparison}><div className="am-dialog-body"><label className="am-field">Comparison name <span>*</span><input name="name" required maxLength={120} defaultValue={`${kind} comparison`} autoFocus /></label><label className="am-field">Review notes<textarea name="notes" maxLength={600} rows={4} placeholder="Add context for your next review..." /></label><p className="ax-dialog-note">Saves a snapshot of {records.length} records to Saved Data in this browser.</p></div><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" onClick={() => setSaving(false)}>Cancel</button><button className="am-button"><Save size={14} />Save snapshot</button></div></form></Dialog>}
  </section>;
}
