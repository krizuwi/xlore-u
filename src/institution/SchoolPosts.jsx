import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useUnsavedChanges } from '../context/UnsavedChangesContext.jsx';
import { UnsavedForm } from '../components/UnsavedForm.jsx';
import { schoolMediaUrl } from '../lib/school-media.js';
import { CommentThread } from './SchoolPostComments.jsx';
import './institution.css';

export function PostCard({ post, student, administrator = false, canReply = false, viewerRole, liked = false, ownComments = [], action, busy, revision, ownerActions, focused = false }) {
  const [show, setShow] = useState(focused), [comments, setComments] = useState([]), [page, setPage] = useState(1), [more, setMore] = useState(false), [body, setBody] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const root = useRef(null), { requestDiscard } = useUnsavedChanges() ?? {};
  useEffect(() => {
    if (!show) return;
    const controller = new AbortController(); setLoading(true); setError('');
    api('/community/posts/' + post.id + '/comments?page=' + page, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setComments(result.data); setMore(result.hasMore); }
    }).catch(err => { if (!controller.signal.aborted) { setError(err.message); setComments([]); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [post.id, page, show, revision]);
  const changeComments = action => requestDiscard ? requestDiscard(action, root.current) : action();
  return <article ref={root} className="content-card school-social-post"><header><h3>{post.title}</h3><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>{ownerActions}</header><p className="school-post-body">{post.body}</p>
    {post.images?.length > 0 && <div className="school-post-photos">{post.images.map((image, index) => <figure key={index}><img src={schoolMediaUrl(image.url)} alt={image.caption || 'School post photo'} loading="lazy" referrerPolicy="no-referrer" />{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}</div>}
    {post.link && <a className="text-btn" href={post.link} target="_blank" rel="noopener noreferrer">Open school link ↗</a>}
    <div className="institution-actions"><button className="secondary-btn" aria-pressed={liked} disabled={!student || busy} onClick={() => action('/posts/' + post.id + '/like', liked ? 'DELETE' : 'PUT')}><Heart size={17} fill={liked ? 'currentColor' : 'none'} /> {liked ? 'Liked' : 'Like'} · <span aria-live="polite">{post.likeCount ?? 0}</span></button><button className="secondary-btn" aria-expanded={show} onClick={() => changeComments(() => setShow(value => !value))}><MessageCircle size={17} /> Comments · <span aria-live="polite">{post.commentCount ?? 0}</span></button></div>
    {!student && !viewerRole && <p className="school-community-hint"><Link to="/login">Student sign in</Link> to like or comment.</p>}
    {show && <section aria-label={'Comments on ' + post.title}><p className="school-community-hint">Students appear by first name. Official school replies and administrator comments are labeled. Keep private information out of comments.</p>
      {administrator ? <p className="school-community-hint">You are commenting as Administrator. Your sign-in email is not displayed.</p> : canReply && <p className="school-community-hint">Use “Reply as school” beneath a comment. Likes are student-only.</p>}
      {error && <p role="alert" className="error-box">{error}</p>}{loading && <p role="status">Loading comments…</p>}
      {!loading && !error && !comments.length && <p>No comments yet.{student || administrator ? ' Be the first to comment.' : ''}</p>}
      {comments.map(comment => <CommentThread key={comment.id} comment={comment} postId={post.id} canReply={administrator || canReply} replyRole={administrator ? 'admin' : 'institution'} ownComments={ownComments} action={action} busy={busy || loading} revision={revision} />)}
      <div className="institution-actions">{page > 1 && <button className="text-btn" disabled={loading || busy} onClick={() => changeComments(() => setPage(value => value - 1))}>Newer comments</button>}{more && <button className="text-btn" disabled={loading || busy} onClick={() => changeComments(() => setPage(value => value + 1))}>Older comments</button>}</div>
      {(student || administrator) && <UnsavedForm className="institution-form school-comment-form" onSubmit={async event => { event.preventDefault(); const saved = await action('/posts/' + post.id + '/comments', 'POST', { body }); if (saved) { setBody(''); setPage(1); } return saved; }}><label>{administrator ? 'Your administrator comment' : 'Your comment'}<textarea required maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder="Write a comment…" /></label><button className="primary-btn" disabled={busy || !body.trim()}>{administrator ? 'Post administrator comment' : 'Post comment'}</button></UnsavedForm>}
    </section>}
  </article>;
}

export function SchoolPosts({ schoolId, refreshKey = 0, renderOwnerActions, focusedPostId, onClearFocus }) {
  const { user } = useAuth(), student = user?.role === 'student' && user.emailVerified;
  const administrator = user?.role === 'admin' && user.emailVerified;
  const eligible = Boolean(user?.emailVerified && ['student', 'institution', 'admin'].includes(user.role));
  const [posts, setPosts] = useState([]), [page, setPage] = useState(1), [more, setMore] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [error, setError] = useState('');
  const [mineRecord, setMine] = useState(null), actionLock = useRef(false), root = useRef(null), jumpedToPost = useRef(false);
  const { requestDiscard } = useUnsavedChanges();
  const viewerKey = (user?.id ?? 'visitor') + ':' + schoolId;
  const emptyMine = { likedPostIds: [], ownCommentIds: [], replySchoolId: null };
  const mine = mineRecord?.key === viewerKey ? mineRecord : emptyMine;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    Promise.all([
      focusedPostId ? api('/community/posts/' + encodeURIComponent(focusedPostId), { signal: controller.signal }).then(post => {
        if (post.schoolId !== schoolId) throw new Error('This post does not belong to this school.');
        return { data: [post], hasMore: false };
      }) : api('/community/schools/' + schoolId + '/posts?page=' + page, { signal: controller.signal }),
      eligible ? api('/community/me?schoolId=' + schoolId, { signal: controller.signal }) : Promise.resolve(null)
    ]).then(([result, identity]) => {
      if (!controller.signal.aborted) {
        setPosts(result.data); setMore(result.hasMore);
        setMine({ key: viewerKey, likedPostIds: identity?.likedPostIds ?? [], ownCommentIds: identity?.ownCommentIds ?? [], replySchoolId: identity?.replySchoolId ?? null });
      }
    }).catch(err => { if (!controller.signal.aborted) { setError(err.message); setPosts([]); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [schoolId, page, revision, refreshKey, eligible, viewerKey, focusedPostId]);
  useEffect(() => {
    if (focusedPostId && !loading && posts.length && !jumpedToPost.current) {
      jumpedToPost.current = true;
      root.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }, [focusedPostId, loading, posts.length]);
  async function action(path, method, body) {
    if (actionLock.current) return false;
    actionLock.current = true; setBusy(true); setError('');
    try {
      const result = await api('/community' + path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      const like = path.match(/^\/posts\/([^/]+)\/like$/);
      if (like) {
        const liked = method === 'PUT', hadLike = mine.likedPostIds.includes(like[1]);
        setMine(current => ({ ...(current?.key === viewerKey ? current : emptyMine), key: viewerKey, likedPostIds: liked ? [...new Set([...mine.likedPostIds, like[1]])] : mine.likedPostIds.filter(value => value !== like[1]) }));
        if (liked !== hadLike) setPosts(current => current.map(post => post.id === like[1] ? { ...post, likeCount: Math.max(0, Number(post.likeCount ?? 0) + (liked ? 1 : -1)) } : post));
      } else if (result?.id) {
        setMine(current => ({ ...(current?.key === viewerKey ? current : emptyMine), key: viewerKey, ownCommentIds: [...mine.ownCommentIds, result.id] }));
      }
      setRevision(value => value + 1); return true;
    } catch (err) { setError(err.message); return false; }
    finally { setBusy(false); actionLock.current = false; }
  }
  return <div ref={root} className="school-post-feed"><h2>School posts</h2><p>Posts publish directly from this school's approved institution account, without a separate post review. Administrators can hide or delete inappropriate posts.</p>
    {focusedPostId && <button type="button" className="text-btn" onClick={() => requestDiscard(onClearFocus, root.current)}>View all school posts</button>}
    {error && <p role="alert" className="error-box">{error}</p>}{loading && !posts.length ? <p role="status">Loading posts…</p> : <>
      {!posts.length && !error && <div className="content-card">This school has not published any posts yet.</div>}
      {posts.map(post => <PostCard key={post.id + ':' + (user?.id ?? 'visitor')} post={post} focused={Boolean(focusedPostId)} student={student} administrator={administrator} viewerRole={user?.role} canReply={eligible && mine.replySchoolId === schoolId} liked={mine.likedPostIds.includes(post.id)} ownComments={mine.ownCommentIds} action={action} busy={busy || loading} revision={revision + refreshKey} ownerActions={renderOwnerActions?.(post)} />)}
      {!focusedPostId && <div className="institution-actions"><button className="secondary-btn" disabled={page === 1 || loading || busy} onClick={() => requestDiscard(() => setPage(value => value - 1), root.current)}>Previous posts</button><span>Page {page}</span><button className="secondary-btn" disabled={!more || loading || busy} onClick={() => requestDiscard(() => setPage(value => value + 1), root.current)}>Next posts</button></div>}
    </>}
  </div>;
}
