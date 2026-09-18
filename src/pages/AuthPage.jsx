import { ArrowRight, Eye, EyeOff, KeyRound, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ErrorMessage, SuccessMessage } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const [step, setStep] = useState(isRegister ? "register" : "login");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", code: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setStep(isRegister ? "register" : "login");
    setError("");
    setSuccess("");
  }, [isRegister]);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(""); setSuccess("");
    try {
      if (step === "register") {
        const data = await api("/auth/register", { method: "POST", body: JSON.stringify(form) });
        setForm((current) => ({ ...current, code: data.verificationCode ?? "" }));
        setStep("verify");
        setSuccess(data.verificationCode ? "Account created. Your development verification code was filled in below." : "Account created. Check your email for the verification code.");
      } else if (step === "verify") {
        await api("/auth/verify-email", { method: "POST", body: JSON.stringify({ email: form.email, code: form.code }) });
        setStep("login");
        setSuccess("Email verified. Sign in to continue.");
      } else {
        await login(form.email, form.password);
        navigate(location.state?.from ?? "/dashboard", { replace: true });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true); setError("");
    try {
      const data = await api("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email: form.email }) });
      setForm((current) => ({ ...current, code: data.verificationCode ?? current.code }));
      setSuccess("A new verification code was generated.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const title = step === "register" ? "Create your account" : step === "verify" ? "Verify your email" : "Welcome back";
  const description = step === "register" ? "Save schools, compare options, and keep your recommendations." : step === "verify" ? `Enter the six-digit code for ${form.email}.` : "Sign in to continue your college exploration.";

  return (
    <section className="auth-page page-shell">
      <div className="auth-layout container">
        <div className="auth-aside">
          <span className="eyebrow"><span className="eyebrow-dot" /> Your college planning workspace</span>
          <h1>Explore with clarity.<br /><span>Decide with confidence.</span></h1>
          <p>Your account keeps recommendations, saved schools, comparisons, and assessment history together.</p>
          <div className="auth-benefits">
            {["Personalized program matches", "Saved schools and comparisons", "Assessment history you can revisit"].map((item) => <div key={item}><span>✓</span>{item}</div>)}
          </div>
        </div>
        <div className="auth-card">
          <span className="section-kicker">{step === "register" ? "Get started" : step === "verify" ? "One more step" : "Student access"}</span>
          <h2>{title}</h2><p className="auth-description">{description}</p>
          <ErrorMessage message={error} /><SuccessMessage message={success} />
          <form onSubmit={submit} className="auth-form">
            {step === "register" && <label><span>Full name</span><div className="input-with-icon"><UserRound size={18} /><input name="fullName" value={form.fullName} onChange={update} required minLength={2} autoComplete="name" placeholder="Your full name" /></div></label>}
            {(step === "register" || step === "login") && <label><span>Email address</span><div className="input-with-icon"><Mail size={18} /><input name="email" value={form.email} onChange={update} required type="email" autoComplete="email" placeholder="student@example.com" /></div></label>}
            {(step === "register" || step === "login") && <label><span>Password</span><div className="input-with-icon"><KeyRound size={18} /><input name="password" value={form.password} onChange={update} required minLength={8} type={showPassword ? "text" : "password"} autoComplete={step === "register" ? "new-password" : "current-password"} placeholder="At least 8 characters" /><button type="button" className="input-icon-btn" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}
            {step === "verify" && <label><span>Verification code</span><div className="input-with-icon code-input"><KeyRound size={18} /><input name="code" value={form.code} onChange={update} required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" /></div></label>}
            <button className="primary-btn auth-submit" disabled={busy}>{busy ? "Please wait..." : step === "register" ? "Create account" : step === "verify" ? "Verify email" : "Sign in"}<ArrowRight size={18} /></button>
          </form>
          {step === "verify" && <button className="text-btn auth-alt" onClick={resend} disabled={busy}>Generate a new code</button>}
          {step !== "verify" && <p className="auth-switch">{step === "login" ? "New to Xlore U?" : "Already have an account?"} <Link to={step === "login" ? "/register" : "/login"}>{step === "login" ? "Create one" : "Sign in"}</Link></p>}
        </div>
      </div>
    </section>
  );
}
