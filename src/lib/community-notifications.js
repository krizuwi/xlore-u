import { contactConversationDestination } from './contact-conversations.js';

export function isPrivateNotice(notice) {
  return ['post_hidden', 'post_restored', 'comment_hidden', 'comment_restored', 'institution_suspended'].includes(notice.kind);
}

export function notificationMessage(notice) {
  if (notice.kind === 'contact_reply') return notice.contactAuthorType === 'admin' ? 'Admin replied to your contact message' : 'New reply in your contact conversation';
  const decisions = { post_hidden: 'Your school post was hidden', post_restored: 'Your school post was restored', comment_hidden: 'Your comment was hidden', comment_restored: 'Your comment was restored', institution_suspended: 'Your institution access was suspended' };
  if (decisions[notice.kind]) return decisions[notice.kind];
  const actor = notice.actor || 'Someone';
  if (notice.kind === 'like') return actor + ' liked a school post';
  if (notice.kind === 'reply') return actor + ' replied to a comment';
  return actor + ' commented on a school post';
}

export function notificationDestination(notice) {
  if (notice.kind === 'contact_reply') return contactConversationDestination(notice);
  if (isPrivateNotice(notice)) return null;
  return '/schools/' + encodeURIComponent(notice.schoolId) + '?tab=posts&post=' + encodeURIComponent(notice.postId);
}

export function mergeNotifications(current, incoming) {
  const ids = new Set(current.map(item => item.id));
  return [...current, ...incoming.filter(item => !ids.has(item.id))];
}
