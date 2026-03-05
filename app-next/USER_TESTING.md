# User testing guide

Use this as a short brief for testers before they try the app.

---

## 1. Where to go

- **Local:** After you run the app, open **http://localhost:3000**
- **Staging / hosted:** Use the URL your team provides (e.g. `https://your-app.vercel.app` or your Firebase URL).

---

## 2. How to sign in

- **Development (e.g. `npm run dev`):**
  - You can sign in with **empty email and password** (leave both blank and click Sign in), **or**
  - Use **any email** (e.g. `tester@example.com`) and the **shared test password** from your facilitator (set in `NEXTAUTH_CREDENTIALS_PASSWORD`).
- **Production / staging:**
  - Use **any email** (e.g. your name or `tester@example.com`) and the **shared test password** your facilitator gives you.  
  - The first time you use an email, an account is created for you.

There are no per-user passwords yet; everyone uses the same test password for this round.

---

## 3. First-time setup (managers)

If you’re testing **manager** features (dashboard, compliance, regos, drivers, event map):

1. Sign in with the shared test password.
2. Go to **Manager dashboard** (link from the login page or `/manager`).
3. If you see “Add managers”, use it to **add yourself (or a test user) as a manager**.  
   Until someone is a manager, manager-only areas may be restricted.

Drivers can use the app without being a manager; they only need to sign in and create/open their sheets.

---

## 4. What to try (goals)

- **Drivers:** Create a fatigue sheet, log work and breaks on the time grid, then **mark the sheet complete** and export a PDF.
- **Managers:** Open the **Manager dashboard**, select a sheet, check **compliance** and **event map**, and (if allowed) add **drivers** and **regos** so drivers can select them on sheets.

One-sentence goal: **Log a week of work/breaks and check that compliance and export work as you expect.**

---

## 5. Sample data (optional)

Your facilitator can preload sample data so you can click around straight away. They run from the app folder:

```bash
npm run db:seed
```

This creates sample drivers, regos, test users (e.g. manager@test.local, driver@test.local), and one draft fatigue sheet. Sign in with one of those emails and the shared test password.

## 6. Empty app?

If there are no sheets or no drivers/regos:

- **Drivers:** Create a new sheet from **Your sheets** → **Start New Week** (or “Create your first sheet”).
- **Managers:** Add **drivers** and **rego**s from the Manager dashboard (or **Manage regos** / **Drivers**). Compliance and map will show data once sheets exist and have events.

---

## 7. Who to contact

For broken flows, wrong behaviour, or access issues, contact **[your team contact / project lead]**.
