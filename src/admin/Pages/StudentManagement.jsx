import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { studentAccessPayload } from '../../lib/enrollment.js';
import { useLiveRefresh } from '../../context/EngagementContext.jsx';
import '../../components/StudentEnrollment.css';
import './StudentManagement.css';

function useStudents(path) {
  const [state, setState] = useState({ key: null, data: null, error: '', loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ key: path, data, error: '', loading: false });
    }).catch(err => { if (!controller.signal.aborted) setState({ key: path, data: null, error: err.message, loading: false }); });
    return () => controller.abort();
  }, [path, revision]);
  useLiveRefresh(async signal => {
    const data = await api(path, { signal });
    if (!signal.aborted) setState({ key: path, data, error: '', loading: false });
  }, { key: path });
  return { ...(state.key === path ? state : { data: null, error: '', loading: true }), refresh() { setState({ key: path, data: null, error: '', loading: true }); setRevision(value => value + 1); } };
}

export function EnrollmentBarChart({ title, rows = [], total = 0 }) {
  const maximum = Math.max(1, ...rows.map(row => Number(row.count)));
  return <figure className="ad-card student-enrollment-chart"><figcaption><h2>{title}</h2><p>Top 10 · {total} current student {total === 1 ? 'report' : 'reports'} matching filters</p></figcaption>
    {!rows.length ? <p className="ad-empty">No enrollment reports match these filters yet.</p> : <ol>{rows.map(row => <li key={row.id}><div><span>{row.label}</span><strong>{row.count}</strong></div><progress value={row.count} max={maximum} aria-label={`${row.label}: ${row.count} students`} /></li>)}</ol>}
  </figure>;
}

export function StudentRecords({ rows, onAccess, onRetry, busy }) {
  return <div className="student-records-scroll"><table className="ad-table student-records"><caption>Private student records · enrollment is student-reported</caption><thead><tr><th scope="col">Student</th><th scope="col">Home city</th><th scope="col">Assessment</th><th scope="col">Enrollment</th><th scope="col">Account access</th></tr></thead><tbody>
    {rows.map(student => <tr key={student.id}>
      <td><strong>{student.name}</strong><span>{student.email}</span><small>{student.verified ? 'Email verified' : 'Email not verified'}</small></td>
      <td>{student.city ?? 'Not provided'}<small>{student.citySource === 'enrollment_report' ? 'Confirmed in enrollment report' : student.citySource === 'profile_estimate' ? 'Estimated from profile address' : 'No recognizable city recorded'}</small></td>
      <td>{student.usedAssessment ? 'Completed' : 'Not completed'}</td>
      <td>{student.schoolId ? <><strong>{student.schoolName}</strong><small>Enrolled · self-reported</small><small>Used Xlore U and found it helpful</small><time dateTime={student.reportedAt}>{new Date(student.reportedAt).toLocaleDateString()}</time></> : 'Not reported'}</td>
      <td><span className="tag">{student.active ? 'Active' : 'Suspended'}</span>{student.lastAction && <details><summary>Last access decision</summary><p className="student-access-reason">{student.lastAction.reason}</p><small>{new Date(student.lastAction.createdAt).toLocaleString()}</small></details>}
        <button className="secondary-btn" type="button" disabled={busy} onClick={() => onAccess(student)}>{student.active ? 'Suspend account' : 'Restore account'}</button>
        {!student.active && student.lastAction && <><small>Suspension email: {student.lastAction.emailStatus === 'sent' ? 'accepted by email provider' : student.lastAction.emailStatus}</small>{['pending', 'failed', 'sending'].includes(student.lastAction.emailStatus) && <button className="text-btn" type="button" disabled={busy} onClick={() => onRetry(student)}>Retry suspension email</button>}</>}
      </td>
    </tr>)}
  </tbody></table></div>;
}

