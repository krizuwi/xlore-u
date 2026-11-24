import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { UnsavedForm } from '../components/UnsavedForm.jsx';
import { useUnsavedChanges } from '../context/UnsavedChangesContext.jsx';
import { SchoolMediaFields } from '../admin/Management/SchoolMediaFields.jsx';
import { schoolMediaUrl } from '../lib/school-media.js';
import { SchoolCoordinateHelp } from '../components/SchoolCoordinateHelp.jsx';
import { ProgramClustersField } from '../admin/Management/ProgramsManagement/ProgramCatalogFields.jsx';
import { catalogOptionList, normalizeCatalogOption } from '../lib/assessmentProgramFilters.js';
import '../admin/Management/management.css';
import './institution.css';

const blankPost = { title: '', body: '', link: '', images: [], status: 'published' };
const blankProgram = { name: '', category: '', degreeLevel: 'Bachelor', description: '', requirements: '', tuition: '', sourceUrl: '', careerPaths: [], interestTags: [], clusterIds: [], isTopProgram: false };

export function ProfileEditor({ school, save, mediaOnly = false, onBusyChange }) {
  const [form, setForm] = useState(() => ({ ...school, media: { logoUrl: school.logoUrl ?? '', logoCredit: school.logoCredit ?? {}, campusPhotos: school.campusPhotos ?? [] } }));
  const [uploading, setUploading] = useState(false);
  const field = (key, label, type = 'text', required = true) => <label>{label}<input type={type} step={type === 'number' ? 'any' : undefined} min={key === 'latitude' ? -90 : key === 'longitude' ? -180 : undefined} max={key === 'latitude' ? 90 : key === 'longitude' ? 180 : undefined} required={required} maxLength={key === 'website' ? 2000 : key === 'tuitionRange' ? 80 : key === 'city' ? 100 : 255} value={form[key] ?? ''} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>;
  return <UnsavedForm className="institution-form" onSubmit={event => { event.preventDefault(); return save('/profile', 'PUT', form); }}>
    <p>Your school identity and activation are admin-controlled. These edits update only {school.name}.</p>
    <fieldset disabled={uploading}>
      {!mediaOnly && <><div className="institution-fields">{field('address', 'Campus address')}{field('city', 'City')}{field('latitude', 'Latitude (optional)', 'number', false)}{field('longitude', 'Longitude (optional)', 'number', false)}{field('website', 'Official HTTPS website', 'url')}{field('tuitionRange', 'General tuition information', 'text', false)}</div>
        <SchoolCoordinateHelp />
        <label>Description<textarea maxLength={5000} value={form.description ?? ''} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
        <label>Scholarships<textarea maxLength={5000} value={form.scholarshipInfo ?? ''} onChange={event => setForm({ ...form, scholarshipInfo: event.target.value })} /></label></>}
      {mediaOnly && <SchoolMediaFields media={form.media} onChange={media => setForm({ ...form, media })} school={school} onBusyChange={value => { setUploading(value); onBusyChange?.(value); }} uploadPath="/institutions/media/assets" saveLabel="Save school photos" />}
      <button className="primary-btn" disabled={uploading}>{mediaOnly ? 'Save school photos' : 'Save school profile'}</button>
    </fieldset>
  </UnsavedForm>;
}

