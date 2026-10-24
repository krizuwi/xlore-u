import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { build } from 'esbuild';

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
async function component(path, name) {
  const result = await build({ entryPoints: [fileURLToPath(new URL('../src/' + path, import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'isolated-render-contexts', setup(builder) {
    builder.onLoad({ filter: /[/\\]AuthContext\.jsx$/ }, () => ({ contents: 'export function useAuth() { return globalThis.__supportAuth; }', loader: 'js' }));
    builder.onLoad({ filter: /[/\\]UnsavedForm\.jsx$/ }, () => ({ contents: 'import {createElement} from "react"; export function UnsavedForm({children, ...props}) { return createElement("form", props, children); }', loader: 'js' }));
    builder.onLoad({ filter: /[/\\]adminApi\.js$/ }, () => ({ contents: 'export function useAdminResource() {return globalThis.__supportInbox;} export async function adminWrite() {}', loader: 'js' }));
  } }] });
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
  return compiled.exports[name];
}
const About = await component('pages/AboutPage.jsx', 'AboutPage');
const Contact = await component('pages/ContactPage.jsx', 'ContactPage');
const Inbox = await component('admin/Pages/ContactMessages.jsx', 'ContactMessages');
const render = Component => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Component)));
const account = { id: 'fixture', fullName: 'Demo Student', email: 'student@example.test', role: 'student', emailVerified: true };

test('About Us renders supplied team photo, four team members, actual features and recommendation limits', () => {
  const html = render(About);
  assert.ok(html.includes('college decisions. Because here at Xlore U, your future is our top priority!'));
  for (const part of ['STI College Global City', 'Neo Aragon V. De Villena', 'Gian Albert T. Orbase', 'Mark Justine Tibor', 'Criszouie Guile P. Tolentino', 'A guide, not a guarantee', '/about/xlore-u-team.png', 'alt="The Xlore U project team', 'href="/contact"']) assert.ok(html.includes(part), part);
  const photo = readFileSync(new URL('../public/about/xlore-u-team.png', import.meta.url));
  assert.equal(photo.subarray(1, 4).toString(), 'PNG');
  assert.equal(photo.readUInt32BE(16), 2048); assert.equal(photo.readUInt32BE(20), 1536);
});
test('both verified students and institution representatives receive the same accessible, bounded contact fields', () => {
  for (const role of ['student', 'institution']) {
    globalThis.__supportAuth = { loading: false, user: { ...account, role } };
    const html = render(Contact);
    for (const part of ['name="name"', 'name="email"', 'name="message"', 'maxLength="100"', 'maxLength="190"', 'maxLength="3000"', 'minLength="10"', 'type="email"', 'value="Demo Student"', 'value="student@example.test"', 'Send message', 'Only administrators can read', 'href="/privacy"']) {
      assert.ok(html.includes(part), part);
    }
    for (const id of ['contact-name', 'contact-email', 'contact-message']) { assert.ok(html.includes(`for="${id}"`)); assert.ok(html.includes(`id="${id}"`)); }
    assert.equal((html.match(/required=""/g) ?? []).length, 3);
  }
});
test('contact page gates anonymous, loading, unverified and admin states without a send form', () => {
  for (const [state, expected] of [[{ user: null, loading: true }, 'Loading your account'], [{ user: null, loading: false }, 'Student sign in'], [{ user: { ...account, emailVerified: false }, loading: false }, 'Verify your account email'], [{ user: { ...account, role: 'admin' }, loading: false }, 'Review contact messages']]) {
    globalThis.__supportAuth = state; const html = render(Contact);
    assert.ok(html.includes(expected)); assert.ok(!html.includes('name="message"'));
  }
});
test('admin inbox escapes messages/contact details, labels submitted versus account email, and offers search/status controls', () => {
  globalThis.__supportInbox = { loading: false, error: '', refresh() {}, data: { total: 1, data: [{ id: 'fixture', name: '<b>Sender</b>', email: 'contact@example.test', message: '<script>alert(1)</script>\nMessage', accountName: 'Account owner', accountEmail: 'account@example.test', senderType: 'institution', status: 'new', createdAt: '2026-10-24T00:00:00Z' }] } };
  const html = render(Inbox);
  for (const part of ['type="search"', 'All messages', 'Contact email (provided by sender)', 'Signed-in account', 'account@example.test', 'Mark as read', 'Close message', '&lt;script&gt;', '&lt;b&gt;Sender&lt;/b&gt;']) assert.ok(html.includes(part), part);
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<b>Sender</b>'));
});
test('admin inbox has empty and error states and no destructive message delete control', () => {
  globalThis.__supportInbox = { loading: false, error: '', refresh() {}, data: { total: 0, data: [] } };
  assert.ok(render(Inbox).includes('No messages found'));
  globalThis.__supportInbox.error = 'Test unavailable';
  assert.ok(render(Inbox).includes('Try again'));
  assert.ok(!source('admin/Pages/ContactMessages.jsx').includes('DELETE'));
});
test('footer links, routes, private indexing and unsaved/retry safeguards are wired without publishing admin credentials', () => {
  const layout = source('components/Layout.jsx'), routes = source('App.jsx'), contact = source('pages/ContactPage.jsx');
  assert.ok(layout.includes('to="/about"') && layout.includes("'/contact'"));
  assert.ok(layout.includes("user?.role === 'institution'"));
  assert.ok(routes.includes('path="about"') && routes.includes('path="contact"'));
  assert.ok(source('admin/Components/navbar/Navbar.jsx').includes("to: '/admin/messages'"));
  assert.ok(source('components/Seo.jsx').includes("'/contact',"));
  for (const part of ['<UnsavedForm', 'crypto.randomUUID()', 'pending.current', 'requestId:', 'setSent(true)', 'Only administrators can read']) assert.ok(contact.includes(part));
  assert.ok(!contact.includes('unicourse02@') && !source('pages/AboutPage.jsx').includes('unicourse02@'));
  const styles = source('pages/SupportPages.css'); assert.match(styles, /@media \(max-width: 600px\)/); assert.match(styles, /height: auto/);
});
