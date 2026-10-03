import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Building2, ChevronDown, CircleCheck, Filter, GraduationCap, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ConfirmDelete, Dialog, Empty, PageFooter, PageHeading, PreviewNote, RowActions, SearchField, handleTabKey, matches, nextId, programSeed, universitySeed, usePreviewData } from "../shared.jsx";
import { FetchNormalizedPrograms } from "../../Request/dashboardApiRequest.jsx";
import "../management.css";

export function ProgramsManagement({ searchQuery = "" }) {
  const [programs, setPrograms] = usePreviewData("programs", programSeed);
  const [catalogRequest, setCatalogRequest] = useState({ loading: true, error: "" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [school, setSchool] = useState("All schools");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    FetchNormalizedPrograms({ signal: controller.signal }).then((records) => {
      if (controller.signal.aborted) return;
      setPrograms(records.map((record, index) => ({
        id: `${record.programName ?? "program"}-${record.university ?? "unknown"}-${index}`,
        name: record.programName ?? "Unnamed program",
        university: record.university ?? "—",
        category: record.category ?? "Uncategorized",
        degree: "—",
        subjects: "—",
        period: "—",
        description: "Program data from the live catalog.",
        tuition: "—"
      })));
      setCategory("All categories");
      setSchool("All schools");
      setPage(1);
      setCatalogRequest({ loading: false, error: "" });
    }).catch((error) => {
      if (!controller.signal.aborted) setCatalogRequest({ loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [setPrograms]);
  const selected = selectedId?.query === searchQuery ? programs.find((item) => item.id === selectedId.id) : null;
  const categoryOptions = [...new Set(programs.map((item) => item.category).filter((value) => typeof value === "string" && value.trim()))]
    .sort((left, right) => left.localeCompare(right));
  const schoolOptions = [...new Set(programs.map((item) => item.university).filter((value) => typeof value === "string" && value.trim()))]
    .sort((left, right) => left.localeCompare(right));
  const pageSize = 20;
  const filtered = programs.filter((item) => matches(`${item.name} ${item.university}`, query) && matches(`${item.name} ${item.university}`, searchQuery) && (category === "All categories" || item.category === category) && (school === "All schools" || item.university === school));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visiblePrograms = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  function save(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.name.trim() || !values.university.trim() || !values.description.trim()) return;
    const item = { ...values, id: modal.item?.id || nextId(programs), degree: "Bachelor’s Degree", subjects: modal.item?.subjects || "—", period: "June – August" };
    setPrograms((rows) => modal.item ? rows.map((row) => row.id === item.id ? item : row) : [...rows, item]);
    setNotice(`${item.name} saved to the local preview.`);
    setModal(null);
  }
  return <section className="am-page"><PageHeading title={selected ? "Program Details" : "Programs Management"} section="Programs" description={selected ? "Explore and manage the details of this academic program." : "Discover, review, and manage your catalog of academic programs."} action={selected ? undefined : "Add Program"} onAction={() => setModal({ mode: "edit" })} dataLabel={catalogRequest.loading ? "Loading catalog" : catalogRequest.error ? "Preview data" : "Live catalog"} />{notice && <div className="am-notice" role="status"><CircleCheck size={16} />{notice}</div>}{catalogRequest.error && <div className="am-notice" role="alert"><CircleCheck size={16} />Live catalog unavailable: {catalogRequest.error}</div>}
    {selected ? <><button className="am-back-link" onClick={() => setSelectedId(null)}><ArrowLeft size={14} />Back to programs</button><div className="am-card am-program-detail"><div className="am-program-hero"><div className="am-campus-art" aria-hidden="true"><div className="am-campus-cloud" /><div className="am-campus-building"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="am-campus-lawn" /><div className="am-campus-tree am-tree-left" /><div className="am-campus-tree am-tree-right" /></div><div className="am-program-title"><h2>{selected.name}</h2><div className="am-program-tags"><span>Undergraduate</span><span>{selected.category}</span></div><p><Building2 size={14} />{selected.university}</p></div><div className="am-program-hero-actions"><button className="am-button am-button-secondary" onClick={() => setModal({ mode: "edit", item: selected })}><Pencil size={14} />Edit</button></div></div><div className="am-tabs" role="tablist" aria-label="Program details">{["Overview", "Requirements", "Curriculum", "Related Programs"].map((item) => <button id={`am-tab-${item.replaceAll(" ", "-")}`} role="tab" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onKeyDown={(event) => handleTabKey(event, ["Overview", "Requirements", "Curriculum", "Related Programs"], tab, setTab)} aria-controls="am-program-panel" key={item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div><div className="am-program-content" id="am-program-panel" role="tabpanel" aria-labelledby={`am-tab-${tab.replaceAll(" ", "-")}`}>
      {tab === "Overview" && <><h3>Description</h3><p className="am-description">{selected.description}</p><dl className="am-detail-grid am-program-facts"><div><dt>Degree</dt><dd>{selected.degree}</dd></div><div><dt>Total subjects</dt><dd>{selected.subjects}</dd></div><div><dt>Tuition fee</dt><dd>{selected.tuition}</dd></div><div><dt>Category</dt><dd>{selected.category}</dd></div><div><dt>Enrollment period</dt><dd>{selected.period}</dd></div><div><dt>Level</dt><dd>Undergraduate</dd></div><div><dt>Record source</dt><dd>{catalogRequest.error ? "Preview catalog" : "Live catalog with local preview edits"}</dd></div></dl><p className="am-preview-note">Illustrative program information. Verify admissions and fees with the institution.</p></>}
      {tab === "Requirements" && <><h3>Admission requirements</h3><p className="am-description">Sample requirements for an undergraduate application.</p><ul className="am-check-list">{["Completed university application form", "Senior high school report card (Form 138)", "Certificate of good moral character", "PSA-issued birth certificate", "University entrance examination results"].map((item) => <li key={item}><CircleCheck size={16} />{item}</li>)}</ul><p className="am-preview-note">Requirements shown are examples. Confirm the current checklist with the admissions office.</p></>}
      {tab === "Curriculum" && <><h3>Curriculum overview</h3><p className="am-description">An illustrative four-year learning path.</p><div className="am-curriculum">{["Foundations & general education", "Core subjects & applied learning", "Specialization & advanced studies", "Capstone project & internship"].map((item, index) => <div key={item}><span>Year {index + 1}</span><strong>{item}</strong><BookOpen size={17} /></div>)}</div></>}
      {tab === "Related Programs" && <><h3>More in {selected.category}</h3><div className="am-related-programs">{programs.filter((item) => item.category === selected.category && item.id !== selected.id).map((item) => <button key={item.id} onClick={() => { setSelectedId({ id: item.id, query: searchQuery }); setTab("Overview"); }}><span className="am-profile-icon"><GraduationCap size={22} /></span><span><strong>{item.name}</strong><small>{item.university}</small></span><ArrowRight size={16} /></button>)}</div>{!programs.some((item) => item.category === selected.category && item.id !== selected.id) && <Empty title="No related programs yet" subtitle="Other programs in this category will appear here." />}</>}
    </div></div></> : <div className="am-card"><div className="am-card-toolbar"><SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search programs..." /><label className="am-filter"><Filter size={15} /><select aria-label="Filter program category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="All categories">All categories</option>{categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={13} /></label><label className="am-filter"><Filter size={15} /><select aria-label="Filter school" value={school} onChange={(event) => { setSchool(event.target.value); setPage(1); }}><option value="All schools">All schools</option>{schoolOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={13} /></label></div><div className="am-table-scroll"><table className="am-table"><thead><tr><th>Program name</th><th>University</th><th>Category</th><th className="am-actions-heading">Actions</th></tr></thead><tbody>{visiblePrograms.map((item) => <tr key={item.id}><td><button className="am-table-link" onClick={() => { setSelectedId({ id: item.id, query: searchQuery }); setTab("Overview"); }}>{item.name}</button></td><td>{item.university}</td><td><span className="am-type">{item.category}</span></td><td><RowActions name={item.name} onEdit={() => setModal({ mode: "edit", item })} onView={() => { setSelectedId({ id: item.id, query: searchQuery }); setTab("Overview"); }} onDelete={() => setModal({ mode: "delete", item })} /></td></tr>)}</tbody></table></div>{!filtered.length && <Empty />}<PageFooter count={filtered.length} page={currentPage} pageSize={pageSize} setPage={setPage} /></div>}
    {modal?.mode === "delete" && <ConfirmDelete name={modal.item.name} onClose={() => setModal(null)} onDelete={() => { setPrograms((rows) => rows.filter((row) => row.id !== modal.item.id)); setNotice("Program removed from the local preview."); setModal(null); }} />}
    {modal?.mode === "edit" && <Dialog title={modal.item ? "Edit Program" : "Add New Program"} onClose={() => setModal(null)} wide><form onSubmit={save}><div className="am-dialog-body"><label className="am-field">Program name <span>*</span><input required maxLength={120} name="name" defaultValue={modal.item?.name} placeholder="e.g. BS Information Technology" autoFocus /></label><label className="am-field">University <span>*</span><input required maxLength={120} name="university" defaultValue={modal.item?.university} placeholder="University name" list="am-university-options" /><datalist id="am-university-options">{universitySeed.map((item) => <option key={item.id} value={item.name} />)}</datalist></label><div className="am-form-grid"><label className="am-field">Category<select name="category" defaultValue={modal.item?.category || "STEM"}>{[...new Set([...categoryOptions, "STEM", "ABM", "HUMSS", "GAS", "TVL"])].map((item) => <option key={item}>{item}</option>)}</select></label></div><label className="am-field">Tuition fee<input name="tuition" maxLength={80} defaultValue={modal.item?.tuition} placeholder="e.g. ₱ 56,000 / year" /></label><label className="am-field">Description <span>*</span><textarea required name="description" maxLength={2000} defaultValue={modal.item?.description} rows={3} placeholder="Tell students about this program" /></label><PreviewNote /></div><div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" onClick={() => setModal(null)}>Cancel</button><button className="am-button">Save program</button></div></form></Dialog>}
  </section>;
}
