import { Fragment, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";

export const universitySeed = [
  { id: 1, name: "University of the Philippines", type: "Public", location: "Quezon City", programs: 56, status: "Active", website: "https://up.edu.ph" },
  { id: 2, name: "Mapúa University", type: "Private", location: "Manila", programs: 42, status: "Active", website: "https://www.mapua.edu.ph" },
  { id: 3, name: "De La Salle University", type: "Private", location: "Manila", programs: 38, status: "Active", website: "https://www.dlsu.edu.ph" },
  { id: 4, name: "Ateneo de Manila University", type: "Private", location: "Quezon City", programs: 31, status: "Active", website: "https://www.ateneo.edu" },
  { id: 5, name: "STI College", type: "Private", location: "Various", programs: 28, status: "Active", website: "https://www.sti.edu" },
  { id: 6, name: "Technological University of the Philippines", type: "Public", location: "Manila", programs: 24, status: "Active", website: "https://www.tup.edu.ph" },
  { id: 7, name: "University of Santo Tomas", type: "Private", location: "Manila", programs: 45, status: "Active", website: "https://www.ust.edu.ph" },
  { id: 8, name: "Polytechnic University of the Philippines", type: "Public", location: "Manila", programs: 36, status: "Inactive", website: "https://www.pup.edu.ph" },
];
export const categorySeed = [
  { id: 1, name: "STEM", description: "Science, Technology, Engineering, and Mathematics", programs: 124, status: "Active" },
  { id: 2, name: "ABM", description: "Accountancy, Business, and Management", programs: 98, status: "Active" },
  { id: 3, name: "HUMSS", description: "Humanities and Social Sciences", programs: 76, status: "Active" },
  { id: 4, name: "GAS", description: "General Academic Strand", programs: 45, status: "Active" },
  { id: 5, name: "TVL", description: "Technical-Vocational-Livelihood", programs: 32, status: "Active" },
];
export const programSeed = [
  { id: 1, name: "BS Information Technology", university: "University of the Philippines", category: "STEM", degree: "Bachelor’s Degree", duration: "4 years", tuition: "₱ 56,000 / year", subjects: "45", period: "June – August", description: "The Bachelor of Science in Information Technology program provides students with the knowledge and skills needed to design, develop, and manage information systems and technology solutions.", status: "Active" },
  { id: 2, name: "BS Computer Science", university: "De La Salle University", category: "STEM", degree: "Bachelor’s Degree", duration: "4 years", tuition: "₱ 120,000 / year", subjects: "48", period: "May – July", description: "Build a strong foundation in computing, algorithms, software engineering, and intelligent systems through hands-on learning and research.", status: "Active" },
  { id: 3, name: "BS Business Administration", university: "Mapúa University", category: "ABM", degree: "Bachelor’s Degree", duration: "4 years", tuition: "₱ 90,000 / year", subjects: "42", period: "June – August", description: "Explore modern business management, finance, entrepreneurship, and marketing through practical projects and industry-based learning.", status: "Active" },
  { id: 4, name: "BA Communication", university: "Ateneo de Manila University", category: "HUMSS", degree: "Bachelor’s Degree", duration: "4 years", tuition: "₱ 110,000 / year", subjects: "44", period: "May – July", description: "Develop the creative and critical skills to tell meaningful stories across journalism, film, digital media, and strategic communication.", status: "Active" },
  { id: 5, name: "BS Civil Engineering", university: "Technological University of the Philippines", category: "STEM", degree: "Bachelor’s Degree", duration: "4 years", tuition: "₱ 45,000 / year", subjects: "52", period: "June – August", description: "Study the design, construction, and maintenance of infrastructure with a focus on sustainable engineering and community development.", status: "Active" },
];
export const jobSeed = [
  { id: 1, target: "TUP Taguig", type: "Full scrape", status: "Completed", started: "Sep 28, 2026 · 08:12", records: 2843 },
  { id: 2, target: "UMak", type: "Full scrape", status: "Completed", started: "Sep 28, 2026 · 07:34", records: 1205 },
  { id: 3, target: "UP Diliman", type: "Incremental", status: "Failed", started: "Sep 28, 2026 · 06:27", records: 0 },
  { id: 4, target: "PUP", type: "Full scrape", status: "Completed", started: "Sep 27, 2026 · 22:17", records: 684 },
  { id: 5, target: "FEU", type: "Full scrape", status: "Completed", started: "Sep 27, 2026 · 20:03", records: 432 },
];

export function usePreviewData(key, initial) {
  const [data, setData] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`xlore-admin-${key}`));
      return saved && Array.isArray(saved) === Array.isArray(initial) ? saved : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(`xlore-admin-${key}`, JSON.stringify(data)); } catch { /* Preview remains usable if storage is unavailable. */ }
  }, [data, key]);
  return [data, setData];
}

