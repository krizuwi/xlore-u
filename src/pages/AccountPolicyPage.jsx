import { Link } from 'react-router-dom';
import { ACCOUNT_POLICY_DATE, ACCOUNT_POLICY_VERSION } from '../lib/account-policies.js';

const configuredContact = String(import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL ?? '').trim();
const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredContact) ? configuredContact : '';

function PolicyContact() {
  return <section id="contact"><h2>Questions and privacy requests</h2>
    {supportEmail ? <p>Contact the Xlore U project team at <a href={`mailto:${supportEmail}`}>{supportEmail}</a> for account questions or requests about your personal data. Describe your request without sending passwords, verification codes, or sensitive documents.</p>
      : <p role="status">The project team has not configured a public support/privacy contact yet. Ask the team for its designated contact before registering. This draft needs that contact information before public deployment.</p>}
    <p>The team may need to verify that a request relates to your account before acting on it. Do not send another person's personal information.</p>
  </section>;
}

export function AccountPolicyPage({ kind }) {
  const privacy = kind === 'privacy';
  return <section className="page-shell"><article className="container account-policy-page">
    <header><span className="section-kicker">Your account and privacy</span><h1>{privacy ? 'Privacy Policy' : 'Terms of Use'}</h1>
      <p>Version {ACCOUNT_POLICY_VERSION} · Prepared {ACCOUNT_POLICY_DATE}</p>
      <p className="policy-review-notice">Draft for project-owner review. Confirm the public contact, retention arrangements, and safeguards for younger students before publishing this policy.</p>
    </header>
    <nav aria-label="Account policies"><Link to="/terms">Terms of Use</Link><Link to="/privacy">Privacy Policy</Link><Link to="/register">Create account</Link></nav>
    {privacy ? <>
      <section><h2>In simple terms</h2><p>Xlore U uses your account details and assessment answers to help you explore schools and programs. Your home pin is optional. We do not track your location continuously. You can use the public school and program directories without creating an account.</p></section>
      <section><h2>Who operates Xlore U</h2><p>Xlore U is a student-developed college-exploration capstone project. The Xlore U project team operates the service and handles account information. It is not a school admissions office.</p></section>
      <section><h2>Information used by the system</h2><ul>
        <li>Account details: your name, email, home address if you provide one, email-verification status, and a password hash if you register with a password.</li>
        <li>Google sign-in, if you choose it: your Google account identifier, name, email, and verified-email status. Xlore U does not receive your Google password.</li>
        <li>College exploration: assessment responses and results, selected fields, saved schools/programs, comparisons, school-view activity, and feedback you submit.</li>
        <li>An optional home pin that you explicitly confirm in Profile. A device-location request happens only when you choose that option. Changing your address clears the previous pin; you can remove the pin in Profile.</li>
        <li>Security and operation records, such as session timestamps, IP address, browser/device information, and the policy version and server time recorded when you accept the account agreement.</li>
      </ul></section>
      <section><h2>Why this information is used</h2><p>We use it to create and verify your account, sign you in, recover access, save your work, produce program suggestions from your responses and selected field, estimate school proximity, and review submitted feedback and system issues. Account details and optional pins are not public directory information.</p><p>Assessment suggestions use automated rules, not an admissions decision. Home-pin distances are approximate straight-line estimates, not driving distances or commute times. Optional pin confirmation is separate from accepting the account terms; accepting these pages does not turn on device-location access or marketing.</p></section>
      <section><h2>Service providers and outside links</h2><p>The service uses Vercel for hosting, Supabase PostgreSQL for stored records, an email-delivery provider for account messages, and Google when you choose Google sign-in or view Google Maps. The optional home-pin map loads OpenStreetMap tiles only when you open it; the map provider receives the viewed map area, not your typed address. School images and outside websites may be served by their respective hosts.</p><p>These providers can receive technical information needed to deliver their services and may process it outside the Philippines. Their own policies apply to their services. Xlore U does not send your private home pin to schools as part of a recommendation.</p></section>
      <section><h2>Browser storage and security</h2><p>The application uses browser storage for sign-in tokens, preferences, and some in-progress work. Keep shared devices secure and sign out when finished. Passwords are hashed rather than stored as readable passwords, and account-only endpoints require authentication. No online system can promise absolute security; never share passwords or verification codes.</p></section>
      <section><h2>Retention and your choices</h2><p>Saved account and assessment records remain in the system until the team removes them through its maintenance or account-request process; there is no automatic account-expiry or self-service deletion feature at present. Removing a home pin removes it from the active profile record. Backups or operational records may retain earlier copies until their retention cycle ends.</p><p>The project owner must establish a documented retention and deletion schedule, including backup handling, before public launch. You may ask the designated team contact about access, correction, deletion, objections, or withdrawal of optional data use, subject to applicable requirements. You may also contact the <a href="https://privacy.gov.ph/" target="_blank" rel="noopener noreferrer">National Privacy Commission</a> about privacy concerns.</p></section>
      <section><h2>Younger students</h2><p>If you are a minor, review these pages with a parent or guardian and ask for help if anything is unclear. This checkbox does not verify parental or guardian consent. The project team must confirm the appropriate safeguards for its student audience before public launch.</p></section>
      <section><h2>Policy changes</h2><p>New account registrations record the policy version shown here. Existing users are not marked as having accepted this version without an affirmative action. Material changes to data use require a separate review and appropriate notice; this checkbox is not permission for unrelated future uses.</p></section>
    </> : <>
      <section><h2>About the service</h2><p>Xlore U helps students explore Metro Manila schools and college programs, compare options, and review suggestions based on assessment responses and a selected field. It is a student-developed capstone project, not an admissions office or an institution's official representative.</p></section>
      <section><h2>Creating and protecting your account</h2><p>Provide details that belong to you and keep your sign-in credentials private. Email registration requires email verification. Google sign-in is optional. If you are a minor, review these terms and the Privacy Policy with a parent or guardian. Do not impersonate other people or share their private information.</p></section>
      <section><h2>Recommendations and school information</h2><p>Suggestions are starting points for exploration, not guaranteed admission, employment, or success. Schools control their own admissions and program availability. Tuition, scholarships, requirements, school data, and program descriptions can change; verify important details directly with the institution before deciding.</p><p>Distance figures are approximate straight-line estimates. A confirmed home pin is used when available; otherwise a clearly labeled city-center estimate may be shown. They are not road distances, travel times, or transport prices. Unknown information is not a guarantee that a school meets your needs.</p></section>
      <section><h2>Responsible use</h2><p>Use the service for lawful college exploration. Do not attempt unauthorized access, disrupt the service, upload harmful content, submit abusive feedback, or misuse other people's personal information. School names, logos, and third-party content remain the property of their respective owners.</p></section>
      <section><h2>Your data and optional features</h2><p>Read the <Link to="/privacy">Privacy Policy</Link> for the information used by the application. A home pin and device-location request are optional and separate from this agreement. Accepting these terms does not authorize advertising, sale of personal data, or unrelated uses of your answers.</p></section>
      <section><h2>Availability and account requests</h2><p>Features may be interrupted by maintenance or provider outages. The project team may address misuse or security issues and may revise the service as the project develops. Contact the designated team contact for account or data requests; there is no self-service account-deletion feature at present.</p></section>
      <section><h2>Your agreement</h2><p>To create an account, actively check the agreement box. The system records the policy version and acceptance time. The Privacy Policy acknowledgment confirms that you have been shown that notice; it does not replace any separate consent or permission required for an optional feature.</p></section>
    </>}
    <PolicyContact />
    <p className="policy-return"><Link className="secondary-btn link-btn" to="/register">Back to create account</Link></p>
  </article></section>;
}
