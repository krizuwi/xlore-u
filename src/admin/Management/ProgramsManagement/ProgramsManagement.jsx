import { UnsavedForm } from "../../../components/UnsavedForm.jsx";
import { useState } from "react";
import { ArrowLeft, Pencil, Check, X } from "lucide-react";
import { adminWrite, useAdminResource } from "../../lib/adminApi.js";
import { ArchiveDialog, Field, Notice } from "../LiveCatalogShared.jsx";
import { Badge, Dialog, Empty, PageFooter, PageHeading, RowActions, SearchField, catalogKeywordMatches } from "../shared.jsx";
import { SchoolOfferingsPreview } from "./SchoolOfferingsPreview.jsx";
import { ProgramClustersField, SchoolOfferingsFields } from "./ProgramCatalogFields.jsx";
import { assessmentProgramFilterOptions, catalogOptionList, normalizeCatalogOption } from "../../../lib/assessmentProgramFilters.js";
import "../management.css";

function ProgramEditor({ item, schools, categories, degreeLevels, clusters, clustersLoading, onClose, onSaved }) {
  const [offerings, setOfferings] = useState(() => Object.fromEntries((item?.schools ?? []).map(s => [s.id, s.tuition ?? ""])));
  const [clusterIds, setClusterIds] = useState(() => [...(item?.clusterIds ?? [])]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = { ...values, category: normalizeCatalogOption(values.category), degreeLevel: normalizeCatalogOption(values.degreeLevel), careerPaths: values.careerPaths.split(/\r?\n/).map(v => v.trim()).filter(Boolean), interestTags: item?.interestTags ?? [], clusterIds, schools: Object.entries(offerings).map(([id, tuition]) => ({ id, tuition })) };
    setBusy(true); setError("");
    try { const result = await adminWrite(item ? `/programs/${item.id}` : "/programs", item ? "PUT" : "POST", body); onSaved(result.message); onClose(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Dialog title={item ? "Edit Program" : "Add Program"} onClose={() => { if (!busy) onClose(); }} wide><UnsavedForm onSubmit={save}><fieldset className="am-dialog-body am-live-fieldset" disabled={busy}>
    <Field label="Program name" name="name" item={item} required maxLength={190} autoFocus />
    <div className="am-form-grid"><label className="am-field">Category <span>*</span><select className="am-catalog-select" name="category" defaultValue={normalizeCatalogOption(item?.category)} required><option value="" disabled>Select a category</option>{catalogOptionList([...categories, item?.category]).map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="am-field">Degree level <span>*</span><select className="am-catalog-select" name="degreeLevel" defaultValue={normalizeCatalogOption(item?.degreeLevel ?? "Bachelor")} required><option value="" disabled>Select a degree level</option>{catalogOptionList([...degreeLevels, item?.degreeLevel ?? "Bachelor"]).map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <div className="am-form-grid"><Field label="Duration" name="duration" item={item} maxLength={80} placeholder="e.g. 4 years" /><label className="am-field">Status<select name="status" defaultValue={item?.status || "Active"}><option>Active</option><option>Inactive</option></select></label></div>
    <label className="am-field">Description *<textarea required name="description" maxLength={5000} rows={4} defaultValue={item?.description ?? ""} /></label>
    <label className="am-field">Admission requirements<textarea name="requirements" maxLength={5000} rows={3} defaultValue={item?.requirements ?? ""} /></label>
    <label className="am-field">Career paths (one per line)<textarea name="careerPaths" rows={3} defaultValue={(item?.careerPaths ?? []).join("\n")} /></label>
    <ProgramClustersField clusters={clusters} selected={clusterIds} onChange={setClusterIds} loading={clustersLoading} />
    <h3>Schools offering this program</h3><p className="am-description">Select each institution and enter its tuition in PHP per semester. Leave the fee blank when it is unknown.</p>
    <SchoolOfferingsFields schools={schools} offerings={offerings} onChange={setOfferings} />
    <Notice error>{error}</Notice></fieldset><div className="am-dialog-actions"><button type="button" data-discard className="am-button am-button-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="am-button" disabled={busy || clustersLoading}>{busy ? "Saving…" : "Save program"}</button></div></UnsavedForm></Dialog>;
}

function ProgramCategoriesDialog({ categories, onClose, onSaved }) {
  const [newCategory, setNewCategory] = useState("");
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");

  async function addCategory(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await adminWrite("/program-categories", "POST", { name: newCategory });
      setNewCategory(""); onSaved(result.message);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function renameCategory(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await adminWrite("/program-categories", "PUT", { oldName: editing, name: editName });
      setEditing(null); setEditName(""); onSaved(result.message);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <Dialog title="Add/edit categories" onClose={onClose} wide>
    <div className="am-dialog-body am-category-manager">
      <p className="am-description">Add a category for new programs, or rename one to update all programs using it.</p>
      <form className="am-category-add" onSubmit={addCategory}>
        <label className="am-field">New category<input required maxLength={100} value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder="e.g. Business and Management" /></label>
        <button className="am-button" disabled={busy}>Add category</button>
      </form>
      <Notice error>{error}</Notice>
      <div className="am-category-list" aria-label="Program categories">
        {categories.map(category => editing === category ? <form className="am-category-row" key={category} onSubmit={renameCategory}>
          <input aria-label="Category name" required maxLength={100} value={editName} onChange={event => setEditName(event.target.value)} autoFocus />
          <button className="am-icon-button" type="submit" disabled={busy} aria-label={`Save ${category}`} title="Save"><Check size={16} /></button>
          <button className="am-icon-button" type="button" disabled={busy} onClick={() => { setEditing(null); setEditName(""); }} aria-label="Cancel rename" title="Cancel"><X size={16} /></button>
        </form> : <div className="am-category-row" key={category}>
          <span>{category}</span>
          <button className="am-icon-button" type="button" disabled={busy} onClick={() => { setEditing(category); setEditName(category); setError(""); }} aria-label={`Edit ${category}`} title="Edit"><Pencil size={15} /></button>
        </div>)}
        {!categories.length && <p className="am-muted">No categories yet. Add one above.</p>}
      </div>
    </div>
    <div className="am-dialog-actions"><button className="am-button am-button-secondary" disabled={busy} onClick={onClose}>Done</button></div>
  </Dialog>;
}

export function ProgramsManagement({ searchQuery = "" }) {
  const resource = useAdminResource("/programs"), schoolResource = useAdminResource("/schools"), settingsResource = useAdminResource("/assessment-settings"), categoryResource = useAdminResource("/program-categories");
  const programs = resource.data?.data ?? [], schools = schoolResource.data?.data ?? [];
  const clusters = settingsResource.data?.settings?.clusters ?? [];
  const [query, setQuery] = useState(""), [category, setCategory] = useState(""), [school, setSchool] = useState(""), [page, setPage] = useState(1), [modal, setModal] = useState(null), [categoryModal, setCategoryModal] = useState(false), [selectedId, setSelectedId] = useState(null), [notice, setNotice] = useState("");
  const selected = programs.find(p => p.id === selectedId);
  const { categories, degreeLevels } = assessmentProgramFilterOptions(programs.filter(program => program.status === "Active"));
  const editableCategories = catalogOptionList([...(categoryResource.data?.data ?? []), ...categories]);
  const filtered = programs.filter(p => [query, searchQuery].every(value => catalogKeywordMatches(p, value)) && (!category || normalizeCatalogOption(p.category).toLocaleLowerCase() === normalizeCatalogOption(category).toLocaleLowerCase()) && (!school || p.schools.some(s => s.id === school)));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  function saved(message) { setNotice(message); resource.refresh(); settingsResource.refresh(); categoryResource.refresh(); }
  return <section className="am-page"><PageHeading title={selected ? "Program details" : "Programs Management"} section="Programs" description="Manage programs, school offerings, tuition, and admission information." action={!selected ? "Add Program" : undefined} onAction={() => setModal({ mode: "edit" })} secondaryAction={!selected ? "Add/edit category" : undefined} onSecondaryAction={() => setCategoryModal(true)} dataLabel="Live catalog" />
    <Notice>{notice}</Notice><Notice error>{resource.error || schoolResource.error || settingsResource.error || categoryResource.error}</Notice>
    {selected ? <><button className="am-back-link" onClick={() => setSelectedId(null)}><ArrowLeft size={14} />Back to programs</button><div className="am-card"><div className="am-dialog-body"><h2>{selected.name}</h2><Badge>{selected.status}</Badge><p className="am-description">{selected.description}</p><dl className="am-detail-grid">{[["Category", selected.category], ["Degree", selected.degreeLevel], ["Duration", selected.duration || "Not provided"], ["Assessment clusters", selected.clusterNames?.join(", ") || "Not assigned"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>Admission requirements</h3><p className="am-description">{selected.requirements || "Not provided."}</p><h3>Career paths</h3><ul>{selected.careerPaths.map(c => <li key={c}>{c}</li>)}</ul><h3>School offerings</h3><ul>{selected.schools.map(s => <li key={s.id}>{s.name} — {s.tuition === null ? "Tuition not provided" : `PHP ${s.tuition.toLocaleString()} per semester`}</li>)}</ul><button className="am-button" onClick={() => setModal({ mode: "edit", item: selected })}><Pencil size={14} />Edit program</button></div></div></> :
    <div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={value => { setQuery(value); setPage(1); }} placeholder="Search programs..." /><select aria-label="Filter program category" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Filter school" value={school} onChange={e => { setSchool(e.target.value); setPage(1); }}><option value="">All schools</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className="am-button am-button-secondary" disabled={resource.loading} onClick={resource.refresh}>Refresh</button></div>
      {resource.loading && <p className="am-loading" role="status">Loading programs…</p>}
      <div className="am-table-scroll"><table className="am-table"><thead><tr><th>Program</th><th>Assessment clusters</th><th>Schools</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 20, currentPage * 20).map(p => <tr key={p.id}><td><button className="am-table-link" onClick={() => setSelectedId(p.id)}>{p.name}</button></td><td>{p.clusterNames?.length ? p.clusterNames.join(", ") : "Not assigned"}</td><td><SchoolOfferingsPreview schools={p.schools} /></td><td>{p.category}</td><td><Badge>{p.status}</Badge></td><td><RowActions name={p.name} onEdit={() => setModal({ mode: "edit", item: p })} onView={() => setSelectedId(p.id)} deleteLabel="Archive" onDelete={p.status === "Active" ? () => setModal({ mode: "archive", item: p }) : undefined} /></td></tr>)}</tbody></table></div>
      {!resource.loading && !filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={20} setPage={setPage} /></div>}
    {modal?.mode === "edit" && <ProgramEditor item={modal.item} schools={schools} categories={editableCategories} degreeLevels={degreeLevels} clusters={clusters} clustersLoading={settingsResource.loading} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.mode === "archive" && <ArchiveDialog name={modal.item.name} path={`/programs/${modal.item.id}`} onClose={() => setModal(null)} onSaved={saved} />}
    {categoryModal && <ProgramCategoriesDialog categories={editableCategories} onClose={() => setCategoryModal(false)} onSaved={saved} />}
  </section>;
}
