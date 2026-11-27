import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { queryClient } from "../../lib/queryClient.js";
import { useLiveRefresh } from "../../context/EngagementContext.jsx";

export function adminWrite(path, method, body) {
  return api(`/admin${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    .then(result => {
      // Refresh admin lists/details after any successful create, update, or delete.
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      return result;
    });
}

export function useAdminResource(path) {
  const resource = useQuery({
    queryKey: ["admin", path],
    queryFn: ({ signal }) => api(`/admin${path}`, { signal })
  });

  // Keep the existing quiet refresh behavior when an administrator returns.
  useLiveRefresh(() => { void resource.refetch(); }, {
    enabled: !resource.isPending && path !== "/settings",
    key: path
  });

  return {
    data: resource.data ?? null,
    loading: resource.isPending || resource.isFetching,
    error: resource.error?.message ?? "",
    refresh: () => { void resource.refetch(); }
  };
}
