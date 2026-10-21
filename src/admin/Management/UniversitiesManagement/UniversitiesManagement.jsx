import { UnsavedForm } from "../../../components/UnsavedForm.jsx";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pencil } from "lucide-react";
import { SchoolLogo } from "../../../components/SchoolLogo.jsx";
import { SchoolMediaFields } from "../SchoolMediaFields.jsx";
import { useUnsavedChanges } from "../../../context/UnsavedChangesContext.jsx";
import { adminWrite, useAdminResource } from "../../lib/adminApi.js";
import { filterManagedUniversities } from '../../lib/university-filters.js';
import { ArchiveDialog, Field, Notice } from "../LiveCatalogShared.jsx";
import { Badge, Dialog, Empty, PageFooter, PageHeading, RowActions, SearchField } from "../shared.jsx";
import "../management.css";

function SchoolEditor({ item, onClose, onSaved, defaultStatus }) {
  const { markClean } = useUnsavedChanges();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [media, setMedia] = useState(() => ({ logoUrl: item?.logoUrl ?? "", logoCredit: item?.logoCredit ?? {}, campusPhotos: item?.campusPhotos ?? [] }));
  async function save(event) {
    event.preventDefault(); const form = event.currentTarget;
    const values = { ...Object.fromEntries(new FormData(form)), media };
    setBusy(true); setError("");
    try { const result = await adminWrite(item ? `/schools/${item.id}` : "/schools", item ? "PUT" : "POST", values); markClean(form); if (!onSaved(result.message, result.id)) onClose(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Dialog title={item ? "Edit University" : "Add University"} onClose={() => { if (!busy && !uploading) onClose(); }} wide><UnsavedForm onSubmit={save}><fieldset className="am-dialog-body am-live-fieldset" disabled={busy || uploading}>
    <Field label="University name" name="name" item={item} required maxLength={190} autoFocus />
    <div className="am-form-grid"><label className="am-field">Type<select name="type" defaultValue={item?.type || "Public"}><option>Public</option><option>Private</option></select></label><label className="am-field">Status<select name="status" defaultValue={item?.status || defaultStatus || "Active"}><option>Active</option><option>Inactive</option></select></label></div>
    <Field label="City / district" name="city" item={item} required maxLength={100} /><Field label="Full address" name="address" item={item} required maxLength={255} />
    <div className="am-form-grid"><Field label="Latitude" name="latitude" item={item} required type="number" min="-90" max="90" step="any" /><Field label="Longitude" name="longitude" item={item} required type="number" min="-180" max="180" step="any" /></div>
    <p className="am-preview-note">Use the school's map coordinates so location recommendations remain accurate.</p>
    <Field label="Official website" name="website" item={item} type="url" maxLength={2000} /><Field label="Tuition range" name="tuitionRange" item={item} maxLength={80} /><Field label="Accreditation" name="accreditation" item={item} maxLength={255} />
    <Field label="Google rating (if verified)" name="googleRating" item={item} type="number" min="0" max="5" step="0.1" />
    <label className="am-field">Scholarship information<textarea name="scholarshipInfo" maxLength={5000} rows={3} defaultValue={item?.scholarshipInfo ?? ""} /></label>
    <label className="am-field">Description<textarea name="description" maxLength={5000} rows={3} defaultValue={item?.description ?? ""} /></label>
    <SchoolMediaFields media={media} onChange={setMedia} school={item} onBusyChange={setUploading} />
    <Notice error>{error}</Notice></fieldset><div className="am-dialog-actions"><button type="button" data-discard className="am-button am-button-secondary" onClick={onClose} disabled={busy || uploading}>Cancel</button><button className="am-button" disabled={busy || uploading}>{uploading ? "Uploading…" : busy ? "Saving…" : "Save university"}</button></div></UnsavedForm></Dialog>;
}

export function UniversitiesManagement({ searchQuery = "" }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const resource = useAdminResource("/schools");
  const universities = resource.data?.data ?? [];
  const editItem = universities.find(school => school.id === searchParams.get("edit"));
  const [query, setQuery] = useState(""), [type, setType] = useState("All types"), [page, setPage] = useState(1), [modal, setModal] = useState(() => searchParams.has("add") ? { mode: "edit" } : null), [notice, setNotice] = useState("");
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (editItem) setModal({ mode: "edit", item: editItem });
  }, [editItem]);
  const filtered = filterManagedUniversities(universities, { query, searchQuery, type, status });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 6)));
  function closeModal() {
    setModal(null);
    if (searchParams.has("add") || searchParams.has("edit")) setSearchParams({}, { replace: true });
  }
  function saved(message, schoolId) {
    if (searchParams.get("returnTo") === "automation" && schoolId) {
      navigate(`/admin/scraping/automation?addSourceFor=${schoolId}`);
      return true;
    }
    setNotice(message); resource.refresh();
    return false;
  }
  return <section className="am-page"><PageHeading title="Universities Management" section="Universities" description="Manage the live university directory." action="Add University" onAction={() => setModal({ mode: "edit" })} dataLabel="Live catalog" />
    <Notice>{notice}</Notice><Notice error>{resource.error}</Notice>
    <div className="am-card"><div className="am-card-toolbar am-university-toolbar"><SearchField value={query} onChange={value => { setQuery(value); setPage(1); }} placeholder="Search universities..." /><select aria-label="Filter university type" value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option>All types</option><option>Public</option><option>Private</option></select><select aria-label="Filter university status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select><button className="am-button am-button-secondary" disabled={resource.loading} onClick={resource.refresh}>Refresh</button></div>
      {resource.loading && <p className="am-loading" role="status">Loading universities…</p>}
      <div className="am-table-scroll"><table className="am-table"><thead><tr><th>Name</th><th>Type</th><th>City</th><th>Programs</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 6, currentPage * 6).map(item => <tr key={item.id}><td><div className="am-university-name"><SchoolLogo school={item} />{item.name}</div></td><td>{item.type}</td><td>{item.city}</td><td>{item.programs}</td><td><Badge>{item.status}</Badge></td><td><RowActions name={item.name} onEdit={() => setModal({ mode: "edit", item })} onView={() => setModal({ mode: "view", item })} deleteLabel="Archive" onDelete={item.status === "Active" ? () => setModal({ mode: "archive", item }) : undefined} /></td></tr>)}</tbody></table></div>
      {!resource.loading && !filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={6} setPage={setPage} />
    </div>
    {modal?.mode === "edit" && <SchoolEditor item={modal.item} onClose={closeModal} onSaved={saved} defaultStatus={searchParams.get("returnTo") === "automation" ? "Inactive" : undefined} />}
    {modal?.mode === "archive" && <ArchiveDialog name={modal.item.name} path={`/schools/${modal.item.id}`} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.mode === "view" && <Dialog title="University details" onClose={() => setModal(null)}><div className="am-dialog-body"><h3>{modal.item.name}</h3><p>{modal.item.address}</p><p>{modal.item.description || "No description provided."}</p><dl className="am-detail-grid">{[["Type", modal.item.type], ["Tuition", modal.item.tuitionRange], ["Accreditation", modal.item.accreditation], ["Scholarships", modal.item.scholarshipInfo || "Not provided"]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div><div className="am-dialog-actions"><button className="am-button" onClick={() => setModal({ ...modal, mode: "edit" })}><Pencil size={14} />Edit university</button></div></Dialog>}
  </section>;
}
