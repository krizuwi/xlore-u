import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, Search } from 'lucide-react';
import { adminWrite, useAdminResource } from '../lib/adminApi.js';
import { ErrorMessage, LoadingState, SuccessMessage } from '../../components/Feedback.jsx';
import { ContactConversation } from '../../components/ContactConversation.jsx';
import './ContactMessages.css';

function MessageResults({ path, page, setPage }) {
  const resource = useAdminResource(path);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function changeStatus(item, status) {
    if (busy) return;
    setBusy(item.id); setError(''); setNotice('');
    try {
      await adminWrite(`/messages/${item.id}`, 'PATCH', { status });
      setNotice(`Message marked ${status}.`); resource.refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }
  const report = resource.data;
  const pages = Math.max(1, Math.ceil((report?.total ?? 0) / 20));
  return <div className="admin-contact-results" aria-busy={resource.loading}>
    <ErrorMessage message={error || resource.error} /><SuccessMessage message={notice} />
    {resource.loading ? <LoadingState label="Loading contact messages…" /> : resource.error ? <button type="button" className="secondary-btn" onClick={resource.refresh}>Try again</button> : <>
      <p className="admin-contact-count" role="status">{report?.total ?? 0} message{report?.total === 1 ? '' : 's'} found · Page {page} of {pages}</p>
      {report?.data?.length ? report.data.map(item => <article className="admin-contact-card" key={item.id}>
        <header><div><span className={`admin-contact-status is-${item.status}`}>{item.status}</span><span className="admin-contact-type">{item.senderType === 'institution' ? 'Institution' : 'Student'}</span><h2>{item.name}</h2></div><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></header>
        <dl><div><dt>Contact email (provided by sender)</dt><dd>{item.email}</dd></div><div><dt>Signed-in account</dt><dd>{item.accountName}<br />{item.accountEmail}</dd></div></dl>
        <h3>Message</h3><p className="admin-contact-body">{item.message}</p>
        <div className="admin-contact-actions" aria-label={`Manage message from ${item.name}`}>
          <Link className="primary-btn" to={'/admin/messages?thread=' + encodeURIComponent(item.id)}>View conversation &amp; reply</Link>
          {['new', 'read', 'closed'].filter(status => status !== item.status).map(status => <button type="button" className="secondary-btn" key={status} disabled={Boolean(busy)} onClick={() => changeStatus(item, status)}>{busy === item.id ? 'Saving…' : status === 'new' ? 'Mark as new' : status === 'read' ? 'Mark as read' : 'Close message'}</button>)}
        </div>
      </article>) : <div className="admin-contact-card"><Mail size={28} aria-hidden="true" /><h2>No messages found</h2><p>Messages from students and institution representatives will appear here. Try a different search or status filter.</p></div>}
      <nav className="admin-contact-pagination" aria-label="Contact message pages"><button className="secondary-btn" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="secondary-btn" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></nav>
    </>}
  </div>;
}

export function ContactMessages() {
  const [params] = useSearchParams(), [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState('all'), [page, setPage] = useState(1);
  const path = `/messages?${new URLSearchParams({ search, status, page: String(page) })}`;
  return <section className="admin-contact-page"><header><span className="section-kicker">Private support inbox</span><h1>Contact messages</h1><p>Read and reply privately to students and institutions. Replies notify the account in Xlore U, not by email. Account replies bring conversations back to New.</p></header>
    {params.get('thread') && <ContactConversation threadId={params.get('thread')} administrator onActivity={() => setRevision(value => value + 1)} />}
    <form className="admin-contact-filters" onSubmit={event => { event.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
      <label><span>Search messages</span><div className="admin-contact-search"><Search size={18} aria-hidden="true" /><input type="search" value={draft} maxLength={150} onChange={event => setDraft(event.target.value)} placeholder="Name, email, or message…" /></div></label>
      <label><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">All messages</option><option value="new">New</option><option value="read">Read</option><option value="closed">Closed</option></select></label>
      <button className="primary-btn" type="submit">Search</button><button className="secondary-btn" type="button" onClick={() => { setDraft(''); setSearch(''); setStatus('all'); setPage(1); }}>Clear</button>
    </form>
    <MessageResults key={path + ':' + revision} path={path} page={page} setPage={setPage} />
  </section>;
}
