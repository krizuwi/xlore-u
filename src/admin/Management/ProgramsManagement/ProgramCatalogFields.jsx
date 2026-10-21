import { useId, useState } from 'react';
import { catalogKeywordMatches } from '../../../lib/keyword-search.js';

export function getInterestTagOptions(programs = [], currentTags = []) {
  return [...new Set(['technology', 'analytical', 'science', 'health', 'business', 'creative', 'communication', 'social',
    ...programs.flatMap(program => program.interestTags ?? []), ...currentTags]
    .map(tag => String(tag).trim().toLowerCase()).filter(Boolean))].sort();
}

export function InterestTagsField({ options, selected, onChange }) {
  return <fieldset className="am-interest-tags">
    <legend>Interest tags</legend>
    <details className="am-interest-tag-dropdown">
      <summary>{selected.length ? `${selected.length} selected · ${selected.join(', ')}` : 'Select interest tags'}</summary>
      <div className="am-interest-tag-options">{options.map(tag => <label className="checkbox-row" key={tag}>
        <input type="checkbox" name="interestTags" value={tag} checked={selected.includes(tag)}
          onChange={event => onChange(event.target.checked ? [...selected, tag] : selected.filter(value => value !== tag))} />
        <span>{tag}</span>
      </label>)}</div>
    </details>
  </fieldset>;
}

export function SchoolOfferingsFields({ schools, offerings, onChange }) {
  const [query, setQuery] = useState('');
  const searchId = useId();
  const matching = schools.filter(school => catalogKeywordMatches(school, query, 'school'));
  const matchingIds = new Set(matching.map(school => school.id));
  return <div className="am-school-offering-fields">
    <label className="am-field" htmlFor={searchId}>Search schools
      {/* A view-only filter is not part of the editable form or its dirty state. */}
      <input id={searchId} type="search" form="" value={query} placeholder="School name, acronym, or city…"
        onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} />
    </label>
    <p className="am-description" role="status">Showing {matching.length} of {schools.length} schools · {Object.keys(offerings).length} selected</p>
    {/* Keep fields mounted when filtered so selections, fees and the unsaved baseline survive searches. */}
    {schools.map(school => <div className="am-offering" key={school.id} hidden={!matchingIds.has(school.id)}>
      <label className="checkbox-row"><input type="checkbox" aria-label={`Offer at ${school.name}`} checked={Object.hasOwn(offerings, school.id)}
        onChange={event => onChange(current => { const copy = { ...current }; if (event.target.checked) copy[school.id] = ''; else delete copy[school.id]; return copy; })} />
        <span>{school.name}{school.status === 'Inactive' && ' (inactive)'}</span>
      </label>
      <input aria-label={`Tuition per semester for ${school.name}`} type="number" min="0" max="99999999" step="0.01"
        disabled={!Object.hasOwn(offerings, school.id)} value={offerings[school.id] ?? ''} placeholder="Unknown"
        onChange={event => onChange(current => ({ ...current, [school.id]: event.target.value }))} />
    </div>)}
    {!matching.length && <p className="am-description">No schools match your search. Try another name, acronym, or city.</p>}
  </div>;
}
