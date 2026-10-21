import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useUnsavedChanges } from '../context/UnsavedChangesContext.jsx';
import { PostEditor, ProfileEditor, ProgramEditor } from './InstitutionEditors.jsx';

export function SchoolPageEditor({ editor, school, save, onClose, busy, error }) {
  const dialog = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { requestDiscard } = useUnsavedChanges();
  const working = busy || uploading;
  const title = editor.type === 'profile' ? 'Edit school profile' : editor.type === 'media' ? 'Edit logo & school photos' : editor.type === 'program' ? (editor.item ? 'Edit program' : 'Add program') : editor.item ? 'Edit post' : 'Create post';
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  const close = () => { if (!working) requestDiscard(onClose, dialog.current); };
  return <dialog ref={dialog} className="school-page-editor" aria-labelledby="school-editor-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="school-editor-heading"><h2 id="school-editor-title">{title}</h2><button type="button" className="secondary-btn" aria-label="Close editor" disabled={working} onClick={close}><X size={20} /></button></header>
    <p className="school-editor-context">Editing {school.name}. Changes appear on this school page after saving.</p>
    {error && <p className="error-box" role="alert">{error}</p>}
    <fieldset className="institution-workspace-body" disabled={busy} aria-busy={working}>
      {(editor.type === 'profile' || editor.type === 'media') && <ProfileEditor school={school} save={save} mediaOnly={editor.type === 'media'} onBusyChange={setUploading} />}
      {editor.type === 'program' && <ProgramEditor initialProgram={editor.item} save={save} />}
      {editor.type === 'post' && <PostEditor initialPost={editor.item} save={save} onBusyChange={setUploading} />}
    </fieldset>
    <footer className="school-editor-footer"><span>{working ? 'Please wait until saving or uploading finishes.' : 'Only your institution can use these controls.'}</span><button type="button" className="secondary-btn" disabled={working} onClick={close}>Cancel</button></footer>
  </dialog>;
}
