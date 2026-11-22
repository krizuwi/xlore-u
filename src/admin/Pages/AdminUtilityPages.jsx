import { UnsavedForm } from "../../components/UnsavedForm.jsx";
import { useUnsavedChanges } from "../../context/UnsavedChangesContext.jsx";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, KeyRound, LockKeyhole, Mail, Search, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { GoogleSignInButton } from "../../pages/AuthPage.jsx";
import { useAdminResource } from "../lib/adminApi.js";
import { api } from "../../lib/api.js";
import { accountLimits } from "../../lib/account-validation.js";
import { personalNameInput, validatePersonalName } from "../../lib/identity-validation.js";
import { Brand } from "../../components/Brand.jsx";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";
import { keywordMatches } from "../../lib/keyword-search.js";
import "./AdminUtilityPages.css";

export function AdminLoginPage() {
  const { markClean } = useUnsavedChanges();
  const { user, loginAdmin, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const authorizedAdminEmail = "unicourse02@gmail.com";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  async function signIn(action) {
    setError(""); setBusy(true);
    try {
      const account = await action();
      if (account.role !== "admin" || account.email.toLowerCase() !== authorizedAdminEmail) {
        await logout();
        throw new Error("Sign in with the authorized administrator account.");
      }
      markClean();
      navigate("/admin", { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="au-login-page">
    <Link to="/" className="au-back-link"><ArrowLeft size={16} />Back to Xlore U</Link>
    <div className="au-login-theme"><ThemeToggle /></div>
    <section className="au-login-card" aria-labelledby="au-login-title">
      <div className="au-login-brand"><Brand subtitle="Admin panel" /></div>
      <div className="au-login-intro"><span className="au-login-shield"><ShieldCheck size={23} /></span><h1 id="au-login-title">Admin sign in</h1><p>Manage the university and program catalog.</p></div>
      <UnsavedForm className="au-login-form" onSubmit={event => { event.preventDefault(); signIn(() => loginAdmin(email.trim(), password)); }}>
        <label htmlFor="au-admin-email">Administrator email</label><input id="au-admin-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} autoComplete="username" autoCapitalize="none" spellCheck={false} />
        <label htmlFor="au-admin-password">Password</label><div className="au-password-field"><input id="au-admin-password" autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        <button className="au-login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button>
      </UnsavedForm>
      <div className="au-login-divider"><span>or continue with Google</span></div>
      <GoogleSignInButton action="signin_with" busy={busy} onCredential={credential => signIn(() => loginWithGoogle(credential, true))} onError={() => setError("Google sign-in is not configured.")} />
      {error && <div className="au-login-error" role="alert"><CircleAlert size={16} />{error}</div>}
      <p className="au-login-note"><LockKeyhole size={12} />Only the verified administrator account can access this panel.</p>
      <p className="au-login-help">Use your Xlore U password, not your Gmail or SMTP app password. If you joined with Google, use Google sign-in or set a password through email recovery.</p>
      <Link to="/login" state={{ step: "forgot", email: email.trim(), from: "/admin" }} className="au-preview-link">Set or reset your Xlore U password</Link>
      {import.meta.env.DEV && <p className="au-login-help">If Google shows origin_mismatch, authorize <code>{window.location.origin}</code> in your Google OAuth client's JavaScript origins.</p>}
    </section>
  </main>;
}

export function AdminProfileSettingsPage() {
  const { user, reloadUser } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    middleName: user?.middleName ?? "",
    lastName: user?.lastName ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm(current => ({
      ...current,
      firstName: user?.firstName ?? "",
      middleName: user?.middleName ?? "",
      lastName: user?.lastName ?? ""
    }));
  }, [user?.firstName, user?.middleName, user?.lastName]);

  function update(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      for (const [field, label] of [["firstName", "First name"], ["middleName", "Middle name"], ["lastName", "Last name"]]) {
        if (form[field].length > accountLimits.name) throw new Error(`${label} must be at most ${accountLimits.name} characters.`);
        validatePersonalName(form[field], label);
      }
      if (form.newPassword && form.newPassword !== form.confirmPassword) {
        throw new Error("The new passwords do not match.");
      }
      if (form.newPassword && user.hasPassword && !form.currentPassword) {
        throw new Error("Enter your current password before choosing a new one.");
      }
      if (form.newPassword && form.newPassword.length < 8) {
        throw new Error("New password must contain at least 8 characters.");
      }

      setBusy(true);
      const body = {
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName
      };
      if (form.newPassword) {
        body.currentPassword = form.currentPassword;
        body.newPassword = form.newPassword;
      }
      const result = await api("/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      await reloadUser();
      setForm(current => ({ ...current, currentPassword: "", newPassword: "", confirmPassword: "" }));
      setMessage(result.message ?? "Administrator profile updated.");
      return true;
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="au-page">
    <header className="au-page-heading"><div><h1>Profile settings</h1><p>Update your administrator name and account password.</p></div></header>
    <UnsavedForm className="au-card au-admin-profile-card" onSubmit={save}>
      <div className="au-card-heading"><span className="au-heading-icon"><UserRound size={18} /></span><div><h2>Administrator profile</h2><p>Changes apply to your administrator account.</p></div></div>
      <div className="au-form-body">
        <div className="au-admin-profile-grid">
          <label htmlFor="admin-first-name">First name<input id="admin-first-name" disabled={busy} name="firstName" value={form.firstName} onChange={update} required maxLength={accountLimits.name} autoComplete="given-name" {...personalNameInput} /></label>
          <label htmlFor="admin-middle-name">Middle name <span>(optional)</span><input id="admin-middle-name" disabled={busy} name="middleName" value={form.middleName} onChange={update} maxLength={accountLimits.name} autoComplete="additional-name" {...personalNameInput} /></label>
          <label htmlFor="admin-last-name">Last name<input id="admin-last-name" disabled={busy} name="lastName" value={form.lastName} onChange={update} required maxLength={accountLimits.name} autoComplete="family-name" {...personalNameInput} /></label>
          <label htmlFor="admin-email">Email address<div className="au-admin-email"><Mail size={16} /><input id="admin-email" type="email" value={user.email} readOnly aria-readonly="true" /></div></label>
        </div>
        <p className="au-field-hint">Your administrator email is read-only. Contact the system owner if it needs to be changed.</p>
        <div className="au-admin-password-heading"><span className="au-heading-icon"><ShieldCheck size={18} /></span><div><h2>Change password</h2><p>{user.hasPassword ? "Enter your current password to set a new one." : "Create a password for your account. Leave these fields blank to keep using Google sign-in."}</p></div></div>
        <div className="au-admin-profile-grid">
          {user.hasPassword && <label htmlFor="admin-current-password">Current password<input id="admin-current-password" disabled={busy} name="currentPassword" value={form.currentPassword} onChange={update} type="password" autoComplete="current-password" /></label>}
          <label htmlFor="admin-new-password">New password<input id="admin-new-password" disabled={busy} name="newPassword" value={form.newPassword} onChange={update} type="password" autoComplete="new-password" minLength={8} /></label>
          <label htmlFor="admin-confirm-password">Confirm new password<input id="admin-confirm-password" disabled={busy} name="confirmPassword" value={form.confirmPassword} onChange={update} type="password" autoComplete="new-password" minLength={8} /></label>
        </div>
        {(error || message) && <p className={`au-form-feedback${error ? " au-form-error" : ""}`} role={error ? "alert" : "status"}>{error || message}</p>}
      </div>
      <div className="au-form-footer"><button className="au-primary-button" disabled={busy}><KeyRound size={15} />{busy ? "Saving…" : "Save profile"}</button></div>
    </UnsavedForm>
  </div>;
}

export function AdminLogsPage() {
  const resource = useAdminResource("/logs"), settings = useAdminResource("/settings");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  useEffect(() => { if (settings.data) setFilter(settings.data.activityFilter); }, [settings.data]);
  const rows = resource.data?.data ?? [];
  const visible = rows.filter(row => (filter === "all" || filter === row.severity) && keywordMatches([row.title, row.detail, row.source, row.severity], query));
  return <div className="au-page"><header className="au-page-heading"><div><h1>Activity logs</h1><p>Administrator changes and catalog collection history.</p></div><button className="au-secondary-button" onClick={resource.refresh} disabled={resource.loading}>Refresh</button></header>
    {resource.error && <p role="alert" className="au-login-error">{resource.error}</p>}
    <section className="au-card au-log-card"><div className="au-log-toolbar"><label className="au-search"><Search size={17} /><input aria-label="Search activity" placeholder="Search activity…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter activity" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All activity</option><option value="success">Success</option><option value="info">Updates</option><option value="error">Errors</option></select></div>
      <div className="au-table-scroll"><table className="au-logs-table"><thead><tr><th>Event</th><th>Details</th><th>Source</th><th>Status</th><th>Date and time</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td>{row.title}</td><td>{row.detail}</td><td>{row.source}</td><td>{row.severity}</td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div><footer className="au-log-footer">{resource.loading ? "Loading activity…" : `${visible.length} events`}</footer>
    </section></div>;
}
