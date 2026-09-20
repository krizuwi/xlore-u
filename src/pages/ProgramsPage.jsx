import { ArrowRight, BookOpen, BriefcaseBusiness, Heart, School, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export function ProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [savedIds, setSavedIds] = useState(new Set());
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      const query = new URLSearchParams({ limit: "50" });
      if (search) query.set("search", search);
      if (category) query.set("category", category);
      api(`/programs?${query}`).then((data) => setPrograms(data.data)).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timeout);
  }, [search, category]);

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

  const categories = [...new Set(programs.map((program) => program.category))];
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-heading"><div><span className="section-kicker">Program explorer</span><h1>Understand your academic options.</h1><p>Explore descriptions, requirements, career paths, and institutions offering each program.</p></div><Link className="primary-btn" to="/compare-programs"><BookOpen size={17} /> Compare Programs</Link></div>
        <div className="catalog-toolbar"><div className="large-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programs or career fields" /></div><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
        <ErrorMessage message={error} />
        {loading ? <LoadingState label="Loading programs..." /> : <div className="program-grid">{programs.map((program) => {
          const saved = savedIds.has(program.id);
          return <article className="program-card" key={program.id}><div className="program-card-top"><div className="program-card-icon"><BookOpen /></div><button type="button" className={`save-btn program-save-btn ${saved ? "saved" : ""}`} onClick={() => toggleSaved(program)} disabled={busyId === program.id} aria-label={saved ? `Remove ${program.name} from saved programs` : `Save ${program.name}`}><Heart size={16} fill={saved ? "currentColor" : "none"} /><span>{saved ? "Saved" : "Save"}</span></button></div><span className="section-kicker">{program.category}</span><h2>{program.name}</h2><p>{program.description}</p><div className="program-meta"><span>{program.degreeLevel}</span><span>{program.schoolCount} {Number(program.schoolCount) === 1 ? "school" : "schools"}</span></div><div className="career-list"><strong><BriefcaseBusiness size={15} /> Possible careers</strong><div>{(program.careerPaths ?? []).slice(0, 3).map((career) => <span className="tag" key={career}>{career}</span>)}</div></div><div className="program-schools"><strong><School size={15} /> Offered by</strong>{(program.schools ?? []).length > 0 ? <div className="program-school-list">{program.schools.map((school) => <Link className="program-school-offering" to={`/schools/${school.id}`} key={school.id}><span><strong>{school.name}</strong><small>{school.city} · {school.schoolType}</small></span><em>View school <ArrowRight size={13} /></em></Link>)}</div> : <p className="program-school-empty">No offering institution is listed yet.</p>}</div><details><summary>Requirements and details</summary><p>{program.requirements}</p></details><div className="program-card-actions"><Link className="outline-btn link-btn" to={`/programs/${program.id}`}>View program <ArrowRight size={14} /></Link></div></article>;
        })}</div>}
      </div>
    </section>
  );
}
