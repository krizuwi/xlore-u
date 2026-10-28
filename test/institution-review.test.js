import test from 'node:test';
import assert from 'node:assert/strict';
import { institutionApprovalRequirements } from '../src/lib/institution-review.js';

test('existing and requested schools require email, authority confirmation and a reason independently', () => {
  for (const requested of [false, true]) for (const emailVerified of [false, true]) for (const verified of [false, true]) for (const note of ['', '  ', 'Verified by the school']) {
    const application = { emailVerified, ...(requested ? { proposedSchool: { name: 'Requested University', latitude: null, longitude: null } } : { schoolId: 'existing-school' }) };
    const requirements = institutionApprovalRequirements(application, verified, note);
    assert.deepEqual(requirements.map(item => item.key), ['email', 'authority', 'reason']);
    assert.equal(requirements.every(item => item.complete), emailVerified && verified && Boolean(note.trim()));
    assert.equal(requirements[0].complete, emailVerified);
  }
});

test('untrusted truthy values do not pass verification gates', () => {
  assert.equal(institutionApprovalRequirements({ emailVerified: 'true' }, true, 'Reason').every(item => item.complete), false);
  assert.equal(institutionApprovalRequirements({ emailVerified: true }, 'true', 'Reason').every(item => item.complete), false);
});
