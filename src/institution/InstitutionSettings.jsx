import { Building2, KeyRound, Link2, Mail, RefreshCw, Save, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useUnsavedChanges } from '../context/UnsavedChangesContext.jsx';
import { ErrorMessage, LoadingState, SuccessMessage } from '../components/Feedback.jsx';
import { AccountField } from '../components/AccountField.jsx';
import { UnsavedForm } from '../components/UnsavedForm.jsx';
import { api } from '../lib/api.js';
import { institutionName, institutionPassword } from '../lib/institution-account.js';
import { institutionRegistrationLimits as limits, optionalVerificationLink } from '../lib/institution-registration.js';
import './institution.css';

export function InstitutionAccountFields({ account, name, onChange, disabled }) {
  return <>
    <AccountField label="Institution name" name="schoolName" icon={Building2} required limit={limits.schoolName} value={name} onChange={onChange} disabled={disabled || !account.canRename} autoComplete="organization" hint={account.canRename ? 'This changes your linked school’s public name, not which school you represent.' : 'School renaming is available only after approval while your school is active.'} />
    <label><span>Institution contact email</span><div className="input-with-icon profile-readonly"><Mail size={18} aria-hidden="true" /><input type="email" value={account.email} readOnly aria-readonly="true" autoComplete="email" /></div></label>
    <label><span>Registered representative</span><div className="input-with-icon profile-readonly"><UserRound size={18} aria-hidden="true" /><input value={account.representativeName ?? ''} readOnly aria-readonly="true" /></div></label>
  </>;
}

export function InstitutionPasswordFields({ value, onChange, disabled }) {
  return <>
    <AccountField label="Current password" name="currentPassword" icon={KeyRound} type="password" required value={value.currentPassword} onChange={event => onChange({ ...value, currentPassword: event.target.value })} disabled={disabled} autoComplete="current-password" placeholder="Enter your current password" />
    <AccountField label="New password" name="newPassword" icon={KeyRound} type="password" required limit={limits.password} minLength={8} value={value.newPassword} onChange={event => onChange({ ...value, newPassword: event.target.value })} disabled={disabled} autoComplete="new-password" placeholder="Create a new password" hint="8–72 characters; no more than 72 UTF-8 bytes." />
    <AccountField label="Confirm new password" name="confirmPassword" icon={KeyRound} type="password" required limit={limits.password} minLength={8} value={value.confirmPassword} onChange={event => onChange({ ...value, confirmPassword: event.target.value })} disabled={disabled} autoComplete="new-password" placeholder="Repeat your new password" />
  </>;
}

