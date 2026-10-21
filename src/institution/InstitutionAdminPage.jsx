import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { SchoolRequestFields } from './InstitutionAuthPage.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { InstitutionPostModeration } from './InstitutionPostModeration.jsx';
import { RepresentativeDetails } from './RepresentativeDetails.jsx';
import './institution.css';

export function ApplicationSearchFilters({ status, search, onStatusChange, onSearchChange }) {
  return <div className="institution-application-filters">
    <label htmlFor="institution-application-status">Application status<select id="institution-application-status" value={status} onChange={event => onStatusChange(event.target.value)}>{['pending', 'approved', 'rejected', 'suspended'].map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    <label htmlFor="institution-application-search">Search applications<span className="institution-application-search"><Search size={19} aria-hidden="true" /><input id="institution-application-search" type="search" maxLength={100} placeholder="Search school, representative, or email..." value={search} onChange={event => onSearchChange(event.target.value)} /></span></label>
    {search && <button type="button" className="secondary-btn" onClick={() => onSearchChange('')}>Clear search</button>}
  </div>;
}

export function SuspensionEmailStatus({ application, save }) {
  const email = application.suspensionEmail;
  if (application.status !== 'suspended' || !email) return null;
  return <div className="institution-email-status"><p>{email.state === 'sent' ? 'Suspension email accepted for delivery. Inbox delivery is not guaranteed.' : email.state === 'sending' ? 'Suspension email is processing. A failed or interrupted attempt can be retried after two minutes.' : email.state === 'cancelled' ? 'This email notice is no longer current.' : 'Suspension saved, but the reason email has not been sent.'}</p>
    {['pending', 'failed', 'sending'].includes(email.state) && <button type="button" className="secondary-btn" onClick={() => save(`/applications/${application.id}/suspension-email/retry`, 'POST', {})}>Retry suspension email</button>}
  </div>;
}

function ApplicationReview({ application, save }) {
  const [note, setNote] = useState(''), [verified, setVerified] = useState(false), [school, setSchool] = useState(application.proposedSchool);
  return <article className="content-card institution-form institution-application-card"><h2>{application.schoolName ?? application.proposedSchool?.name}</h2><RepresentativeDetails application={application} />
    {application.proposedSchool && !application.schoolId && <details><summary>Review/correct new-school details before approval</summary><SchoolRequestFields value={school} onChange={setSchool} /></details>}
    {application.reviewNote && <p>Previous decision: {application.reviewNote}</p>}<SuspensionEmailStatus application={application} save={save} /><label>Review reason / instructions<textarea required maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
    <p>This reason is shared privately with the account owner. Suspension reasons are also emailed to their registered account. Do not include other people's private data.</p>
    {['pending', 'suspended'].includes(application.status) && <label className="checkbox-row"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} /><span>I independently verified this representative's authority for this school.</span></label>}
    <div className="institution-actions">{application.status === 'pending' && <><button className="primary-btn" disabled={!verified || !application.emailVerified || !note.trim()} onClick={() => save(`/applications/${application.id}/review`, 'POST', { decision: 'approve', note, verifiedAuthority: verified, school })}>Approve and activate</button><button className="secondary-btn" disabled={!note.trim()} onClick={() => save(`/applications/${application.id}/review`, 'POST', { decision: 'reject', note })}>Reject request</button></>}
      {application.status === 'approved' && <button className="secondary-btn" disabled={!note.trim()} onClick={() => save(`/applications/${application.id}/review`, 'POST', { decision: 'suspend', note })}>Suspend institution access</button>}
      {application.status === 'suspended' && <button className="primary-btn" disabled={!verified || !note.trim()} onClick={() => save(`/applications/${application.id}/review`, 'POST', { decision: 'resume', note, verifiedAuthority: verified })}>Restore verified access</button>}
    </div></article>;
}

export function InstitutionAdminPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('pending'), [search, setSearch] = useState(''), [resource, setResource] = useState(null), [tab, setTab] = useState('applications'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [notice, setNotice] = useState('');
  const key = JSON.stringify([status, search, revision]);
  const ready = resource?.key === key, loading = !ready;
  const applications = ready ? resource.data : [];
  useEffect(() => {
    if (tab !== 'applications') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api('/admin/institutions/applications?' + new URLSearchParams({ status, search }), { signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) setResource({ key, data: result.data });
      }).catch(err => { if (!controller.signal.aborted) setResource({ key, data: [], error: err.message }); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tab, status, search, revision, key]);
  async function save(path, method, body) {
    setBusy(true); setError(''); setNotice('');
    try { const result = await api('/admin/institutions' + path, { method, body: JSON.stringify(body) }); setNotice(result.message ?? 'Saved.'); setRevision(value => value + 1); return true; }
    catch (err) { setError(err.message); return false; } finally { setBusy(false); }
  }
  return <section className="institution-page"><h1>Institution accounts & community</h1><nav className="institution-tabs"><button disabled={busy} onClick={() => setTab('applications')} aria-current={tab === 'applications' ? 'page' : undefined}>School applications</button><button disabled={busy} onClick={() => setTab('moderation')} aria-current={tab === 'moderation' ? 'page' : undefined}>Posts & comment moderation</button></nav>
    {notice && <p role="status">{notice}</p>}
    {tab === 'applications' ? <>{error && <p role="alert" className="error-box">{error}</p>}<fieldset disabled={busy} className="institution-form">
      <ApplicationSearchFilters status={status} search={search} onStatusChange={setStatus} onSearchChange={setSearch} />
      <p>Showing up to 200 matching applications in the selected status, oldest first. Search by existing or requested school name, representative, or contact email. New schools are not directory records until approval. Existing-school claims also need verification.</p>
      {loading && <p role="status">Searching applications…</p>}
      {ready && resource.error && <p role="alert" className="error-box">{resource.error} <button type="button" className="text-btn" onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
      {applications.map(application => <ApplicationReview key={application.id + ':' + application.status} application={application} save={save} />)}
      {ready && !resource.error && !applications.length && <p role="status">{search.trim() ? 'No matching applications in this status. Try another school, representative, or email, or clear the search.' : 'No applications in this status.'}</p>}
    </fieldset></>
      : <InstitutionPostModeration user={user} />}
  </section>;
}
