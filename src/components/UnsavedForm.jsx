import { useLayoutEffect, useRef } from "react";
import { useUnsavedChanges } from "../context/UnsavedChangesContext.jsx";
import { formSnapshot } from "../lib/unsaved-changes.js";

// Successful handlers return true when the form remains mounted. Failed saves
// retain the baseline, so leaving still warns. Modal saves unmount the form.
export function UnsavedForm({ onSubmit, enabled = true, children, ...props }) {
  const ref = useRef(null), baseline = useRef(null), active = useRef(enabled);
  active.current = enabled;
  const { register } = useUnsavedChanges();
  useLayoutEffect(() => {
    const form = ref.current;
    baseline.current = formSnapshot(form);
    return register({
      root: form,
      isDirty: () => active.current && form.isConnected && formSnapshot(form) !== baseline.current,
      markClean: () => { baseline.current = formSnapshot(form); }
    });
  }, [register]);
  async function submit(event) {
    const form = event.currentTarget;
    const saved = await onSubmit?.(event);
    if (saved === true) {
      // Let controlled fields (e.g. cleared password inputs) commit first.
      requestAnimationFrame(() => { if (form.isConnected) baseline.current = formSnapshot(form); });
    }
  }
  return <form {...props} ref={ref} onSubmit={submit}>{children}</form>;
}
