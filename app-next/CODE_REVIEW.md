# Code review: dead ends and errors

Summary of findings and fixes applied.

---

## Fixes applied

### 1. API routes – wrong status and unsafe JSON

- **Sheets list/one (GET)**  
  - `sheetToJson()` used `JSON.parse(row.days)` with no try/catch; corrupted DB data could throw and was then reported as 401.  
  - **Change:** Added `parseDays()` that returns `[]` on parse failure. GET handlers now return **500** for unexpected errors instead of 401.

- **Sheets [id] PATCH/DELETE**  
  - Any error (DB, etc.) was returned as 404 "Not found or unauthorized".  
  - **Change:** Catch-all now returns **500** "Server error".

### 2. Unhandled promise rejections

- **`sheet-detail.tsx`**  
  - `getCurrentPosition(BEST_EFFORT_OPTIONS).then(...)` (two places) had no `.catch()`. Denied or failed geolocation could cause unhandled rejections.  
  - **Change:** Added `.catch(() => {})` so failures are ignored without crashing.

- **`useOfflineSync.ts`**  
  - `doSync()` and `getPendingCount().then(setPendingCount)` were not guarded; rejections could be unhandled.  
  - **Change:** `doSync().catch(() => {})` and `getPendingCount().then(...).catch(() => setPendingCount(0))`.

---

## Dead / unused code

| Location | What | Suggestion |
|----------|------|------------|
| **`src/lib/rate-limit.ts`** | `checkLoginRateLimit`, `checkSensitiveApiRateLimit` are never imported. | Either wire them (e.g. login API route, POST /api/sheets, /api/users) or remove the file. |
| **`src/lib/hours.ts`** | `getHoursForDisplay()` is never used. | Remove or use in UI (e.g. stat cards); logic duplicates `compliance.ts` `getHours()`. |

---

## Other notes (no change made)

- **`api.ts`** – `res.json().catch(() => ({ error: res.statusText }))` is appropriate for non-JSON error bodies.
- **`rego-kms/route.ts`** – Whole handler in try/catch; `JSON.parse` errors return 500. Good.
- **`export/route.ts`** – `JSON.parse(row.days)` wrapped in try/catch with `days = []` fallback. Good.
- **Middleware** – Auth and protected routes are clear; no dead branches found.
- **Compliance / LogBar** – Multiple `return null` paths are intentional (no current work/break, etc.).

---

## Optional improvements

1. **Rate limiting**  
   Use `checkLoginRateLimit` in the NextAuth credentials `authorize` path (e.g. in `auth.ts` or the route that handles sign-in) and `checkSensitiveApiRateLimit` in POST `/api/sheets`, POST `/api/users`, etc., to reduce abuse.

2. **Consolidate hours helpers**  
   `getHoursForDisplay` (hours.ts) and `getHours` (compliance.ts) are the same. Use one (e.g. from compliance) everywhere or delete `hours.ts`.
