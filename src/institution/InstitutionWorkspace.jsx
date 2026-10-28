import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { InstitutionApplicationAttempts } from './InstitutionApplicationAttempts.jsx';
import './institution.css';

// Approved institutions manage the school page itself, not a separate dashboard.
export function InstitutionWorkspace() {
  const { user, loading, logout } = useAuth();
  const [resubmission, setResubmission] = useState(null);
  const resubmitting = Boolean(resubmission);
  const [record, setRecord] = useState(null), [error, setError] = useState('');
  async function refresh() {
    try { const data = await api('/institutions/me'); setRecord({ userId: user.id, data }); setError(''); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => {
    if (user?.role !== 'institution') return;
    const controller = new AbortController();
    api('/institutions/me', { signal: controller.signal }).then(data => setRecord({ userId: user.id, data })).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [user?.id, user?.role]);
  if (loading) return <p className="container">Checking account…</p>;
  // Keep the requested destination through logout, instead of racing the normal sign-in redirect.
  if (!user) return resubmission
    ? <Navigate to="/institution/register" replace state={{ resubmitEmail: resubmission.email }} />
    : <Navigate to="/institution/login" replace />;
  if (user.role !== 'institution') return <section className="container page-shell"><h1>Institution account required</h1><p>Sign out and use your institution contact account.</p><Link to="/dashboard">Student dashboard</Link></section>;
  const data = record?.userId === user.id ? record.data : null;
  async function openResubmission() {
    if (resubmitting || !data?.application.canResubmit) return;
    setResubmission({ email: user.email });
    await logout().catch(() => {});
  }
  if (data?.canEdit && data.school?.id) return <Navigate to={`/schools/${data.school.id}`} replace />;
  return <section className="page-shell container institution-page"><header><span className="section-kicker">Institution account</span><h1>{data?.school?.name ?? data?.application.proposedSchool?.name ?? 'Your school'}</h1><p>Application status: <strong>{data?.application.status ?? 'Loading…'}</strong></p><Link className="secondary-btn" to="/institution/settings">Account settings</Link></header>
    {error && <p className="error-box" role="alert">{error}</p>}
    {data && <InstitutionApplicationAttempts application={data.application} onResubmit={openResubmission} busy={resubmitting} />}
    {data && <div className="content-card"><h2>{data.application.status === 'pending' ? 'Waiting for admin verification' : 'School access is not active'}</h2><p>No editing or publishing is available until your school and representative are approved and active.</p><p>{data.application.reviewNote || 'The administrator will review the contact information and evidence you submitted.'}</p><button className="secondary-btn" onClick={refresh}>Refresh application status</button>{data.school?.id && <Link className="text-btn" to={`/schools/${data.school.id}`}>View school page</Link>}</div>}
    {!data && error && <button className="secondary-btn" onClick={refresh}>Try again</button>}
  </section>;
}
