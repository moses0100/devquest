# Demo storage verification — 2026-10-18

- 13 unit tests, TypeScript, ESLint and production build passed.
- Chrome verification used two pages in one fresh browser context on a dedicated demo server. It covered removal of `devquest.v1`, a structurally invalid snapshot, `localStorage.clear()`, and recovery after a valid snapshot was restored. Writes/export were disabled and a reload instruction appeared after invalidation; valid updates cleared the error and re-enabled controls.
- A form was opened before storage was removed in the same tab (no cross-tab notification). Submitting the form reported the missing data and left storage absent, instead of resurrecting the old snapshot.
- Reloading with an empty-string snapshot preserved it and displayed an error. No browser page errors occurred. User browser data and the PostgreSQL database were not used.
- Checkpoint: `checkpoint/before-storage-sync-20261018`. No schema migration or data deletion is part of this change.

To repeat manually, open the demo in two tabs, open settings in one and inspect the JSON export button. In the other tab use browser developer tools to remove or invalidate the `devquest.v1` storage item, then restore the original JSON. Verify the first tab disables export with a reload instruction and recovers after valid JSON returns. Use a separate test browser profile, not personal data.
