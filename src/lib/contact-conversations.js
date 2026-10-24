export function validateContactReplyText(value) {
  if (typeof value !== 'string') throw new Error('Enter a reply.');
  const message = value.trim();
  if (!message || message.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)) throw new Error('Reply must be 1–3,000 characters without control characters.');
  return message;
}
export function mergeContactReplies(current, incoming) {
  const replies = new Map(current.map(item => [item.id, item]));
  incoming.forEach(item => replies.set(item.id, item));
  return [...replies.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
}
export function contactConversationDestination(notice) {
  return (notice.contactAuthorType === 'admin' ? '/contact' : '/admin/messages') + '?thread=' + encodeURIComponent(notice.contactId);
}
export function institutionContactReturn(value) {
  return typeof value === 'string' && (value === '/contact' || value.startsWith('/contact?')) ? value : '/institution';
}
