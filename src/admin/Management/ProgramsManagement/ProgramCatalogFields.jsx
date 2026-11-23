import { useId, useState } from 'react';
import { catalogKeywordMatches } from '../../../lib/keyword-search.js';

export function ProgramClustersField({ clusters = [], selected = [], onChange, disabled = false, loading = false }) {
  const selectedNames = clusters.filter(cluster => selected.includes(cluster.id)).map(cluster => cluster.name);
  return <fieldset className="am-program-clusters" disabled={disabled || loading}>
    <legend>Assessment clusters</legend>
    {loading ? <p className="am-description">Loading assessment clusters…</p> : clusters.length ? <details className="am-program-cluster-dropdown">
      <summary>{selectedNames.length ? `${selectedNames.length} selected · ${selectedNames.join(', ')}` : 'Select assessment clusters'}</summary>
      <div className="am-program-cluster-options">{clusters.map(cluster => <label className="checkbox-row" key={cluster.id}>
        <input type="checkbox" name="clusterIds" value={cluster.id} checked={selected.includes(cluster.id)}
          onChange={event => onChange(event.target.checked ? [...selected, cluster.id] : selected.filter(value => value !== cluster.id))} />
        <span><strong>{cluster.name}</strong>{cluster.description && <small>{cluster.description}</small>}</span>
      </label>)}</div>
    </details> : <p className="am-description">Assessment clusters are unavailable. Ask an administrator to configure assessment results.</p>}
    <p className="am-description">Choose the cluster or clusters where this program should appear in student assessment results.</p>
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
