import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, LockKeyhole, Save, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { GoogleSignInButton } from "../../pages/AuthPage.jsx";
import { adminWrite, useAdminResource } from "../lib/adminApi.js";
import "./AdminUtilityPages.css";

export function AdminLoginPage() {
  const { user, loginAdmin, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const email = "unicourse02@gmail.com";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  async function signIn(action) {
    setError(""); setBusy(true);
    try {
      const account = await action();
      if (account.role !== "admin" || account.email.toLowerCase() !== email) {
        await logout();
        throw new Error("Sign in with the authorized administrator account.");
      }
      navigate("/admin", { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="au-login-page">
    <Link to="/" className="au-back-link"><ArrowLeft size={16} />Back to Xlore U</Link>
    <section className="au-login-card" aria-labelledby="au-login-title">
      <div className="au-login-brand"><span className="au-brand-mark" /><span><strong>Xlore U</strong><small>Admin Panel</small></span></div>
      <div className="au-login-intro"><span className="au-login-shield"><ShieldCheck size={23} /></span><h1 id="au-login-title">Admin sign in</h1><p>Manage the university and program catalog.</p></div>
      <form className="au-login-form" onSubmit={event => { event.preventDefault(); signIn(() => loginAdmin(email, password)); }}>
        <label htmlFor="au-admin-email">Administrator email</label><input id="au-admin-email" type="email" value={email} readOnly autoComplete="username" />
        <label htmlFor="au-admin-password">Password</label><div className="au-password-field"><input id="au-admin-password" autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
        <button className="au-login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button>
      </form>
      <div className="au-login-divider"><span>or continue with Google</span></div>
      <GoogleSignInButton action="signin_with" busy={busy} onCredential={credential => signIn(() => loginWithGoogle(credential, true))} onError={() => setError("Google sign-in is not configured.")} />
      {error && <div className="au-login-error" role="alert"><CircleAlert size={16} />{error}</div>}
      <p className="au-login-note"><LockKeyhole size={12} />Only the verified administrator account can access this panel.</p>
      <p className="au-login-help">Use your Xlore U password, not your Gmail or SMTP app password. If you joined with Google, use Google sign-in or set a password through email recovery.</p>
      <Link to="/login" state={{ step: "forgot", email, from: "/admin" }} className="au-preview-link">Set or reset your Xlore U password</Link>
      {import.meta.env.DEV && <p className="au-login-help">If Google shows origin_mismatch, authorize <code>{window.location.origin}</code> in your Google OAuth client's JavaScript origins.</p>}
    </section>
  </main>;
}

export function AdminSettingsPage() {
  const { user } = useAuth();
  const resource = useAdminResource("/settings");
  const [preferences, setPreferences] = useState(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => { if (resource.data) setPreferences(resource.data); }, [resource.data]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { await adminWrite("/settings", "PATCH", { workspaceName: preferences.workspaceName, activityFilter: preferences.activityFilter }); setMessage("Workspace preferences saved."); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="au-page"><header className="au-page-heading"><div><h1>Settings</h1><p>Manage your administrator account and workspace preferences.</p></div></header>
    {(error || resource.error) && <p className="au-login-error" role="alert">{error || resource.error}</p>}
    <div className="au-settings-layout"><section className="au-card au-profile-card"><h2>{user.fullName}</h2><p>{user.email}</p><span className="au-profile-badge">Administrator</span><Link className="au-secondary-button" to="/profile">Manage profile</Link></section>
      {preferences ? <form className="au-card au-preferences-card" onSubmit={save}><div className="au-card-heading"><h2>Workspace preferences</h2></div><div className="au-form-body"><label htmlFor="workspace-name">Workspace name</label><input id="workspace-name" maxLength={60} required value={preferences.workspaceName} onChange={e => setPreferences(current => ({ ...current, workspaceName: e.target.value }))} />
        <label htmlFor="activity-filter">Default activity filter</label><select id="activity-filter" value={preferences.activityFilter} onChange={e => setPreferences(current => ({ ...current, activityFilter: e.target.value }))}><option value="all">All activity</option><option value="success">Successful events</option><option value="info">Updates</option><option value="error">Errors</option></select>{message && <p role="status">{message}</p>}</div><div className="au-form-footer"><button className="au-primary-button" disabled={busy}><Save size={15} />{busy ? "Saving…" : "Save preferences"}</button></div></form> : <p>Loading preferences…</p>}
    </div></div>;
}

export function AdminLogsPage() {
  const resource = useAdminResource("/logs"), settings = useAdminResource("/settings");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  useEffect(() => { if (settings.data) setFilter(settings.data.activityFilter); }, [settings.data]);
  const rows = resource.data?.data ?? [];
  const visible = rows.filter(row => (filter === "all" || filter === row.severity) && `${row.title} ${row.detail} ${row.source}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="au-page"><header className="au-page-heading"><div><h1>Activity logs</h1><p>Administrator changes and catalog collection history.</p></div><button className="au-secondary-button" onClick={resource.refresh} disabled={resource.loading}>Refresh</button></header>
    {resource.error && <p role="alert" className="au-login-error">{resource.error}</p>}
    <section className="au-card au-log-card"><div className="au-log-toolbar"><label className="au-search"><Search size={17} /><input aria-label="Search activity" placeholder="Search activity…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter activity" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All activity</option><option value="success">Success</option><option value="info">Updates</option><option value="error">Errors</option></select></div>
      <div className="au-table-scroll"><table className="au-logs-table"><thead><tr><th>Event</th><th>Details</th><th>Source</th><th>Status</th><th>Date and time</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td>{row.title}</td><td>{row.detail}</td><td>{row.source}</td><td>{row.severity}</td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div><footer className="au-log-footer">{resource.loading ? "Loading activity…" : `${visible.length} events`}</footer>
    </section></div>;
}
