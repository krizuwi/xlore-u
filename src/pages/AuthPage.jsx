import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, Mail, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ErrorMessage, SuccessMessage } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

function GoogleSignInButton({ action, busy, onCredential, onError }) {
  const containerRef = useRef(null);
  const credentialHandlerRef = useRef(onCredential);

  useEffect(() => {
    credentialHandlerRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!googleClientId) return undefined;
    let active = true;

    const render = () => {
      if (!active || !containerRef.current || !window.google?.accounts?.id) return;
      containerRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => credentialHandlerRef.current(response.credential),
        cancel_on_tap_outside: true
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline",
        size: "large",
        text: action,
        shape: "pill",
        logo_alignment: "left",
        width: Math.min(containerRef.current.clientWidth || 360, 360)
      });
    };

    let script = document.querySelector('script[data-xlore-google-signin="true"]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.dataset.xloreGoogleSignin = "true";
      document.head.append(script);
    }
    script.addEventListener("load", render);
    if (window.google?.accounts?.id) render();

    const themeObserver = new MutationObserver(render);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      active = false;
      script.removeEventListener("load", render);
      themeObserver.disconnect();
    };
  }, [action]);

  if (!googleClientId) {
    return (
      <button type="button" className="google-placeholder-btn" disabled={busy} onClick={onError}>
        <span aria-hidden="true">G</span>
        {action === "signup_with" ? "Sign up with Google" : "Sign in with Google"}
      </button>
    );
  }

  return <div className={`google-button-host${busy ? " is-busy" : ""}`} ref={containerRef} />;
}

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  code: "",
  newPassword: "",
  confirmPassword: ""
};

export function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const [step, setStep] = useState(isRegister ? "register" : "login");
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setStep(isRegister ? "register" : "login");
    setError("");
    setSuccess("");
  }, [isRegister]);

  useEffect(() => {
    if (user) navigate(location.state?.from ?? "/dashboard", { replace: true });
  }, [user, navigate, location.state]);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const moveTo = (nextStep) => {
    setStep(nextStep);
    setError("");
    setSuccess("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (step === "register") {
        const data = await api("/auth/register", {
          method: "POST",
          body: JSON.stringify({ fullName: form.fullName, email: form.email, password: form.password })
        });
        setForm((current) => ({ ...current, code: "" }));
        setStep("verify");
        setSuccess(data.message ?? "Account created. Check your email for the verification code.");
      } else if (step === "verify") {
        await api("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ email: form.email, code: form.code })
        });
        setStep("login");
        setSuccess("Email verified. Sign in to continue.");
      } else if (step === "forgot") {
        const data = await api("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: form.email })
        });
        setForm((current) => ({ ...current, code: "" }));
        setStep("reset");
        setSuccess(data.message ?? "Check your email for a password reset code.");
      } else if (step === "reset") {
        if (form.newPassword !== form.confirmPassword) throw new Error("The new passwords do not match.");
        await api("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ email: form.email, code: form.code, newPassword: form.newPassword })
        });
        setForm((current) => ({ ...current, password: "", code: "", newPassword: "", confirmPassword: "" }));
        setStep("login");
        setSuccess("Password updated. Sign in with your new password.");
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

  const signInWithGoogle = async (credential) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await loginWithGoogle(credential);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: form.email })
      });
      setForm((current) => ({ ...current, code: "" }));
      setSuccess(data.message ?? "A new verification code was sent to your email.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const content = {
    register: ["Get started", "Create your account", "Save schools, compare options, and keep your recommendations."],
    login: ["Student access", "Welcome back", location.state?.message ?? "Sign in to continue your college exploration."],
    verify: ["One more step", "Verify your email", "Enter your email and the six-digit verification code."],
    forgot: ["Account recovery", "Forgot your password?", "Enter your email and we will generate a six-digit reset code."],
    reset: ["Account recovery", "Create a new password", "Enter the reset code and choose a new password."]
  }[step];
  const showGoogle = step === "login" || step === "register";
  const showCurrentPassword = step === "login" || step === "register";
  const showCode = step === "verify" || step === "reset";

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
          <span className="section-kicker">{content[0]}</span>
          <h2>{content[1]}</h2>
          <p className="auth-description">{content[2]}</p>
          <ErrorMessage message={error} />
          <SuccessMessage message={success} />

          {showGoogle && (
            <>
              <GoogleSignInButton
                action={step === "register" ? "signup_with" : "signin_with"}
                busy={busy}
                onCredential={signInWithGoogle}
                onError={() => setError("Google sign-in needs a client ID. Add VITE_GOOGLE_CLIENT_ID to the frontend .env file.")}
              />
              <div className="auth-divider"><span>or continue with email</span></div>
            </>
          )}

          <form onSubmit={submit} className="auth-form">
            {step === "register" && (
              <label><span>Full name</span><div className="input-with-icon"><UserRound size={18} /><input name="fullName" value={form.fullName} onChange={update} required minLength={2} autoComplete="name" placeholder="Your full name" /></div></label>
            )}
            <label><span>Email address</span><div className="input-with-icon"><Mail size={18} /><input name="email" value={form.email} onChange={update} required type="email" autoComplete="email" placeholder="student@example.com" /></div></label>
            {showCurrentPassword && (
              <label><span>Password</span><div className="input-with-icon"><KeyRound size={18} /><input name="password" value={form.password} onChange={update} required minLength={8} type={showPassword ? "text" : "password"} autoComplete={step === "register" ? "new-password" : "current-password"} placeholder="At least 8 characters" /><button type="button" className="input-icon-btn" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            )}
            {step === "login" && (
              <div className="auth-help-row">
                <button type="button" onClick={() => moveTo("verify")}>Enter verification code</button>
                <button type="button" onClick={() => moveTo("forgot")}>Forgot password?</button>
              </div>
            )}
            {showCode && (
              <label><span>{step === "verify" ? "Verification code" : "Reset code"}</span><div className="input-with-icon code-input"><KeyRound size={18} /><input name="code" value={form.code} onChange={update} required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="000000" /></div></label>
            )}
            {step === "reset" && (
              <>
                <label><span>New password</span><div className="input-with-icon"><KeyRound size={18} /><input name="newPassword" value={form.newPassword} onChange={update} required minLength={8} type={showNewPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" /><button type="button" className="input-icon-btn" onClick={() => setShowNewPassword((value) => !value)} aria-label="Toggle new password visibility">{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
                <label><span>Confirm new password</span><div className="input-with-icon"><KeyRound size={18} /><input name="confirmPassword" value={form.confirmPassword} onChange={update} required minLength={8} type={showNewPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your new password" /></div></label>
              </>
            )}
            <button className="primary-btn auth-submit" disabled={busy}>
              {busy ? "Please wait..." : step === "register" ? "Create account" : step === "verify" ? "Verify email" : step === "forgot" ? "Send reset code" : step === "reset" ? "Reset password" : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>

          {step === "verify" && <button className="text-btn auth-alt" type="button" onClick={resend} disabled={busy}>Generate a new code</button>}
          {["verify", "forgot", "reset"].includes(step) && <button className="text-btn auth-back" type="button" onClick={() => moveTo("login")}><ArrowLeft size={15} /> Back to sign in</button>}
          {showGoogle && <p className="auth-switch">{step === "login" ? "New to Xlore U?" : "Already have an account?"} <Link to={step === "login" ? "/register" : "/login"} state={location.state}>{step === "login" ? "Create one" : "Sign in"}</Link></p>}
        </div>
      </div>
    </section>
  );
}