function SettingsForms({ account, onReload }) {
  const { logout } = useAuth(), { markClean } = useUnsavedChanges(), navigate = useNavigate();
  const [name, setName] = useState(account.school?.name ?? account.proposedName ?? ''), [savedName, setSavedName] = useState(account.school?.name ?? '');
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [verificationUrl, setVerificationUrl] = useState(account.verificationUrl ?? ''), [savedVerificationUrl, setSavedVerificationUrl] = useState(account.verificationUrl ?? '');
  const [verificationError, setVerificationError] = useState(''), [verificationSuccess, setVerificationSuccess] = useState('');
  const [busy, setBusy] = useState(''), [nameError, setNameError] = useState(''), [nameSuccess, setNameSuccess] = useState(''), [passwordError, setPasswordError] = useState('');
  const lock = useRef(false), passwordRoot = useRef(null);
  async function saveVerification(event) {
    event.preventDefault(); if (lock.current) return false;
    setVerificationError(''); setVerificationSuccess('');
    let next; try { next = optionalVerificationLink(verificationUrl); } catch (err) { setVerificationError(err.message); return false; }
    lock.current = true; setBusy('verification');
    try {
      const result = await api('/institutions/account/verification', { method: 'PATCH', body: JSON.stringify({ verificationUrl: next, expectedVerificationUrl: savedVerificationUrl }) });
      setVerificationUrl(result.verificationUrl); setSavedVerificationUrl(result.verificationUrl); setVerificationSuccess(result.message); return true;
    } catch (err) { setVerificationError(err.message); return false; }
    finally { lock.current = false; setBusy(''); }
  }
  async function saveName(event) {
    event.preventDefault(); if (lock.current) return false;
    setNameError(''); setNameSuccess('');
    let next; try { next = institutionName(name); } catch (err) { setNameError(err.message); return false; }
    lock.current = true; setBusy('name');
    try {
      const result = await api('/institutions/account', { method: 'PATCH', body: JSON.stringify({ schoolName: next, expectedName: savedName }) });
      setName(result.schoolName); setSavedName(result.schoolName); setNameSuccess(result.message); return true;
    } catch (err) { setNameError(err.message); return false; }
    finally { lock.current = false; setBusy(''); }
  }
  async function changePassword(event) {
    event.preventDefault(); if (lock.current) return false;
    setPasswordError('');
    let body; try { body = institutionPassword(password); } catch (err) { setPasswordError(err.message); return false; }
    lock.current = true; setBusy('password');
    try {
      const result = await api('/institutions/account/password', { method: 'POST', body: JSON.stringify(body) });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      markClean(passwordRoot.current);
      // The server revoked refresh sessions; clear this browser's credentials too.
      await logout().catch(() => {});
      navigate('/institution/login', { replace: true, state: { message: result.message } }); return true;
    } catch (err) { setPasswordError(err.message); return false; }
    finally { lock.current = false; setBusy(''); }
  }
  return <div className="profile-form institution-settings-grid">
    <UnsavedForm className="content-card profile-card" onSubmit={saveName} enabled={account.canRename}>
      <div className="profile-card-heading"><span className="profile-card-icon"><Building2 size={21} /></span><div><h2>Institution information</h2><p>Your sign-in email and school ownership stay unchanged.</p></div></div>
      <InstitutionAccountFields account={account} name={name} onChange={event => { setName(event.target.value); setNameSuccess(''); }} disabled={Boolean(busy)} />
      <ErrorMessage message={nameError} /><SuccessMessage message={nameSuccess} />
      {account.canRename && <button type="submit" className="primary-btn" disabled={Boolean(busy) || name === savedName}><Save size={17} />{busy === 'name' ? 'Saving…' : 'Save institution name'}</button>}
      <button type="button" className="text-btn" disabled={Boolean(busy)} onClick={onReload}><RefreshCw size={15} /> Reload account details</button>
    </UnsavedForm>
    <div ref={passwordRoot}><UnsavedForm className="content-card profile-card" onSubmit={changePassword}>
      <div className="profile-card-heading"><span className="profile-card-icon"><ShieldCheck size={21} /></span><div><h2>Change password</h2><p>Confirm your current password before creating a new one.</p></div></div>
      <InstitutionPasswordFields value={password} onChange={setPassword} disabled={Boolean(busy)} />
      <p className="institution-form-note">You will be signed out after changing your password. Other refresh sessions will also be revoked. Save any institution name or verification link changes first.</p>
      <ErrorMessage message={passwordError} />
      <button type="submit" className="primary-btn" disabled={Boolean(busy) || !password.currentPassword || !password.newPassword || !password.confirmPassword || name !== savedName && account.canRename || verificationUrl !== savedVerificationUrl}><ShieldCheck size={17} />{busy === 'password' ? 'Updating…' : 'Update password'}</button>
    </UnsavedForm></div>
    <UnsavedForm className="content-card profile-card institution-verification-card" onSubmit={saveVerification}>
      <div className="profile-card-heading"><span className="profile-card-icon"><Link2 size={21} /></span><div><h2>School verification link</h2><p>Add an official staff directory or contact page to help admin verify your authority. You may leave it blank.</p></div></div>
      <AccountField label="Official school website or verification link" name="verificationUrl" type="url" icon={Link2} limit={limits.url} value={verificationUrl} onChange={event => { setVerificationUrl(event.target.value); setVerificationSuccess(''); }} disabled={Boolean(busy)} pattern="https://.+" placeholder="https://school.edu.ph/staff" hint="Only your account and administrators can view this link. Updating it does not approve or reactivate an account." />
      <ErrorMessage message={verificationError} /><SuccessMessage message={verificationSuccess} />
      <button type="submit" className="primary-btn" disabled={Boolean(busy) || verificationUrl === savedVerificationUrl}><Save size={17} />{busy === 'verification' ? 'Saving…' : 'Save verification link'}</button>
    </UnsavedForm>
  </div>;
}

function AccountSettings() {
  const [account, setAccount] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const { requestDiscard } = useUnsavedChanges();
  useEffect(() => {
    const controller = new AbortController(); setAccount(null); setError('');
    api('/institutions/account', { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setAccount(data); }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [revision]);
  return <section className="page-shell profile-page institution-settings-page"><div className="container profile-container">
    <header className="profile-heading"><Link className="back-link" to="/institution">← Back to institution panel</Link><span className="section-kicker">Your institution account</span><h1>Profile settings</h1><p>Keep your institution name current and secure your Xlore U account.</p></header>
    {error ? <div className="content-card"><ErrorMessage message={error} /><button type="button" className="secondary-btn" onClick={() => setRevision(value => value + 1)}>Try again</button></div> : account ? <SettingsForms key={revision} account={account} onReload={() => requestDiscard(() => setRevision(value => value + 1))} /> : <LoadingState label="Loading institution settings…" />}
  </div></section>;
}

export function InstitutionSettings() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-shell container"><LoadingState label="Checking your account…" /></div>;
  if (!user) return <Navigate to="/institution/login" replace state={{ message: 'Sign in to manage your institution account.' }} />;
  if (user.role !== 'institution') return <Navigate to="/profile" replace />;
  if (!user.emailVerified) return <section className="page-shell container"><h1>Verify your contact email</h1><p>Verify your institution email before opening account settings.</p><Link to="/institution/login">Institution sign in</Link></section>;
  return <AccountSettings key={user.id} />;
}
