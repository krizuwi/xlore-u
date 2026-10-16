export const ACCOUNT_POLICY_VERSION = '2026-10-16-v1';
export const ACCOUNT_POLICY_DATE = '16 October 2026';

export function policyAcceptance(accepted) {
  if (accepted !== true) throw new Error('Please agree to the Terms of Use and acknowledge the Privacy Policy before creating an account.');
  return { acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION };
}