export function Dialog({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={`am-dialog${wide ? " am-dialog-wide" : ""}`} aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="am-dialog-head"><h2>{title}</h2><button className="am-icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
    {children}
  </dialog>;
}

export function ConfirmDelete({ name, onClose, onDelete }) {
  return <Dialog title="Delete this record?" onClose={onClose}><div className="am-dialog-body"><div className="am-delete-symbol"><Trash2 size={24} /></div><p>Remove <strong>{name}</strong> from your local demo data? This cannot be undone.</p></div><div className="am-dialog-actions"><button className="am-button am-button-secondary" onClick={onClose}>Cancel</button><button className="am-button am-button-danger" onClick={onDelete}>Delete record</button></div></Dialog>;
}

export function PageHeading({ title, description, section, action, onAction, dataLabel = "Demo data" }) {
  return <div className="am-page-heading"><div><div className="am-breadcrumb">Admin <ChevronRight size={12} /> {section || title}</div><h1>{title}</h1><p>{description}</p></div><div className="am-heading-actions"><span className="am-demo">{dataLabel}</span>{action && <button className="am-button" onClick={onAction}><Plus size={16} />{action}</button>}</div></div>;
}
export function Badge({ children }) { return <span className={`am-badge ${children === "Failed" ? "am-badge-red" : ["Inactive", "Unknown", "Draft"].includes(children) ? "am-badge-gray" : children === "Queued" ? "am-badge-blue" : ""}`}><span />{children}</span>; }
export function SearchField({ value, onChange, placeholder }) { return <div className="am-search"><Search size={16} /><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></div>; }
export function Empty({ title = "No matching records", subtitle = "Try a different search or adjust your filters." }) { return <div className="am-empty"><Search size={27} /><h3>{title}</h3><p>{subtitle}</p></div>; }
export function PageFooter({ count, page, pageSize, setPage }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const visiblePages = [...new Set([1, page - 1, page, page + 1, pages])].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  return (
    <div className="am-table-footer">
      <span>Showing {count ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, count)} of {count}</span>
      <nav className="am-pagination" aria-label="Table pagination">
        <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /></button>
        {visiblePages.map((value, index) => (
          <Fragment key={value}>
            {index > 0 && value - visiblePages[index - 1] > 1 && <span className="am-pagination-gap" aria-hidden="true">…</span>}
            <button type="button" aria-label={`Page ${value}`} aria-current={page === value ? "page" : undefined} className={page === value ? "is-active" : ""} onClick={() => setPage(value)}>{value}</button>
          </Fragment>
        ))}
        <button type="button" aria-label="Next page" disabled={page === pages} onClick={() => setPage(page + 1)}><ChevronRight size={14} /></button>
      </nav>
    </div>
  );
}
export function RowActions({ name, onView, onEdit, onDelete, deleteLabel = "Delete" }) {
  return <div className="am-row-actions">{onEdit && <button aria-label={`Edit ${name}`} title="Edit" onClick={onEdit}><Pencil size={14} /></button>}{onView && <button aria-label={`View ${name}`} title="View details" onClick={onView}><Eye size={14} /></button>}{onDelete && <button className="am-delete" aria-label={`${deleteLabel} ${name}`} title={deleteLabel} onClick={onDelete}><Trash2 size={14} /></button>}</div>;
}
export function PreviewNote({ persistent = true }) { return <p className="am-preview-note">{persistent ? "Changes are saved in this browser for preview." : "Changes are for this preview session and reset when you leave this page."} No live records are changed.</p>; }
export function nextId(items) { return items.reduce((max, item) => Number.isSafeInteger(Number(item.id)) ? Math.max(max, Number(item.id)) : max, 0) + 1; }
export function matches(value, query) { return value.toLowerCase().includes(query.trim().toLowerCase()); }
export function handleTabKey(event, items, selected, onChange) {
  const index = items.indexOf(selected);
  const next = event.key === "ArrowRight" ? (index + 1) % items.length : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
  if (next < 0) return;
  event.preventDefault();
  onChange(items[next]);
  event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
}
