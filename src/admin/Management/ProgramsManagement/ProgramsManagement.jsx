import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { adminWrite, useAdminResource } from "../../lib/adminApi.js";
import { ArchiveDialog, Field, Notice } from "../LiveCatalogShared.jsx";
import { Badge, Dialog, Empty, PageFooter, PageHeading, RowActions, SearchField, matches } from "../shared.jsx";
import "../management.css";

function ProgramEditor({ item, schools, categories, onClose, onSaved }) {
  const [offerings, setOfferings] = useState(() => Object.fromEntries((item?.schools ?? []).map(s => [s.id, s.tuition ?? ""])));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = { ...values, careerPaths: values.careerPaths.split(/\r?\n/).map(v => v.trim()).filter(Boolean), interestTags: values.interestTags.split(",").map(v => v.trim().toLowerCase()).filter(Boolean), schools: Object.entries(offerings).map(([id, tuition]) => ({ id, tuition })) };
    setBusy(true); setError("");
    try { const result = await adminWrite(item ? `/programs/${item.id}` : "/programs", item ? "PUT" : "POST", body); onSaved(result.message); onClose(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Dialog title={item ? "Edit Program" : "Add Program"} onClose={() => { if (!busy) onClose(); }} wide><form onSubmit={save}><fieldset className="am-dialog-body am-live-fieldset" disabled={busy}>
    <Field label="Program name" name="name" item={item} required maxLength={190} autoFocus />
    <div className="am-form-grid"><Field label="Category" name="category" item={item} required maxLength={100} list="admin-categories" /><datalist id="admin-categories">{categories.map(c => <option key={c}>{c}</option>)}</datalist><Field label="Degree level" name="degreeLevel" item={item ?? { degreeLevel: "Bachelor" }} required maxLength={60} /></div>
    <div className="am-form-grid"><Field label="Duration" name="duration" item={item} maxLength={80} placeholder="e.g. 4 years" /><label className="am-field">Status<select name="status" defaultValue={item?.status || "Active"}><option>Active</option><option>Inactive</option></select></label></div>
    <label className="am-field">Description *<textarea required name="description" maxLength={5000} rows={4} defaultValue={item?.description ?? ""} /></label>
    <label className="am-field">Admission requirements<textarea name="requirements" maxLength={5000} rows={3} defaultValue={item?.requirements ?? ""} /></label>
    <label className="am-field">Career paths (one per line)<textarea name="careerPaths" rows={3} defaultValue={(item?.careerPaths ?? []).join("\n")} /></label>
    <Field label="Interest tags (separated by commas)" name="interestTags" item={{ interestTags: (item?.interestTags ?? []).join(", ") }} placeholder="technology, analytical" />
    <p className="am-preview-note">Use technology, analytical, science, health, business, creative, communication, or social to connect this program to assessment results.</p>
    <h3>Schools offering this program</h3><p className="am-description">Select each institution and enter its tuition in PHP per semester. Leave the fee blank when it is unknown.</p>
    {schools.map(s => <div className="am-offering" key={s.id}><label><input type="checkbox" checked={Object.hasOwn(offerings, s.id)} onChange={e => setOfferings(current => { const copy = { ...current }; if (e.target.checked) copy[s.id] = ""; else delete copy[s.id]; return copy; })} /> {s.name}{s.status === "Inactive" && " (inactive)"}</label><input aria-label={`Tuition per semester for ${s.name}`} type="number" min="0" max="99999999" step="0.01" disabled={!Object.hasOwn(offerings, s.id)} value={offerings[s.id] ?? ""} placeholder="Unknown" onChange={e => setOfferings(current => ({ ...current, [s.id]: e.target.value }))} /></div>)}
    <Notice error>{error}</Notice></fieldset><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="am-button" disabled={busy}>{busy ? "Saving…" : "Save program"}</button></div></form></Dialog>;
}

export function ProgramsManagement({ searchQuery = "" }) {
  const resource = useAdminResource("/programs"), schoolResource = useAdminResource("/schools");
  const programs = resource.data?.data ?? [], schools = schoolResource.data?.data ?? [];
  const [query, setQuery] = useState(""), [category, setCategory] = useState(""), [school, setSchool] = useState(""), [page, setPage] = useState(1), [modal, setModal] = useState(null), [selectedId, setSelectedId] = useState(null), [notice, setNotice] = useState("");
  const selected = programs.find(p => p.id === selectedId);
  const categories = [...new Set(programs.map(p => p.category))].sort();
  const filtered = programs.filter(p => matches(`${p.name} ${p.schools.map(s => s.name).join(" ")}`, query) && matches(p.name, searchQuery) && (!category || p.category === category) && (!school || p.schools.some(s => s.id === school)));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  function saved(message) { setNotice(message); resource.refresh(); }
  return <section className="am-page"><PageHeading title={selected ? "Program details" : "Programs Management"} section="Programs" description="Manage programs, school offerings, tuition, and admission information." action="Add Program" onAction={() => setModal({ mode: "edit" })} dataLabel="Live catalog" />
    <Notice>{notice}</Notice><Notice error>{resource.error || schoolResource.error}</Notice>
    {selected ? <><button className="am-back-link" onClick={() => setSelectedId(null)}><ArrowLeft size={14} />Back to programs</button><div className="am-card"><div className="am-dialog-body"><h2>{selected.name}</h2><Badge>{selected.status}</Badge><p className="am-description">{selected.description}</p><dl className="am-detail-grid">{[["Category", selected.category], ["Degree", selected.degreeLevel], ["Duration", selected.duration || "Not provided"], ["Interest tags", selected.interestTags.join(", ") || "Not provided"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>Admission requirements</h3><p className="am-description">{selected.requirements || "Not provided."}</p><h3>Career paths</h3><ul>{selected.careerPaths.map(c => <li key={c}>{c}</li>)}</ul><h3>School offerings</h3><ul>{selected.schools.map(s => <li key={s.id}>{s.name} — {s.tuition === null ? "Tuition not provided" : `PHP ${s.tuition.toLocaleString()} per semester`}</li>)}</ul><button className="am-button" onClick={() => setModal({ mode: "edit", item: selected })}><Pencil size={14} />Edit program</button></div></div></> :
    <div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={value => { setQuery(value); setPage(1); }} placeholder="Search programs..." /><select aria-label="Filter program category" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Filter school" value={school} onChange={e => { setSchool(e.target.value); setPage(1); }}><option value="">All schools</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="am-button am-button-secondary" disabled={resource.loading} onClick={resource.refresh}>Refresh</button></div>
      {resource.loading && <p className="am-loading" role="status">Loading programs…</p>}
      <div className="am-table-scroll"><table className="am-table"><thead><tr><th>Program</th><th>Schools</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 20, currentPage * 20).map(p => <tr key={p.id}><td><button className="am-table-link" onClick={() => setSelectedId(p.id)}>{p.name}</button></td><td>{p.schools.map(s => s.name).join(", ") || "Not assigned"}</td><td>{p.category}</td><td><Badge>{p.status}</Badge></td><td><RowActions name={p.name} onEdit={() => setModal({ mode: "edit", item: p })} onView={() => setSelectedId(p.id)} deleteLabel="Archive" onDelete={p.status === "Active" ? () => setModal({ mode: "archive", item: p }) : undefined} /></td></tr>)}</tbody></table></div>
      {!resource.loading && !filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={20} setPage={setPage} /></div>}
    {modal?.mode === "edit" && <ProgramEditor item={modal.item} schools={schools} categories={categories} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.mode === "archive" && <ArchiveDialog name={modal.item.name} path={`/programs/${modal.item.id}`} onClose={() => setModal(null)} onSaved={saved} />}
  </section>;
}
