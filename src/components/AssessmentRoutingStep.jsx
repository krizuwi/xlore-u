import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ErrorMessage } from './Feedback.jsx';

export function AssessmentRoutingStep({ plan, selection, onSelection, onBack, onComplete, busy, error }) {
  const [step, setStep] = useState(plan.primaryProfile ? 'field' : 'profile');
  const choosingProfile = step === 'profile', choosingVehicle = step === 'vehicle';
  const hasVehicle = plan.careerVehicle?.enabled, copy = plan.display?.copy ?? {};
  const choices = choosingProfile ? plan.leadingProfiles.map(id => ({ id, label: plan.profiles[id] }))
    : choosingVehicle ? plan.careerVehicle.options : plan.branches[selection.profile] ?? [];
  const selected = choosingProfile ? selection.profile : choosingVehicle ? selection.vehicle : selection.field;
  const number = choosingProfile ? 1 : (plan.primaryProfile ? 1 : 2) + (choosingVehicle ? 1 : 0);
  const question = plan.routingQuestions?.[selection.profile];
  function advance() {
    if (busy || !selected) return;
    if (choosingProfile) setStep('field'); else if (!choosingVehicle && hasVehicle) setStep('vehicle'); else onComplete();
  }
  return <section className="assessment-page page-shell"><div className="narrow-container container">
    <div className="assessment-top"><span className="section-kicker">{choosingVehicle ? plan.careerVehicle.title : question?.title ?? 'Section 2 · Targeted follow-up'}</span><h1>{copy.routingTitle ?? 'Let’s narrow your direction.'}</h1>
      <p>Your core answers {plan.primaryProfile ? `lean toward ${plan.profiles[plan.primaryProfile]}` : 'give more than one direction the same number of votes'}. {copy.routingIntro ?? 'These follow-ups help route your choices; they add no assessment points.'}</p>
    </div>
    <div className="progress-meta"><span>Follow-up {number} of {plan.followUpCount}</span><span>Core questionnaire complete</span></div>
    <div className="assessment-progress"><span style={{ width: `${number / plan.followUpCount * 100}%` }} /></div>
    <ErrorMessage message={error} />
    <form className="question-card" onSubmit={event => { event.preventDefault(); advance(); }}>
      <h2>{choosingProfile ? copy.tiePrompt ?? 'Which of these equally strong directions feels closest to what you want to explore?' : choosingVehicle ? plan.careerVehicle.prompt : question?.prompt ?? 'Within this direction, what would you most like to study or do?'}</h2>
      <div className="answer-grid">{choices.map(choice => <button key={choice.id} type="button" disabled={busy}
        className={`answer-card ${selected === choice.id ? 'selected' : ''}`} aria-pressed={selected === choice.id}
        onClick={() => onSelection(choosingProfile ? { ...selection, profile: choice.id, field: '' } : choosingVehicle ? { ...selection, vehicle: choice.id } : { ...selection, field: choice.id })}>
        <span className="answer-radio">{selected === choice.id && <Check size={14} />}</span>{choice.label}
      </button>)}</div>
      <div className="assessment-nav"><button className="secondary-btn" type="button" disabled={busy} onClick={() => {
        if (choosingVehicle) setStep('field'); else if (!choosingProfile && !plan.primaryProfile) setStep('profile'); else onBack();
      }}><ArrowLeft size={16} />{choosingVehicle || !choosingProfile && !plan.primaryProfile ? 'Previous' : 'Review core answers'}</button>
        <button className="primary-btn" disabled={busy || !selected}>{choosingProfile ? <>Next <ArrowRight size={16} /></> : !choosingVehicle && hasVehicle ? <>Final routing question <ArrowRight size={16} /></>
          : <><Sparkles size={16} />{busy ? 'Creating your roadmap…' : copy.completeButton ?? 'See my programs and schools'}</>}</button>
      </div>
    </form>
  </div></section>;
}
