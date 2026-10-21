import { assert } from '../utils/http-error.js';

export const ACCOUNT_POLICY_VERSION = '2026-10-20-v2';

export function requirePolicyAcceptance(body, status = 400) {
  assert(body.acceptedPolicies === true, status,
    'Please agree to the Terms of Use and acknowledge the Privacy Policy before creating an account.',
    { code: 'POLICY_ACCEPTANCE_REQUIRED' });
  assert(body.policyVersion === ACCOUNT_POLICY_VERSION, 409,
    'The account policies changed. Refresh the page and review them before creating your account.',
    { code: 'POLICY_VERSION_CHANGED' });
  return ACCOUNT_POLICY_VERSION;
}
