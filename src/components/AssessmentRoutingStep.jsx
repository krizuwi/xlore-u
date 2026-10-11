import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ErrorMessage } from './Feedback.jsx';

export function AssessmentRoutingStep({ plan, selection, onSelection, onBack, onComplete, busy, error }) {
  const [tieResolved, setTieResolved] = useState(Boolean(plan.primaryProfile));
  const branches = plan.branches[selection.profile] ?? [];
  const choosingProfile = !tieResolved;
  const choices = choosingProfile ? plan.leadingProfiles.map(id => ({ id, label: plan.profiles[id] })) : branches;
  const selected = choosingProfile ? selection.profile : selection.field;
  const number = choosingProfile || plan.followUpCount === 1 ? 1 : 2;
  return <section className="assessment-page page-shell"><div className="narrow-container container">
    <div className="assessment-top"><span className="section-kicker">Section 2 · Targeted follow-up</span><h1>Let’s narrow your direction.</h1>
      <p>Your core answers {plan.primaryProfile ? `lean toward ${plan.profiles[plan.primaryProfile]}` : 'give more than one direction the same number of votes'}. These follow-ups help route your choices; they add no assessment points.</p>
    </div>
    <div className="progress-meta"><span>Follow-up {number} of {plan.followUpCount}</span><span>Core questionnaire complete</span></div>
    <div className="assessment-progress"><span style={{ width: `${number / plan.followUpCount * 100}%` }} /></div>
    <ErrorMessage message={error} />
    <form className="question-card" onSubmit={event => { event.preventDefault(); if (!busy && selection.field) onComplete(); }}>
      <h2>{choosingProfile ? 'Which of these equally strong directions feels closest to what you want to explore?' : 'Within this direction, what would you most like to study or do?'}</h2>
      <div className="answer-grid">{choices.map(choice => <button key={choice.id} type="button" disabled={busy}
        className={`answer-card ${selected === choice.id ? 'selected' : ''}`} aria-pressed={selected === choice.id}
        onClick={() => onSelection(choosingProfile ? { profile: choice.id, field: '' } : { ...selection, field: choice.id })}>
        <span className="answer-radio">{selected === choice.id && <Check size={14} />}</span>{choice.label}
      </button>)}</div>
      <div className="assessment-nav"><button className="secondary-btn" type="button" disabled={busy} onClick={() => {
        if (!choosingProfile && !plan.primaryProfile) setTieResolved(false); else onBack();
      }}><ArrowLeft size={16} />{!choosingProfile && !plan.primaryProfile ? 'Previous' : 'Review core answers'}</button>
        {choosingProfile ? <button className="primary-btn" type="button" disabled={busy || !selection.profile} onClick={() => setTieResolved(true)}>Next <ArrowRight size={16} /></button>
          : <button className="primary-btn" disabled={busy || !selection.field}><Sparkles size={16} />{busy ? 'Creating your roadmap…' : 'See my programs and schools'}</button>}
      </div>
    </form>
  </div></section>;
}
