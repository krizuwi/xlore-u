import { QueryClient } from "@tanstack/react-query";

// One shared cache keeps admin screens in sync after they load the same data.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

// Private data keys always include both account role and account ID.
export const accountQueryPrefix = (user) => [
  "account",
  user?.role ?? "anonymous",
  user?.id ?? "anonymous"
];

export const accountQueryKey = (user, resource, ...parts) => [
  ...accountQueryPrefix(user),
  resource,
  ...parts
];
