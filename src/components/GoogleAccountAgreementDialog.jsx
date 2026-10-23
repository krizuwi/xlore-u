import { useEffect, useRef } from 'react';
import { AccountAgreement } from './AccountAgreement.jsx';
import { ErrorMessage } from './Feedback.jsx';

export function GoogleAccountAgreementDialog({ open, checked, onChange, busy, error, onConfirm, onCancel }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);

  return <dialog ref={dialogRef} className="google-agreement-dialog" aria-labelledby="google-agreement-title" aria-describedby="google-agreement-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <div className="google-account-agreement">
      <h2 id="google-agreement-title">Create your Google-linked account</h2>
      <p id="google-agreement-description">Your Google account is verified. Before we create your Xlore U account, please review and accept the policies below.</p>
      <ErrorMessage message={error} />
      <AccountAgreement id="google-account-agreement" checked={checked} disabled={busy} onChange={onChange} />
      <div className="google-agreement-actions">
        <button className="secondary-btn" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
        <button className="primary-btn" type="button" disabled={busy || !checked} onClick={onConfirm}>{busy ? 'Creating account...' : 'Agree and create account'}</button>
      </div>
    </div>
  </dialog>;
}
