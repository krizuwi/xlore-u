import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { UnsavedForm } from '../../components/UnsavedForm.jsx';
import { adminWrite, useAdminResource } from '../lib/adminApi.js';
import { Notice } from '../Management/LiveCatalogShared.jsx';
import { useUnsavedChanges, useUnsavedProgress } from '../../context/UnsavedChangesContext.jsx';
import { catalogKeywordMatches } from '../../lib/keyword-search.js';

const labelFor = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
const split = value => value.split(',').map(item => item.trim()).filter(Boolean);
const freshId = prefix => `${prefix}-${crypto.randomUUID()}`;

function CsvField({ label, values, onChange, numeric = false }) {
  const [raw, setRaw] = useState(() => values.join(', '));
  return <label className="am-field">{label}<input value={raw} onChange={event => {
    setRaw(event.target.value); const parsed = split(event.target.value); onChange(numeric ? parsed.map(Number) : parsed);
  }} /></label>;
}

function CatalogPicker({ label, records, selected, onChange, kind = 'program' }) {
  const [search, setSearch] = useState('');
  const visible = records.filter(item => catalogKeywordMatches(item, search, kind));
  return <details className="am-assessment-catalog"><summary>{label} ({selected.length} selected)</summary>
    <input type="search" form="" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} />
    <div>{visible.map(item => <label key={item.id}><input type="checkbox" checked={selected.includes(item.id)}
      onChange={e => onChange(e.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />{item.name}{item.active === false ? ' (Inactive)' : ''}</label>)}
      {!visible.length && <p>No matching records.</p>}</div>
  </details>;
}

function Editor({ resource, onSaved }) {
  const [draft, setDraft] = useState(() => structuredClone(resource.data.settings ?? resource.data.defaults));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const markSaved = useUnsavedProgress(JSON.stringify(draft));
  const set = (path, value) => setDraft(current => {
    const next = structuredClone(current); let target = next;
    for (const part of path.slice(0, -1)) target = target[part];
    target[path.at(-1)] = value; return next;
  });
  const field = (path, label, { area = false, numeric = false } = {}) => {
    let value = draft; for (const part of path) value = value[part];
    return <label className="am-field" key={path.join('.')}>{label}{area
      ? <textarea rows={3} maxLength={3000} value={value} onChange={e => set(path, e.target.value)} />
      : <input type={numeric ? 'number' : 'text'} min={numeric ? 1 : undefined} max={numeric ? 50 : undefined} value={value} onChange={e => set(path, numeric ? Number(e.target.value) : e.target.value)} />}</label>;
  };
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await adminWrite('/assessment-settings', 'PUT', { settings: draft, version: resource.data.version }); markSaved(); onSaved(result.message); resource.refresh(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <UnsavedForm onSubmit={save}><fieldset disabled={busy} className="am-live-fieldset am-assessment-settings">
    <Notice error>{error}</Notice>
    <details className="am-card" open><summary>Access, scoring and school-matching policies</summary><div className="am-dialog-body">
      <p>Core answers use the agreed one-vote A/B/C/D method. The five practical preferences and both follow-ups add no career points. Changes to the interpretation still need expert review.</p>
      <div className="am-form-grid">
        <label className="am-field">Assessment access<select value={draft.policy.attempts} onChange={e => set(['policy', 'attempts'], e.target.value)}><option value="once">One completed assessment per account</option><option value="unlimited">Allow new attempts; retain every old result</option></select></label>
        <label className="am-field">Tied macro-profiles<select value={draft.policy.tieHandling} onChange={e => set(['policy', 'tieHandling'], e.target.value)}><option value="ask">Ask the student to choose among tied profiles</option><option value="priority">Use the explicit profile priority below</option></select></label>
        <CsvField label="Tie priority (A, B, C, D; each once)" values={draft.policy.tiePriority} onChange={value => set(['policy', 'tiePriority'], value)} />
        <CsvField label="School priority order (career, distance, tuition, name)" values={draft.matching.schoolPriority} onChange={value => set(['matching', 'schoolPriority'], value)} />
      </div>
      <p>Career priority only uses schools deliberately associated below, and only after confirming they offer the selected program. Tuition/distance priorities follow the chosen practical answers. These do not claim verified commute times or partnerships.</p>
      <div className="am-assessment-checks">{['Bachelor', 'Associate', 'Diploma', 'Certificate', 'Postgraduate'].map(level => <label key={level}><input type="checkbox" checked={draft.matching.degreeLevels.includes(level)} onChange={e => set(['matching', 'degreeLevels'], e.target.checked ? [...draft.matching.degreeLevels, level] : draft.matching.degreeLevels.filter(v => v !== level))} />{level}</label>)}</div>
    </div></details>
    <details className="am-card"><summary>Macro-profile names and questionnaire sections</summary><div className="am-dialog-body">
      <div className="am-form-grid">{['A', 'B', 'C', 'D'].map(profile => field(['profiles', profile], `Profile ${profile} name`))}</div>
      {draft.sections.map((section, index) => <div className="am-assessment-item" key={section.id}>
        {field(['sections', index, 'title'], 'Section title')}<small>Reference: {section.id}. Assign questions to this section in the question editor.</small>
        <div className="am-row-actions">{[-1, 1].map(direction => <button key={direction} type="button" className="am-button am-button-secondary" disabled={index + direction < 0 || index + direction >= draft.sections.length} onClick={() => {
          const sections = [...draft.sections]; [sections[index], sections[index + direction]] = [sections[index + direction], sections[index]]; set(['sections'], sections);
        }}>{direction < 0 ? 'Move section up' : 'Move section down'}</button>)}</div>
        <button type="button" className="am-button am-button-secondary" disabled={draft.sections.length <= 1} onClick={() => set(['sections'], draft.sections.filter(s => s.id !== section.id))}><Trash2 size={14} />Remove section</button>
      </div>)}
      <button type="button" className="am-button am-button-secondary" onClick={() => set(['sections'], [...draft.sections, { id: freshId('section'), title: 'New section' }])}><Plus size={14} />Add section</button>
    </div></details>
    <details className="am-card"><summary>Profile-specific follow-up questions</summary><div className="am-dialog-body">
      {['A', 'B', 'C', 'D'].map(profile => <details className="am-assessment-item" key={profile}><summary>{profile} — {draft.profiles[profile]}</summary>
        {field(['routingQuestions', profile, 'title'], 'Follow-up section title')}{field(['routingQuestions', profile, 'prompt'], 'Follow-up question', { area: true })}
        {draft.routingQuestions[profile].options.map((option, index) => <div className="am-assessment-item" key={option.id}>
          {field(['routingQuestions', profile, 'options', index, 'label'], `Answer ${index + 1}`)}
          <label className="am-field">Umbrella cluster<select value={option.clusterId} onChange={e => set(['routingQuestions', profile, 'options', index, 'clusterId'], e.target.value)}>{draft.clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <button type="button" className="am-button am-button-secondary" disabled={draft.routingQuestions[profile].options.length <= 2} onClick={() => set(['routingQuestions', profile, 'options'], draft.routingQuestions[profile].options.filter(o => o.id !== option.id))}><Trash2 size={14} />Remove answer</button>
        </div>)}
        <button type="button" className="am-button am-button-secondary" onClick={() => set(['routingQuestions', profile, 'options'], [...draft.routingQuestions[profile].options, { id: freshId('answer'), label: 'New answer', clusterId: draft.clusters[0].id }])}><Plus size={14} />Add answer</button>
      </details>)}
    </div></details>
    <details className="am-card"><summary>Career-launch follow-up and preferred schools</summary><div className="am-dialog-body">
      <label className="am-assessment-priority"><input type="checkbox" checked={draft.careerVehicle.enabled} onChange={e => set(['careerVehicle', 'enabled'], e.target.checked)} />Include the career-launch follow-up</label>
      {field(['careerVehicle', 'title'], 'Career-launch section title')}{field(['careerVehicle', 'prompt'], 'Career-launch question', { area: true })}
      {draft.careerVehicle.options.map((option, index) => <div className="am-assessment-item" key={option.id}>
        {field(['careerVehicle', 'options', index, 'label'], `Career answer ${index + 1}`)}{field(['careerVehicle', 'options', index, 'note'], 'Result note', { area: true })}
        <CatalogPicker kind="school" label={`Preferred schools for career answer ${index + 1}`} records={resource.data.schools} selected={option.preferredSchoolIds} onChange={ids => set(['careerVehicle', 'options', index, 'preferredSchoolIds'], ids)} />
        <button type="button" className="am-button am-button-secondary" disabled={draft.careerVehicle.options.length <= 2} onClick={() => set(['careerVehicle', 'options'], draft.careerVehicle.options.filter(o => o.id !== option.id))}><Trash2 size={14} />Remove answer</button>
      </div>)}
      <button type="button" className="am-button am-button-secondary" onClick={() => set(['careerVehicle', 'options'], [...draft.careerVehicle.options, { id: freshId('vehicle'), label: 'New career-launch answer', note: '', preferredSchoolIds: [] }])}><Plus size={14} />Add career answer</button>
    </div></details>
    <details className="am-card"><summary>Umbrella clusters and program matching</summary><div className="am-dialog-body">
      <p>Keywords match complete words in actual program names. Explicit included programs override keyword rules; explicit exclusions always win. Examples are descriptive—not a claim that a school offers them.</p>
      {draft.clusters.map((cluster, index) => <details className="am-assessment-item" key={cluster.id}><summary>{cluster.name}</summary>
        {field(['clusters', index, 'name'], 'Cluster name')}{field(['clusters', index, 'description'], 'Cluster description', { area: true })}
        {['programExamples', 'includeKeywords', 'excludeKeywords'].map(key => <CsvField key={key} label={`${labelFor(key)} (comma separated)`} values={cluster[key]} onChange={value => set(['clusters', index, key], value)} />)}
        <CatalogPicker label={`Included programs for ${cluster.name}`} records={resource.data.programs} selected={cluster.includeProgramIds} onChange={ids => set(['clusters', index, 'includeProgramIds'], ids)} />
        <CatalogPicker label={`Excluded programs for ${cluster.name}`} records={resource.data.programs} selected={cluster.excludeProgramIds} onChange={ids => set(['clusters', index, 'excludeProgramIds'], ids)} />
        <button type="button" className="am-button am-button-secondary" disabled={draft.clusters.length <= 1} onClick={() => set(['clusters'], draft.clusters.filter(c => c.id !== cluster.id))}><Trash2 size={14} />Remove cluster</button>
      </details>)}
      <button type="button" className="am-button am-button-secondary" onClick={() => set(['clusters'], [...draft.clusters, { id: freshId('cluster'), name: 'New umbrella cluster', description: '', programExamples: [], includeKeywords: [], excludeKeywords: [], includeProgramIds: [], excludeProgramIds: [] }])}><Plus size={14} />Add cluster</button>
    </div></details>
    <details className="am-card"><summary>Result display, filters and all assessment text</summary><div className="am-dialog-body">
      {field(['display', 'programPreviewCount'], 'Programs initially shown', { numeric: true })}
      <div className="am-assessment-checks">{['showVoteBreakdown', 'showConstraints', 'showClusterDirectory'].map(flag => <label key={flag}><input type="checkbox" checked={draft.display[flag]} onChange={e => set(['display', flag], e.target.checked)} />{labelFor(flag)}</label>)}</div>
      {['tuitionChoices', 'distanceChoices'].map(key => <CsvField key={key} label={`${labelFor(key)} (comma-separated numbers)`} values={draft.display[key]} numeric onChange={value => set(['display', key], value)} />)}
      <div className="am-form-grid">{Object.keys(draft.copy).map(key => field(['copy', key], labelFor(key), { area: !/Button$|Title$/.test(key) }))}</div>
    </div></details>
  </fieldset><div className="am-dialog-actions"><button className="am-button" disabled={busy}>{busy ? 'Saving…' : 'Save assessment settings'}</button></div></UnsavedForm>;
}

export function AssessmentSettingsEditor({ onSaved }) {
  const resource = useAdminResource('/assessment-settings');
  const { requestDiscard } = useUnsavedChanges();
  return <div><div className="am-card-toolbar"><button type="button" className="am-button am-button-secondary" disabled={resource.loading} onClick={() => requestDiscard(resource.refresh)}>Refresh settings</button></div><Notice error>{resource.error}</Notice>{resource.loading ? <p className="am-loading">Loading assessment settings…</p>
    : resource.data && <Editor key={resource.data.version} resource={resource} onSaved={onSaved} />}</div>;
}
