import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useLiveRefresh } from "../../context/EngagementContext.jsx";
export function adminWrite(path, method, body) {
  return api(`/admin${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
export function useAdminResource(path) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  useLiveRefresh(async signal => {
    const data = await api(`/admin${path}`, { signal });
    if (!signal.aborted) setState({ data, loading: false, error: "" });
  }, { enabled: !state.loading && path !== "/settings", key: path });
  useEffect(() => {
    const controller = new AbortController();
    api(`/admin${path}`, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: "" });
    }).catch(error => {
      if (!controller.signal.aborted) setState(current => ({ ...current, loading: false, error: error.message }));
    });
    return () => controller.abort();
  }, [path, revision]);
  return { ...state, refresh: () => { setState(current => ({ ...current, loading: true, error: "" })); setRevision(value => value + 1); } };
}
