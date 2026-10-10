import { ArrowRight, ChevronDown, School } from "lucide-react";
import { Link } from "react-router-dom";

export function ProgramSchoolOfferings({ schools = [], programName }) {
  if (!schools.length) return <div className="program-schools"><strong><School size={15} /> Offered by</strong><p className="program-school-empty">No offering institution is listed yet.</p></div>;
  return <details className="program-schools program-offerings-disclosure">
    <summary aria-label={`Schools offering ${programName}`}>
      <span className="program-offerings-heading"><School size={15} /> Offered by</span>
      <span className="program-offerings-toggle"><span className="program-offerings-more">View more</span><span className="program-offerings-less">View less</span><ChevronDown size={14} /></span>
    </summary>
    <div className="program-school-list" role="region" aria-label={`Schools offering ${programName}`} tabIndex={0}>
      {schools.map(school => <Link className="program-school-offering" to={`/schools/${school.id}`} key={school.id}>
        <span><strong>{school.name}</strong><small>{school.city} · {school.schoolType}</small></span>
        <em>View school <ArrowRight size={13} /></em>
      </Link>)}
    </div>
  </details>;
}
