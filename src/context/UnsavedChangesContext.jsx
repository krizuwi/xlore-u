import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { leavesPage } from "../lib/unsaved-changes.js";
import "../components/UnsavedChanges.css";

const UnsavedChangesContext = createContext(null);

function DiscardNotice({ onKeep, onDiscard }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="discard-notice" aria-labelledby="discard-title" aria-describedby="discard-description"
    onCancel={event => { event.preventDefault(); onKeep(); }}>
    <span className="discard-notice-icon"><TriangleAlert size={28} /></span>
    <h2 id="discard-title">Are you sure you want to exit and discard your progress?</h2>
    <p id="discard-description">You have unsaved changes. Stay on this page to keep editing, or discard them and leave.</p>
    <div className="discard-notice-actions">
      <button type="button" className="primary-btn" autoFocus onClick={onKeep}>Keep editing</button>
      <button type="button" className="secondary-btn" onClick={onDiscard}>Discard and leave</button>
    </div>
  </dialog>;
}

export function UnsavedChangesProvider({ children }) {
  const entries = useRef(new Set());
  const pendingRef = useRef(null);
  const [pending, setPending] = useState(null);
  const register = useCallback(entry => {
    entries.current.add(entry);
    return () => entries.current.delete(entry);
  }, []);
  const inScope = (entry, scope) => !scope || (entry.root && scope.contains(entry.root));
  const hasUnsavedChanges = useCallback(scope => Array.from(entries.current).some(entry => inScope(entry, scope) && entry.isDirty()), []);
  const markClean = useCallback(scope => {
    entries.current.forEach(entry => { if (inScope(entry, scope)) entry.markClean(); });
  }, []);
  const shouldBlock = useCallback(({ currentLocation, nextLocation }) =>
    leavesPage(currentLocation, nextLocation) && hasUnsavedChanges(), [hasUnsavedChanges]);
  const blocker = useBlocker(shouldBlock);

  // A single native unload listener also protects refresh, external navigation,
  // and tab/window close. Browsers choose the wording for this security prompt.
  useEffect(() => {
    const beforeUnload = event => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsavedChanges]);

  const requestDiscard = useCallback((action, scope) => {
    if (!hasUnsavedChanges(scope)) { action(); return; }
    // Do not replace an already-pending action while a confirmation is open.
    if (pendingRef.current) return;
    const request = { action, scope };
    pendingRef.current = request;
    setPending(request);
  }, [hasUnsavedChanges]);
  function keepEditing() {
    pendingRef.current = null;
    setPending(null);
    if (blocker.state === "blocked") blocker.reset();
  }
  function discard() {
    const request = pendingRef.current;
    markClean(request?.scope);
    pendingRef.current = null;
    setPending(null);
    if (blocker.state === "blocked") blocker.proceed();
    else request?.action();
  }
  const value = useMemo(() => ({ register, hasUnsavedChanges, markClean, requestDiscard }), [register, hasUnsavedChanges, markClean, requestDiscard]);
  return <UnsavedChangesContext.Provider value={value}>
    {children}
    {(pending || blocker.state === "blocked") && <DiscardNotice onKeep={keepEditing} onDiscard={discard} />}
  </UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

// For stateful editors without a form, such as assessment answers.
export function useUnsavedProgress(value) {
  const { register } = useUnsavedChanges();
  const current = useRef(value), baseline = useRef(value);
  current.current = value;
  const markClean = useCallback(() => { baseline.current = current.current; }, []);
  useLayoutEffect(() => register({ isDirty: () => current.current !== baseline.current, markClean }), [register, markClean]);
  return markClean;
}
