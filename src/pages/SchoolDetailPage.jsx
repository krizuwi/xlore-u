import { ArrowLeft, Award, ExternalLink, GraduationCap, MapPin, PhilippinePeso, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { api } from "../lib/api.js";

export function SchoolDetailPage() {
  const { id } = useParams();
  const [school, setSchool] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/schools/${id}`).then(setSchool).catch((requestError) => setError(requestError.message)); }, [id]);
  if (error) return <section className="page-shell container"><ErrorMessage message={error} /><Link className="text-btn" to="/schools">Back to schools</Link></section>;
  if (!school) return <section className="page-shell container"><LoadingState label="Loading school details..." /></section>;
  const mapUrl = `https://www.google.com/maps?q=${school.latitude},${school.longitude}`;
  return (
    <section className="page-shell detail-page">
      <div className="container">
        <Link className="back-link" to="/schools"><ArrowLeft size={16} /> Back to directory</Link>
        <div className="detail-hero"><div><span className="section-kicker">{school.schoolType} institution</span><h1>{school.name}</h1><p className="detail-address"><MapPin size={17} /> {school.address}, {school.city}</p>{school.description && <p className="detail-description">{school.description}</p>}</div><div className="detail-hero-actions"><a className="primary-btn" href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={17} /> View on map <ExternalLink size={14} /></a>{school.officialWebsiteUrl && <a className="secondary-btn" href={school.officialWebsiteUrl} target="_blank" rel="noreferrer">Official website <ExternalLink size={14} /></a>}</div></div>
        <div className="detail-stat-grid">
          <div><PhilippinePeso /><span><small>Tuition range</small><strong>{school.tuitionRange}</strong></span></div>
          <div><Award /><span><small>Accreditation</small><strong>{school.accreditation}</strong></span></div>
          <div><Star /><span><small>Google rating</small><strong>{school.googleRating ?? "Not listed"}</strong></span></div>
        </div>
        <div className="detail-layout">
          <div><div className="content-card"><h2><GraduationCap /> Programs offered</h2><div className="offering-list">{school.programs.map((program) => <article key={program.id}><div><span className="tag">{program.category}</span>{program.isTopProgram && <span className="match-pill">Top program</span>}<h3>{program.name}</h3><p>{program.description}</p>{program.sourceUrl && <a className="text-btn" href={program.sourceUrl} target="_blank" rel="noreferrer">Official source <ExternalLink size={13} /></a>}</div><div className="offering-tuition"><small>Per semester</small><strong>{program.tuitionPerSemester == null ? "Contact school" : `₱${Number(program.tuitionPerSemester).toLocaleString()}`}</strong></div></article>)}</div></div></div>
          <aside><div className="content-card side-card"><h3>Scholarship information</h3><p>{school.scholarshipInfo || "Contact the institution for current scholarship information."}</p></div><div className="content-card side-card"><h3>Accepted SHS strands</h3><div className="tag-row">{school.acceptedStrands.map((strand) => <span className="tag" key={strand.code}>{strand.code}</span>)}</div></div></aside>
        </div>
      </div>
    </section>
  );
}
