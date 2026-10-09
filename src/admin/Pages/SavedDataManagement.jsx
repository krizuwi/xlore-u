import { UnsavedForm } from "../../components/UnsavedForm.jsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Download, Eye, FolderClosed, GitCompareArrows, Pencil, Trash2, University } from "lucide-react";
import { ConfirmDelete, Dialog, Empty, PageFooter, PageHeading, SearchField, handleTabKey, usePreviewData } from "../Management/shared.jsx";
import { CatalogStatus, ComparisonTable, RecordIcon, WorkspaceNotice } from "./WorkspaceShared.jsx";
import { downloadRecords, recordMatches, savedSeed, useAdminCatalog } from "./workspaceData.js";
import "../Management/management.css";

const tabs = ["All records", "Universities", "Programs", "Comparisons"];

function SaveRecordDialog({ records, onSave, onClose }) {
  const [kind, setKind] = useState("Universities");
  const [query, setQuery] = useState("");
  const [recordId, setRecordId] = useState("");
  const available = records.filter((item) => item.kind === kind && recordMatches(item, query));
  const chosen = records.find((item) => item.id === recordId);
  return <Dialog title="Save a Catalog Record" onClose={onClose}><UnsavedForm onSubmit={(event) => { event.preventDefault(); if (chosen) onSave(chosen, new FormData(event.currentTarget).get("notes").trim()); }}><div className="am-dialog-body"><p className="ax-dialog-note">Save a snapshot for later review. The original catalog record stays unchanged.</p><label className="am-field">Record type<select value={kind} onChange={(event) => { setKind(event.target.value); setRecordId(""); }}><option>Universities</option><option>Programs</option></select></label><label className="am-field">Find a record<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setRecordId(""); }} placeholder="Search the catalog..." autoFocus /></label><label className="am-field">Record <span>*</span><select required value={recordId} onChange={(event) => setRecordId(event.target.value)}><option value="">Choose a record</option>{available.map((item) => <option value={item.id} key={item.id}>{item.name}{item.details.University ? ` — ${item.details.University}` : ""} · {item.source}</option>)}</select></label>{!available.length && <p className="ax-dialog-note">No matching records. Try a different search.</p>}<label className="am-field">Review notes<textarea name="notes" rows={3} maxLength={600} placeholder="What would you like to remember?" /></label>{chosen && <span className="am-demo">Source: {chosen.source}</span>}</div><div className="am-dialog-actions"><button type="button" data-discard className="am-button am-button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="am-button" disabled={!chosen}>Save record</button></div></UnsavedForm></Dialog>;
}

