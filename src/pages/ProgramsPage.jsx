import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { ProgramCard } from "../components/ProgramCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useLiveRefresh } from "../context/EngagementContext.jsx";
import { usePublicPageData } from "../context/PublicPageData.js";
import { accountQueryKey } from "../lib/queryClient.js";
import { api } from "../lib/api.js";
import { catalogOptionList } from "../lib/assessmentProgramFilters.js";
import "./ProgramsPage.css";

const PAGE_SIZE = 12;
const EMPTY_PAGINATION = { page: 1, pages: 1, total: 0 };

export function ProgramsPage() {
  const initial = usePublicPageData();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [savedOverrides, setSavedOverrides] = useState({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const { user } = useAuth();
  const queryCache = useQueryClient();
  const navigate = useNavigate();

  const programsQuery = useQuery({
    queryKey: ["catalog", "programs", submittedSearch, category, page],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
      if (submittedSearch) params.set("search", submittedSearch);
      if (category) params.set("category", category);
      return api(`/programs?${params}`, { signal });
    },
    // Keep the last cards on screen during a new search/filter request.
    placeholderData: previous => previous,
    initialData: initial && !submittedSearch && !category && page === 1 ? initial.catalog : undefined
  });
  const filtersQuery = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => api("/schools/meta/filters", { signal }),
    initialData: initial?.filters,
    staleTime: 5 * 60_000
  });
  const savedQuery = useQuery({
    queryKey: accountQueryKey(user, "saved"),
    queryFn: ({ signal }) => api("/saved", { signal }),
    enabled: Boolean(user),
    staleTime: 30_000
  });

  const defaultCatalog = !submittedSearch && !category && page === 1 ? initial?.catalog : undefined;
  const programs = programsQuery.data?.data ?? defaultCatalog?.data ?? [];
  const pagination = programsQuery.data?.pagination ?? defaultCatalog?.pagination ?? EMPTY_PAGINATION;
  const loading = programsQuery.isPending || programsQuery.isFetching;
  const programError = programsQuery.error?.message ?? "";
  const categoryOptions = filtersQuery.data?.specializations ?? [];
  const savedIds = useMemo(() => {
    const ids = new Set((savedQuery.data?.programs ?? []).map(program => program.id));
    for (const [id, saved] of Object.entries(savedOverrides)) {
      if (saved) ids.add(id);
      else ids.delete(id);
    }
    return ids;
  }, [savedQuery.data, savedOverrides]);

  // Refresh the currently selected catalog query when the page becomes active again.
  useLiveRefresh(() => { void programsQuery.refetch(); }, {
    enabled: !programsQuery.isPending && !busyId,
    key: `${submittedSearch}:${category}:${page}:${user?.id ?? ""}`
  });

  useEffect(() => {
    const pages = Math.max(1, Number(pagination.pages));
    if (page > pages) setPage(pages);
  }, [page, pagination.pages]);

  useEffect(() => {
    setSavedOverrides({});
  }, [user?.id]);

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
      setSavedOverrides(current => ({ ...current, [program.id]: !saved }));
      void queryCache.invalidateQueries({ queryKey: accountQueryKey(user, "saved") });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId("");
    }
  };

  const categories = catalogOptionList([
    ...categoryOptions,
    category,
    ...programs.map(program => program.category)
  ]);
  const pageNumbers = [...new Set([1, pagination.page - 1, pagination.page, pagination.page + 1, pagination.pages])]
    .filter(value => value >= 1 && value <= pagination.pages)
    .sort((a, b) => a - b);

  function changePage(nextPage) {
    if (loading || nextPage === pagination.page) return;
    setPage(nextPage);
    document.getElementById("program-results")?.scrollIntoView({ block: "start" });
  }

  return (
    <section className="page-shell programs-page">
      <div className="container">
        <div className="page-heading">
          <div>
            <span className="section-kicker">Program explorer</span>
            <h1>Understand your academic options.</h1>
            <p>Explore descriptions, requirements, career paths, and institutions offering each program. <Link to="/guides/read-your-assessment">Learn how to build a program shortlist.</Link></p>
          </div>
          <Link className="primary-btn" to="/comparison#program-comparison"><BookOpen size={17} /> Compare Programs</Link>
        </div>

        <div className="catalog-toolbar">
          <div className="large-search">
            <Search />
            <input
              type="search"
              maxLength={200}
              value={search}
              aria-label="Search programs"
              aria-describedby="program-search-help"
              onChange={event => { setSearch(event.target.value); setPage(1); }}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setSubmittedSearch(search.trim());
                  setPage(1);
                }
              }}
              placeholder="e.g. BSIT, nursing UST, engineering Manila"
            />
          </div>
          <select value={category} aria-label="Filter program category" onChange={event => { setCategory(event.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {categories.map(value => <option key={value}>{value}</option>)}
          </select>
        </div>
        <p id="program-search-help" className="search-help">Type a program, abbreviation, career, school, or location, then press Enter to search. Combine keywords in any order.</p>
        <ErrorMessage message={error} />
        <div id="program-results" aria-busy={loading}>
          <ErrorMessage message={programError} />
          {programError && <button type="button" className="secondary-btn" onClick={() => void programsQuery.refetch()}>Try again</button>}
          {programsQuery.isPending && !programError
            ? <LoadingState label="Loading programs..." />
            : programs.length > 0 && <div className="program-grid">{programs.map(program => <ProgramCard key={program.id} program={program} saved={savedIds.has(program.id)} onToggleSaved={toggleSaved} saving={busyId === program.id} />)}</div>}
          {!loading && !programError && programs.length === 0 && <div className="empty-state"><BookOpen className="empty-icon" /><h3>No matching programs</h3><p>Try another search or choose a different category.</p></div>}
        </div>
        {!programError && pagination.total > 0 && <div className="program-pagination-footer">
          <p className="program-pagination-summary" role="status">{loading ? "Updating programs…" : `Showing ${(pagination.page - 1) * PAGE_SIZE + 1}–${Math.min(pagination.page * PAGE_SIZE, pagination.total)} of ${pagination.total} programs`}</p>
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
