import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackPage, feedbackExit, feedbackDismissKey, shouldPromptFeedback } from './user-feedback.js';
import { feedbackReleasePlugin } from '../../build/feedback-release.js';

const school = '/schools/40000000-0000-4000-8000-000000000007';
test('only assessment, comparison, map and school details are feedback sections', () => {
  assert.equal(feedbackPage('/assessment').section, 'assessment');
  assert.equal(feedbackPage('/assessment/example/results').section, 'assessment');
  assert.equal(feedbackPage('/comparison').section, 'comparison');
  assert.equal(feedbackPage('/compare-programs').section, 'comparison');
  assert.equal(feedbackPage('/map').section, 'map');
  assert.equal(feedbackPage(school).schoolId, school.split('/')[2]);
  for (const path of ['/', '/schools', '/schools/not-a-school-id', '/admin', '/login', '/profile', '/assessment-wrong']) assert.equal(feedbackPage(path), null);
});
test('back links, browser Back and navigation exits prompt, not internal assessment transitions or refreshes', () => {
  assert.equal(feedbackExit('/map', '/schools').section, 'map');
  assert.equal(feedbackExit('/comparison', '/dashboard').section, 'comparison');
  assert.equal(feedbackExit(school, '/schools').schoolId, school.split('/')[2]);
  assert.equal(feedbackExit('/assessment/example/results', '/dashboard').section, 'assessment');
  assert.equal(feedbackExit('/assessment', '/assessment/example/results'), null);
  assert.equal(feedbackExit('/comparison', '/comparison'), null);
  assert.equal(feedbackExit('/schools', school), null);
  assert.equal(feedbackExit(school, school), null);
});
test('answered sections are skipped until a new release, without suppressing other sections', () => {
  const status = { releaseId: 'release-one', submittedSections: ['map'] };
  assert.equal(shouldPromptFeedback(status, 'map'), false);
  assert.equal(shouldPromptFeedback(status, 'assessment'), true);
  assert.equal(shouldPromptFeedback({ releaseId: 'release-two', submittedSections: [] }, 'map'), true);
  assert.equal(shouldPromptFeedback(null, 'map'), false);
  assert.equal(shouldPromptFeedback(status, 'assessment', true), false);
});
test('dismissal keys are isolated by account, section and release', () => {
  const key = feedbackDismissKey('user-one', 'release-one', 'map');
  assert.notEqual(key, feedbackDismissKey('user-two', 'release-one', 'map'));
  assert.notEqual(key, feedbackDismissKey('user-one', 'release-two', 'map'));
  assert.notEqual(key, feedbackDismissKey('user-one', 'release-one', 'school'));
});
test('every frontend build emits a fresh public deployment manifest', () => {
  const outputs = [];
  for (let index = 0; index < 2; index++) feedbackReleasePlugin().generateBundle.call({ emitFile: asset => outputs.push(asset) });
  assert.equal(outputs[0].fileName, 'feedback-release.json');
  assert.notEqual(JSON.parse(outputs[0].source).release, JSON.parse(outputs[1].source).release);
  assert.match(JSON.parse(outputs[0].source).release, /^[a-f0-9-]+$/);
});
