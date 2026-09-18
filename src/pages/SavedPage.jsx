import { BookOpen, Heart } from "lucide-react";
import { useEffect, useState } from "react";
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
  const removeProgram = async (program) => { await api(`/saved/programs/${program.id}`, { method: "DELETE" }); load(); };
  if (!data && !error) return <section className="page-shell container"><LoadingState label="Loading saved items..." /></section>;
  return (
    <section className="page-shell"><div className="container"><div className="page-heading"><div><span className="section-kicker">Your shortlist</span><h1>Saved schools and programs.</h1><p>Keep promising options together while you explore and compare.</p></div></div><ErrorMessage message={error} />
      {data && <><div className="saved-section"><h2><Heart size={20} /> Saved schools <span>{data.schools.length}</span></h2>{data.schools.length ? <div className="school-grid">{data.schools.map((school) => <SchoolCard key={school.id} school={school} saved onSave={removeSchool} />)}</div> : <div className="empty-state"><Heart className="empty-icon" /><h3>No saved schools yet</h3><p>Use the heart button in the school directory to build your shortlist.</p></div>}</div>
      <div className="saved-section"><h2><BookOpen size={20} /> Saved programs <span>{data.programs.length}</span></h2>{data.programs.length ? <div className="saved-program-list">{data.programs.map((program) => <article key={program.id}><div><span className="tag">{program.category}</span><h3>{program.name}</h3><p>{program.degreeLevel}</p></div><button className="ghost-danger" onClick={() => removeProgram(program)}>Remove</button></article>)}</div> : <div className="empty-state"><BookOpen className="empty-icon" /><h3>No saved programs yet</h3><p>Programs you save will appear here.</p></div>}</div></>}
    </div></section>
  );
}
