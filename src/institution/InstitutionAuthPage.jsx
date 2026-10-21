import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, KeyRound, Link2, Mail, MapPin, Phone, Search, ShieldCheck, UserRound } from 'lucide-react';
import { AccountField as InstitutionField } from '../components/AccountField.jsx';
export { AccountField as InstitutionField } from '../components/AccountField.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { AccountAgreement } from '../components/AccountAgreement.jsx';
import { ErrorMessage, SuccessMessage } from '../components/Feedback.jsx';
import { policyAcceptance } from '../lib/account-policies.js';
import { institutionRegistrationLimits as limits, validateInstitutionRegistration } from '../lib/institution-registration.js';
import { UnsavedForm } from '../components/UnsavedForm.jsx';
import './institution.css';

export const emptySchool = { name: '', type: 'Private', city: '', address: '', latitude: '', longitude: '', website: '', description: '', tuitionRange: '', accreditation: '', scholarshipInfo: '' };

export function SchoolRequestFields({ value, onChange }) {
  const field = (key, label, type, limit, icon, extra = {}) => <InstitutionField name={'proposedSchool.' + key} label={label} value={value[key] ?? ''} onChange={event => onChange({ ...value, [key]: event.target.value })} type={type} limit={limit} icon={icon} required {...extra} />;
  return <div className="institution-fields institution-request-fields">
    {field('name', 'Official school name', 'text', limits.schoolName, Building2, { className: 'wide', autoComplete: 'organization' })}
    <label className="institution-auth-field"><span>School type</span><select name="proposedSchool.type" value={value.type} onChange={event => onChange({ ...value, type: event.target.value })}><option>Private</option><option>Public</option></select></label>
    {field('city', 'City', 'text', limits.city, MapPin, { autoComplete: 'address-level2' })}
    {field('address', 'Campus address', 'text', limits.address, MapPin, { className: 'wide', autoComplete: 'street-address' })}
    {field('latitude', 'Latitude', 'number', undefined, MapPin, { step: 'any', min: -90, max: 90 })}
    {field('longitude', 'Longitude', 'number', undefined, MapPin, { step: 'any', min: -180, max: 180 })}
    {field('website', 'Official HTTPS website', 'url', limits.url, Link2, { className: 'wide', placeholder: 'https://school.edu.ph', pattern: 'https://.+' })}
    <InstitutionField name="proposedSchool.description" className="wide" label="School description" multiline limit={limits.description} value={value.description ?? ''} onChange={event => onChange({ ...value, description: event.target.value })} hint="A short introduction to the campus and what it offers." />
  </div>;
}

