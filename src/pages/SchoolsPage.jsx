import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { SchoolCard } from "../components/SchoolCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { useLiveRefresh } from "../context/EngagementContext.jsx";

export function SchoolsPage() {
  const [params, setParams] = useSearchParams();
  const [schools, setSchools] = useState([]);
  const [meta, setMeta] = useState({ cities: [], schoolTypes: [], strands: [], specializations: [] });
  const [savedIds, setSavedIds] = useState(new Set());
  const [comparedIds, setComparedIds] = useState(new Set());
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const query = useMemo(() => {
    const output = new URLSearchParams(params);
    output.set("limit", "8");
    return output.toString();
  }, [params]);

  useLiveRefresh(async signal => {
    const data = await api(`/schools?${query}`, { signal });
    if (signal.aborted) return;
    setSchools(data.data); setPagination(data.pagination); setError("");
    const filters = await api("/schools/meta/filters", { signal });
    if (!signal.aborted) setMeta(filters);
    if (user) {
      const [saved, comparison] = await Promise.all([api("/saved", { signal }), api("/comparison", { signal })]);
      if (!signal.aborted) { setSavedIds(new Set(saved.schools.map(s => s.id))); setComparedIds(new Set(comparison.schools.map(s => s.id))); }
    }
  }, { enabled: !loading && !busyId, key: `${query}:${user?.id ?? ""}` });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const timeout = setTimeout(() => {
      api(`/schools?${query}`, { signal: controller.signal }).then(data => {
        if (!controller.signal.aborted) { setSchools(data.data); setPagination(data.pagination); }
      }).catch(requestError => {
        if (!controller.signal.aborted) setError(requestError.message);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query]);
  useEffect(() => { api("/schools/meta/filters").then(setMeta).catch(() => {}); }, []);
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); setComparedIds(new Set()); return; }
    Promise.all([api("/saved"), api("/comparison")]).then(([saved, comparison]) => {
      setSavedIds(new Set(saved.schools.map((school) => school.id)));
      setComparedIds(new Set(comparison.schools.map((school) => school.id)));
    }).catch(() => {});
  }, [user]);

  const setFilter = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    if (name !== "page") next.delete("page");
    setParams(next);
  };

  const requireUser = () => { if (!user) { navigate("/login", { state: { from: "/schools" } }); return false; } return true; };
  const toggleSaved = async (school) => {
    if (!requireUser()) return;
    setBusyId(school.id);
    try {
      const saved = savedIds.has(school.id);
      await api(`/saved/schools/${school.id}`, { method: saved ? "DELETE" : "POST" });
      setSavedIds((current) => { const next = new Set(current); saved ? next.delete(school.id) : next.add(school.id); return next; });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  };
  const toggleCompare = async (school) => {
    if (!requireUser()) return;
    setBusyId(school.id);
    try {
      const compared = comparedIds.has(school.id);
      await api(`/comparison/schools/${school.id}`, { method: compared ? "DELETE" : "POST" });
      setComparedIds((current) => { const next = new Set(current); compared ? next.delete(school.id) : next.add(school.id); return next; });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  };

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-heading"><div><span className="section-kicker">School directory</span><h1>Explore Metro Manila institutions.</h1><p>Search, filter, save, and compare schools based on the factors that matter to you.</p></div><div className="compare-counter"><span>{comparedIds.size}</span> of 3 schools compared</div></div>
        <ErrorMessage message={error} />
        <div className="directory-layout">
          <aside className="filter-panel">
            <h3><SlidersHorizontal size={18} /> Filters</h3>
            <label className="filter-label" htmlFor="school-search">Keyword</label>
            <div className="compact-search"><Search size={16} /><input id="school-search" type="search" maxLength={200} className="filter-input" value={params.get("search") ?? ""} onChange={(event) => setFilter("search", event.target.value)} placeholder="e.g. PUP, BSIT Manila" aria-describedby="school-search-help" /></div>
            <p id="school-search-help" className="search-help">Use a school name, abbreviation, program, or location. Keywords can be in any order.</p>
            <div className="filter-group"><label className="filter-label">City</label><select className="filter-input" value={params.get("city") ?? ""} onChange={(event) => setFilter("city", event.target.value)}><option value="">All cities</option>{meta.cities.map((value) => <option key={value}>{value}</option>)}</select></div>
            <div className="filter-group"><label className="filter-label">School type</label><div className="filter-options"><button className={`filter-chip ${!params.get("schoolType") ? "active" : ""}`} onClick={() => setFilter("schoolType", "")}>All</button>{meta.schoolTypes.map((value) => <button key={value} className={`filter-chip ${params.get("schoolType") === value ? "active" : ""}`} onClick={() => setFilter("schoolType", value)}>{value}</button>)}</div></div>
            <div className="filter-group"><label className="filter-label">SHS strand</label><select className="filter-input" value={params.get("strand") ?? ""} onChange={(event) => setFilter("strand", event.target.value)}><option value="">All strands</option>{meta.strands.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}</select></div>
            <div className="filter-group"><label className="filter-label">Maximum tuition</label><select className="filter-input" value={params.get("maxTuition") ?? ""} onChange={(event) => setFilter("maxTuition", event.target.value)}><option value="">Any amount</option><option value="30000">Up to ₱30,000</option><option value="70000">Up to ₱70,000</option><option value="100000">Up to ₱100,000</option></select></div>
            <div className="filter-note"><strong><Filter size={13} /> Tip</strong><p>Take the assessment first to see match scores alongside recommended institutions.</p></div>
          </aside>
          <div>
            <div className="results-toolbar"><p role="status"><strong>{pagination.total}</strong> institutions found</p><select aria-label="Sort school results" value={params.get("sort") ?? (params.get("search")?.trim() ? "relevance" : "name")} onChange={(event) => setFilter("sort", event.target.value)}><option value="relevance">Best keyword match</option><option value="name">Name A-Z</option><option value="rating">Highest rating</option><option value="tuition_low">Lowest tuition</option><option value="tuition_high">Highest tuition</option></select></div>
            {loading ? <LoadingState label="Loading institutions..." /> : schools.length ? <div className="school-grid directory-grid">{schools.map((school) => <SchoolCard key={school.id} school={school} saved={savedIds.has(school.id)} compared={comparedIds.has(school.id)} onSave={toggleSaved} onCompare={toggleCompare} busy={busyId === school.id} />)}</div> : <div className="empty-state large-empty"><Search className="empty-icon" /><h3>No schools found</h3><p>Try changing or clearing some filters.</p></div>}
            {pagination.pages > 1 && <div className="pagination"><button disabled={pagination.page <= 1} onClick={() => setFilter("page", String(pagination.page - 1))}>Previous</button><span>Page {pagination.page} of {pagination.pages}</span><button disabled={pagination.page >= pagination.pages} onClick={() => setFilter("page", String(pagination.page + 1))}>Next</button></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
