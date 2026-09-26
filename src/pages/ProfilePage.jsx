import { Eye, EyeOff, KeyRound, Mail, MapPin, Save, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorMessage, SuccessMessage } from "../components/Feedback.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export function ProfilePage() {
  const { user, reloadUser } = useAuth();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    middleName: user?.middleName ?? "",
    lastName: user?.lastName ?? "",
    address: user?.address ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setForm((current) => ({
      ...current,
      firstName: user?.firstName ?? "",
      middleName: user?.middleName ?? "",
      lastName: user?.lastName ?? "",
      address: user?.address ?? ""
    }));
  }, [user?.firstName, user?.middleName, user?.lastName, user?.address]);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (form.newPassword && user.hasPassword && !form.currentPassword) {
      setError("Enter your current password before choosing a new one.");
      return;
    }

    setBusy(true);
    try {
      const body = {
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        address: form.address
      };
      if (form.newPassword) {
        body.newPassword = form.newPassword;
        body.currentPassword = form.currentPassword;
      }
      const data = await api("/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      await reloadUser();
      setForm((current) => ({ ...current, currentPassword: "", newPassword: "", confirmPassword: "" }));
      setSuccess(data.message ?? "Your profile was updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-shell profile-page">
      <div className="container profile-container">
        <header className="profile-heading">
          <span className="section-kicker">Your account</span>
          <h1>Profile settings</h1>
          <p>Keep your personal details current and secure your Xlore U account.</p>
        </header>

        <form className="profile-form" onSubmit={submit}>
          <section className="content-card profile-card">
            <div className="profile-card-heading">
              <span className="profile-card-icon"><UserRound size={21} /></span>
              <div><h2>Personal information</h2><p>Your address is private and only visible in your account.</p></div>
            </div>
            <label><span>First name</span><div className="input-with-icon"><UserRound size={18} /><input name="firstName" value={form.firstName} onChange={update} required maxLength={120} autoComplete="given-name" /></div></label>
            <label><span>Middle name <small>(optional)</small></span><div className="input-with-icon"><UserRound size={18} /><input name="middleName" value={form.middleName} onChange={update} maxLength={120} autoComplete="additional-name" /></div></label>
            <label><span>Last name</span><div className="input-with-icon"><UserRound size={18} /><input name="lastName" value={form.lastName} onChange={update} required maxLength={120} autoComplete="family-name" /></div></label>
            <label><span>Email address</span><div className="input-with-icon profile-readonly"><Mail size={18} /><input value={user.email} readOnly aria-readonly="true" /></div></label>
            <label><span>Home address</span><div className="input-with-icon"><MapPin size={18} /><input name="address" value={form.address} onChange={update} required minLength={5} maxLength={255} autoComplete="street-address" placeholder="Street, barangay, city" /></div></label>
          </section>

          <section className="content-card profile-card">
            <div className="profile-card-heading">
              <span className="profile-card-icon"><ShieldCheck size={21} /></span>
              <div><h2>Change password</h2><p>{user.hasPassword ? "Confirm your current password before creating a new one." : "Your Google account has no Xlore U password yet. You may create one here."}</p></div>
            </div>
            {user.hasPassword && <label><span>Current password</span><div className="input-with-icon"><KeyRound size={18} /><input name="currentPassword" value={form.currentPassword} onChange={update} type={showPasswords ? "text" : "password"} autoComplete="current-password" placeholder="Required only when changing password" /></div></label>}
            <label><span>New password</span><div className="input-with-icon"><KeyRound size={18} /><input name="newPassword" value={form.newPassword} onChange={update} minLength={8} type={showPasswords ? "text" : "password"} autoComplete="new-password" placeholder="Leave blank to keep your password" /><button className="input-icon-btn" type="button" onClick={() => setShowPasswords((value) => !value)} aria-label="Toggle password visibility">{showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <label><span>Confirm new password</span><div className="input-with-icon"><KeyRound size={18} /><input name="confirmPassword" value={form.confirmPassword} onChange={update} minLength={8} type={showPasswords ? "text" : "password"} autoComplete="new-password" placeholder="Repeat the new password" /></div></label>
          </section>

          <div className="profile-feedback"><ErrorMessage message={error} /><SuccessMessage message={success} /></div>
          <button className="primary-btn profile-save" disabled={busy}><Save size={17} /> {busy ? "Saving…" : "Save changes"}</button>
        </form>

      </div>
    </section>
  );
}
