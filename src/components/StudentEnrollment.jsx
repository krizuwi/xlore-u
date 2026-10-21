import { GraduationCap, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useUnsavedChanges } from '../context/UnsavedChangesContext.jsx';
import { api } from '../lib/api.js';
import { ENROLLMENT_DECLARATION, ENROLLMENT_DECLARATION_VERSION, enrollmentPayload } from '../lib/enrollment.js';
import { UnsavedForm } from './UnsavedForm.jsx';
import './StudentEnrollment.css';

export function EnrollmentFields({ selected, city, checked, onCity, onChecked, declaration = ENROLLMENT_DECLARATION }) {
  return <>
    <div className="enrollment-selected" role="status"><strong>{selected?.name ?? 'No school selected'}</strong>{selected?.city && <span>{selected.city}</span>}</div>
    <label className="enrollment-field"><span>Your home city / municipality</span><input name="city" value={city} onChange={event => onCity(event.target.value)} required maxLength={100} autoComplete="address-level2" placeholder="e.g. Taguig" aria-describedby="enrollment-city-help" /></label>
    <small id="enrollment-city-help">Confirm where you are from, not the school's city. Do not enter your street address.</small>
    <label className="checkbox-row enrollment-declaration"><input type="checkbox" name="usedXloreU" required checked={checked} onChange={event => onChecked(event.target.checked)} /><span>{declaration}</span></label>
    <p className="enrollment-hint">Submit only if this statement is true. This optional report does not affect access to your account. Administrators can see your report and city; it is not posted publicly or verified by the school.</p>
  </>;
}

export function EnrollmentSchoolSearch({ open, search, current, selected, onSearch, onSelect, onOpen, changeButtonRef }) {
  if (!open) return <button ref={changeButtonRef} type="button" className="secondary-btn enrollment-change-school" onClick={onOpen}>Change school</button>;
  return <>
    <label className="enrollment-field"><span><Search size={16} aria-hidden="true" /> Search schools</span><input type="search" name="schoolSearch" value={search} onChange={event => onSearch(event.target.value)} maxLength={100} placeholder="School name, acronym or city (e.g. PUP Taguig)" autoComplete="off" autoFocus aria-controls="enrollment-school-results" aria-describedby="enrollment-search-help" /></label>
    <small id="enrollment-search-help">Search by school name or acronym and add a city to find the right campus.</small>
    {current.loading ? <p role="status">Searching schools…</p> : current.error ? <p className="error-box" role="alert">{current.error}</p> : !current.data.length ? <p role="status">No available schools found. Try a different school name, acronym or city.</p> : <>
      <ul id="enrollment-school-results" className="enrollment-school-results" aria-label="Available schools">{current.data.map(school => <li key={school.id}><button type="button" aria-pressed={selected?.id === school.id} onClick={() => onSelect(school)}><strong>{school.name}</strong><span>{school.city}</span></button></li>)}</ul>
      <small>Showing up to 30 schools, closest matches first. Refine your search if needed. No school is selected automatically.</small>
    </>}
  </>;
}

