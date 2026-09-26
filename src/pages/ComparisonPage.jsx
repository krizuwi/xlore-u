import { BookOpenCheck, PhilippinePeso, Scale, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { api } from "../lib/api.js";

const formatTuition = (amount) => amount == null
  ? "Contact school"
  : Number(amount) === 0
  ? "Tuition-free / subsidized"
  : `₱${Number(amount).toLocaleString()} per semester`;

export function ComparisonPage() {
  const [schools, setSchools] = useState(null);
  const [selectedPrograms, setSelectedPrograms] = useState({});
  const [error, setError] = useState("");
  const { hash } = useLocation();

  const load = async () => {
    try {
      setError("");
      const data = await api("/comparison");
      setSchools(data.schools);
      setSelectedPrograms((current) => {
        const next = {};
        for (const school of data.schools) {
          const offerings = school.programOfferings ?? [];
          const currentStillExists = offerings.some((program) => program.id === current[school.id]);
          next[school.id] = currentStillExists ? current[school.id] : offerings[0]?.id ?? "";
        }
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (schools?.length && hash === "#program-comparison") {
      document.getElementById("program-comparison")?.scrollIntoView({ block: "start" });
    }
  }, [schools, hash]);

  const sharedPrograms = useMemo(() => {
    const byId = new Map();
    for (const school of schools ?? []) {
      for (const program of school.programOfferings ?? []) {
        const entry = byId.get(program.id) ?? { ...program, schoolCount: 0 };
        entry.schoolCount += 1;
        byId.set(program.id, entry);
      }
    }
    return [...byId.values()]
      .filter((program) => program.schoolCount >= 2)
      .sort((left, right) => right.schoolCount - left.schoolCount || left.name.localeCompare(right.name));
  }, [schools]);

  const selectSharedProgram = (programId) => {
    setSelectedPrograms((current) => {
      const next = { ...current };
      for (const school of schools) {
        if ((school.programOfferings ?? []).some((program) => program.id === programId)) next[school.id] = programId;
      }
      return next;
    });
  };

  const remove = async (id) => {
    try {
      await api(`/comparison/schools/${id}`, { method: "DELETE" });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const clear = async () => {
    try {
      await api("/comparison", { method: "DELETE" });
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (!schools && !error) {
    return <section className="page-shell container"><LoadingState label="Loading comparison..." /></section>;
  }

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-heading">
          <div>
            <span className="section-kicker">One comparison workspace</span>
            <h1>Compare schools and programs together.</h1>
            <p>Review up to three schools side by side, then choose a program at each school to compare offerings and estimated tuition.</p>
          </div>
          {schools?.length > 0 && <button className="secondary-btn danger-outline" onClick={clear}><Trash2 size={16} /> Clear all</button>}
        </div>
        <ErrorMessage message={error} />

        {schools?.length ? (
          <>
            <div className="comparison-program-intro" id="program-comparison">
              <BookOpenCheck size={20} />
              <div><strong>Program comparison is included below</strong><p>Pick a program in each school column. You can compare the same program or different offerings.</p></div>
            </div>
            {sharedPrograms.length > 0 && (
              <div className="shared-programs">
                <strong>Compare the same program across schools</strong>
                <div>{sharedPrograms.map((program) => <button key={program.id} type="button" onClick={() => selectSharedProgram(program.id)}>{program.name}<span>{program.schoolCount} schools</span></button>)}</div>
              </div>
            )}
            <div className={`comparison-grid count-${schools.length}`}>
              {schools.map((school) => {
                const offerings = school.programOfferings ?? [];
                const selected = offerings.find((program) => program.id === selectedPrograms[school.id]);
                return <article className="comparison-column" key={school.id}>
                  <button className="comparison-remove" onClick={() => remove(school.id)} aria-label={`Remove ${school.name}`}><X /></button>
                  <div className="comparison-logo"><Scale /></div>
                  <span className="tag">{school.schoolType}</span>
                  <h2>{school.name}</h2>
                  <p className="school-location">{school.city}</p>
                  <div className="comparison-row"><small>General tuition</small><strong>{school.tuitionRange}</strong></div>
                  <div className="comparison-row"><small>Rating</small><strong>{school.googleRating ? `★ ${school.googleRating}` : "Not listed"}</strong></div>
                  <div className="comparison-row"><small>Accreditation</small><strong>{school.accreditation}</strong></div>
                  <div className="comparison-row"><small>Scholarships</small><strong>{school.scholarshipInfo || "Contact school"}</strong></div>
                  <div className="comparison-row"><small>Programs listed</small><strong>{school.programOfferings?.length ?? 0}</strong></div>
                  <div className="comparison-program-section">
                    <h3><BookOpenCheck size={17} /> Compare a program</h3>
                    <label htmlFor={`program-${school.id}`}>Program offered by {school.name}</label>
                    <select id={`program-${school.id}`} value={selectedPrograms[school.id] ?? ""} disabled={!offerings.length} onChange={(event) => setSelectedPrograms((current) => ({ ...current, [school.id]: event.target.value }))}>
                      {offerings.length === 0 && <option value="">No programs listed</option>}
                      {offerings.map((program) => <option value={program.id} key={program.id}>{program.name}</option>)}
                    </select>
                    {selected ? (
                        <div className="program-comparison-details">
                          <div className="program-title-row"><span className="tag">{selected.category}</span></div>
                          <h3>{selected.name}</h3>
                          <p>{selected.description}</p>
                          <div className="program-comparison-stat"><PhilippinePeso /><span><small>Estimated tuition</small><strong>{formatTuition(selected.tuitionPerSemester)}</strong></span></div>
                          <div className="program-detail-row"><small>Degree level</small><strong>{selected.degreeLevel}</strong></div>
                          <div className="program-detail-row"><small>Requirements</small><strong>{selected.requirements}</strong></div>
                          <div className="program-careers"><small>Possible careers</small><div>{(selected.careerPaths ?? []).map((career) => <span key={career}>{career}</span>)}</div></div>
                          <Link className="text-btn comparison-view-program" to={`/programs/${selected.id}`}>View program details</Link>
                        </div>
                      ) : <div className="empty-inline">No program offering is available for this school.</div>}
                  </div>
                  <Link className="primary-btn compact comparison-view-school" to={`/schools/${school.id}`}>View school</Link>
                </article>;
              })}
              {Array.from({ length: 3 - schools.length }).map((_, index) => (
                <Link to="/schools" className="comparison-empty" key={index}><span>+</span><strong>Add another school</strong><small>Choose from the directory</small></Link>
              ))}
            </div>

          </>
        ) : (
          <div className="empty-state large-empty"><Scale className="empty-icon" /><h3>Your comparison is empty</h3><p>Add schools to compare their details and program offerings side by side.</p><Link className="primary-btn empty-action" to="/schools">Browse schools</Link></div>
        )}
      </div>
    </section>
  );
}
