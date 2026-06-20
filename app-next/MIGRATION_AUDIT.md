# Migration audit: Base44 → Next.js rebuild

This document lists **dead ends and issues** found after the app was rebuilt from another platform (Base44) for Next.js + Prisma + Vercel hosting.

---

## 1. Missing `.env.example` (dead end for new devs)

**Issue:** README and MIGRATION.md say `cp .env.example .env.local`, but `.env.example` did not exist. New developers would get "No such file or directory".

**Fix:** Added `app-next/.env.example` with required and optional variables. Use:
```bash
cp .env.example .env.local
```
then edit `.env.local` with real values.

---

## 2. Placeholder repository URL

**Issue:** `package.json` has:
```json
"repository": { "url": "https://github.com/YOUR_USERNAME/YOUR_REPO.git" }
```
This is a placeholder. Not breaking, but should be updated when the repo is known.

**Fix:** Replace `YOUR_USERNAME` and `YOUR_REPO` with your actual GitHub org/repo, or remove the `repository` field if not applicable.

---

## 3. Doc vs code: NextAuth version

**Issue:** MIGRATION.md says "**Auth.js** (NextAuth.js **v5**)". The project uses `next-auth@^4.24.10` (v4).

**Fix:** MIGRATION.md was updated to "NextAuth.js (v4; Credentials provider)" so it matches the codebase.

---

## 4. Base44 references (comments only – OK)

**Status:** No Base44 SDK or runtime code remains. The only references are:

- Comments in `src/lib/api.ts` and `prisma/schema.prisma` ("replaces Base44", "no Base44").
- MIGRATION.md and README describing the migration.

These are fine to keep for context.

---

## 5. Server-side API base URL

**Status:** `src/lib/api.ts` uses:
- In browser: `base = ""` (relative URLs, same origin + cookies).
- On server: `base = process.env.NEXTAUTH_URL ?? ""`.

The API client is only used from **client components** (e.g. useQuery, useMutation) and from `offline-api.ts` in the browser. No server components or API routes call `api.*` with server-side `fetch`. So a blank `NEXTAUTH_URL` on the server does not currently cause broken requests. If you later use the API client from server code, set `NEXTAUTH_URL` so absolute URLs work (e.g. `https://your-domain.com`).

---

## Summary

| Item                         | Severity   | Action taken / recommendation        |
|-----------------------------|------------|--------------------------------------|
| Missing `.env.example`      | High       | Added `app-next/.env.example`        |
| Placeholder repo URL        | Low        | Update when repo is known            |
| NextAuth v5 vs v4 in docs   | Low        | Align MIGRATION.md with v4          |
| Base44 references           | None       | Comments only, OK                    |
| Server NEXTAUTH_URL         | Info       | Fine for current use; set if needed  |
