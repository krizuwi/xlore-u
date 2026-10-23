import { policyAcceptance } from './account-policies.js';

// First verify Google without consent data. The server requires explicit
// acceptance only for a new account, before it creates an account or session.
export async function authenticateGoogleStudent(credential, loginWithGoogle, acceptedPolicies = null) {
  const agreement = acceptedPolicies === null ? {} : policyAcceptance(acceptedPolicies);
  try {
    await loginWithGoogle(credential, false, agreement);
    return { requiresAgreement: false };
  } catch (error) {
    if (error.details?.code === 'POLICY_ACCEPTANCE_REQUIRED') return { requiresAgreement: true };
    throw error;
  }
}
