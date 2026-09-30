import { useState } from "react";
import { ArrowRight, CircleCheck, GraduationCap, Plus, Search, Trash2 } from "lucide-react";
import { Badge, ConfirmDelete, Dialog, Empty, PageHeading, PreviewNote, RowActions, SearchField, categorySeed, matches, nextId, usePreviewData } from "../shared.jsx";
import "../management.css";

export function CategoriesManagement({ searchQuery = "" }) {
  const [categories, setCategories] = usePreviewData("categories", categorySeed);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const filtered = categories.filter((item) => matches(`${item.name} ${item.description}`, query) && matches(`${item.name} ${item.description}`, searchQuery));
  function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.name.trim() || !values.description.trim()) return;
    const item = { ...values, name: values.name.trim(), description: values.description.trim(), id: modal.item?.id || nextId(categories), programs: modal.item?.programs || 0 };
    setCategories((rows) => modal.item ? rows.map((row) => row.id === item.id ? item : row) : [...rows, item]);
    setNotice(`${item.name} saved to the local preview.`);
    setModal(null);
  }
  return <section className="am-page"><PageHeading title="Category Management" section="Categories" description="Organize academic programs into clear, meaningful categories." action="Add Category" onAction={() => setModal({ mode: "edit" })} />{notice && <div className="am-notice" role="status"><CircleCheck size={16} />{notice}</div>}<div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={setQuery} placeholder="Search categories..." /><span className="am-record-count">{categories.length} categories</span></div><div className="am-table-scroll"><table className="am-table"><thead><tr><th>Name</th><th>Description</th><th>Programs</th><th>Status</th><th className="am-actions-heading">Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><span className="am-category-name">{item.name}</span></td><td>{item.description}</td><td>{item.programs}</td><td><Badge>{item.status}</Badge></td><td><RowActions name={item.name} onEdit={() => setModal({ mode: "edit", item })} onDelete={() => setModal({ mode: "delete", item })} /></td></tr>)}</tbody></table></div>{!filtered.length && <Empty />}<div className="am-table-footer">{filtered.length} categories in your directory</div></div><div className="am-information"><GraduationCap size={20} /><div><strong>Make exploration easier</strong><p>Categories help students discover programs that match their interests and academic strand.</p></div></div>
    {modal?.mode === "delete" && <ConfirmDelete name={modal.item.name} onClose={() => setModal(null)} onDelete={() => { setCategories((rows) => rows.filter((row) => row.id !== modal.item.id)); setNotice("Category removed from the local preview."); setModal(null); }} />}
    {modal?.mode === "edit" && <Dialog title={modal.item ? "Edit Category" : "Add New Category"} onClose={() => setModal(null)}><form onSubmit={save}><div className="am-dialog-body"><label className="am-field">Category name <span>*</span><input required name="name" maxLength={40} defaultValue={modal.item?.name} placeholder="e.g. STEM" autoFocus /></label><label className="am-field">Description <span>*</span><textarea required name="description" maxLength={250} defaultValue={modal.item?.description} placeholder="What does this category cover?" rows={3} /></label><label className="am-field">Status<select name="status" defaultValue={modal.item?.status || "Active"}><option>Active</option><option>Inactive</option></select></label><PreviewNote /></div><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="am-button">Save category</button></div></form></Dialog>}
  </section>;
}
