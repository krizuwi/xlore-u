import { UnsavedForm } from "../../../components/UnsavedForm.jsx";
import { useState } from "react";
import { adminWrite, useAdminResource } from "../../lib/adminApi.js";
import { Notice } from "../LiveCatalogShared.jsx";
import { Dialog, Empty, PageFooter, PageHeading, RowActions, SearchField, matches } from "../shared.jsx";
import "../management.css";

export function CategoriesManagement({ searchQuery = "" }) {
  const resource = useAdminResource("/programs");
  const programs = resource.data?.data ?? [];
  const [query, setQuery] = useState(""), [category, setCategory] = useState(""), [page, setPage] = useState(1), [selected, setSelected] = useState(null), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const categories = [...new Set(programs.map(p => p.category))].sort();
  const filtered = programs.filter(p => matches(`${p.name} ${p.category} ${p.schools.map(s => s.name).join(" ")}`, query) && matches(p.name, searchQuery) && (!category || category === p.category));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  async function save(event) {
    event.preventDefault(); const value = new FormData(event.currentTarget).get("category");
    setBusy(true); setError("");
    try { const result = await adminWrite(`/programs/${selected.id}/category`, "PATCH", { category: value }); setNotice(result.message); setSelected(null); resource.refresh(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="am-page"><PageHeading title="Category Management" section="Categories" description="Update the category of each program across all its school offerings." dataLabel="Live catalog" />
    <Notice>{notice}</Notice><Notice error>{resource.error}</Notice>
    <div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={v => { setQuery(v); setPage(1); }} placeholder="Search programs, schools, or categories..." /><select aria-label="Filter program category" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select><button className="am-button am-button-secondary" disabled={resource.loading} onClick={resource.refresh}>Refresh</button></div>
      {resource.loading && <p className="am-loading">Loading categories…</p>}
      <div className="am-table-scroll"><table className="am-table"><thead><tr><th>Program</th><th>Schools</th><th>Category</th><th>Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 20, currentPage * 20).map(p => <tr key={p.id}><td>{p.name}</td><td>{p.schools.map(s => s.name).join(", ") || "Not assigned"}</td><td>{p.category}</td><td><RowActions name={`category for ${p.name}`} onEdit={() => { setError(""); setSelected(p); }} /></td></tr>)}</tbody></table></div>
      {!resource.loading && !filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={20} setPage={setPage} /></div>
    {selected && <Dialog title="Edit program category" onClose={() => { if (!busy) setSelected(null); }}><UnsavedForm onSubmit={save}><div className="am-dialog-body"><h3>{selected.name}</h3><label className="am-field">Category<input name="category" required maxLength={100} defaultValue={selected.category} list="category-options" autoFocus disabled={busy} /></label><datalist id="category-options">{categories.map(c => <option key={c}>{c}</option>)}</datalist><Notice error>{error}</Notice></div><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</button><button className="am-button" disabled={busy}>{busy ? "Saving…" : "Save category"}</button></div></UnsavedForm></Dialog>}
  </section>;
}
