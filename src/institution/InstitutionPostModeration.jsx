import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { schoolMediaUrl } from '../lib/school-media.js';
import { SchoolLogo } from '../components/SchoolLogo.jsx';
import { Badge, Empty, PageFooter, SearchField } from '../admin/Management/shared.jsx';
import { AdminPostDeleteButton } from './AdminPostDeleteButton.jsx';
import '../admin/Management/management.css';
import './institution.css';

export function ModerationSchoolTable({ schools, loading, onSelect }) {
  return <div className="am-table-scroll"><table className="am-table"><thead><tr><th>School</th><th>Type</th><th>City</th><th>Community</th><th>Posts</th><th>Actions</th></tr></thead>
    <tbody>{schools.map(school => <tr key={school.id}><td><button className="institution-school-select" disabled={loading} onClick={() => onSelect(school)}><SchoolLogo school={school} /><strong>{school.name}</strong></button></td><td>{school.type}</td><td>{school.city}</td><td><Badge>{school.active ? 'Activated' : 'Inactive'}</Badge></td><td>{school.postCount}</td><td><button className="am-button am-button-secondary" disabled={loading} onClick={() => onSelect(school)}>View posts</button></td></tr>)}</tbody>
  </table></div>;
}

function SchoolChooser({ onSelect }) {
  const [search, setSearch] = useState(''), [status, setStatus] = useState('active'), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [resource, setResource] = useState(null);
  const key = JSON.stringify([search, status, page, revision]);
  const ready = resource?.key === key, loading = !ready;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search, status, page: String(page) });
      api('/admin/institutions/moderation/schools?' + params, { signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) setResource({ key, ...result });
      }).catch(err => { if (!controller.signal.aborted) setResource({ key, error: err.message, data: [], pagination: { total: 0 } }); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, status, page, revision, key]);
  const schools = ready ? resource.data : [];
  return <section className="institution-school-chooser"><h2>Select a school</h2><p>Choose a registered institution to review its posts and comments. Activated schools are shown by default; inactive or suspended institutions remain available through the filter.</p>
    <div className="am-card"><div className="am-card-toolbar"><SearchField value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder="Search registered schools..." /><select aria-label="Filter institution activation" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="active">Activated schools</option><option value="all">All registered schools</option><option value="inactive">Inactive / suspended schools</option></select><button className="am-button am-button-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh</button></div>
      {ready && resource.error && <p className="error-box" role="alert">{resource.error}</p>}
      {loading && <p className="am-loading" role="status">Loading registered schools…</p>}
      <ModerationSchoolTable schools={schools} loading={loading} onSelect={onSelect} />
      {ready && !resource.error && !schools.length && <Empty title="No matching registered schools" subtitle="Try another name, city, or activation filter. Schools without an approved institution account are not listed here." />}
      {ready && !resource.error && <PageFooter count={resource.pagination.total} page={page} pageSize={6} setPage={setPage} />}
    </div>
  </section>;
}

export function ModeratedPost({ post, save, user }) {
  const [comments, setComments] = useState(null), [note, setNote] = useState(''), [error, setError] = useState('');
  async function loadComments() { try { const result = await api('/admin/institutions/posts/' + post.id + '/comments'); setComments(result.data); setError(''); } catch (err) { setError(err.message); } }
  return <article className="content-card institution-form institution-moderated-post"><header><h3>{post.title}</h3><div className="tag-row"><span className="tag">{post.status === 'draft' ? 'Draft — not public' : 'Published'}</span><span className="tag">{post.hidden ? 'Hidden by admin' : 'Not hidden'}</span></div>{post.createdAt && <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>}</header>
    <p className="school-community-hint">{post.likeCount ?? 0} likes · {post.commentCount ?? 0} comments and replies (including hidden comments)</p>
    <p className="school-post-body">{post.body}</p>
    {post.images?.length > 0 && <div className="school-post-photos">{post.images.map((image, index) => <figure key={index}><img src={schoolMediaUrl(image.url)} alt={image.caption || 'School post photo'} loading="lazy" referrerPolicy="no-referrer" />{image.caption && <figcaption>{image.caption}</figcaption>}</figure>)}</div>}
    {post.link && <a className="text-btn" href={post.link} target="_blank" rel="noopener noreferrer">Open school link <ExternalLink size={14} /></a>}
    {post.note && <p>Last moderation: {post.note}</p>}
    <label>Moderation reason<input maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></label>
    <p>This reason is sent privately to the content owner. Do not include other people's private data.</p>
    <div className="institution-actions"><button className="secondary-btn" disabled={!note.trim()} onClick={() => save('/posts/' + post.id + '/moderation', 'PATCH', { hidden: !post.hidden, note })}>{post.hidden ? 'Restore post visibility' : 'Hide post'}</button><AdminPostDeleteButton post={post} user={user} onDelete={() => save('/posts/' + post.id, 'DELETE', { note: note.trim() || 'Removed by administrator from school post moderation.' })} /><button className="text-btn" onClick={loadComments}>Review comments</button></div>
    {error && <p role="alert">{error}</p>}
    {comments?.length === 0 && <p>No comments on this post.</p>}
    {comments?.map(comment => <div className="school-post-comment" key={comment.id}><strong>{comment.author}</strong>{comment.authorType === 'admin' ? <span className="tag">Administrator</span> : comment.authorType === 'institution' && <span className="tag">School reply</span>}<p>{comment.body}</p><button className="text-btn" disabled={!note.trim()} onClick={async () => { if (await save('/comments/' + comment.id + '/moderation', 'PATCH', { hidden: !comment.hidden, note })) loadComments(); }}>{comment.hidden ? 'Restore comment' : 'Hide comment'}</button></div>)}
  </article>;
}

