import { ArrowRight, BookOpen, Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { SchoolCard } from "../components/SchoolCard.jsx";
import { SaveButton } from "../components/SaveButton.jsx";
import { api } from "../lib/api.js";
import { accountQueryKey } from "../lib/queryClient.js";
import { useLiveRefresh } from "../context/EngagementContext.jsx";

export function SavedPage() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const savedQuery = useQuery({
    queryKey: accountQueryKey(user, "saved"),
    queryFn: ({ signal }) => api("/saved", { signal }),
    enabled: user?.role === "student"
  });
  const removeSaved = useMutation({
    mutationFn: ({ kind, id }) => api(`/saved/${kind}/${id}`, { method: "DELETE" }),
    onSuccess: () => cache.invalidateQueries({ queryKey: accountQueryKey(user, "saved") })
  });
  useLiveRefresh(() => { void savedQuery.refetch(); }, { enabled: !savedQuery.isPending, key: user?.id });
  const data = savedQuery.data ?? null;
  const error = savedQuery.error?.message ?? removeSaved.error?.message ?? "";
  const removeSchool = (school) => removeSaved.mutate({ kind: "schools", id: school.id });
  const removeProgram = (program) => removeSaved.mutate({ kind: "programs", id: program.id });
  if (!data && savedQuery.isPending) return <section className="page-shell container"><LoadingState label="Loading saved items..." /></section>;
  return (
    <section className="page-shell"><div className="container"><div className="page-heading"><div><span className="section-kicker">Your shortlist</span><h1>Saved schools and programs.</h1><p>Keep promising options together while you explore and compare.</p></div></div><ErrorMessage message={error} />
      {data && <><div className="saved-section"><h2><Heart size={20} /> Saved schools <span>{data.schools.length}</span></h2>{data.schools.length ? <div className="school-grid">{data.schools.map((school) => <SchoolCard key={school.id} school={school} saved onSave={removeSchool} busy={removeSaved.isPending} />)}</div> : <div className="empty-state"><Heart className="empty-icon" /><h3>No saved schools yet</h3><p>Use the heart button in the school directory to build your shortlist.</p></div>}</div>
      <div className="saved-section"><h2><BookOpen size={20} /> Saved programs <span>{data.programs.length}</span></h2>{data.programs.length ? <div className="saved-program-list">{data.programs.map((program) => <article className="saved-program-card" key={program.id}><div className="saved-program-card-top"><div className="program-card-icon"><BookOpen /></div><SaveButton saved disabled={removeSaved.isPending} onClick={() => removeProgram(program)} label={`Remove ${program.name} from saved programs`} /></div><div><span className="tag">{program.category}</span><h3>{program.name}</h3><p>{program.degreeLevel}</p></div><div className="saved-program-actions"><Link className="outline-btn link-btn" to={`/programs/${program.id}`}>View program <ArrowRight size={14} /></Link></div></article>)}</div> : <div className="empty-state"><BookOpen className="empty-icon" /><h3>No saved programs yet</h3><p>Programs you save will appear here.</p></div>}</div></>}
    </div></section>
  );
}
