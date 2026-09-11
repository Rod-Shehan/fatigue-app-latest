# PDF drop — Google Drive first (middleware)

**Status:** Owner direction 2026-09-11. Google Drive now, using **circadia24@gmail.com**. Dropbox later per client. OneDrive parked.

## What people see

**Circadia:** My Drive on `circadia24@gmail.com` → `Circadia PDF drop` → client name → week folder → PDFs.

**Client:** Google share email → Shared with me → the same client folder → they copy the files out.

```
Circadia PDF drop
  Acme Haul
    week 23 Aug 2026
      Rob Sherman.pdf
```

No Circadia login for the client. No “produce” button.

## What this is

A **transfer dock**, not an archive and not Circadia’s system of record.

1. Files live in **circadia24@gmail.com** My Drive.
2. That client folder is shared with the filing inbox (`Tenant.recordsInbox`).
3. Circadia writes signed weekly trip-sheet PDFs.
4. The client takes the files and files them however they already file records.
5. Neon still holds the electronic diary.

Invite **named emails only**. Connect **that Gmail only** — the app rejects any other Google account.

## One-time connect (not production until the owner approves env)

1. In Google Cloud, create a project (or reuse one). Enable **Google Drive API**.
2. OAuth consent screen: External, Testing. Add `circadia24@gmail.com` as a test user.
3. Create an OAuth client, type **Desktop** or **Web**. Authorized redirect: `http://127.0.0.1:8765/callback`.
4. From `app-next`, with client id and secret in the environment:

```
npx tsx scripts/google-drive-connect.ts
```

5. Sign in as **circadia24@gmail.com** and allow Drive.
6. Put the printed values in env. Do not commit the refresh token.

| Variable | Role |
|----------|------|
| `PDF_DROP_PROVIDER` | `google` |
| `GOOGLE_DRIVE_USER_EMAIL` | `circadia24@gmail.com` |
| `GOOGLE_DRIVE_CLIENT_ID` | OAuth client |
| `GOOGLE_DRIVE_CLIENT_SECRET` | OAuth secret |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | From the connect script |

Production Vercel env is a **separate owner approval**. Do not set it until asked.

## Staff actions

On the Circadia client page: invite the filing inbox, then drop a signed week.

Dropbox and auto-drop on sign-off are later.
