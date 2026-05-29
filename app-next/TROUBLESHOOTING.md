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

## 4. Login page appears but sign-in does nothing / "Invalid email or password"

**Cause:** No password is set for the app, or you are on **production Vercel** without the fleet password / dev bypass.

**Fix (local — easiest while building UI):**
- Run **`npm run dev`** in **app-next** (not the production URL).
- Open **http://localhost:3000** and sign in with **both fields blank** (dev@localhost), or your email + **blank password** if you have no manager-set password in the DB.

**Fix (local .env):**
- In **app-next**, open **`.env.local`**.
- Set **NEXTAUTH_CREDENTIALS_PASSWORD=** to a password you choose.
- Set **NEXTAUTH_SECRET=** to any long random string.
- Restart the dev server. Sign in with any email + that password.

**Fix (Vercel production / preview while still in dev):**
1. In **Vercel → Project → Settings → Environment Variables**, add:
   - `NEXTAUTH_ALLOW_DEV_LOGIN` = `true`
   - `NEXTAUTH_DEV_BYPASS_SECRET` = a long random string (e.g. from `openssl rand -base64 32`)
   - `NEXT_PUBLIC_AUTH_DEV_LOGIN_HINT` = `true` (shows instructions on the login page)
2. **Redeploy** (env changes need a new deployment).
3. Sign in with your email and paste **NEXTAUTH_DEV_BYPASS_SECRET** into the **Password** field.

**Or** set `NEXTAUTH_CREDENTIALS_PASSWORD` on Vercel to a shared fleet password and use that instead.

Remove `NEXTAUTH_ALLOW_DEV_LOGIN`, `NEXTAUTH_DEV_BYPASS_SECRET`, and `NEXT_PUBLIC_AUTH_DEV_LOGIN_HINT` before real users go live.

---

## 5. Port 3000 already in use

**Cause:** Another program (or an old Next.js run) is using port 3000.

**Fix:**
- Close any other **"Next.js"** or **"Node"** command windows.
- Or use a different port: in **app-next** run:  
  `set PORT=3001 && npm run dev`  
  Then open **http://localhost:3001** in your browser.
