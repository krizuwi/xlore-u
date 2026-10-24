import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Mail, Send, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { UnsavedForm } from '../components/UnsavedForm.jsx';
import { ErrorMessage, LoadingState, SuccessMessage } from '../components/Feedback.jsx';
import { personalNameInput, validatePersonalName } from '../lib/identity-validation.js';
import { api } from '../lib/api.js';
import { ContactConversation } from '../components/ContactConversation.jsx';
import { useLiveRefresh } from '../context/EngagementContext.jsx';
import './SupportPages.css';

function ContactForm({ user, onSent }) {
  const [form, setForm] = useState({ name: user.fullName ?? '', email: user.email ?? '', message: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false);
  const pending = useRef(false), request = useRef(null);
  function update(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })); setError(''); }
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError('');
    try {
      const item = { name: form.name.trim(), email: form.email.trim(), message: form.message.trim() };
      validatePersonalName(item.name, 'Name');
      if (Array.from(item.name).length < 2 || Array.from(item.message).length < 10) throw new Error('Enter your name (at least 2 characters) and a message of at least 10 characters.');
      const fingerprint = JSON.stringify(item);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      await api('/contact', { method: 'POST', body: JSON.stringify({ ...item, requestId: request.current.id }) });
      setSent(true);
      onSent?.();
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  if (sent) return <div className="support-card"><SuccessMessage message="Your message has been sent to the admin inbox." /><p>View it in My conversations below. Admin replies will appear there and in your notifications. There is no guaranteed response time; this form does not send email.</p><button type="button" className="secondary-btn" onClick={() => { request.current = null; setForm(current => ({ ...current, message: '' })); setSent(false); }}>Send another message</button></div>;
  return <UnsavedForm className="support-card support-form" onSubmit={submit}>
    <h2>Start a new conversation</h2><p>Signed in as {user.role === 'institution' ? 'an institution representative' : 'a student'}. Only administrators can read your message.</p>
    <ErrorMessage message={error} />
    <label htmlFor="contact-name">Your name</label><div className="support-input"><UserRound size={18} aria-hidden="true" /><input id="contact-name" name="name" autoComplete="name" value={form.name} onChange={update} required minLength={2} maxLength={100} disabled={busy} {...personalNameInput} /></div>
    <label htmlFor="contact-email">Contact email</label><div className="support-input"><Mail size={18} aria-hidden="true" /><input id="contact-email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} required maxLength={190} disabled={busy} aria-describedby="contact-email-hint" /></div>
    <small id="contact-email-hint">Use an address where the administrator can contact you if needed.</small>
    <label htmlFor="contact-message">Your message</label><textarea id="contact-message" name="message" value={form.message} onChange={update} required minLength={10} maxLength={3000} rows={7} disabled={busy} placeholder="Describe your question or the issue you encountered…" aria-describedby="contact-message-hint contact-count" />
    <div className="support-field-meta"><small id="contact-message-hint">10–3,000 characters. Do not send passwords, verification codes, or sensitive documents.</small><small id="contact-count">{form.message.length.toLocaleString()} / 3,000</small></div>
    <p className="support-privacy"><ShieldCheck size={18} aria-hidden="true" />Your name, email, message, and account association are stored privately for support. <Link to="/privacy">Privacy Policy</Link></p>
    <button className="primary-btn" type="submit" disabled={busy}><Send size={17} aria-hidden="true" />{busy ? 'Sending…' : 'Send message'}</button>
  </UnsavedForm>;
}

function ContactHistory({ selected, revision }) {
  const [page, setPage] = useState(1), [state, setState] = useState({ data: null, loading: true, error: '' }), [retry, setRetry] = useState(0);
  const path = '/contact?page=' + page;
  useEffect(() => { setPage(1); }, [revision]);
  useEffect(() => {
    const controller = new AbortController(); setState(current => ({ ...current, loading: true, error: '' }));
    api(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setState({ data, loading: false, error: '' }); }).catch(error => { if (!controller.signal.aborted) setState(current => ({ ...current, loading: false, error: error.message })); });
    return () => controller.abort();
  }, [path, revision, retry]);
  useLiveRefresh(async signal => { const data = await api(path, { signal }); if (!signal.aborted) setState({ data, loading: false, error: '' }); }, { key: path, enabled: !state.loading });
  const pages = Math.max(1, Math.ceil((state.data?.total ?? 0) / 20));
  return <section className="support-card" aria-labelledby="contact-history-title"><h2 id="contact-history-title">My conversations</h2><p>Open a message to read the administrator’s replies and continue the conversation.</p>
    <ErrorMessage message={state.error} />{state.error && <button type="button" className="secondary-btn" onClick={() => setRetry(value => value + 1)}>Try again</button>}
    {state.loading ? <LoadingState label="Loading your messages…" /> : !state.error && <>
      {state.data?.data?.length ? <ul className="contact-history-list">{state.data.data.map(item => <li key={item.id}><Link to={'/contact?thread=' + encodeURIComponent(item.id)} aria-current={selected === item.id ? 'page' : undefined}><strong>{item.preview}</strong><span>Status: {item.status} · View conversation</span><time dateTime={item.updatedAt}>Last activity: {new Date(item.updatedAt).toLocaleString()}</time></Link></li>)}</ul> : <p>No contact conversations yet. Send a message to get started.</p>}
      <nav className="contact-history-pagination" aria-label="Your conversation pages"><button className="secondary-btn" type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><small>Page {page} of {pages}</small><button className="secondary-btn" type="button" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </>}
  </section>;
}

function ContactAccount({ user }) {
  const [params] = useSearchParams(), [revision, setRevision] = useState(0);
  const threadId = params.get('thread');
  const refresh = () => setRevision(value => value + 1);
  return <>
    {threadId && <ContactConversation threadId={threadId} onActivity={refresh} />}
    <ContactForm key={threadId || 'new'} user={user} onSent={refresh} />
    <ContactHistory selected={threadId} revision={revision} />
  </>;
}

export function ContactPage() {
  const { user, loading } = useAuth();
  const location = useLocation(), from = location.pathname + location.search;
  return <section className="page-shell support-page support-contact container"><header className="support-heading"><span className="section-kicker">We’re here to help</span><h1>Contact Admin</h1><p>Have a question about your account or something in Xlore U? Send a private message to the administrator.</p></header>
    {loading ? <LoadingState label="Loading your account…" /> : !user ? <div className="support-card"><h2>Sign in to send a message</h2><p>Use your student or institution account so the administrator can identify your request.</p><div className="support-actions"><Link className="primary-btn" to="/login" state={{ from }}>Student sign in</Link><Link className="secondary-btn" to="/institution/login" state={{ from }}>Institution sign in</Link></div></div> : user.role === 'admin' ? <div className="support-card"><h2>Your contact inbox</h2><Link className="primary-btn" to="/admin/messages">Review contact messages</Link></div> : !user.emailVerified ? <div className="support-card"><h2>Verify your account email first</h2><p>Finish email verification before sending a support message.</p><Link className="secondary-btn" to={user.role === 'institution' ? '/institution/login' : '/login'} state={{ from }}>Go to sign in</Link></div> : <ContactAccount key={user.id} user={user} />}
  </section>;
}
