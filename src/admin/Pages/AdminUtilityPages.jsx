import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, ClipboardList, Eye, EyeOff, Info, LockKeyhole, Save, Search, Settings2, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import "./AdminUtilityPages.css";

const preferencesKey = "xlore-admin-preferences";
const defaultPreferences = { workspaceName: "Xlore-U workspace", activityFilter: "all" };

function readPreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey) || "null");
    return {
      workspaceName: typeof value?.workspaceName === "string" && value.workspaceName.trim() ? value.workspaceName : defaultPreferences.workspaceName,
      activityFilter: ["all", "success", "info", "error"].includes(value?.activityFilter) ? value.activityFilter : "all",
    };
  } catch {
    return defaultPreferences;
  }
}

function UtilityHeading({ title, description }) {
  return <header className="au-page-heading"><div><h1>{title}</h1><p>{description}</p></div><span className="au-preview-tag"><span /> Preview workspace</span></header>;
}

export function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const account = await login(email.trim(), password);
      if (account?.role === "admin" || (Array.isArray(account?.roles) && account.roles.includes("admin"))) {
        navigate("/admin", { replace: true });
      } else {
        setError("This account is signed in but does not have an administrator role. You can explore the sample workspace below.");
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="au-login-page">
      <Link to="/" className="au-back-link"><ArrowLeft size={16} aria-hidden="true" /> Back to Xlore-U</Link>
      <section className="au-login-card" aria-labelledby="au-login-title">
        <Link className="au-login-brand" to="/admin" aria-label="Xlore-U admin preview"><span className="au-brand-mark" aria-hidden="true" /><span><strong>Xlore-U</strong><small>Admin Panel</small></span></Link>
        <div className="au-login-intro"><span className="au-login-shield"><ShieldCheck size={23} aria-hidden="true" /></span><h1 id="au-login-title">Admin Access</h1><p>Use your admin credentials to access the panel.</p></div>
        <form className="au-login-form" onSubmit={submit}>
          <label htmlFor="au-admin-email">Email address</label>
          <input id="au-admin-email" name="email" type="email" autoComplete="username" placeholder="admin@xlore-u.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} />
          <label htmlFor="au-admin-password">Password</label>
          <div className="au-password-field"><input id="au-admin-password" name="password" autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          {error && <div className="au-login-error" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{error}</span></div>}
          <button type="submit" className="au-login-submit" disabled={busy}>{busy ? "Signing in…" : "Login"}<ArrowRight size={16} aria-hidden="true" /></button>
        </form>
        <div className="au-login-divider"><span>or take a look around</span></div>
        <Link className="au-preview-link" to="/admin">Explore admin preview <ArrowRight size={14} aria-hidden="true" /></Link>
        <p className="au-login-note"><LockKeyhole size={12} aria-hidden="true" /> Admin access requires an authorized account.</p>
      </section>
      <p className="au-login-footer">Xlore-U <span>·</span> Build for a better education future.</p>
    </main>
  );
}

export function AdminSettingsPage() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(readPreferences);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const savePreferences = (event) => {
    event.preventDefault();
    setMessage("");
    setSaveError("");
    const next = { ...preferences, workspaceName: preferences.workspaceName.trim() };
    if (!next.workspaceName) {
      setSaveError("Enter a workspace name.");
      return;
    }
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(next));
      setPreferences(next);
      setMessage("Your preferences have been saved in this browser.");
    } catch {
      setSaveError("This browser could not save your preferences. Check that local storage is available.");
    }
  };

  const updatePreference = (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setMessage("");
    setSaveError("");
  };

  return (
    <div className="au-page">
      <UtilityHeading title="Settings" description="Manage your workspace and personal preferences." />
      <div className="au-settings-layout">
        <section className="au-card au-profile-card">
          <div className="au-card-heading"><span className="au-heading-icon"><UserRound size={19} aria-hidden="true" /></span><div><h2>Your profile</h2><p>Account information</p></div></div>
          <div className="au-profile-avatar"><UserRound size={31} aria-hidden="true" /></div>
          <h3>{user?.fullName || "Preview administrator"}</h3>
          <p className="au-profile-email">{user?.email || "No account connected"}</p>
          <span className="au-profile-badge">{user ? "Signed-in account" : "Preview mode"}</span>
          <p className="au-profile-description">{user ? "Manage your personal details and account information in your profile." : "Explore the admin workspace with sample data. Sign in to manage your own account."}</p>
          <Link className="au-secondary-button" to={user ? "/profile" : "/admin/login"}>{user ? "Manage profile" : "Admin sign in"}<ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
        <form className="au-card au-preferences-card" onSubmit={savePreferences}>
          <div className="au-card-heading"><span className="au-heading-icon"><Settings2 size={19} aria-hidden="true" /></span><div><h2>Workspace preferences</h2><p>Make this workspace feel like yours.</p></div></div>
          <div className="au-form-body">
            <label htmlFor="au-workspace-name">Workspace name</label>
            <input id="au-workspace-name" value={preferences.workspaceName} onChange={(event) => updatePreference("workspaceName", event.target.value)} maxLength={60} required />
            <p className="au-field-hint">Your personal label for this browser’s workspace.</p>
            <label htmlFor="au-activity-filter">Default activity filter</label>
            <select id="au-activity-filter" value={preferences.activityFilter} onChange={(event) => updatePreference("activityFilter", event.target.value)}><option value="all">All activity</option><option value="success">Successful events</option><option value="info">Updates</option><option value="error">Errors</option></select>
            <p className="au-field-hint">Applied the next time you open the Logs page.</p>
            <div className="au-info-box"><Info size={17} aria-hidden="true" /><p>Preferences are saved only in this browser. The preview workspace displays sample data.</p></div>
            {message && <p className="au-form-feedback" role="status"><CheckCircle2 size={16} aria-hidden="true" />{message}</p>}
            {saveError && <p className="au-form-feedback au-form-error" role="alert"><CircleAlert size={16} aria-hidden="true" />{saveError}</p>}
          </div>
          <div className="au-form-footer"><span>Personal workspace settings</span><button className="au-primary-button" type="submit"><Save size={15} aria-hidden="true" />Save preferences</button></div>
        </form>
      </div>
    </div>
  );
}

