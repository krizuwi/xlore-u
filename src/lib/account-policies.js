export const ACCOUNT_POLICY_VERSION = '2026-10-20-v2';
export const ACCOUNT_POLICY_DATE = '20 October 2026';

export function goBackFromPolicy(navigate, historyIndex) {
  // Only use known in-app history; direct/new-tab visits fall back to home.
  if (Number.isInteger(historyIndex) && historyIndex > 0) navigate(-1);
  else navigate('/', { replace: true });
}

export function policyAcceptance(accepted) {
  if (accepted !== true) throw new Error('Please agree to the Terms of Use and acknowledge the Privacy Policy before creating an account.');
  return { acceptedPolicies: true, policyVersion: ACCOUNT_POLICY_VERSION };
}
