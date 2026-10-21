import { Trash2 } from 'lucide-react';

export function AdminPostDeleteButton({ post, user, busy, onDelete }) {
  if (user?.role !== 'admin' || user.emailVerified !== true) return null;
  return <button type="button" className="secondary-btn school-admin-delete" disabled={busy} onClick={() => {
    if (window.confirm('Delete “' + post.title + '” from the school page? It will no longer be visible or editable by the school. Moderation records are retained.')) onDelete(post);
  }}><Trash2 size={16} /> Delete school post</button>;
}