function programForm(program) {
  return program ? { ...blankProgram, ...program, ...(program.details ?? {}), programId: program.id, tuition: program.tuition ?? '', sourceUrl: program.sourceUrl ?? '' } : { ...blankProgram };
}
export function ProgramEditor({ initialProgram, save }) {
  const [form, setForm] = useState(() => programForm(initialProgram));
  const [search, setSearch] = useState(''), [catalog, setCatalog] = useState([]), [clusters, setClusters] = useState([]), [clustersLoading, setClustersLoading] = useState(true), [error, setError] = useState('');
  const [programOptions, setProgramOptions] = useState({ categories: [], degreeLevels: [] });
  const { requestDiscard } = useUnsavedChanges();
  useEffect(() => {
    const controller = new AbortController();
    api('/institutions/program-clusters', { signal: controller.signal }).then(result => setClusters(result.data ?? []))
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setClustersLoading(false); });
    api('/schools/meta/filters', { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setProgramOptions({
        categories: catalogOptionList(result.specializations ?? []),
        degreeLevels: catalogOptionList(result.degreeLevels ?? [])
      });
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (initialProgram) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api('/programs?limit=50&search=' + encodeURIComponent(search), { signal: controller.signal }).then(result => setCatalog(result.data)).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, initialProgram]);
  const shared = Boolean(form.programId) && !form.metadataEditable;
  const canEditClusters = !form.programId || form.metadataEditable === true;
  const field = (key, label, required = true) => <label>{label}<input required={required} maxLength={key === 'sourceUrl' ? 2000 : 190} readOnly={shared && ['name', 'category', 'degreeLevel'].includes(key)} value={form[key] ?? ''} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>;
  const optionField = (key, label, values, fallback) => shared
    ? <label>{label}<input required value={form[key] ?? ''} readOnly /></label>
    : <label>{label}<select className="am-catalog-select" required value={normalizeCatalogOption(form[key]) || fallback} onChange={event => setForm({ ...form, [key]: event.target.value })}>
      <option value="" disabled>Select {label.toLowerCase()}</option>
      {catalogOptionList([...values, form[key]]).map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>;
  return <div className="institution-form">
    {!initialProgram && <section className="school-catalog-picker"><h3>Choose an existing program</h3>
      <label>Search existing programs<input type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Catalog program<select value="" onChange={event => { const program = catalog.find(row => row.id === event.target.value); if (program) requestDiscard(() => setForm(programForm(program))); }}><option value="">Choose a program to add</option>{catalog.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
      <button className="text-btn" onClick={() => requestDiscard(() => setForm(programForm()))}>My program is new — create a program</button></section>}
    {error && <p role="alert">{error}</p>}
    <UnsavedForm key={form.programId ?? 'new'} className="institution-form" onSubmit={event => { event.preventDefault(); return save('/programs', 'PUT', { ...form, category: normalizeCatalogOption(form.category), degreeLevel: normalizeCatalogOption(form.degreeLevel) }); }}>
      <h3>{form.programId ? 'School offering details' : 'New school program'}</h3>
      <p>Shared catalog titles/category/degree cannot be changed for other schools. Your description, requirements, fee, and source link belong to your offering.</p>
      <div className="institution-fields">{field('name', 'Program title')}{optionField('category', 'Category', programOptions.categories, '')}{optionField('degreeLevel', 'Degree level', programOptions.degreeLevels, 'Bachelor')}
        <label>Tuition per semester (PHP, blank if unknown)<input type="number" min="0" max="99999999" step="0.01" value={form.tuition} onChange={event => setForm({ ...form, tuition: event.target.value })} /></label>{field('sourceUrl', 'Official program HTTPS link', false)}</div>
      <label>Description<textarea required maxLength={5000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <label>Requirements<textarea maxLength={5000} value={form.requirements} onChange={event => setForm({ ...form, requirements: event.target.value })} /></label>
      <label>Career paths (one per line)<textarea value={(form.careerPaths ?? []).join('\n')} onChange={event => setForm({ ...form, careerPaths: event.target.value.split('\n') })} /></label>
      <ProgramClustersField clusters={clusters} selected={form.clusterIds ?? []} disabled={!canEditClusters} loading={clustersLoading}
        onChange={clusterIds => setForm({ ...form, clusterIds })} />
      {!canEditClusters && <p className="am-description">This catalog program is shared. Its assessment cluster assignment is managed by the catalog owner.</p>}
      <label className="checkbox-row"><input type="checkbox" checked={form.isTopProgram} onChange={event => setForm({ ...form, isTopProgram: event.target.checked })} /><span>Highlight this program</span></label>
      <button className="primary-btn" disabled={clustersLoading}>Save school program</button>
    </UnsavedForm>
  </div>;
}

export function PostEditor({ initialPost, save, onBusyChange }) {
  const [form, setForm] = useState(() => ({ ...blankPost, ...initialPost }));
  const [uploading, setUploading] = useState(false), [error, setError] = useState('');
  async function upload(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) { setError('Use PNG, JPEG or WebP up to 4 MB.'); return; }
    setUploading(true); onBusyChange?.(true); setError('');
    try { const image = await api('/institutions/media/assets', { method: 'POST', headers: { 'Content-Type': file.type }, body: file }); setForm(current => ({ ...current, images: [...current.images, { url: image.url, caption: '' }] })); }
    catch (err) { setError(err.message); } finally { setUploading(false); onBusyChange?.(false); }
  }
  return <UnsavedForm className="institution-form" onSubmit={event => { event.preventDefault(); return save(form.id ? '/posts/' + form.id : '/posts', form.id ? 'PUT' : 'POST', form); }}>
    <fieldset disabled={uploading}>
      <p>Publish immediately — posts do not need a separate admin approval. Save a draft if you are not ready to share. Administrators can hide or delete inappropriate posts. Do not post private student records. Editing cannot remove admin moderation.</p>
      <label>Title<input required maxLength={180} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
      <label>Post<textarea required rows={8} maxLength={10000} value={form.body} onChange={event => setForm({ ...form, body: event.target.value })} /></label>
      <label>HTTPS link (optional)<input type="url" maxLength={2000} value={form.link ?? ''} onChange={event => setForm({ ...form, link: event.target.value })} /></label>
      {form.images.map((image, index) => <div key={index} className="institution-post-image"><img src={schoolMediaUrl(image.url)} alt={image.caption || 'Post image preview'} referrerPolicy="no-referrer" />
        <label>Photo caption<input maxLength={200} value={image.caption} onChange={event => setForm({ ...form, images: form.images.map((row, i) => i === index ? { ...row, caption: event.target.value } : row) })} /></label>
        <button type="button" className="text-btn" onClick={() => setForm({ ...form, images: form.images.filter((_, i) => i !== index) })}>Remove photo</button></div>)}
      <label>Upload photo (up to six)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={form.images.length >= 6} onChange={upload} /></label>
      <label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="draft">Draft — not public</option><option value="published">Publish now — no post approval required</option></select></label>
      {error && <p role="alert">{error}</p>}<button className="primary-btn">{form.status === 'published' ? 'Publish post' : 'Save draft'}</button>
    </fieldset>
  </UnsavedForm>;
}