function SchoolModerationFeed({ school, user, onBack }) {
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [revision, setRevision] = useState(0), [resource, setResource] = useState(null), [busy, setBusy] = useState(false), [saveError, setSaveError] = useState('');
  const key = JSON.stringify([school.id, page, search, revision]);
  const ready = resource?.key === key, loading = !ready;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { api('/admin/institutions/moderation?' + new URLSearchParams({ schoolId: school.id, page: String(page), search }), { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (!result.data.length && page > 1) { setPage(value => value - 1); return; }
      setResource({ key, search, ...result });
    }).catch(err => { if (!controller.signal.aborted) setResource({ key, search, data: [], error: err.message }); }); }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [school.id, page, search, revision, key]);
  async function save(path, method, body) {
    if (busy) return false;
    setBusy(true); setSaveError('');
    try { await api('/admin/institutions' + path, { method, body: JSON.stringify(body) }); setRevision(value => value + 1); return true; }
    catch (err) { setSaveError(err.message); return false; } finally { setBusy(false); }
  }
  const posts = resource?.page === page && resource.search === search ? resource.data : [];
  return <section className="institution-school-post-review"><button className="text-btn" disabled={busy} onClick={onBack}><ArrowLeft size={16} /> Change school</button>
    <header className="content-card institution-selected-school"><SchoolLogo school={school} /><div><h2>{school.name}</h2><p>{school.city} · {school.type} institution</p><p>Review this school's published, draft, and moderated posts. Deleted posts are excluded.</p></div><Link className="secondary-btn" to={'/schools/' + school.id}>Open school page <ExternalLink size={14} /></Link></header>
    <div className="am-card institution-post-search"><div className="am-card-toolbar"><SearchField value={search} onChange={value => { setSearch(value.slice(0, 100)); setPage(1); }} placeholder="Search this school's posts..." /><button className="am-button am-button-secondary" disabled={!search || busy} onClick={() => { setSearch(''); setPage(1); }}>Clear search</button></div><p className="school-community-hint">Search post titles and content across all pages for this school.</p></div>
    {saveError && <p role="alert" className="error-box">{saveError}</p>}{ready && resource.error && <p role="alert" className="error-box">{resource.error}</p>}
    {loading && <p role="status">Loading school posts…</p>}
    <fieldset className="institution-workspace-body" disabled={busy || loading} aria-busy={busy || loading}>
      {posts.map(post => <ModeratedPost key={post.id + ':' + post.hidden} post={post} user={user} save={save} />)}
      {ready && !resource.error && !posts.length && <div className="content-card">{search ? 'No posts match your search. Try another keyword or clear the search.' : 'This school has no posts to review yet.'}</div>}
      <div className="institution-actions"><button className="secondary-btn" disabled={page === 1 || busy || loading} onClick={() => setPage(value => value - 1)}>Previous posts</button><span>Page {page}</span><button className="secondary-btn" disabled={!ready || !resource.hasMore || busy || loading} onClick={() => setPage(value => value + 1)}>Next posts</button><button className="text-btn" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Refresh posts</button></div>
    </fieldset>
  </section>;
}

export function InstitutionPostModeration({ user }) {
  const [school, setSchool] = useState(null);
  return school ? <SchoolModerationFeed key={school.id} school={school} user={user} onBack={() => setSchool(null)} /> : <SchoolChooser onSelect={setSchool} />;
}
