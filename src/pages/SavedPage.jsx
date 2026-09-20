import { ArrowRight, BookOpen, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { SchoolCard } from "../components/SchoolCard.jsx";
import { api } from "../lib/api.js";

export function SavedPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = () => api("/saved").then(setData).catch((requestError) => setError(requestError.message));
  useEffect(() => {
    load();
  }, []);
  const removeSchool = async (school) => { await api(`/saved/schools/${school.id}`, { method: "DELETE" }); load(); };
  const removeProgram = async (program) => {
    try {
      await api(`/saved/programs/${program.id}`, { method: "DELETE" });
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  if (!data && !error) return <section className="page-shell container"><LoadingState label="Loading saved items..." /></section>;
  return (
    <section className="page-shell"><div className="container"><div className="page-heading"><div><span className="section-kicker">Your shortlist</span><h1>Saved schools and programs.</h1><p>Keep promising options together while you explore and compare.</p></div></div><ErrorMessage message={error} />
      {data && <><div className="saved-section"><h2><Heart size={20} /> Saved schools <span>{data.schools.length}</span></h2>{data.schools.length ? <div className="school-grid">{data.schools.map((school) => <SchoolCard key={school.id} school={school} saved onSave={removeSchool} />)}</div> : <div className="empty-state"><Heart className="empty-icon" /><h3>No saved schools yet</h3><p>Use the heart button in the school directory to build your shortlist.</p></div>}</div>
      <div className="saved-section"><h2><BookOpen size={20} /> Saved programs <span>{data.programs.length}</span></h2>{data.programs.length ? <div className="saved-program-list">{data.programs.map((program) => <article className="saved-program-card" key={program.id}><div className="saved-program-card-top"><div className="program-card-icon"><BookOpen /></div><button type="button" className="save-btn program-save-btn saved" onClick={() => removeProgram(program)} aria-label={`Remove ${program.name} from saved programs`}><Heart size={16} fill="currentColor" /><span>Saved</span></button></div><div><span className="tag">{program.category}</span><h3>{program.name}</h3><p>{program.degreeLevel}</p></div><div className="saved-program-actions"><Link className="outline-btn link-btn" to={`/programs/${program.id}`}>View program <ArrowRight size={14} /></Link></div></article>)}</div> : <div className="empty-state"><BookOpen className="empty-icon" /><h3>No saved programs yet</h3><p>Programs you save will appear here.</p></div>}</div></>}
    </div></section>
  );
}