const activity = [
  { id: "EVT-001", severity: "success", title: "TUP Taguig scraping completed", detail: "2,843 programs collected successfully", source: "Scraping", date: "Sep 28, 2026", time: "08:12 AM" },
  { id: "EVT-002", severity: "success", title: "UMak scraping completed", detail: "1,205 program records updated", source: "Scraping", date: "Sep 28, 2026", time: "07:34 AM" },
  { id: "EVT-003", severity: "info", title: "New university added", detail: "STI College was added to the university catalog", source: "Universities", date: "Sep 28, 2026", time: "07:00 AM" },
  { id: "EVT-004", severity: "info", title: "Program updated", detail: "BS Information Technology program details updated", source: "Programs", date: "Sep 28, 2026", time: "06:42 AM" },
  { id: "EVT-005", severity: "error", title: "UP Diliman scraping failed", detail: "The source website did not respond within 30 seconds", source: "Scraping", date: "Sep 28, 2026", time: "06:27 AM" },
  { id: "EVT-006", severity: "success", title: "PUP scraping completed", detail: "University and program records collected", source: "Scraping", date: "Sep 27, 2026", time: "10:17 PM" },
  { id: "EVT-007", severity: "info", title: "Category updated", detail: "STEM category description and program associations updated", source: "Categories", date: "Sep 27, 2026", time: "04:30 PM" },
  { id: "EVT-008", severity: "success", title: "FEU scraping completed", detail: "Program information refreshed successfully", source: "Scraping", date: "Sep 27, 2026", time: "03:00 AM" },
];
const statusNames = { success: "Success", info: "Update", error: "Error" };

export function AdminLogsPage({ searchQuery = "" }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(() => readPreferences().activityFilter);
  const visible = activity.filter((item) => {
    const searchable = `${item.title} ${item.detail} ${item.source} ${item.id}`.toLowerCase();
    return (filter === "all" || item.severity === filter)
      && [query, searchQuery].every((value) => searchable.includes(value.trim().toLowerCase()));
  });

  return (
    <div className="au-page">
      <UtilityHeading title="Activity Logs" description="Review recent activity across your admin workspace." />
      <div className="au-log-summary">
        {[
          { label: "Total events", count: activity.length, className: "info", Icon: ClipboardList },
          { label: "Successful events", count: activity.filter((item) => item.severity === "success").length, className: "success", Icon: CheckCircle2 },
          { label: "Errors to review", count: activity.filter((item) => item.severity === "error").length, className: "error", Icon: CircleAlert },
        ].map(({ label, count, className, Icon }) => <div className="au-card au-log-stat" key={label}><span className={`au-event-icon ${className}`}><Icon size={20} aria-hidden="true" /></span><div><p>{label}</p><strong>{count}</strong></div></div>)}
      </div>
      <section className="au-card au-log-card" aria-labelledby="au-logs-title">
        <div className="au-card-heading au-logs-heading"><div><h2 id="au-logs-title">Workspace activity</h2><p>Sample events from September 27–28, 2026</p></div><span className="au-demo-tag">Demo activity</span></div>
        <div className="au-log-toolbar"><label className="au-search"><Search size={17} aria-hidden="true" /><input aria-label="Search activity" placeholder="Search events, programs, or universities…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by event status"><option value="all">All activity</option><option value="success">Success</option><option value="info">Updates</option><option value="error">Errors</option></select></div>
        <div className="au-table-scroll"><table className="au-logs-table"><thead><tr><th>Event</th><th>Source</th><th>Status</th><th>Date & time</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td><div className="au-event-cell"><span className={`au-event-icon ${item.severity}`}>{item.severity === "success" ? <Check size={15} aria-hidden="true" /> : item.severity === "error" ? <CircleAlert size={15} aria-hidden="true" /> : <Info size={15} aria-hidden="true" />}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></div></td><td>{item.source}</td><td><span className={`au-status ${item.severity}`}><span />{statusNames[item.severity]}</span></td><td><span className="au-event-date">{item.date}</span><span className="au-event-time">{item.time}</span></td></tr>)}</tbody></table></div>
        {!visible.length && <div className="au-empty-state"><Search size={27} aria-hidden="true" /><h3>No matching events</h3><p>{searchQuery.trim() ? "Try changing the search in the top bar or the filters on this page." : "Try a different search or event status."}</p>{(query || filter !== "all") && <button className="au-secondary-button" type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear page filters</button>}</div>}
        <footer className="au-log-footer"><span role="status">Showing {visible.length} of {activity.length} demo events</span><span>Preview data · No live system logs</span></footer>
      </section>
    </div>
  );
}
