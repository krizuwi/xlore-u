export function InstitutionApplicationAttempts({ application, onResubmit, busy = false }) {
  const attempt = application.attemptNumber ?? 1, count = application.rejectionCount ?? 0, max = application.maxRejections ?? 5;
  const rejected = application.status === 'rejected';
  return <section className="institution-application-attempts" aria-label="Institution application attempts">
    <p><strong>Application attempt {attempt} of {max}</strong> · {count} of {max} rejected</p>
    {rejected && (application.canResubmit && count < max ? <>
      <p>You can correct your registration and submit again using the same email and existing password. {max - count} {max - count === 1 ? 'attempt remains' : 'attempts remain'}. Verify your email again after submitting.</p>
      {onResubmit && <button type="button" className="primary-btn" disabled={busy} onClick={onResubmit}>{busy ? 'Opening registration…' : 'Correct and resubmit application'}</button>}
    </> : <p role="status">This email has reached five rejected applications. Further institution submissions using this email are blocked.</p>)}
  </section>;
}

export function InstitutionRejectionHistory({ application }) {
  const history = application.rejectionHistory ?? [];
  return <section className="institution-application-attempts" aria-label="Application attempt history">
    <p><strong>Application attempt {application.attemptNumber ?? 1} of 5</strong> · {application.rejectionCount ?? 0} of 5 rejected</p>
    {history.length > 0 && <details><summary>Previous rejection history ({history.length})</summary>
      {history.map(item => <article key={item.attemptNumber} className="institution-rejection-record">
        <h4>Attempt {item.attemptNumber} — rejected</h4>
        <p><strong>School:</strong> {item.registration?.schoolName ?? item.registration?.proposedSchool?.name ?? 'Not provided'}</p>
        <p><strong>Representative:</strong> {item.registration?.representativeName ?? 'Not provided'}</p>
        <p className="school-post-body"><strong>Reason:</strong> {item.reason}</p>
        {item.rejectedAt && <p><strong>Reviewed:</strong> {new Date(item.rejectedAt).toLocaleString()}</p>}
      </article>)}
    </details>}
    {application.status === 'rejected' && application.rejectionCount >= 5 && <p>Five-rejection limit reached. This email can no longer resubmit.</p>}
  </section>;
}
