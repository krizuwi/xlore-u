import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { IDLE_NOTICE_MS, canRefreshPage, createEngagementMonitor, createRefreshTask } from "../lib/engagement.js";
import { useUnsavedChanges } from "./UnsavedChangesContext.jsx";

const EngagementContext = createContext(null);

function IdleNotice({ onResume }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={dialogRef} className="engagement-notice" aria-labelledby="engagement-title" aria-describedby="engagement-description" onCancel={event => { event.preventDefault(); onResume(); }}>
    <span className="engagement-notice-icon"><Clock3 size={28} /></span>
    <h2 id="engagement-title">Are you still there?</h2>
    <p id="engagement-description">You haven’t interacted with Xlore U for 20 minutes. Your work is still here. Live updates are paused until you return.</p>
    <button autoFocus type="button" className="primary-btn" onClick={onResume}>Yes, I’m still here</button>
  </dialog>;
}

export function EngagementProvider({ children }) {
  const { hasUnsavedChanges } = useUnsavedChanges();
  const [idle, setIdle] = useState(false);
  const listeners = useRef(new Set());
  const monitor = useRef(null);
  const subscribe = useCallback(listener => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);
  useEffect(() => {
    function refresh() {
      if (hasUnsavedChanges()) return;
      if (!canRefreshPage({
        visible: document.visibilityState === "visible", pathname: window.location.pathname,
        editing: Boolean(document.activeElement?.matches("input, textarea, select, [contenteditable='true']")),
        dialogOpen: Boolean(document.querySelector("dialog[open], [role='dialog'], [role='alertdialog']")),
        submitting: Boolean(document.querySelector("form fieldset:disabled, [aria-busy='true']"))
      })) return;
      listeners.current.forEach(listener => listener());
    }
    // Shortened timeouts are only allowed for local development UI checks.
    const testTimeout = import.meta.env.DEV ? Number(import.meta.env.VITE_IDLE_NOTICE_TEST_MS) : NaN;
    const idleMs = Number.isFinite(testTimeout) && testTimeout >= 1000 && testTimeout < IDLE_NOTICE_MS ? testTimeout : IDLE_NOTICE_MS;
    const instance = createEngagementMonitor({ idleMs, onIdle: () => setIdle(true), onResume: () => setIdle(false), onRefresh: refresh });
    monitor.current = instance;
    const activity = () => instance.activity();
    const visibility = () => { if (document.visibilityState === "visible") instance.check(); };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"];
    events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    document.addEventListener("visibilitychange", visibility);
    instance.start();
    return () => {
      instance.stop();
      events.forEach(event => window.removeEventListener(event, activity));
      document.removeEventListener("visibilitychange", visibility);
      monitor.current = null;
    };
  }, [hasUnsavedChanges]);
  return <EngagementContext.Provider value={subscribe}>{children}{idle && <IdleNotice onResume={() => monitor.current?.resume()} />}</EngagementContext.Provider>;
}

// Silent refresh, retaining local filters and drafts; cancel on route/filter changes.
export function useLiveRefresh(callback, { enabled = true, key = "" } = {}) {
  const subscribe = useContext(EngagementContext);
  const latest = useRef(callback);
  useEffect(() => { latest.current = callback; }, [callback]);
  useEffect(() => {
    if (!subscribe || !enabled) return;
    const task = createRefreshTask(() => latest.current);
    const unsubscribe = subscribe(() => { void task.run(); });
    return () => { unsubscribe(); task.stop(); };
  }, [subscribe, enabled, key]);
}