export function EnrollmentDialog({ record, onClose, onSaved }) {
  const initial = record.enrollment;
  const dialog = useRef(null), changeSchoolButton = useRef(null), { requestDiscard } = useUnsavedChanges();
  const [selected, setSelected] = useState(initial ? { id: initial.schoolId, name: initial.schoolName, city: initial.schoolCity } : null);
  const [choosingSchool, setChoosingSchool] = useState(!initial);
  const [city, setCity] = useState(initial?.city ?? record.suggestedCity ?? ''), [checked, setChecked] = useState(false);
  const [search, setSearch] = useState(''), [results, setResults] = useState({ key: null, data: [], error: '', loading: true });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [withdraw, setWithdraw] = useState(false);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  useEffect(() => { if (!choosingSchool) changeSchoolButton.current?.focus(); }, [choosingSchool]);
  useEffect(() => {
    if (!choosingSchool) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api('/enrollment/schools?search=' + encodeURIComponent(search.trim()), { signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) setResults({ key: search, data: result.data, error: '', loading: false });
      }).catch(err => { if (!controller.signal.aborted) setResults({ key: search, data: [], error: err.message, loading: false }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, choosingSchool]);
  const current = results.key === search ? results : { data: [], error: '', loading: true };
  const close = () => { if (!busy) requestDiscard(onClose, dialog.current); };
  async function submit(event) {
    event.preventDefault(); setError('');
    let body;
    try { body = enrollmentPayload(selected, city, checked, record.declaration?.version ?? ENROLLMENT_DECLARATION_VERSION); }
    catch (err) { setError(err.message); return; }
    setBusy(true);
    try { const saved = await api('/enrollment', { method: 'PUT', body: JSON.stringify(body) }); onSaved(saved); return true; }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function removeReport() {
    setBusy(true); setError('');
    try { const saved = await api('/enrollment', { method: 'DELETE' }); onSaved(saved); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="enrollment-dialog" aria-labelledby="enrollment-dialog-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header><div><span className="section-kicker">Your next chapter</span><h2 id="enrollment-dialog-title">Enrolled?</h2></div><button className="secondary-btn" type="button" disabled={busy} aria-label="Close enrollment report" onClick={close}><X size={20} /></button></header>
    <p>Select the school where you are currently enrolled.</p>
    <UnsavedForm onSubmit={submit}><fieldset disabled={busy} aria-busy={busy}>
      <EnrollmentSchoolSearch open={choosingSchool} search={search} current={current} selected={selected} onSearch={setSearch} changeButtonRef={changeSchoolButton}
        onOpen={() => { setSearch(''); setChoosingSchool(true); }}
        onSelect={school => { setSelected(school); setChoosingSchool(false); setChecked(false); setWithdraw(false); }} />
      <input type="hidden" name="schoolId" value={selected?.id ?? ''} readOnly />
      <EnrollmentFields selected={selected} city={city} checked={checked} onCity={setCity} onChecked={setChecked} declaration={record.declaration?.text ?? ENROLLMENT_DECLARATION} />
      {error && <p className="error-box" role="alert">{error}</p>}
      <div className="enrollment-actions"><button type="button" className="secondary-btn" onClick={close}>Cancel</button><button className="primary-btn" type="submit" disabled={!selected || !checked || busy}>{busy ? 'Saving…' : initial ? 'Update enrollment report' : 'Submit enrollment report'}</button></div>
      {initial && <div className="enrollment-withdraw">{withdraw ? <><p>Withdraw your current report? It will be removed from the enrollment statistics.</p><button type="button" className="secondary-btn" onClick={removeReport}>Confirm withdrawal</button><button type="button" className="text-btn" onClick={() => setWithdraw(false)}>Keep report</button></> : <button type="button" className="text-btn" onClick={() => setWithdraw(true)}>Withdraw my enrollment report</button>}</div>}
    </fieldset></UnsavedForm>
  </dialog>;
}

function AccountEnrollment() {
  const { user } = useAuth();
  const [record, setRecord] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [open, setOpen] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user.emailVerified) return;
    const controller = new AbortController();
    api('/enrollment', { signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setRecord(data); setError(''); } }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [revision, user.emailVerified]);
  return <section className="content-card enrollment-dashboard-card" aria-labelledby="enrollment-card-title">
    <div><span className="section-kicker">Your college journey</span><h2 id="enrollment-card-title">Already enrolled in a school?</h2><p>{record?.enrollment ? <>You reported enrollment at <strong>{record.enrollment.schoolName}</strong>. This is your self-report, not a school verification.</> : 'Tell us where you enrolled and whether Xlore U helped you find it.'}</p>{!user.emailVerified && <p>Verify your email before submitting an enrollment report.</p>}</div>
    <button type="button" className="primary-btn" disabled={!record || !user.emailVerified} onClick={() => { setMessage(''); setOpen(true); }}><GraduationCap size={19} />Enrolled?</button>
    {error && <p className="error-box" role="alert">{error} <button type="button" className="text-btn" onClick={() => setRevision(v => v + 1)}>Try again</button></p>}
    {message && <p className="success-box" role="status">{message}</p>}
    {open && <EnrollmentDialog record={record} onClose={() => setOpen(false)} onSaved={saved => { setRecord(current => ({ ...current, enrollment: saved.enrollment })); setMessage(saved.message); setOpen(false); }} />}
  </section>;
}

export function StudentEnrollment() {
  const { user } = useAuth();
  return user?.role === 'student' ? <AccountEnrollment key={user.id} /> : null;
}