export function StudentAccessDialog({ student, onClose, onSaved }) {
  const dialog = useRef(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  async function submit(event) {
    event.preventDefault(); setError('');
    let body; try { body = studentAccessPayload(student, reason); } catch (err) { setError(err.message); return; }
    setBusy(true);
    try { const result = await api('/admin/students/' + encodeURIComponent(student.id) + '/access', { method: 'PATCH', body: JSON.stringify(body) }); onSaved(result); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="enrollment-dialog student-access-dialog" aria-labelledby="student-access-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id="student-access-title"><ShieldAlert size={22} /> {student.active ? 'Suspend student account' : 'Restore student account'}</h2><button type="button" className="secondary-btn" disabled={busy} aria-label="Cancel access change" onClick={onClose}><X size={18} /></button></header>
    <p><strong>{student.name}</strong><br />{student.email}</p><p>{student.active ? 'This blocks sign-in and authenticated activity, revokes existing sessions, and emails the student your reason. It does not delete their data.' : 'This restores account access. Revoked sessions stay revoked; the student must sign in again.'}</p>
    <form onSubmit={submit}><fieldset disabled={busy} aria-busy={busy}><label className="enrollment-field"><span>Administrator reason</span><textarea required minLength={1} maxLength={2000} rows={4} name="reason" value={reason} onChange={event => setReason(event.target.value)} autoFocus aria-describedby="student-reason-help" /></label><small id="student-reason-help">{reason.length} / 2000 · Do not include passwords, private student records or unrelated personal details.</small>{error && <p role="alert" className="error-box">{error}</p>}<div className="enrollment-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button type="submit" className="primary-btn" disabled={!reason.trim() || busy}>{busy ? 'Saving…' : student.active ? 'Confirm suspension' : 'Confirm restore'}</button></div></fieldset></form>
  </dialog>;
}

export function StudentManagement() {
  const [search, setSearch] = useState(''), [appliedSearch, setAppliedSearch] = useState(''), [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', enrollment: '', assessment: '' });
  const [selected, setSelected] = useState(null), [message, setMessage] = useState(''), [writeError, setWriteError] = useState(''), [retrying, setRetrying] = useState(false);
  useEffect(() => { const timer = setTimeout(() => { setAppliedSearch(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  const params = new URLSearchParams({ search: appliedSearch, page: String(page), ...filters });
  const resource = useStudents('/admin/students?' + params);
  const pending = search.trim() !== appliedSearch || resource.loading;
  const report = resource.data, summary = report?.summary, pagination = report?.pagination;
  const filter = (name, value) => { setFilters(current => ({ ...current, [name]: value })); setPage(1); };
  async function retryEmail(student) {
    setRetrying(true); setWriteError(''); setMessage('');
    try { const result = await api('/admin/students/' + encodeURIComponent(student.id) + '/suspension-email/retry', { method: 'POST' }); setMessage(result.message); resource.refresh(); }
    catch (err) { setWriteError(err.message); } finally { setRetrying(false); }
  }
  return <div className="student-admin-page">
    <div className="ad-page-heading"><div><h1>Students & enrollment</h1><p>Private student account information and voluntary enrollment reports.</p></div><button type="button" className="secondary-btn" onClick={resource.refresh}><RefreshCw size={17} /> Refresh</button></div>
    <section className="ad-card student-management-filters" aria-label="Student search and filters">
      <form onSubmit={event => { event.preventDefault(); setAppliedSearch(search.trim()); setPage(1); }}><label htmlFor="student-search"><Search size={17} /> Search students</label><div><input id="student-search" type="search" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Name, email, home city or enrolled school" /><button type="submit" className="primary-btn">Search</button>{search && <button type="button" className="secondary-btn" onClick={() => { setSearch(''); setAppliedSearch(''); setPage(1); }}>Clear</button>}</div></form>
      <div className="student-management-selects"><label>Account status<select value={filters.status} onChange={event => filter('status', event.target.value)}><option value="">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label><label>Enrollment<select value={filters.enrollment} onChange={event => filter('enrollment', event.target.value)}><option value="">All students</option><option value="reported">Enrollment reported</option><option value="unreported">Not reported</option></select></label><label>Assessment<select value={filters.assessment} onChange={event => filter('assessment', event.target.value)}><option value="">Any assessment status</option><option value="completed">Completed</option><option value="not_completed">Not completed</option></select></label></div>
      <p>Charts follow these filters across all matching records, not just this page. One current report per student. These are self-reports, not verified admissions, school rankings, or proof that Xlore U caused enrollment.</p>
    </section>
    {message && <p className="success-box" role="status">{message}</p>}{writeError && <p className="error-box" role="alert">{writeError}</p>}
    {resource.error ? <p className="error-box" role="alert">{resource.error} <button type="button" className="text-btn" onClick={resource.refresh}>Try again</button></p> : pending ? <p role="status">Loading student records…</p> : report && <>
      <div className="student-summary">{[['Students', summary.total], ['Assessment completed', summary.assessed], ['Enrollment reported', summary.enrolled], ['Suspended accounts', summary.suspended]].map(([label, value]) => <section className="ad-card" key={label}><span>{label}</span><strong>{value}</strong></section>)}</div>
      <div className="student-charts"><EnrollmentBarChart title="Most selected enrolled schools" rows={report.charts.schools} total={summary.enrolled} /><EnrollmentBarChart title="Home cities of enrolled students" rows={report.charts.cities} total={summary.enrolled} /></div>
      <section className="ad-card student-list-card"><h2>Student records</h2>{!report.data.length ? <p>No students match these filters.</p> : <StudentRecords rows={report.data} onAccess={student => { setMessage(''); setWriteError(''); setSelected(student); }} onRetry={retryEmail} busy={retrying} />}
        <div className="student-record-pagination"><span>{pagination.total} matching students · page {pagination.page} of {pagination.pages}</span><button type="button" className="secondary-btn" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}><ChevronLeft size={16} />Previous</button><button type="button" className="secondary-btn" disabled={pagination.page >= pagination.pages} onClick={() => setPage(pagination.page + 1)}>Next<ChevronRight size={16} /></button></div>
      </section>
    </>}
    {selected && <StudentAccessDialog student={selected} onClose={() => setSelected(null)} onSaved={result => { setSelected(null); setMessage(result.message + (!result.active ? result.emailStatus === 'sent' ? ' The email provider accepted the suspension notice.' : ' The email was not confirmed as sent; check its status and retry if needed.' : '')); resource.refresh(); }} />}
  </div>;
}
