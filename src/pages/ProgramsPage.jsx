import { ArrowRight, BookOpen, BriefcaseBusiness, ChevronLeft, ChevronRight, Heart, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { useLiveRefresh } from "../context/EngagementContext.jsx";
import { ProgramSchoolOfferings } from "../components/ProgramSchoolOfferings.jsx";
import "./ProgramsPage.css";

const PAGE_SIZE = 12;

export function ProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [requestVersion, setRequestVersion] = useState(0);
  const [programError, setProgramError] = useState("");
  const [savedIds, setSavedIds] = useState(new Set());
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  useLiveRefresh(async signal => {
    const query = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    if (search) query.set("search", search);
    if (category) query.set("category", category);
    const data = await api(`/programs?${query}`, { signal });
    if (signal.aborted) return;
    const pages = Math.max(1, Number(data.pagination.pages));
    if (page > pages) { setPage(pages); return; }
    setPrograms(data.data); setPagination({ page: Number(data.pagination.page), pages, total: Number(data.pagination.total) }); setProgramError("");
    const filters = await api("/schools/meta/filters", { signal });
    if (!signal.aborted) setCategoryOptions(filters.specializations || []);
    if (user) {
      const saved = await api("/saved", { signal });
      if (!signal.aborted) setSavedIds(new Set(saved.programs.map(p => p.id)));
    }
  }, { enabled: !loading && !busyId, key: `${search}:${category}:${page}:${user?.id ?? ""}` });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setProgramError("");
    const timeout = setTimeout(() => {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
      if (search) query.set("search", search);
      if (category) query.set("category", category);
      api(`/programs?${query}`, { signal: controller.signal }).then((data) => {
        if (controller.signal.aborted) return;
        const pages = Math.max(1, Number(data.pagination.pages));
        if (page > pages) { setPage(pages); return; }
        setPrograms(data.data);
        setPagination({ page: Number(data.pagination.page), pages, total: Number(data.pagination.total) });
      }).catch((requestError) => {
        if (!controller.signal.aborted) setProgramError(requestError.message);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 200);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [search, category, page, requestVersion]);

  useEffect(() => {
    const controller = new AbortController();
    api("/schools/meta/filters", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setCategoryOptions(data.specializations || []); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    api("/saved")
      .then((saved) => setSavedIds(new Set(saved.programs.map((program) => program.id))))
      .catch((requestError) => setError(requestError.message));
  }, [user]);

  const toggleSaved = async (program) => {
    if (!user) {
      navigate("/login", {
        state: {
          from: "/programs",
          message: "Sign in or create an account to save programs."
        }
      });
      return;
    }

    setBusyId(program.id);
    setError("");
    try {
      const saved = savedIds.has(program.id);
      await api(`/saved/programs/${program.id}`, { method: saved ? "DELETE" : "POST" });
      setSavedIds((current) => {
        const next = new Set(current);
        saved ? next.delete(program.id) : next.add(program.id);
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  };

  const categories = [...new Set([...categoryOptions, category, ...programs.map((program) => program.category)].filter(Boolean))].sort();
  const pageNumbers = [...new Set([1, pagination.page - 1, pagination.page, pagination.page + 1, pagination.pages])]
    .filter((value) => value >= 1 && value <= pagination.pages).sort((a, b) => a - b);
  function changePage(nextPage) {
    if (loading || nextPage === pagination.page) return;
    setLoading(true);
    setPage(nextPage);
    document.getElementById("program-results")?.scrollIntoView({ block: "start" });
  }
  return (
    <section className="page-shell programs-page">
      <div className="container">
        <div className="page-heading"><div><span className="section-kicker">Program explorer</span><h1>Understand your academic options.</h1><p>Explore descriptions, requirements, career paths, and institutions offering each program.</p></div><Link className="primary-btn" to="/comparison#program-comparison"><BookOpen size={17} /> Compare Programs</Link></div>
        <div className="catalog-toolbar"><div className="large-search"><Search /><input type="search" maxLength={200} value={search} aria-label="Search programs" aria-describedby="program-search-help" onChange={(event) => { setSearch(event.target.value); setPage(1); setLoading(true); }} placeholder="e.g. BSIT, nursing UST, engineering Manila" /></div><select value={category} aria-label="Filter program category" onChange={(event) => { setCategory(event.target.value); setPage(1); setLoading(true); }}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
        <p id="program-search-help" className="search-help">Search by program, abbreviation, career, offering school, or location. Combine keywords in any order.</p>
        <ErrorMessage message={error} />
        <div id="program-results" aria-busy={loading}>
        <ErrorMessage message={programError} />
        {programError && <button type="button" className="secondary-btn" onClick={() => setRequestVersion((current) => current + 1)}>Try again</button>}
        {loading ? <LoadingState label="Loading programs..." /> : !programError && <div className="program-grid">{programs.map((program) => {
          const saved = savedIds.has(program.id);
          return <article className="program-card" key={program.id}><div className="program-card-top"><div className="program-card-icon"><BookOpen /></div><button type="button" className={`save-btn program-save-btn ${saved ? "saved" : ""}`} onClick={() => toggleSaved(program)} disabled={busyId === program.id} aria-label={saved ? `Remove ${program.name} from saved programs` : `Save ${program.name}`}><Heart size={16} fill={saved ? "currentColor" : "none"} /><span>{saved ? "Saved" : "Save"}</span></button></div><span className="section-kicker">{program.category}</span><h2>{program.name}</h2><p>{program.description}</p><div className="program-meta"><span>{program.degreeLevel}</span><span>{program.schoolCount} {Number(program.schoolCount) === 1 ? "school" : "schools"}</span></div><div className="career-list"><strong><BriefcaseBusiness size={15} /> Possible careers</strong><div>{(program.careerPaths ?? []).slice(0, 3).map((career) => <span className="tag" key={career}>{career}</span>)}</div></div><ProgramSchoolOfferings schools={program.schools ?? []} programName={program.name} /><details><summary>Requirements and details</summary><p>{program.requirements}</p></details><div className="program-card-actions"><Link className="outline-btn link-btn" to={`/programs/${program.id}`}>View program <ArrowRight size={14} /></Link></div></article>;
        })}</div>}
        {!loading && !programError && programs.length === 0 && <div className="empty-state"><BookOpen className="empty-icon" /><h3>No matching programs</h3><p>Try another search or choose a different category.</p></div>}
        </div>
        {!programError && pagination.total > 0 && <div className="program-pagination-footer">
          <p className="program-pagination-summary" role="status">{loading ? "Loading programs…" : `Showing ${(pagination.page - 1) * PAGE_SIZE + 1}–${Math.min(pagination.page * PAGE_SIZE, pagination.total)} of ${pagination.total} programs`}</p>
          {pagination.pages > 1 && <nav className="program-pagination" aria-label="Programs pagination">
            <button type="button" className="program-pagination-step" disabled={loading || pagination.page <= 1} onClick={() => changePage(pagination.page - 1)} aria-label="Previous page" aria-controls="program-results"><ChevronLeft size={16} aria-hidden="true" /><span>Previous</span></button>
            <div className="program-pagination-numbers">{pageNumbers.map((value, index) => <span className="program-pagination-item" key={value}>{index > 0 && value - pageNumbers[index - 1] > 1 && <span className="program-pagination-ellipsis" aria-hidden="true">…</span>}<button type="button" aria-label={`Page ${value}`} aria-current={pagination.page === value ? "page" : undefined} aria-controls="program-results" disabled={loading} onClick={() => changePage(value)}>{value}</button></span>)}</div>
            <span className="program-pagination-mobile-status">Page <strong>{pagination.page}</strong> of {pagination.pages}</span>
            <button type="button" className="program-pagination-step" disabled={loading || pagination.page >= pagination.pages} onClick={() => changePage(pagination.page + 1)} aria-label="Next page" aria-controls="program-results"><span>Next</span><ChevronRight size={16} aria-hidden="true" /></button>
          </nav>}
        </div>}
      </div>
    </section>
  );
}
