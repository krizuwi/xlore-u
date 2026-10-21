import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { isPrivateNotice, mergeNotifications, notificationDestination, notificationMessage } from '../src/lib/community-notifications.js';
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const result = await build({ entryPoints: [fileURLToPath(new URL('../src/components/CommunityNotifications.jsx', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
const module = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { NotificationItems, PrivateModerationNotice } = module.exports;
const notice = { id: '1', actor: '<script>Student</script>', kind: 'like', postTitle: '<img onerror=evil>', schoolName: 'Fixture School', schoolId: 'school', postId: 'post', createdAt: '2026-10-20T00:00:00Z', readAt: null };
test('notification labels cover likes, comments and school/admin replies', () => {
  assert.match(notificationMessage(notice), /liked a school post/);
  assert.equal(notificationMessage({ actor: 'Administrator', kind: 'reply' }), 'Administrator replied to a comment');
  assert.match(notificationMessage({ kind: 'comment' }), /Someone commented/);
});

test('moderation reasons open privately, escape text and never link to hidden content', () => {
  for (const kind of ['post_hidden', 'post_restored', 'comment_hidden', 'comment_restored', 'institution_suspended']) {
    const item = { ...notice, kind, reason: '<script>private reason</script>\nPlease review your post.' };
    assert.equal(isPrivateNotice(item), true); assert.equal(notificationDestination(item), null);
    const html = renderToStaticMarkup(createElement(PrivateModerationNotice, { notice: item, onClose() {} }));
    assert.ok(html.includes('Private administrator notice') && html.includes('Administrator&#x27;s reason'));
    assert.ok(html.includes('&lt;script&gt;private reason&lt;/script&gt;')); assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('aria-labelledby="moderation-notice-title"'));
    assert.match(notificationMessage(item), /Your/);
  }
  const ui = source('components/CommunityNotifications.jsx');
  assert.ok(ui.indexOf('if (isPrivateNotice(item))') < ui.indexOf('requestDiscard(async'));
});
test('notification links target the exact school post including older posts, with escaped IDs', () => {
  assert.equal(notificationDestination(notice), '/schools/school?tab=posts&post=post');
  assert.equal(notificationDestination({ schoolId: 'a/b', postId: 'x&y' }), '/schools/a%2Fb?tab=posts&post=x%26y');
  assert.ok(source('institution/SchoolPosts.jsx').includes("api('/community/posts/' + encodeURIComponent(focusedPostId)"));
  assert.ok(source('institution/SchoolPosts.jsx').includes('post.schoolId !== schoolId'));
  assert.ok(source('pages/SchoolDetailPage.jsx').includes('focusedPostId={focusedPostId}'));
});
test('pagination merges without duplicates while retaining original unread/read records', () => {
  const original = [notice], next = [{ ...notice, readAt: 'later' }, { ...notice, id: '2' }];
  const merged = mergeNotifications(original, next);
  assert.equal(merged.length, 2); assert.equal(merged[0], notice); assert.equal(original.length, 1);
});
test('notification rows escape public text, expose unread status and disable writes when busy', () => {
  const html = renderToStaticMarkup(createElement(NotificationItems, { items: [notice, { ...notice, id: '2', readAt: 'now', kind: 'reply' }], busy: true, onOpen() {} }));
  assert.ok(html.includes('&lt;script&gt;Student&lt;/script&gt;')); assert.ok(!html.includes('<script>Student'));
  assert.ok(html.includes('&lt;img onerror=evil&gt;')); assert.equal((html.match(/aria-label="Unread"/g) ?? []).length, 1);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
});
test('bells cover verified student/institution/admin accounts, isolate account state and preserve admin activity links', () => {
  const ui = source('components/CommunityNotifications.jsx');
  for (const phrase of ["['student', 'institution', 'admin']", 'key={user.id', 'requestDiscard(async', '60000', 'document.hidden', 'AbortController', "event.key === 'Escape'", 'Mark all read', 'record.watermark', 'Older notifications']) assert.ok(ui.includes(phrase), phrase);
  assert.ok(source('components/Layout.jsx').includes('<CommunityNotifications />'));
  const shell = source('admin/Components/AdminShell.jsx');
  for (const phrase of ['<CommunityNotifications extraUnread={unread}', 'onOpenActivity={markRead}', 'Scraping activity', 'System logs', 'School community']) assert.ok(shell.includes(phrase), phrase);
});
