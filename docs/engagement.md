# Engagement and live data

All student and admin routes share an inactivity timer. Mouse/touch interactions,
typing, scrolling and clicks count as activity. After 20 minutes without activity,
an accessible, themed “Are you still there?” dialog appears. Confirming the dialog
restarts the timer. It does not log out the user or discard their work.

Read-only page data refreshes every 15 seconds, without a browser reload. This
refreshes catalog/account data, not a newly deployed application bundle. Existing
filters, program comparison selections and drafts remain intact.

Refresh pauses when the tab is hidden, the inactivity dialog is open, a form input
is focused, an edit dialog is open, or a page is busy. Profile, registration,
login, assessment and admin settings drafts do not auto-refresh. Background
failures retain the last loaded data and retry on the next tick. Requests do not
overlap and are cancelled when the route or filter changes.

Run `npm test` for fake-clock checks of the exact 20-minute/15-second boundaries,
activity resets, background-tab handling, refresh guards and request cleanup.
For a local visual check, set `VITE_IDLE_NOTICE_TEST_MS=5000` in the terminal
running Vite. This override is ignored in production; never add it to `.env`.
