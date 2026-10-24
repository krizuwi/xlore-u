import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { institutionContactReturn, mergeContactReplies, validateContactReplyText } from '../src/lib/contact-conversations.js';
import { isPrivateNotice, notificationDestination, notificationMessage } from '../src/lib/community-notifications.js';
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
const result = await build({ entryPoints: [fileURLToPath(new URL('../src/components/ContactConversation.jsx', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'plain-form-render', setup(builder) { builder.onLoad({ filter: /[/\\]UnsavedForm\.jsx$/ }, () => ({ contents: 'import {createElement} from "react"; export function UnsavedForm({children, ...props}) { return createElement("form", props, children); }', loader: 'js' })); } }] });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { ContactConversationEntries, ContactReplyForm } = compiled.exports;
const date = '2026-10-24T00:00:00Z';
test('reply validation accepts bounded plain text, rejects empty/control values and trims retries consistently', () => {
  assert.equal(validateContactReplyText('  Thank you\nAdmin!  '), 'Thank you\nAdmin!');
  assert.equal(validateContactReplyText('😀'), '😀');
  assert.equal(validateContactReplyText('a'.repeat(3000)).length, 3000);
  for (const message of [null, {}, [], '', '  ', 'a'.repeat(3001), 'Hello\u0000there']) assert.throws(() => validateContactReplyText(message));
});
test('reply pagination merges idempotently, orders large string IDs precisely and preserves inputs', () => {
  const first = [{ id: '9007199254740993', message: 'Later' }, { id: '2', message: 'Early' }];
  const next = [{ id: '9007199254740992', message: 'Middle' }, { id: '2', message: 'Early updated' }];
  const merged = mergeContactReplies(first, next);
  assert.deepEqual(merged.map(item => item.id), ['2', '9007199254740992', '9007199254740993']);
  assert.equal(merged[0].message, 'Early updated'); assert.equal(first[1].message, 'Early'); assert.equal(first.length, 2);
});
test('admin-reply notifications take students and institutions to their exact private contact thread', () => {
  const notice = { kind: 'contact_reply', contactAuthorType: 'admin', contactId: 'thread/a&b' };
  assert.equal(notificationDestination(notice), '/contact?thread=thread%2Fa%26b');
  assert.equal(notificationMessage(notice), 'Admin replied to your contact message');
  assert.equal(isPrivateNotice(notice), false); // Opens the conversation, not a moderation-reason dialog.
  for (const type of ['student', 'institution']) assert.equal(notificationDestination({ ...notice, contactAuthorType: type }), '/admin/messages?thread=thread%2Fa%26b');
});
test('institution sign-in safely preserves contact notification destinations without enabling external redirects', () => {
  for (const path of ['/contact', '/contact?thread=fixture']) assert.equal(institutionContactReturn(path), path);
  for (const path of [undefined, {}, 'https://evil.example', '//evil.example/contact', '/contact-evil', 'javascript:alert(1)', '/admin/messages']) assert.equal(institutionContactReturn(path), '/institution');
  assert.ok(source('institution/InstitutionAuthPage.jsx').includes('institutionContactReturn(location.state?.from)'));
  assert.ok(source('pages/ContactPage.jsx').includes('location.pathname + location.search'));
});
test('conversation messages escape private content and distinguish administrator from account-owner replies', () => {
  const thread = { message: '<script>Original</script>\nNext line', createdAt: date, senderType: 'institution' };
  const replies = [{ id: '1', authorType: 'admin', message: '<img onerror=evil>', createdAt: date }, { id: '2', authorType: 'institution', message: 'Thank you!', createdAt: date }];
  for (const administrator of [false, true]) {
    const html = renderToStaticMarkup(createElement(ContactConversationEntries, { thread, replies, administrator }));
    for (const part of ['Original message', 'Administrator', '&lt;script&gt;Original&lt;/script&gt;', '&lt;img onerror=evil&gt;', 'Thank you!', 'aria-label="Conversation messages"']) assert.ok(html.includes(part), part);
    assert.ok(html.includes(administrator ? 'Institution representative' : 'You'));
    assert.ok(!html.includes('<script>') && !html.includes('<img onerror'));
  }
});
test('reply forms are labeled, bounded, protected while sending, and explain private in-app delivery', () => {
  for (const administrator of [false, true]) {
    const html = renderToStaticMarkup(createElement(ContactReplyForm, { message: 'Hello', busy: true, error: '<b>Error</b>', notice: '', administrator, onChange() {}, onSubmit() {} }));
    for (const part of ['for="contact-reply"', 'name="reply"', 'maxLength="3000"', 'required=""', 'aria-describedby="contact-reply-hint"', '5 / 3,000', 'Sending reply', '&lt;b&gt;Error&lt;/b&gt;']) assert.ok(html.includes(part), part);
    assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
    assert.ok(html.includes(administrator ? 'in-app notification' : 'back to New'));
  }
});
test('both panels wire the same thread/reply experience while keeping drafts and preventing duplicate sends', () => {
  const conversation = source('components/ContactConversation.jsx'), contact = source('pages/ContactPage.jsx'), admin = source('admin/Pages/ContactMessages.jsx');
  for (const part of ['<UnsavedForm', 'crypto.randomUUID()', 'pending.current', "base + '/replies'", 'validateContactReplyText(message)', 'Load earlier replies', 'key={`${administrator}:${threadId}`}']) assert.ok(conversation.includes(part), part);
  for (const part of ['My conversations', 'key={user.id}', '<ContactConversation threadId={threadId}', '/contact?thread=']) assert.ok(contact.includes(part), part);
  for (const part of ['View conversation &amp; reply', '<ContactConversation', 'administrator onActivity', '/admin/messages?thread=']) assert.ok(admin.includes(part), part);
  const notices = source('components/CommunityNotifications.jsx');
  assert.ok(notices.includes('Contact Admin · Private conversation'));
  assert.ok(!notices.includes('item.message') && !notices.includes('item.email'));
});
