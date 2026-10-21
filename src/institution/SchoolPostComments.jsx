import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { UnsavedForm } from '../components/UnsavedForm.jsx';
import { useUnsavedChanges } from '../context/UnsavedChangesContext.jsx';

export function CommentMessage({ comment, own, busy, onDelete }) {
  const school = comment.authorType === 'institution', admin = comment.authorType === 'admin';
  return <div className={'school-comment-message ' + (admin ? 'is-admin-comment' : school ? 'is-school-reply' : '')}>
    <header><strong>{admin ? 'Xlore U' : comment.author}</strong>{admin ? <span className="tag">Administrator</span> : school && <span className="tag">School reply</span>}</header>
    <p>{comment.body}</p><small><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time></small>
    {own && <button type="button" className="text-btn" disabled={busy} onClick={onDelete}>{school || comment.parentCommentId ? 'Delete my reply' : 'Delete my comment'}</button>}
  </div>;
}

export function CommentThread({ comment, postId, canReply, replyRole = 'institution', ownComments = [], action, busy, revision }) {
  const root = useRef(null), { requestDiscard } = useUnsavedChanges() ?? {};
  const [showReplies, setShowReplies] = useState(false), [writing, setWriting] = useState(false), [body, setBody] = useState('');
  const [replies, setReplies] = useState([]), [page, setPage] = useState(1), [more, setMore] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const admin = replyRole === 'admin';
  useEffect(() => {
    if (!showReplies) return;
    const controller = new AbortController(); setLoading(true); setError('');
    api('/community/comments/' + comment.id + '/replies?page=' + page, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setReplies(result.data); setMore(result.hasMore); }
    }).catch(err => { if (!controller.signal.aborted) { setReplies([]); setError(err.message); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [comment.id, page, showReplies, revision]);
  return <article ref={root} className="school-post-comment">
    <CommentMessage comment={comment} own={ownComments.includes(comment.id)} busy={busy} onDelete={() => action('/comments/' + comment.id, 'DELETE')} />
    <div className="institution-actions"><button type="button" className="text-btn" aria-expanded={showReplies} onClick={() => setShowReplies(value => !value)}>Replies · {comment.replyCount ?? 0}</button>{canReply && <button type="button" className="text-btn" disabled={busy} onClick={() => { const change = () => { setWriting(value => !value); setShowReplies(true); }; if (requestDiscard) requestDiscard(change, root.current); else change(); }}>{admin ? 'Reply as administrator' : 'Reply as school'}</button>}</div>
    {showReplies && <div className="school-comment-replies" aria-label={'Replies to ' + comment.author}>
      {loading && <p role="status">Loading replies…</p>}{error && <p className="error-box" role="alert">{error}</p>}
      {replies.map(reply => <CommentMessage key={reply.id} comment={reply} own={ownComments.includes(reply.id)} busy={busy || loading} onDelete={() => action('/comments/' + reply.id, 'DELETE')} />)}
      {!loading && !error && !replies.length && <p>No replies yet.</p>}
      <div className="institution-actions">{page > 1 && <button type="button" className="text-btn" disabled={loading} onClick={() => setPage(value => value - 1)}>Newer replies</button>}{more && <button type="button" className="text-btn" disabled={loading} onClick={() => setPage(value => value + 1)}>Older replies</button>}</div>
    </div>}
    {canReply && writing && <UnsavedForm className="institution-form school-reply-form" onSubmit={async event => {
      event.preventDefault();
      const saved = await action('/posts/' + postId + '/comments', 'POST', { body, parentCommentId: comment.id });
      if (saved) { setBody(''); setWriting(false); setShowReplies(true); setPage(1); }
      return saved;
    }}><label>{admin ? 'Reply as administrator' : 'Reply as your school'}<textarea autoFocus required maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder="Write a public reply. Do not include private student information." /></label><button className="primary-btn" disabled={busy || !body.trim()}>{admin ? 'Post administrator reply' : 'Post school reply'}</button></UnsavedForm>}
  </article>;
}
