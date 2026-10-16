import test from 'node:test';
import assert from 'node:assert/strict';
import { scrapingRunNotification } from '../src/admin/Management/ScrapingManagement/scraping-run-notification.js';

test('a failed or partial scrape is never announced as complete', () => {
  const complete = scrapingRunNotification({ status: 'completed', succeeded: 2, checked: 2 }, 'Example University');
  assert.equal(complete.kind, 'success');
  assert.match(complete.detail, /2\/2 sources succeeded/);

  const failed = scrapingRunNotification({ status: 'failed', succeeded: 0, checked: 2,
    errors: ['Mapúa: article list unavailable'] }, 'Mapúa University');
  assert.equal(failed.kind, 'error');
  assert.match(failed.detail, /0\/2 sources succeeded/);
  assert.match(failed.detail, /article list unavailable/);

  const partial = scrapingRunNotification({ status: 'partial', succeeded: 1, checked: 2 }, 'Example University');
  assert.equal(partial.kind, 'warning');
  assert.match(partial.detail, /failed sources/);

  const skipped = scrapingRunNotification({ skipped: true, reason: 'Another update is running.' });
  assert.equal(skipped.kind, 'warning');
  assert.match(skipped.detail, /Another update/);
});
