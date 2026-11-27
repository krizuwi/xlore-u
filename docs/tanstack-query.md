# TanStack Query integration

TanStack Query (the React package `@tanstack/react-query`) manages server data that the interface reads from the API. It caches matching requests, avoids unnecessary repeat loads, exposes loading and error state, and lets the interface refresh cached data after a change.

## Where it is connected

- `src/lib/queryClient.js` creates the shared cache. Queries stay fresh for 30 seconds, retry once after a failed request, and do not automatically reload just because the browser window received focus.
- `src/main.jsx` places `QueryClientProvider` around the app so screens can use that cache.
- `src/admin/lib/adminApi.js` uses `useQuery` for the shared administrator resource hook. The request uses the existing `api()` helper and passes TanStack Query's abort signal through to `fetch`.
- Successful `adminWrite()` requests invalidate the `['admin']` cache prefix. Admin lists and details then reload with the changed server data.
- The existing idle/live refresh still works: when an administrator returns, the active resource is refetched, except for Settings as before.
- `src/lib/queryClient.js` builds private account keys from the account role and user ID. Student dashboard, saved items, enrollment, and assessment/profile updates use this account scope. Institution application status, institution settings, and owner data on the institution's school page use the same pattern.
- `src/context/AuthContext.jsx` clears the in-memory query cache when an account signs in, signs out, or can no longer be authenticated. This prevents data from the previous session being reused in a new one.
- Student and institution changes invalidate or update that user's cached records. For example, changing an institution name refreshes its account/workspace queries, and submitting an enrollment report updates the student's cached enrollment entry.

## Data flow

```text
Admin screen
    -> useAdminResource(path)
    -> useQuery(['admin', path])
    -> existing api() helper
    -> backend API

Successful adminWrite()
    -> invalidate ['admin'] cache
    -> active admin data refreshes

Private user data
    -> key includes role + user ID + resource
    -> logout/account switch clears the cache
    -> successful changes refresh that account's data
```

## Adding an administrator resource

Use the existing hook from the component:

```jsx
const resource = useAdminResource('/programs');

if (resource.loading) return <LoadingState />;
if (resource.error) return <ErrorMessage message={resource.error} />;

return <ProgramList programs={resource.data ?? []} onRefresh={resource.refresh} />;
```

The path is part of the query key, so different endpoints (including paths with filters) have separate cached results. Continue using `adminWrite(path, method, body)` for admin changes; it clears the admin cache after the server accepts the change.

## Scope and security

TanStack Query is a client-side cache, not a database or security boundary. Authentication, authorization, and data access remain enforced by the existing API and backend. No access tokens or private configuration are stored in query keys. Some public catalog and feature-specific requests still use their existing fetch/state patterns; the account-specific areas listed above are now managed by TanStack Query.

## Official references

- [TanStack Query for React](https://tanstack.com/query/latest/docs/framework/react/overview)
- [QueryClientProvider](https://tanstack.com/query/latest/docs/framework/react/reference/QueryClientProvider)
- [Queries and query keys](https://tanstack.com/query/latest/docs/framework/react/guides/queries)