export function SavedDataManagement({ searchQuery = "" }) {
  const navigate = useNavigate();
  const [saved, setSaved] = usePreviewData("saved-records-v1", savedSeed);
  const catalog = useAdminCatalog();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All records");
  const [sort, setSort] = useState("Newest first");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const filtered = saved.filter((item) => (tab === "All records" || item.kind === tab) && [query, searchQuery].every((value) => `${item.name} ${item.kind} ${item.notes}`.toLowerCase().includes(value.trim().toLowerCase())))
    .sort((a, b) => sort === "Name A–Z" ? a.name.localeCompare(b.name) : Date.parse(b.savedAt) - Date.parse(a.savedAt));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)));
  function saveRecord(record, notes) {
    if (saved.some((item) => item.record?.id === record.id)) { setNotice("This record is already saved. You can edit its review notes below."); setModal(null); return; }
    setSaved((current) => [{ id: crypto.randomUUID(), name: record.name, kind: record.kind, source: record.source, savedAt: new Date().toISOString(), notes, record }, ...current]);
    setNotice("Record saved in this browser."); setModal(null); setTab("All records"); setPage(1);
  }
  function exportRows(rows) {
    downloadRecords(rows, "xlore-u-saved-data.json");
    setNotice(`Exported ${rows.length} saved ${rows.length === 1 ? "record" : "records"} as JSON.`);
  }
  return <section className="am-page ax-page"><PageHeading title="Saved Data" section="Saved Data" description="Keep catalog snapshots, comparisons, and review notes in one place." action="Save Record" onAction={() => setModal({ type: "add" })} dataLabel="Browser library" />
    <div className="ax-stat-grid ax-stat-grid-four">{[{ label: "Saved records", value: saved.length, icon: FolderClosed }, { label: "Universities", value: saved.filter((item) => item.kind === "Universities").length, icon: University }, { label: "Programs", value: saved.filter((item) => item.kind === "Programs").length, icon: BookOpen }, { label: "Comparisons", value: saved.filter((item) => item.kind === "Comparisons").length, icon: GitCompareArrows }].map(({ label, value, icon: Icon }) => <div key={label}><span className="ax-stat-icon"><Icon size={21} /></span><div><small>{label}</small><strong>{value}</strong></div></div>)}</div>
    {notice && <WorkspaceNotice onClose={() => setNotice("")}>{notice}</WorkspaceNotice>}
    <div className="am-card"><div className="am-tabs ax-tabs" role="tablist" aria-label="Saved record type">{tabs.map((item) => <button key={item} id={`saved-tab-${item.replaceAll(" ", "-")}`} type="button" role="tab" aria-controls="saved-record-panel" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onKeyDown={(event) => handleTabKey(event, tabs, tab, (value) => { setTab(value); setPage(1); })} className={tab === item ? "is-active" : undefined} onClick={() => { setTab(item); setPage(1); }}>{item}</button>)}</div><div id="saved-record-panel" role="tabpanel" aria-labelledby={`saved-tab-${tab.replaceAll(" ", "-")}`}><div className="am-card-toolbar"><SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search saved records or notes..." /><div className="ax-button-row"><select className="ax-select" aria-label="Sort saved records" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option>Newest first</option><option>Name A–Z</option></select><button className="am-button am-button-secondary" disabled={!filtered.length} onClick={() => exportRows(filtered)}><Download size={14} />Export</button></div></div>
    <div className="am-table-scroll"><table className="am-table ax-saved-table"><thead><tr><th scope="col">Record</th><th scope="col">Type</th><th scope="col">Saved on</th><th scope="col">Source</th><th scope="col">Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 8, currentPage * 8).map((item) => <tr key={item.id}><td><button className="ax-record-name" onClick={() => setModal({ type: "view", item })}><RecordIcon kind={item.kind} /><span><strong>{item.name}</strong><small>{item.notes || "No review notes"}</small></span></button></td><td><span className="am-type">{item.kind}</span></td><td><time dateTime={item.savedAt}>{new Date(item.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time></td><td><span className="am-demo">{item.source}</span></td><td><div className="am-row-actions"><button aria-label={`View ${item.name}`} onClick={() => setModal({ type: "view", item })}><Eye size={14} /></button><button aria-label={`Edit notes for ${item.name}`} onClick={() => setModal({ type: "notes", item })}><Pencil size={14} /></button><button className="am-delete" aria-label={`Remove ${item.name}`} onClick={() => setModal({ type: "delete", item })}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>
    {!filtered.length && <Empty title={saved.length ? "No matching saved records" : "Your library is ready"} subtitle={saved.length ? "Try a different search or record type." : "Save a catalog record or a comparison to start your review library."} />}<PageFooter count={filtered.length} page={currentPage} pageSize={8} setPage={setPage} /></div></div>
    <CatalogStatus loading={catalog.loading} errors={catalog.errors} onRefresh={catalog.refresh} />
    <p className="am-bottom-note">Saved snapshots stay in this browser. They are separate from students’ saved items and do not update automatically.</p>
    {modal?.type === "add" && <SaveRecordDialog records={catalog.records} onSave={saveRecord} onClose={() => setModal(null)} />}
    {modal?.type === "notes" && <Dialog title="Edit Review Notes" onClose={() => setModal(null)}><UnsavedForm onSubmit={(event) => { event.preventDefault(); const notes = new FormData(event.currentTarget).get("notes").trim(); setSaved((current) => current.map((item) => item.id === modal.item.id ? { ...item, notes } : item)); setNotice("Review notes saved."); setModal(null); }}><div className="am-dialog-body"><p className="ax-dialog-note">{modal.item.name}</p><label className="am-field">Notes<textarea name="notes" rows={5} maxLength={600} defaultValue={modal.item.notes} autoFocus /></label></div><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="am-button">Save notes</button></div></UnsavedForm></Dialog>}
    {modal?.type === "view" && <Dialog title={modal.item.name} onClose={() => setModal(null)} wide><div className="am-dialog-body"><div className="ax-snapshot-meta"><RecordIcon kind={modal.item.kind} /><span>{modal.item.kind} · {modal.item.source}</span><span className="am-demo">Saved snapshot</span></div>{modal.item.kind === "Comparisons" ? <ComparisonTable records={modal.item.records} /> : <dl className="am-detail-grid">{Object.entries(modal.item.record.details).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}<div className="ax-review-note"><strong>Review notes</strong><p>{modal.item.notes || "No notes added yet."}</p></div></div><div className="am-dialog-actions"><button className="am-button am-button-secondary" onClick={() => exportRows([modal.item])}><Download size={14} />Export</button><button className="am-button" onClick={() => navigate("/admin/comparison", { state: { records: modal.item.kind === "Comparisons" ? modal.item.records : [modal.item.record] } })}><GitCompareArrows size={15} />Open comparison</button></div></Dialog>}
    {modal?.type === "delete" && <ConfirmDelete name={modal.item.name} onClose={() => setModal(null)} onDelete={() => { setSaved((current) => current.filter((item) => item.id !== modal.item.id)); setNotice("Record removed from this browser’s library."); setModal(null); }} />}
  </section>;
}
