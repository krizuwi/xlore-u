import { ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness, ExternalLink, GraduationCap, Heart, School } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export function ProgramDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setProgram(null);
    setError("");
    api(`/programs/${id}`).then(setProgram).catch((requestError) => setError(requestError.message));
  }, [id]);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }
    api("/saved")
      .then((result) => setSaved(result.programs.some((item) => item.id === id)))
      .catch((requestError) => setError(requestError.message));
  }, [id, user]);

  const toggleSaved = async () => {
    if (!user) {
      navigate("/login", {
        state: {
          from: `/programs/${id}`,
          message: "Sign in or create an account to save this program."
        }
      });
      return;
    }

    setBusy(true);
    setError("");
    try {
      await api(`/saved/programs/${id}`, { method: saved ? "DELETE" : "POST" });
      setSaved((current) => !current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !program) {
    return <section className="page-shell container"><ErrorMessage message={error} /><Link className="text-btn" to="/programs">Back to programs</Link></section>;
  }
  if (!program) return <section className="page-shell container"><LoadingState label="Loading program details..." /></section>;

  return (
    <section className="page-shell detail-page">
      <div className="container">
        <Link className="back-link" to="/programs"><ArrowLeft size={16} /> Back to programs</Link>
        <ErrorMessage message={error} />
        <div className="detail-hero">
          <div>
            <span className="section-kicker">{program.category}</span>
            <h1>{program.name}</h1>
            <p className="detail-description">{program.description}</p>
          </div>
          <div className="detail-hero-actions">
            <button type="button" className="primary-btn" onClick={toggleSaved} disabled={busy}>
              <Heart size={17} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved program" : "Save program"}
            </button>
            {program.sourceUrl && <a className="secondary-btn" href={program.sourceUrl} target="_blank" rel="noreferrer">Official source <ExternalLink size={14} /></a>}
          </div>
        </div>

        <div className="detail-stat-grid">
          <div><GraduationCap /><span><small>Degree level</small><strong>{program.degreeLevel || "Not specified"}</strong></span></div>
          <div><BookOpen /><span><small>Program category</small><strong>{program.category || "Not specified"}</strong></span></div>
          <div><School /><span><small>Offering institutions</small><strong>{program.schools.length} {program.schools.length === 1 ? "school" : "schools"}</strong></span></div>
        </div>

        <div className="detail-layout program-detail-layout">
          <div className="content-card">
            <h2><BriefcaseBusiness /> Program overview</h2>
            <div className="program-detail-section">
              <h3>Admission requirements</h3>
              <p>{program.requirements || "Contact an offering institution for its current admission requirements."}</p>
            </div>
            <div className="program-detail-section">
              <h3>Possible careers</h3>
              <div className="tag-row">{(program.careerPaths ?? []).map((career) => <span className="tag" key={career}>{career}</span>)}</div>
            </div>
            {(program.interestTags ?? []).length > 0 && <div className="program-detail-section"><h3>Related interests</h3><div className="tag-row">{program.interestTags.map((interest) => <span className="tag" key={interest}>{interest}</span>)}</div></div>}
          </div>

          <aside>
            <div className="content-card side-card program-offering-card">
              <h3><School size={18} /> Schools offering this program</h3>
              {program.schools.length > 0 ? <div className="program-school-list">{program.schools.map((school) => (
                <Link className="program-school-offering" to={`/schools/${school.id}`} key={school.id}>
                  <span><strong>{school.name}</strong><small>{school.city} · {school.schoolType}</small><small>{school.tuitionPerSemester == null ? "Contact school for tuition" : `Estimated tuition: ₱${Number(school.tuitionPerSemester).toLocaleString()}`}</small></span>
                  <em>View school <ArrowRight size={13} /></em>
                </Link>
              ))}</div> : <p>No offering institution is currently listed.</p>}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
