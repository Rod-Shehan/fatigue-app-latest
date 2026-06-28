# Why the app might not open

## 1. "npm" or "next" is not recognized

**Cause:** Node.js is not installed, or it's not in your PATH when you run the batch file.

**Fix:**
- Install Node.js from https://nodejs.org (choose **LTS**).
- During setup, leave **"Add to PATH"** checked.
- **Restart your PC** (or at least close and reopen Cursor/File Explorer).
- Double-click **Start App (Next).bat** again.

---

## 2. Browser opens but says "This site can't be reached" or "Connection refused"

**Cause:** The Next.js server is not running yet, or it failed to start.

**Fix:**
- When you run **Start App (Next).bat**, a **second window** opens titled **"Next.js - Fatigue App"**. **Leave that window open.**
- In that window, wait until you see something like: **"Ready in 3s"** or **"compiled"**.
- If you see **red error text** in that window, read it (e.g. "Port 3000 is in use", "Module not found").
- Then in your browser go to **http://localhost:3000** or press **F5** to refresh.

---

## 3. Prisma errors (e.g. "datasource url" or "schema validation")

**Cause:** A different (newer) version of Prisma is being used than the one in the project.

**Fix:**
- Open a command prompt in the **app-next** folder:
  - `cd "c:\Users\r_she\Documents\Fatigue app\app-next"`
- Run: `npm install` then `npx prisma generate` then `npx prisma db push`
- If it still fails, run: `npm install prisma@6.9.0 --save-dev` then try again.

---

## 4. Login page appears but sign-in fails / "Invalid email or password"

**Cause:** Wrong password, driver not on Approved Drivers, account disabled, or production env misconfigured.

**Fix (production — https://www.circadia24.com):**
- Each user needs a **per-user password** (minimum 6 characters).
- **Drivers:** manager/owner sets password on **Approved Drivers**, or driver changes it under **Settings → Change password**.
- **Managers:** owner sets/resets on **Add managers**.
- Confirm `NEXTAUTH_SECRET` and `NEXTAUTH_URL=https://www.circadia24.com` on Vercel Production.
- Do **not** rely on `NEXTAUTH_CREDENTIALS_PASSWORD` on Production (removed for pilot). See **docs/AUTH_AND_ROLES.md**.

**Fix (local — `npm run dev`):**
- Open **http://localhost:3000** (not the production URL).
- After `npm run db:seed`: `driver@test.local` or `manager@test.local` + `NEXTAUTH_CREDENTIALS_PASSWORD` from `.env.local`.
- Or blank email + blank password in dev when no per-user hash exists.
- Set in **`.env.local`**: `NEXTAUTH_SECRET`, optional `NEXTAUTH_CREDENTIALS_PASSWORD`.

**Fix (Vercel Preview only — not Production):**
- Preview may use `NEXTAUTH_ALLOW_DEV_LOGIN` and `NEXTAUTH_DEV_BYPASS_SECRET` — **blocked automatically when `NODE_ENV=production`**.
- Never set dev bypass vars on **Production**. See **docs/AUTH_AND_ROLES.md**.

---

## 5. Port 3000 already in use

**Cause:** Another program (or an old Next.js run) is using port 3000.

**Fix:**
- Close any other **"Next.js"** or **"Node"** command windows.
- Or use a different port: in **app-next** run:  
  `set PORT=3001 && npm run dev`  
  Then open **http://localhost:3001** in your browser.
