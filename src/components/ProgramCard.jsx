import { ArrowRight, BookOpen, BriefcaseBusiness } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProgramSchoolOfferings } from './ProgramSchoolOfferings.jsx';
import { SaveButton } from './SaveButton.jsx';

/** Shared program card for the directory and assessment recommendations. */
export function ProgramCard({ program, saved = false, onToggleSaved, saving = false, recommendationNote = '' }) {
  const careerPaths = Array.isArray(program.careerPaths) ? program.careerPaths : [];
  const schools = Array.isArray(program.schools) ? program.schools : [];
  const schoolCount = Number(program.schoolCount ?? schools.length);

  return <article className="program-card">
    <div className="program-card-top">
      <div className="program-card-icon"><BookOpen /></div>
      <SaveButton saved={saved} onClick={() => onToggleSaved?.(program)} disabled={saving}
        label={saved ? `Remove ${program.name} from saved programs` : `Save ${program.name}`} />
    </div>
    <span className="section-kicker">{program.category}</span>
    <h2>{program.name}</h2>
    <p>{program.description}</p>
    <div className="program-meta"><span>{program.degreeLevel}</span><span>{schoolCount} {schoolCount === 1 ? 'school' : 'schools'}</span></div>
    {recommendationNote && <p className="program-recommendation-note">{recommendationNote}</p>}
    <div className="career-list"><strong><BriefcaseBusiness size={15} /> Possible careers</strong>
      <div>{careerPaths.slice(0, 3).map(career => <span className="tag" key={career}>{career}</span>)}</div>
    </div>
    <ProgramSchoolOfferings schools={schools} programName={program.name} />
    <details><summary>Requirements and details</summary><p>{program.requirements}</p></details>
    <div className="program-card-actions"><Link className="outline-btn link-btn" to={`/programs/${program.id}`}>View program <ArrowRight size={14} /></Link></div>
  </article>;
}
