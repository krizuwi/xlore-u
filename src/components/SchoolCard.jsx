import { ArrowRight, Heart, MapPin, Scale } from "lucide-react";
import { Link } from "react-router-dom";

const colors = ["#2447d8", "#b91c1c", "#6d28d9", "#047857", "#c2410c", "#0f766e"];

export function SchoolCard({ school, saved = false, compared = false, onSave, onCompare, busy, showMinimumTuition = false }) {
  const initials = school.name.split(/\s+/).filter((word) => !["of", "the"].includes(word.toLowerCase())).slice(0, 3).map((word) => word[0]).join("");
  const color = colors[school.name.length % colors.length];
  const programs = school.programs ?? school.matchedPrograms ?? [];

  return (
    <article className="school-card">
      <div className="school-card-top">
        <div className="school-logo" style={{ background: color }}>{initials}</div>
        {onSave && (
          <button className={`save-btn ${saved ? "saved" : ""}`} onClick={() => onSave(school)} disabled={busy} aria-label={saved ? "Remove saved school" : "Save school"}>
            <Heart size={18} fill={saved ? "currentColor" : "none"} />
          </button>
        )}
      </div>
      <div className="match-row">
        {school.distanceKm != null
          ? <span className="distance-pill">≈ {school.distanceKm} km from {school.distanceArea} center</span>
          : school.matchScore != null && <span className="match-pill">{school.matchScore}% match</span>}
        <span className="school-location"><MapPin size={11} /> {school.city}</span>
      </div>
      <h3>{school.name}</h3>
      <p className="tuition-label">Estimated tuition</p>
      <p className="tuition-value">{school.tuitionRange}</p>
      {showMinimumTuition && school.minimumTuition != null && <p className="tuition-related">Related programs from ≈ ₱{Number(school.minimumTuition).toLocaleString("en-PH")} / semester</p>}
      <div className="tag-row">
        <span className="tag">{school.schoolType}</span>
        {school.googleRating && <span className="tag">★ {school.googleRating}</span>}
      </div>
      {programs.length > 0 && (
        <div className="program-list">
          {programs.slice(0, 3).map((program) => (
            <span className="program-item" key={program}><span className="program-dot" />{program}</span>
          ))}
        </div>
      )}
      <div className="card-actions">
        <Link className="outline-btn link-btn" to={`/schools/${school.id}`}>View details <ArrowRight size={14} /></Link>
        {onCompare && (
          <button className={`compare-btn ${compared ? "selected" : ""}`} onClick={() => onCompare(school)} disabled={busy} aria-label="Toggle comparison">
            <Scale size={16} /> {compared ? "Added" : "Compare"}
          </button>
        )}
      </div>
    </article>
  );
}
