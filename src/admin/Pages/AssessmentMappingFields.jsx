export const profiles = { A: 'Analytical', B: 'Creative', C: 'People-Oriented', D: 'Practical' };
export const constraints = {
  tuition: 'Tuition importance', distance: 'Distance importance', travel: 'Travel-time preference',
  facilities: 'Learning resources preference', assistance: 'Financial assistance preference'
};

export function AssessmentMappingFields({ routing, onChange, sections = [] }) {
  return <div className="am-form-grid">
    <label className="am-field">Question role<select value={routing.role} onChange={event => onChange(event.target.value === 'macro-vote'
      ? { ...routing, role: 'macro-vote', constraintKey: undefined } : { ...routing, role: 'constraint', constraintKey: 'tuition' })}>
      <option value="macro-vote">Core interest — one A/B/C/D vote</option>
      <option value="constraint">Practical preference — no career points</option>
    </select></label>
    {routing.role === 'constraint' && <label className="am-field">Practical preference<select value={routing.constraintKey} onChange={event => onChange({ ...routing, constraintKey: event.target.value })}>
      {Object.entries(constraints).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>}
    {sections.length > 0 && <label className="am-field">Questionnaire section<select value={routing.sectionId ?? ''} onChange={event => onChange({ ...routing, sectionId: event.target.value })}>
      <option value="" disabled>Choose a section</option>{sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}
    </select></label>}
  </div>;
}

export function AnswerMappingField({ option, index, routing, onChange, profileNames = profiles }) {
  if (routing.role === 'macro-vote') return <label className="am-field">Answer {index + 1} macro-profile<select
    value={option.macro ?? ''} onChange={event => onChange({ macro: event.target.value })}>
    <option value="" disabled>Choose a profile</option>
    {Object.entries(profileNames).map(([key, label]) => <option key={key} value={key}>{key} — {label} · 1 vote</option>)}
  </select></label>;
  return <div className="am-description"><p>Unscored practical answer — contributes no A/B/C/D votes.</p>
    {['tuition', 'distance'].includes(routing.constraintKey) && <label className="am-assessment-priority">
      <input type="checkbox" checked={option.prioritize === true} onChange={event => onChange({ prioritize: event.target.checked })} />
      Prioritize {routing.constraintKey === 'tuition' ? 'lower known tuition' : 'shorter known straight-line distance'} when this answer is selected
    </label>}
  </div>;
}

export function mappingSummary(question) {
  if (question.routing?.role === 'macro-vote') return 'A/B/C/D · 1 vote per answer';
  if (question.routing?.role === 'constraint') return `${constraints[question.routing.constraintKey] ?? 'Practical preference'} · unscored`;
  return 'Mapping not configured';
}
