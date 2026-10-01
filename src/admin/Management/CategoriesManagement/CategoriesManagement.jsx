import { useEffect, useState } from "react";
import { ChevronDown, CircleAlert, CircleCheck, Filter, GraduationCap, RefreshCw } from "lucide-react";
import { Dialog, Empty, PageFooter, PageHeading, PreviewNote, RowActions, SearchField, matches } from "../shared.jsx";
import { FetchNormalizedPrograms } from "../../Request/dashboardApiRequest.jsx";
import "../management.css";

const PAGE_SIZE = 20;

export function CategoriesManagement({ searchQuery = "" }) {
  const [programs, setPrograms] = useState([]);
  const [catalogRequest, setCatalogRequest] = useState({ loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [school, setSchool] = useState("");
  const [page, setPage] = useState(1);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [notice, setNotice] = useState("");
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogRequest({ loading: true, error: "" });
    FetchNormalizedPrograms({ signal: controller.signal }).then((records) => {
      if (controller.signal.aborted) return;
      setPrograms(records.map((record, index) => ({
        id: `${record.programName ?? "program"}-${record.university ?? "unknown"}-${index}`,
        name: record.programName ?? "Unnamed program",
        university: record.university ?? "—",
        category: record.category ?? "Uncategorized",
      })));
      setCategory("");
      setPage(1);
      setHasLocalEdits(false);
      setCatalogRequest({ loading: false, error: "" });
    }).catch((error) => {
      if (!controller.signal.aborted) setCatalogRequest({ loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [revision]);

  const categoryOptions = [...new Set(programs.map((item) => item.category))]
    .sort((left, right) => left.localeCompare(right));
  const schoolOptions = [...new Set(programs.map((item) => item.university).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const filtered = programs.filter((item) => {
    const searchable = `${item.name} ${item.university} ${item.category}`;
    return matches(searchable, query) && matches(searchable, searchQuery)
      && (!category || item.category === category)
      && (!school || item.university === school);
  });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const visiblePrograms = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function saveCategory(event) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("category");
    const value = field.value.trim();
    if (!value) {
      field.setCustomValidity("Enter a category name.");
      field.reportValidity();
      return;
    }
    setPrograms((current) => current.map((item) => item.id === selectedProgram.id ? { ...item, category: value } : item));
    setHasLocalEdits(true);
    setNotice(`Category for ${selectedProgram.name} updated in this preview session.`);
    setSelectedProgram(null);
  }

  return (
    <section className="am-page">
      <PageHeading
        title="Category Management"
        section="Categories"
        description="Review and organize categories using the same program catalog as Programs."
        dataLabel={catalogRequest.loading ? "Loading catalog" : catalogRequest.error ? "Catalog unavailable" : hasLocalEdits ? "Live catalog · Local edits" : "Live catalog"}
      />
      {notice && <div className="am-notice" role="status"><CircleCheck size={16} />{notice}</div>}
      {catalogRequest.error && (
        <div className="am-notice" role="alert">
          <CircleAlert size={16} />
          <span>Unable to load program categories: {catalogRequest.error}</span>
          <button type="button" className="am-button am-button-secondary" onClick={() => setRevision((current) => current + 1)}><RefreshCw size={14} />Retry</button>
        </div>
      )}
      <div className="am-card" aria-busy={catalogRequest.loading}>
        <div className="am-card-toolbar">
          <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search program names, universities, or categories..." />
          <label className="am-filter">
            <Filter size={15} />
            <select aria-label="Filter program category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {categoryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <ChevronDown size={13} />
          </label>
          <label className="am-filter">
            <Filter size={15} />
            <select aria-label="Filter school" value={school} onChange={(event) => { setSchool(event.target.value); setPage(1); }}>
              <option value="">All schools</option>
              {schoolOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <ChevronDown size={13} />
          </label>
        </div>
        {catalogRequest.loading ? <div className="am-empty" role="status"><GraduationCap size={27} /><p>Loading program categories…</p></div> : !catalogRequest.error && <>
          <div className="am-table-scroll">
            <table className="am-table">
              <thead><tr><th scope="col">Program name</th><th scope="col">University</th><th scope="col">Category</th><th scope="col" className="am-actions-heading">Actions</th></tr></thead>
              <tbody>{visiblePrograms.map((item) => (
                <tr key={item.id}>
                  <td><span className="am-category-name">{item.name}</span></td>
                  <td>{item.university}</td>
                  <td><span className="am-type">{item.category}</span></td>
                  <td><RowActions name={`category for ${item.name} at ${item.university}`} onEdit={() => setSelectedProgram(item)} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {!filtered.length && <Empty title={programs.length ? "No matching programs" : "No programs available"} subtitle={programs.length ? "Try another program name, university, or category." : "Program categories will appear when records are available in the catalog."} />}
          <PageFooter count={filtered.length} page={currentPage} pageSize={PAGE_SIZE} setPage={setPage} />
        </>}
      </div>
      <div className="am-information"><GraduationCap size={20} /><div><strong>Categories from your program catalog</strong><p>Program names, universities, and categories come directly from the Programs response. Missing values are shown as unavailable.</p></div></div>
      {selectedProgram && (
        <Dialog title="Edit Program Category" onClose={() => setSelectedProgram(null)}>
          <form onSubmit={saveCategory}>
            <div className="am-dialog-body">
              <label className="am-field">Program name<input value={selectedProgram.name} readOnly /></label>
              <label className="am-field">University<input value={selectedProgram.university} readOnly /></label>
              <label className="am-field">Category <span>*</span><input required name="category" maxLength={120} defaultValue={selectedProgram.category === "Uncategorized" ? "" : selectedProgram.category} list="am-program-category-options" placeholder="Enter a category" onInput={(event) => event.currentTarget.setCustomValidity("")} autoFocus /></label>
              <datalist id="am-program-category-options">{categoryOptions.map((item) => <option key={item} value={item} />)}</datalist>
              <PreviewNote persistent={false} />
            </div>
            <div className="am-dialog-actions"><button type="button" className="am-button am-button-secondary" onClick={() => setSelectedProgram(null)}>Cancel</button><button type="submit" className="am-button">Save category</button></div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
