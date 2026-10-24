import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { api } from '../lib/api.js';
import { useLiveRefresh } from '../context/EngagementContext.jsx';
import { mergeContactReplies, validateContactReplyText } from '../lib/contact-conversations.js';
import { UnsavedForm } from './UnsavedForm.jsx';
import { ErrorMessage, LoadingState, SuccessMessage } from './Feedback.jsx';
import './ContactConversation.css';

export function ContactConversationEntries({ thread, replies, administrator = false }) {
  const owner = administrator ? thread.senderType === 'institution' ? 'Institution representative' : 'Student' : 'You';
  return <ol className="contact-conversation-entries" aria-label="Conversation messages">
    <li className="contact-conversation-entry is-owner"><header><strong>{owner} · Original message</strong><time dateTime={thread.createdAt}>{new Date(thread.createdAt).toLocaleString()}</time></header><p>{thread.message}</p></li>
    {replies.map(reply => <li className={`contact-conversation-entry is-${reply.authorType === 'admin' ? 'admin' : 'owner'}`} key={reply.id}><header><strong>{reply.authorType === 'admin' ? 'Administrator' : owner}</strong><time dateTime={reply.createdAt}>{new Date(reply.createdAt).toLocaleString()}</time></header><p>{reply.message}</p></li>)}
  </ol>;
}

export function ContactReplyForm({ message, onChange, busy, error, notice, administrator, onSubmit }) {
  return <UnsavedForm className="contact-reply-form" onSubmit={onSubmit}>
    <SuccessMessage message={notice} /><ErrorMessage message={error} />
    <label htmlFor="contact-reply">{administrator ? 'Your reply to this account' : 'Reply to Admin'}</label>
    <textarea id="contact-reply" name="reply" rows={4} required maxLength={3000} value={message} disabled={busy} onChange={onChange} aria-describedby="contact-reply-hint" placeholder="Write your reply…" />
    <small id="contact-reply-hint">{message.length.toLocaleString()} / 3,000 characters. Do not include passwords, verification codes, or sensitive documents.</small>
    <p>{administrator ? 'This sends an in-app notification to the account that started this conversation, not an email.' : 'Your reply will bring this conversation back to New in the admin inbox, even if it was closed.'}</p>
    <button type="submit" className="primary-btn" disabled={busy}><Send size={17} aria-hidden="true" />{busy ? 'Sending reply…' : 'Send reply'}</button>
  </UnsavedForm>;
}

function ConversationPanel({ threadId, administrator, onActivity }) {
  const base = `${administrator ? '/admin/messages' : '/contact'}/${encodeURIComponent(threadId)}`;
  const [record, setRecord] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [sendError, setSendError] = useState(''), [notice, setNotice] = useState('');
  const request = useRef(null), pending = useRef(false), draft = useRef(null), root = useRef(null);
  const load = useCallback(async (before = null) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try {
      const data = await api(base + (before ? '?before=' + encodeURIComponent(before) : ''), { signal: controller.signal });
      if (!controller.signal.aborted) setRecord(current => ({ ...data,
        replies: mergeContactReplies(current?.replies ?? [], data.replies),
        nextCursor: data.nextCursor }));
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [base]);
  useEffect(() => { load(); root.current?.scrollIntoView({ block: 'start' }); return () => request.current?.abort(); }, [load]);
  useLiveRefresh(() => { if (!pending.current && !loading) return load(); }, { key: base });
  async function submit(event) {
    event.preventDefault(); if (pending.current) return false;
    pending.current = true; setBusy(true); setSendError(''); setNotice('');
    try {
      const text = validateContactReplyText(message);
      if (draft.current?.message !== text) draft.current = { message: text, requestId: crypto.randomUUID() };
      await api(base + '/replies', { method: 'POST', body: JSON.stringify(draft.current) });
      setMessage(''); draft.current = null; setNotice('Reply sent.');
      await load(); onActivity?.(); return true;
    } catch (err) { setSendError(err.message); return false; }
    finally { pending.current = false; setBusy(false); }
  }
  return <section ref={root} className="contact-conversation" aria-labelledby="contact-conversation-title" aria-busy={busy || loading}>
    <header className="contact-conversation-heading"><div><span className="section-kicker">Private conversation</span><h2 id="contact-conversation-title">{administrator ? 'Reply to contact message' : 'Your conversation with Admin'}</h2><p>{administrator ? 'Visible only to administrators and the account that started this conversation.' : 'Only you and the administrator can view this conversation.'}</p></div><button type="button" className="secondary-btn" aria-label="Refresh conversation" disabled={busy || loading} onClick={() => load()}><RefreshCw size={17} /></button></header>
    <ErrorMessage message={error} />
    {loading && !record && <LoadingState label="Loading conversation…" />}
    {!record && error && <button type="button" className="secondary-btn" onClick={() => load()}>Try again</button>}
    {record && <>
      <div className="contact-conversation-summary"><strong>{record.thread.name}</strong><span>Status: {record.thread.status}</span></div>
      {record.nextCursor && <button type="button" className="text-btn" disabled={loading || busy} onClick={() => load(record.nextCursor)}>Load earlier replies</button>}
      <ContactConversationEntries thread={record.thread} replies={record.replies} administrator={administrator} />
      <ContactReplyForm message={message} onChange={event => { setMessage(event.target.value); setNotice(''); }} busy={busy} error={sendError} notice={notice} administrator={administrator} onSubmit={submit} />
    </>}
  </section>;
}

export function ContactConversation({ threadId, administrator = false, onActivity }) {
  return <ConversationPanel key={`${administrator}:${threadId}`} threadId={threadId} administrator={administrator} onActivity={onActivity} />;
}
