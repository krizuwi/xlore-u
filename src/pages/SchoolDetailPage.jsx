import { ArrowLeft, Award, Camera, ExternalLink, GraduationCap, Pencil, PhilippinePeso, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { schoolMapQuery } from '../lib/school-location.js';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ErrorMessage, LoadingState } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { SchoolHero } from "../components/SchoolHero.jsx";
import { SchoolLogo } from "../components/SchoolLogo.jsx";
import { useLiveRefresh } from "../context/EngagementContext.jsx";
import { useFeedbackCompletion } from "../context/FeedbackExperienceContext.jsx";
import { SchoolPosts } from '../institution/SchoolPosts.jsx';
import { SchoolPageEditor } from '../institution/SchoolPageEditor.jsx';
import { canManageSchool } from '../lib/institution-owner.js';

export function SchoolDetailPage() {
  const { id } = useParams(), { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedPostId = searchParams.get('tab') === 'posts' ? searchParams.get('post') : null;
  const [school, setSchool] = useState(null), [error, setError] = useState('');
  const section = searchParams.get('tab') === 'posts' ? 'posts' : 'programs';
  const setSection = value => setSearchParams(value === 'posts' ? { tab: 'posts' } : {});
  const [ownerRecord, setOwnerRecord] = useState(null);
  const [editor, setEditor] = useState(null), [busy, setBusy] = useState(false), [preview, setPreview] = useState(false);
  const [ownerError, setOwnerError] = useState(''), [message, setMessage] = useState(''), [revision, setRevision] = useState(0);
  const trackedVisit = useRef(''), currentPage = useRef('');
  currentPage.current = (user?.id ?? '') + ':' + id;
  const ownsSchool = school?.id === id && school.institutionActive === true && canManageSchool(user, ownerRecord, id);
  const managing = ownsSchool && !preview;
  const owner = ownsSchool ? ownerRecord.data : null;
  useFeedbackCompletion(!error && school?.id === id);
  useLiveRefresh(async signal => {
    const data = await api('/schools/' + id, { signal });
    if (!signal.aborted) { setSchool(data); setError(''); }
  }, { key: id });
  useEffect(() => {
    const controller = new AbortController();
    setEditor(null); setOwnerError(''); setMessage(''); setPreview(false);
    api('/schools/' + id, { signal: controller.signal }).then(setSchool).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [id]);
  useEffect(() => {
    if (user?.role !== 'institution') return;
    const controller = new AbortController();
    api('/institutions/me', { signal: controller.signal }).then(data => setOwnerRecord({ userId: user.id, data })).catch(err => { if (!controller.signal.aborted) setOwnerError(err.message); });
    return () => controller.abort();
  }, [id, user?.id, user?.role]);
  useEffect(() => {
    const visitKey = user ? user.id + ':' + id : '';
    if (user?.role !== 'student' || school?.id !== id || trackedVisit.current === visitKey) return;
    trackedVisit.current = visitKey;
    api('/schools/' + id + '/visit', { method: 'POST' }).catch(() => {});
  }, [id, school, user]);

  function openEditor(type, item) {
    setOwnerError(''); setMessage('');
    setEditor({ type, item, pageKey: currentPage.current });
  }
  async function save(path, method, body) {
    if (!managing || busy) return false;
    const pageKey = currentPage.current;
    setBusy(true); setOwnerError(''); setMessage('');
    try {
      await api('/institutions' + path, { method, ...(body ? { body: JSON.stringify({ ...body, careerPaths: body.careerPaths?.filter(value => value.trim()) }) } : {}) });
      if (currentPage.current !== pageKey) return true;
      setEditor(null); setMessage('Changes saved to your school page.'); setRevision(value => value + 1);
      try {
        const [publicSchool, data] = await Promise.all([api('/schools/' + id), api('/institutions/me')]);
        if (currentPage.current === pageKey) { setSchool(publicSchool); setOwnerRecord({ userId: user.id, data }); }
      } catch {
        if (currentPage.current === pageKey) setOwnerError('Changes were saved, but the page could not refresh. Reload to see the latest version.');
      }
      return true;
    } catch (err) { if (currentPage.current === pageKey) setOwnerError(err.message); return false; }
    finally { setBusy(false); }
  }
  function postActions(post) {
    return <div className="school-item-actions" aria-label={'Manage post: ' + post.title}>
      <button className="text-btn" disabled={busy} onClick={() => openEditor('post', owner.posts.find(item => item.id === post.id) ?? { ...post, status: 'published' })}><Pencil size={15} /> Edit post</button>
      <button className="text-btn" disabled={busy} onClick={() => { if (window.confirm('Remove this post from public view?')) save('/posts/' + post.id, 'DELETE'); }}><Trash2 size={15} /> Delete post</button>
    </div>;
  }
  if (error) return <section className="page-shell container"><ErrorMessage message={error} /><Link className="text-btn" to="/schools">Back to schools</Link></section>;
  if (!school || school.id !== id) return <section className="page-shell container"><LoadingState label="Loading school details..." /></section>;
  const mapUrl = 'https://www.google.com/maps?q=' + encodeURIComponent(schoolMapQuery(school));
  const schoolPrograms = school.programs.map(program => ({ ...program, ...(program.institutionDetails ?? {}) }));
  const privatePosts = managing ? owner.posts.filter(post => post.status === 'draft' || post.hiddenByAdmin) : [];
  return <section className={'page-shell detail-page ' + (managing ? 'school-owner-page' : '')}><div className="container">
    <Link className="back-link" to="/schools"><ArrowLeft size={16} /> Back to directory</Link>
    {ownsSchool && <div className="school-owner-bar"><div><strong>{preview ? 'Visitor preview' : 'Your school page'}</strong><span>{preview ? 'Editing controls and private drafts are hidden in this preview.' : 'Manage your profile, programs, and posts right here.'}</span></div><div className="institution-actions"><Link className="secondary-btn" to="/institution/settings">Account settings</Link><button className="secondary-btn" onClick={() => setPreview(value => !value)}>{preview ? 'Return to editing' : 'View as visitor'}</button></div></div>}
    {ownerError && !editor && <p className="error-box" role="alert">{ownerError}</p>}
    {message && <p className="school-save-notice" role="status">{message}</p>}
    <SchoolHero key={school.id} school={school} mapUrl={mapUrl}
      logoAction={managing && <button className="school-logo-edit" aria-label="Edit school logo" onClick={() => openEditor('media')}><Camera size={18} /></button>}
      photoAction={managing && <button className="secondary-btn" onClick={() => openEditor('media')}><Camera size={17} /> Edit school photos</button>}
      profileActions={managing && <><button className="primary-btn" onClick={() => openEditor('profile')}><Pencil size={17} /> Edit profile</button><button className="secondary-btn" onClick={() => { setSection('posts'); openEditor('post'); }}><Plus size={17} /> Create post</button></>} />
    <div className="detail-stat-grid"><div><PhilippinePeso /><span><small>Tuition range</small><strong>{school.tuitionRange}</strong></span></div><div><Award /><span><small>Accreditation</small><strong>{school.accreditation}</strong></span></div><div><Star /><span><small>Google rating</small><strong>{school.googleRating ?? 'Not listed'}</strong></span></div></div>
    <div className="detail-layout"><div>
      {school.institutionActive && <nav className="institution-tabs school-section-tabs" aria-label="School sections"><button aria-current={section === 'programs' ? 'page' : undefined} onClick={() => setSection('programs')}>Programs offered</button><button aria-current={section === 'posts' ? 'page' : undefined} onClick={() => setSection('posts')}>School posts</button></nav>}
      {school.institutionActive && section === 'posts' ? <>
        {managing && <section className="content-card school-post-composer"><SchoolLogo school={school} /><div><h2>Share an update</h2><p>Announcements, photos, events, and admissions news.</p></div><button className="primary-btn" onClick={() => openEditor('post')}><Plus size={17} /> Create post</button></section>}
        {privatePosts.length > 0 && <section className="content-card school-private-posts"><h2>Drafts & moderated posts</h2><p>Only your institution can see this management list.</p>{privatePosts.map(post => <article key={post.id}><span className="tag">{post.hiddenByAdmin ? 'Hidden by admin' : 'Draft — not public'}</span><h3>{post.title}</h3><p>{post.hiddenByAdmin ? post.moderationNote : post.body.slice(0, 160)}</p>{postActions(post)}</article>)}</section>}
        <SchoolPosts key={school.id + ':' + (focusedPostId ?? '')} schoolId={school.id} focusedPostId={focusedPostId} onClearFocus={() => setSearchParams({ tab: 'posts' })} refreshKey={revision} renderOwnerActions={managing ? postActions : undefined} />
      </> : <div className="content-card"><div className="school-section-heading"><h2><GraduationCap /> Programs offered</h2>{managing && <button className="primary-btn" onClick={() => openEditor('program')}><Plus size={17} /> Add program</button>}</div>
        {!schoolPrograms.length && <p>{managing ? 'Add the programs your school offers to get started.' : 'Contact the school for its current program offerings.'}</p>}
        <div className="offering-list">{schoolPrograms.map(program => <article key={program.id}><div><span className="tag">{program.category}</span>{program.isTopProgram && <span className="match-pill">Top program</span>}<h3>{program.name}</h3><p>{program.description}</p>{program.sourceUrl && <a className="text-btn" href={program.sourceUrl} target="_blank" rel="noreferrer">Official source <ExternalLink size={13} /></a>}
          {managing && <div className="school-item-actions"><button className="text-btn" disabled={busy} onClick={() => openEditor('program', owner.programs.find(item => item.id === program.id))}><Pencil size={15} /> Edit program</button><button className="text-btn" disabled={busy} onClick={() => { if (window.confirm('Remove ' + program.name + ' from your school only?')) save('/programs/' + program.id, 'DELETE'); }}><Trash2 size={15} /> Remove offering</button></div>}
        </div><div className="offering-tuition"><small>Per semester</small><strong>{program.tuitionPerSemester == null ? 'Contact school' : '₱' + Number(program.tuitionPerSemester).toLocaleString()}</strong></div></article>)}</div>
      </div>}
    </div><aside><div className="content-card side-card"><div className="school-section-heading"><h3>Scholarship information</h3>{managing && <button className="text-btn" aria-label="Edit scholarship information" onClick={() => openEditor('profile')}><Pencil size={16} /></button>}</div><p>{school.scholarshipInfo || 'Contact the institution for current scholarship information.'}</p></div><div className="content-card side-card"><h3>Accepted SHS strands</h3><div className="tag-row">{school.acceptedStrands.map(strand => <span className="tag" key={strand.code}>{strand.code}</span>)}</div></div></aside></div>
    {managing && editor?.pageKey === currentPage.current && <SchoolPageEditor key={editor.type + (editor.item?.id ?? 'new')} editor={editor} school={owner.school} busy={busy} error={ownerError} save={save} onClose={() => { setEditor(null); setOwnerError(''); }} />}
  </div></section>;
}
