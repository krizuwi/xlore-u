import { Bell, CheckCheck, Heart, MessageCircle, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useUnsavedChanges } from '../context/UnsavedChangesContext.jsx';
import { api } from '../lib/api.js';
import { isPrivateNotice, mergeNotifications, notificationDestination, notificationMessage } from '../lib/community-notifications.js';
import './CommunityNotifications.css';

export function NotificationItems({ items, busy, onOpen }) {
  return <ul className="community-notice-list">{items.map(item => <li key={item.id}><button type="button" className={'community-notice-item' + (!item.readAt ? ' is-unread' : '')} disabled={busy} onClick={() => onOpen(item)}>
    <span className="community-notice-icon" aria-hidden="true">{isPrivateNotice(item) ? <ShieldAlert size={18} /> : item.kind === 'like' ? <Heart size={18} /> : <MessageCircle size={18} />}</span>
    <span className="community-notice-copy"><strong>{notificationMessage(item)}</strong><span>{item.schoolName} · {item.postTitle}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></span>
    {!item.readAt && <span className="community-unread-dot" aria-label="Unread" />}
  </button></li>)}</ul>;
}

export function PrivateModerationNotice({ notice, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function dismiss() { dialog.current?.close(); onClose(); }
  return <dialog ref={dialog} className="private-moderation-notice" aria-labelledby="moderation-notice-title" onCancel={event => { event.preventDefault(); dismiss(); }}>
    <header><ShieldAlert size={24} aria-hidden="true" /><button className="text-btn" type="button" aria-label="Close moderation notice" onClick={dismiss}><X size={20} /></button></header>
    <p className="eyebrow">Private administrator notice</p><h2 id="moderation-notice-title">{notificationMessage(notice)}</h2>
    <p>{notice.schoolName}{notice.postTitle && ' · ' + notice.postTitle}</p>
    <time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleString()}</time>
    <h3>Administrator's reason</h3><p className="moderation-notice-reason">{notice.reason}</p>
    <p>This notice remains available even if the content is hidden or institution access is suspended.</p>
    <button type="button" className="primary-btn" onClick={dismiss}>Close notice</button>
  </dialog>;
}

function AccountNotifications({ administrator, role, extraUnread, onOpenActivity, children }) {
  const [open, setOpen] = useState(false), [record, setRecord] = useState(null), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const root = useRef(null), trigger = useRef(null), request = useRef(null), mutation = useRef(false), openRef = useRef(false);
  const navigate = useNavigate(), location = useLocation(), { requestDiscard } = useUnsavedChanges();
  const title = administrator ? 'Activity center' : 'Notifications';
  openRef.current = open;
  const load = useCallback(async (before = null) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try {
      const data = await api('/notifications' + (before ? '?before=' + encodeURIComponent(before) : ''), { signal: controller.signal });
      if (!controller.signal.aborted) setRecord(current => ({ ...data, data: before ? mergeNotifications(current?.data ?? [], data.data) : data.data }));
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    // Poll only while the browser is visible; don't reset an open, paginated inbox.
    const refresh = () => { if (!document.hidden && !openRef.current && !mutation.current) load(); };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); request.current?.abort(); };
  }, [load]);
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  async function mark(path, body) {
    if (mutation.current) return false;
    mutation.current = true; setBusy(true); request.current?.abort(); setError('');
    try { await api(path, { method: 'PATCH', ...(body ? { body: JSON.stringify(body) } : {}) }); await load(); return true; }
    catch (err) { setError(err.message); return false; }
    finally { mutation.current = false; setBusy(false); }
  }
  async function visit(item) {
    if (isPrivateNotice(item)) {
      if (!item.readAt) await mark('/notifications/' + item.id + '/read');
      setOpen(false); setSelected(item); return;
    }
    requestDiscard(async () => {
      if (!item.readAt) await mark('/notifications/' + item.id + '/read');
      setOpen(false); navigate(notificationDestination(item));
    });
  }
  const unread = record?.unreadCount ?? 0;
  return <div className="community-notifications" ref={root}>
    <button ref={trigger} className="community-notice-trigger" type="button" aria-label={(administrator ? 'Open activity notifications' : 'Open notifications') + (unread ? ', ' + unread + ' unread' : '')} aria-expanded={open} aria-controls="community-notice-panel" onClick={() => { if (!open) { load(); onOpenActivity?.(); } setOpen(value => !value); }}>
      <Bell size={20} aria-hidden="true" />{unread > 0 ? <span className="community-notice-count">{unread > 99 ? '99+' : unread}</span> : extraUnread && <span className="community-unread-dot" />}
    </button>
    {open && <section className="community-notice-panel" id="community-notice-panel" aria-label={title}>
      <header><div><strong>{title}</strong><p>{administrator ? 'Community and workspace updates' : 'Updates from your school community'}</p></div><button type="button" className="text-btn" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18} /></button></header>
      {children && <div className="community-activity-links" onClick={event => { if (event.target.closest('a')) setOpen(false); }}>{children}</div>}
      <div className="community-notice-tools"><span>{unread} unread</span><button type="button" className="text-btn" disabled={loading || busy || !unread} onClick={() => mark('/notifications/read-all', { through: record.watermark })}><CheckCheck size={15} /> Mark all read</button><button type="button" className="text-btn" aria-label="Refresh notifications" disabled={loading || busy} onClick={() => load()}><RefreshCw size={15} /></button></div>
      {error && <p className="community-notice-status" role="alert">Could not load or update notifications. {error} <button type="button" className="text-btn" onClick={() => load()} disabled={loading || busy}>Try again</button></p>}
      {loading && <p className="community-notice-status" role="status">Loading notifications…</p>}
      {!loading && !error && !record?.data.length && <div className="community-notice-empty"><Bell size={25} /><strong>You're all caught up</strong><p>{administrator ? 'Replies in comment threads you participate in will appear here.' : role === 'institution' ? 'School post activity and private administrator notices will appear here.' : 'Replies to your comments and private administrator notices will appear here.'}</p></div>}
      <NotificationItems items={record?.data ?? []} busy={busy || loading} onOpen={visit} />
      {record?.nextCursor && <button type="button" className="text-btn community-notice-more" disabled={loading || busy} onClick={() => load(record.nextCursor)}>Older notifications</button>}
    </section>}
    {selected && <PrivateModerationNotice notice={selected} onClose={() => { setSelected(null); trigger.current?.focus(); }} />}
  </div>;
}

export function CommunityNotifications(props) {
  const { user } = useAuth();
  if (!user?.emailVerified || !['student', 'institution', 'admin'].includes(user.role)) return null;
  // Remount on account changes so a previous account's inbox cannot flash on screen.
  return <AccountNotifications key={user.id + ':' + user.role} administrator={user.role === 'admin'} role={user.role} {...props} />;
}
