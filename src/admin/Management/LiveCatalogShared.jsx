import { useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { adminWrite } from "../lib/adminApi.js";
import { Dialog } from "./shared.jsx";

export function Notice({ error, children }) {
  return children ? <div className="am-notice" role={error ? "alert" : "status"}>{error ? <CircleAlert size={16} /> : <CircleCheck size={16} />}{children}</div> : null;
}
export function Field({ label, name, item, required, type = "text", maxLength, ...rest }) {
  return <label className="am-field">{label}{required && <span> *</span>}<input name={name} defaultValue={item?.[name] ?? ""} required={required} type={type} maxLength={maxLength} {...rest} /></label>;
}
export function ArchiveDialog({ name, path, onClose, onSaved }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function archive() {
    setBusy(true); setError("");
    try { const result = await adminWrite(path, "DELETE"); onSaved(result.message); onClose(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <Dialog title="Archive this record?" onClose={() => { if (!busy) onClose(); }}><div className="am-dialog-body"><p>Archive <strong>{name}</strong>? It will no longer appear in new student selections. Previous results are preserved, and you can restore it by setting its status to Active.</p><Notice error>{error}</Notice></div><div className="am-dialog-actions"><button className="am-button am-button-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="am-button am-button-danger" disabled={busy} onClick={archive}>{busy ? "Archiving…" : "Archive record"}</button></div></Dialog>;
}
