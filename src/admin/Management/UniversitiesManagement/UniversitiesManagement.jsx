import { useEffect, useState } from "react";
import { ArrowRight, Building2, ChevronDown, CircleAlert, CircleCheck, ExternalLink, Filter, GraduationCap, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Badge, ConfirmDelete, Dialog, Empty, PageFooter, PageHeading, PreviewNote, RowActions, SearchField, matches, nextId } from "../shared.jsx";
import { FetchCollectionData } from "../../Request/dashboardApiRequest.jsx";
import "../management.css";

export function UniversitiesManagement({ searchQuery = "" }) {
  const [universities, setUniversities] = useState([]);
  const [catalogRequest, setCatalogRequest] = useState({ loading: true, error: "" });
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All types");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    FetchCollectionData({ signal: controller.signal, allPages: true }).then(({ universities: records }) => {
      if (controller.signal.aborted) return;
      setUniversities(records.map((record, index) => ({
        id: record.id ?? record.schoolId ?? `university-${index}`,
        avatarIndex: index % 4,
        name: record.name ?? "Unnamed university",
        type: record.schoolType ?? "Unknown",
        location: record.city ?? record.address ?? "—",
        programs: Array.isArray(record.programs) ? record.programs.length : 0,
        status: "Active",
        website: record.officialWebsiteUrl ?? ""
      })));
      setCatalogRequest({ loading: false, error: "" });
    }).catch((error) => {
      if (!controller.signal.aborted) setCatalogRequest({ loading: false, error: error.message });
    });
    return () => controller.abort();
  }, []);
  const filtered = universities.filter((item) => matches(`${item.name} ${item.location}`, query) && matches(`${item.name} ${item.location}`, searchQuery) && (type === "All types" || type === item.type));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 6)));
  function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const id = modal.item?.id || nextId(universities);
    const item = { ...values, name: values.name.trim(), location: values.location.trim(), programs: modal.item?.programs || 0, id, avatarIndex: modal.item?.avatarIndex ?? (typeof id === "number" ? id % 4 : 0) };
    if (!item.name || !item.location) return;
    setUniversities((rows) => modal.item ? rows.map((row) => row.id === item.id ? item : row) : [...rows, item]);
    setNotice(`${item.name} ${modal.item ? "updated" : "added"} in the local preview.`);
    setModal(null);
  }
  return <section className="am-page"><PageHeading title="Universities Management" section="Universities" description="Manage your university directory and keep every detail up to date." action="Add University" onAction={() => setModal({ mode: "edit" })} dataLabel={catalogRequest.loading ? "Loading catalog" : catalogRequest.error ? "Catalog unavailable" : "Live catalog"} />
    {notice && <div className="am-notice" role="status"><CircleCheck size={16} />{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={15} /></button></div>}
    {catalogRequest.error && <div className="am-notice" role="alert"><CircleAlert size={16} />Unable to load universities: {catalogRequest.error}</div>}
    <div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search universities..." /><label className="am-filter"><Filter size={15} /><select aria-label="Filter university type" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option>All types</option>{[...new Set(universities.map((item) => item.type).filter(Boolean))].sort().map((schoolType) => <option key={schoolType}>{schoolType}</option>)}</select><ChevronDown size={13} /></label></div>
      {catalogRequest.loading && <p className="am-loading" role="status">Loading universities...</p>}
      <div className="am-table-scroll"><table className="am-table"><thead><tr><th>Name</th><th>Type</th><th>Location</th><th>Programs</th><th>Status</th><th className="am-actions-heading">Actions</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 6, currentPage * 6).map((item) => <tr key={item.id}><td><div className="am-university-name"><span className={`am-university-avatar am-avatar-${item.avatarIndex ?? 0}`}><Building2 size={17} /></span><span>{item.name}</span></div></td><td><span className="am-type">{item.type}</span></td><td>{item.location}</td><td>{item.programs}</td><td><Badge>{item.status}</Badge></td><td><RowActions name={item.name} onEdit={() => setModal({ mode: "edit", item })} onView={() => setModal({ mode: "view", item })} onDelete={() => setModal({ mode: "delete", item })} /></td></tr>)}</tbody></table></div>
      {!catalogRequest.loading && !catalogRequest.error && !filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={6} setPage={setPage} /></div>
    <div className="am-information"><Building2 size={18} /><div><strong>A complete picture of every university</strong><p>Keep institution profiles, locations, and program information organized in one place.</p></div></div>
    {modal?.mode === "delete" && <ConfirmDelete name={modal.item.name} onClose={() => setModal(null)} onDelete={() => { setUniversities((rows) => rows.filter((row) => row.id !== modal.item.id)); setNotice("University removed from the local preview."); setModal(null); }} />}
    {modal?.mode === "edit" && <Dialog title={modal.item ? "Edit University" : "Add New University"} onClose={() => setModal(null)}><form onSubmit={save}><div className="am-dialog-body"><label className="am-field">University name <span>*</span><input required maxLength={120} name="name" defaultValue={modal.item?.name} placeholder="e.g. University of the Philippines" autoFocus /></label><div className="am-form-grid"><label className="am-field">Type <span>*</span><select name="type" defaultValue={modal.item?.type || "Public"}><option>Public</option><option>Private</option></select></label><label className="am-field">Status<select name="status" defaultValue={modal.item?.status || "Active"}><option>Active</option><option>Inactive</option></select></label></div><label className="am-field">Location <span>*</span><input required maxLength={100} name="location" defaultValue={modal.item?.location} placeholder="e.g. Quezon City" /></label><label className="am-field">Website<input type="url" name="website" defaultValue={modal.item?.website} placeholder="https://university.edu.ph" /></label><PreviewNote persistent={false} /></div><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="am-button">{modal.item ? "Save changes" : "Add university"}<ArrowRight size={15} /></button></div></form></Dialog>}
    {modal?.mode === "view" && <Dialog title="University Details" onClose={() => setModal(null)}><div className="am-dialog-body"><div className="am-profile-heading"><span className="am-profile-icon"><Building2 size={30} /></span><div><h3>{modal.item.name}</h3><p><MapPin size={13} />{modal.item.location}</p></div></div><dl className="am-detail-grid"><div><dt>Institution type</dt><dd>{modal.item.type}</dd></div><div><dt>Programs</dt><dd>{modal.item.programs}</dd></div><div><dt>Status</dt><dd><Badge>{modal.item.status}</Badge></dd></div><div><dt>Website</dt><dd>{/^https?:\/\//.test(modal.item.website) ? <a href={modal.item.website} target="_blank" rel="noreferrer">Visit website <ExternalLink size={12} /></a> : "Not provided"}</dd></div></dl><PreviewNote persistent={false} /></div><div className="am-dialog-actions"><button className="am-button" onClick={() => setModal({ ...modal, mode: "edit" })}><Pencil size={14} />Edit university</button></div></Dialog>}
  </section>;
}
