import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="status-state" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

export function SuccessMessage({ message }) {
  if (!message) return null;
  return (
    <div className="alert alert-success" role="status">
      <CheckCircle2 size={18} />
      <span>{message}</span>
    </div>
  );
}
