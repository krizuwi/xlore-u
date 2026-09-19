import { ArrowRight, BookOpen, BriefcaseBusiness, School, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { api } from "../lib/api.js";

export function ProgramsPage() {
  const [programs, setPrograms] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
  const categories = [...new Set(programs.map((program) => program.category))];
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-heading"><div><span className="section-kicker">Program explorer</span><h1>Understand your academic options.</h1><p>Explore descriptions, requirements, career paths, and institutions offering each program.</p></div><Link className="primary-btn" to="/compare-programs"><BookOpen size={17} /> Compare Programs</Link></div>
        <div className="catalog-toolbar"><div className="large-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search programs or career fields" /></div><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>
        <ErrorMessage message={error} />
        {loading ? <LoadingState label="Loading programs..." /> : <div className="program-grid">{programs.map((program) => <article className="program-card" key={program.id}><div className="program-card-icon"><BookOpen /></div><span className="section-kicker">{program.category}</span><h2>{program.name}</h2><p>{program.description}</p><div className="program-meta"><span>{program.degreeLevel}</span><span>{program.schoolCount} {Number(program.schoolCount) === 1 ? "school" : "schools"}</span></div><div className="career-list"><strong><BriefcaseBusiness size={15} /> Possible careers</strong><div>{(program.careerPaths ?? []).slice(0, 3).map((career) => <span className="tag" key={career}>{career}</span>)}</div></div><div className="program-schools"><strong><School size={15} /> Offered by</strong>{(program.schools ?? []).length > 0 ? <div className="program-school-list">{program.schools.map((school) => <Link className="program-school-offering" to={`/schools/${school.id}`} key={school.id}><span><strong>{school.name}</strong><small>{school.city} · {school.schoolType}</small></span><em>View school <ArrowRight size={13} /></em></Link>)}</div> : <p className="program-school-empty">No offering institution is listed yet.</p>}</div><details><summary>Requirements and details</summary><p>{program.requirements}</p></details></article>)}</div>}
      </div>
    </section>
  );
}