export function InstitutionAuthPage({ register = false }) {
  const { user, loginInstitution } = useAuth(), navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ firstName: '', middleName: '', lastName: '', email: '', password: '', confirmPassword: '', schoolId: '', representativeTitle: '', contactPhone: '', verificationUrl: '', verificationNote: '' });
  const [proposed, setProposed] = useState(emptySchool), [requestNew, setRequestNew] = useState(false), [search, setSearch] = useState(''), [schools, setSchools] = useState([]), [searching, setSearching] = useState(false), [searchError, setSearchError] = useState('');
  const [agreed, setAgreed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(location.state?.message ?? ''), [registered, setRegistered] = useState(false), [code, setCode] = useState('');
  useEffect(() => {
    if (!register || requestNew || registered) return;
    const controller = new AbortController(); setSearching(true); setSearchError('');
    const timer = setTimeout(() => { api(`/institutions/schools?search=${encodeURIComponent(search)}`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setSchools(result.data); }).catch(err => { if (!controller.signal.aborted) { setSchools([]); setSearchError(err.message); } }).finally(() => { if (!controller.signal.aborted) setSearching(false); }); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [register, requestNew, search, registered]);
  if (user?.role === 'institution') return <Navigate to="/institution" replace />;
  const field = (key, label, type, limit, icon, extra = {}) => <InstitutionField name={key} label={label} value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} type={type} limit={limit} icon={icon} required={key !== 'middleName'} {...extra} />;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (register) {
        validateInstitutionRegistration(form, requestNew ? proposed : null);
        const acceptance = policyAcceptance(agreed);
        await api('/institutions/register', { method: 'POST', body: JSON.stringify({ ...form, ...acceptance, schoolId: requestNew ? null : form.schoolId, proposedSchool: requestNew ? proposed : null }) });
        setForm(current => ({ ...current, password: '', confirmPassword: '' }));
        setRegistered(true); setMessage('Check your contact email for the verification code. Your school application will still need admin approval.');
      } else { await loginInstitution(form.email, form.password); navigate('/institution'); }
      return true;
    } catch (err) { setError(err.message); return false; } finally { setBusy(false); }
  }
  async function verify(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email: form.email, code }) }); setRegistered(false); setCode(''); setMessage('Email verified. Sign in to view your application status.'); if (register) navigate('/institution/login', { state: { message: 'Email verified. Sign in to view your application status.' } }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className={'auth-page page-shell institution-auth-page' + (register && !registered ? ' institution-register-page' : '')}>
    <div className="auth-layout container">
      <aside className="auth-aside">
        <span className="eyebrow"><span className="eyebrow-dot" /> Your institution's home on Xlore U</span>
        <h1>Connect with students.<br /><span>Share your school's story.</span></h1>
        <p>Keep your school profile, programs, and community updates together in one place.</p>
        <div className="auth-benefits">{['Manage your school profile and programs', 'Publish updates and reply to students', 'One verified account for your institution'].map(item => <div key={item}><span>✓</span>{item}</div>)}</div>
        <p className="institution-approval-note"><ShieldCheck size={19} aria-hidden="true" /> School access starts after email verification and an admin ownership check.</p>
      </aside>
      <div className="auth-card">
        <nav className="account-type-switch" aria-label="Account type"><Link to={register ? '/register' : '/login'}>Student</Link><Link aria-current="page" to={register ? '/institution/register' : '/institution/login'}>Institution</Link></nav>
        <span className="section-kicker">{registered ? 'One more step' : 'Institution access'}</span>
        <h2>{registered ? 'Verify your email' : register ? 'Register your institution' : 'Welcome back'}</h2>
        <p className="auth-description">{registered ? 'Enter the six-digit code sent to your institution contact email.' : register ? 'Create a representative account and select the school you are authorized to manage.' : 'Sign in to manage your school and connect with students.'}</p>
        {user && <ErrorMessage message="You are signed in to another account. Sign out before using institution access." />}
        <ErrorMessage message={error} /><SuccessMessage message={message} />
        {registered ? <form className="auth-form institution-auth-form" onSubmit={verify}><fieldset disabled={busy || Boolean(user)}>
          {field('email', 'Institution contact email', 'email', limits.email, Mail, { autoComplete: 'email', placeholder: 'admissions@school.edu.ph' })}
          <InstitutionField name="code" label="Six-digit email code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, limits.code))} icon={KeyRound} limit={limits.code} required inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" placeholder="000000" />
          <button className="primary-btn auth-submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify contact email'}<ArrowRight size={18} /></button>
          <button type="button" className="text-btn" disabled={busy || !form.email.trim()} onClick={async () => { setBusy(true); setError(''); try { await api('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: form.email }) }); setCode(''); setMessage('Replacement code sent.'); } catch (err) { setError(err.message); } finally { setBusy(false); } }}>Resend code</button>
          <button type="button" className="text-btn" onClick={() => { setRegistered(false); setError(''); setMessage(''); }}>Back to {register ? 'registration' : 'sign in'}</button>
        </fieldset></form> : <UnsavedForm enabled={register && !user} className="auth-form institution-auth-form" onSubmit={submit}>
          <fieldset disabled={busy || Boolean(user)}>
            {register && <section className="institution-registration-section"><h3><UserRound size={19} aria-hidden="true" /> Representative details</h3><p>Use your own name and a contact the school can verify.</p>
              <div className="institution-fields">{field('firstName', 'First name', 'text', limits.name, UserRound, { autoComplete: 'given-name' })}{field('middleName', 'Middle name', 'text', limits.name, UserRound, { autoComplete: 'additional-name' })}{field('lastName', 'Last name', 'text', limits.name, UserRound, { autoComplete: 'family-name' })}{field('representativeTitle', 'Position / designation', 'text', limits.representativeTitle, Building2, { autoComplete: 'organization-title', placeholder: 'e.g. Admissions officer' })}{field('contactPhone', 'School contact telephone', 'tel', limits.contactPhone, Phone, { autoComplete: 'tel', placeholder: '0281234567' })}</div>
            </section>}
            <section className="institution-registration-section">
              {register && <h3><KeyRound size={19} aria-hidden="true" /> Account details</h3>}
              {field('email', 'Institution contact email', 'email', limits.email, Mail, { autoComplete: 'email', placeholder: 'admissions@school.edu.ph' })}
              {field('password', 'Password', 'password', limits.password, KeyRound, { autoComplete: register ? 'new-password' : 'current-password', minLength: register ? 8 : undefined, placeholder: register ? 'At least 8 characters' : 'Enter your password', hint: register ? '8–72 characters; up to 72 UTF-8 bytes.' : undefined })}
              {register && field('confirmPassword', 'Re-enter password', 'password', limits.password, KeyRound, { autoComplete: 'new-password', minLength: 8, placeholder: 'Repeat your password' })}
              {!register && <div className="auth-help-row"><button type="button" onClick={() => { setRegistered(true); setError(''); setMessage(''); }}>Enter verification code</button><Link to="/login" state={{ step: 'forgot', email: form.email }}>Forgot password?</Link></div>}
            </section>
            {register && <>
              <section className="institution-registration-section"><h3><Building2 size={19} aria-hidden="true" /> Choose one school</h3><p>Each institution account represents one school.</p>
                <label className="institution-new-school-choice checkbox-row"><input name="requestNew" type="checkbox" checked={requestNew} onChange={event => { setRequestNew(event.target.checked); setForm(current => ({ ...current, schoolId: '' })); }} /><span>My school is not in the directory</span></label>
                {requestNew ? <><p className="institution-form-note">New schools stay private until admin verifies and approves the request.</p><SchoolRequestFields value={proposed} onChange={setProposed} /></> : <>
                  <InstitutionField name="schoolSearch" label="Search existing schools" type="search" icon={Search} limit={limits.search} value={search} onChange={event => { setSearch(event.target.value); setForm(current => ({ ...current, schoolId: '' })); }} placeholder="School name or city" hint="Search first, then choose one school below." />
                  <label className="institution-auth-field"><span>Existing school</span><select name="schoolId" required disabled={searching || Boolean(searchError)} value={form.schoolId} onChange={event => setForm(current => ({ ...current, schoolId: event.target.value }))}><option value="">{searching ? 'Searching schools…' : 'Select exactly one school'}</option>{schools.map(school => <option key={school.id} value={school.id} disabled={school.claimed}>{school.name} — {school.city}{school.claimed ? ' (already registered)' : ''}</option>)}</select></label>
                  {searching && <p className="institution-form-note" role="status">Searching schools…</p>}{searchError && <ErrorMessage message={searchError} />}{!searching && !searchError && !schools.length && <p className="institution-form-note" role="status">No schools found. Try another name or request a new school above.</p>}
                </>}
              </section>
              <section className="institution-registration-section"><h3><ShieldCheck size={19} aria-hidden="true" /> Verify your authority</h3><p>Admin checks your authority independently. Do not submit IDs, passwords, or private student records.</p>
                {field('verificationUrl', 'Official staff / authorization HTTPS link', 'url', limits.url, Link2, { placeholder: 'https://school.edu.ph/staff', pattern: 'https://.+' })}
                <InstitutionField name="verificationNote" label="How can admin verify your authority?" multiline required limit={limits.verificationNote} value={form.verificationNote} onChange={event => setForm(current => ({ ...current, verificationNote: event.target.value }))} placeholder="Provide a public department contact and explain how your role can be verified." />
              </section>
              <AccountAgreement institution checked={agreed} onChange={setAgreed} disabled={busy} />
            </>}
            <button className="primary-btn auth-submit" disabled={busy || register && (!agreed || !requestNew && (searching || Boolean(searchError)))}>{busy ? 'Please wait…' : register ? 'Submit for review' : 'Sign in'}<ArrowRight size={18} /></button>
            {register && <p className="institution-form-note">Verify your email after submitting. School editing and posting stay unavailable until admin approval.</p>}
          </fieldset>
        </UnsavedForm>}
        <p className="auth-switch">{register ? 'Already registered?' : 'New school representative?'} <Link to={register ? '/institution/login' : '/institution/register'}>{register ? 'Sign in' : 'Register institution'}</Link></p>
      </div>
    </div>
  </section>;
}
