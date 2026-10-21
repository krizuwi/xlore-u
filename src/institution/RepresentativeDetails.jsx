import { ExternalLink, ShieldCheck, UserRound } from 'lucide-react';

function evidenceLink(value) {
  try { const link = new URL(value); return link.protocol === 'https:' ? link.href : null; }
  catch { return null; }
}

function Detail({ label, value, wide = false }) {
  return <div className={wide ? 'representative-detail-wide' : ''}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>;
}

// Deliberate field allowlist: registration passwords/tokens never belong in review UI.
export function RepresentativeDetails({ application }) {
  const link = evidenceLink(application.verificationUrl);
  const submitted = application.createdAt ? new Date(application.createdAt) : null;
  const validDate = submitted && !Number.isNaN(submitted.getTime());
  return <section className="representative-details" aria-label="Submitted representative details">
    <header><span className="profile-card-icon"><UserRound size={21} aria-hidden="true" /></span><div><h3>Representative details</h3><p>Saved registration information · visible to administrators only</p></div></header>
    <dl className="representative-detail-grid">
      <Detail label="Full name" value={application.representativeName} wide />
      <Detail label="First name" value={application.firstName} />
      <Detail label="Middle name (optional)" value={application.middleName} />
      <Detail label="Last name" value={application.lastName} />
      <Detail label="Position / designation" value={application.title} />
      <Detail label="Institution contact email" value={application.email} />
      <Detail label="School contact telephone" value={application.phone} />
      <div><dt>Email verification</dt><dd><span className="tag"><ShieldCheck size={14} aria-hidden="true" /> {application.emailVerified ? 'Email verified' : 'Email not verified'}</span></dd></div>
      <div><dt>Submitted on</dt><dd>{validDate ? <time dateTime={submitted.toISOString()}>{submitted.toLocaleString()}</time> : 'Not available'}</dd></div>
    </dl>
    <section className="representative-evidence" aria-label="Submitted authority verification">
      <h4>Authority verification</h4>
      <dl><div><dt>Official staff / authorization link</dt><dd>{link ? <a href={link} target="_blank" rel="noopener noreferrer">{application.verificationUrl}<ExternalLink size={14} aria-hidden="true" /></a> : application.verificationUrl || 'Not provided'}</dd></div>
        <div><dt>How admin can verify their authority</dt><dd className="school-post-body">{application.evidence || 'Not provided'}</dd></div>
      </dl>
    </section>
    <p className="representative-privacy-note">Email verification confirms the mailbox only. Independently contact the school using a trusted official channel before approving ownership.</p>
  </section>;
}
