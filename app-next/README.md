# Driver Fatigue Log (Next.js – no Base44)

This is the same app converted to **Next.js + TypeScript + Prisma + NextAuth**, with no Base44 dependency.

## Quick start

1. **Install and set up env**
   ```bash
   cd app-next
   npm install
   cp .env.example .env.local
   ```
   Edit `.env.local`:
   - **NEXTAUTH_SECRET** (required): e.g. `openssl rand -base64 32`. Required in production; without it, auth may be insecure.
   - **NEXTAUTH_CREDENTIALS_PASSWORD** (required for sign-in): set a shared test password; sign in with any email + this password.

2. **Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Optional: seed sample data for user testing**
   ```bash
   npm run db:seed
   ```
   Creates sample drivers, regos, test users (manager@test.local, driver@test.local), and one draft fatigue sheet. Sign in with those emails and your `NEXTAUTH_CREDENTIALS_PASSWORD`.

4. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Sign in with any email and the password you set in `NEXTAUTH_CREDENTIALS_PASSWORD` (or, in dev only, leave both fields blank to sign in as dev@localhost).

## Stack

- **Next.js** (App Router), **TypeScript**, **Tailwind**
- **Prisma** + **SQLite** (dev) or **PostgreSQL** (prod via `DATABASE_URL`)
- **NextAuth.js** (Credentials provider; add Google etc. in `src/lib/auth.ts`)
- **TanStack Query** for client data

## Fatigue Sheet UI

The sheet **list** and **drivers** pages are fully wired. The single-sheet **editor** (time grid, compliance panel, signature) lives in `src/components/fatigue/`. Use `api.sheets.get(id)`, `api.sheets.update(id, data)`, and `api.sheets.exportPdfUrl(id)` from `@/lib/api.ts`.

See **MIGRATION.md** in the repo root for the full conversion guide.

## Australia-wide architecture & approvals

- **ADR:** `docs/adr/0001-multi-jurisdiction-fatigue-architecture.md`  
- **Step-by-step roadmap & approval gates:** `docs/roadmap/approval-gates.md` (major changes need explicit **Approve: S#** before implementation)  
- **Product positioning:** `docs/product/positioning.md`  
- **Transition checklist:** `docs/architecture/australia-wide-transition.md`  
- **NHVR provisional pack (optional):** `docs/architecture/nhvr-provisional-pack.md` — set `NEXT_PUBLIC_NHVR_PROVISIONAL_RULES_ENABLED=true` and/or `NHVR_PROVISIONAL_RULES_ENABLED=true` to expose the second **Fatigue rules** option and accept `NHVR_PROVISIONAL` on the API (not a certified EWD).

## User testing

See **USER_TESTING.md** for a short tester brief: how to sign in, get manager access, and what to try. Run `npm run db:seed` first so testers see sample drivers, regos, and a sheet.

## Firebase (optional)

Firebase is set up for **Hosting** (deploy Next.js to Firebase) and optional **Auth** / **Firestore** from the client.

**Add your Firebase config to the app (one-time):**

1. Open [Firebase Console](https://console.firebase.google.com) and sign in.
2. Click your project (or create one, then click it).
3. Click the **gear icon** next to “Project overview” → **Project settings**.
4. Scroll to **“Your apps”**. If there’s no web app yet, click **“Add app”** → choose the **Web** icon (</>).
5. You’ll see a `firebaseConfig` block with things like `apiKey: "AIza..."`. Copy each value into `.env.local` in `app-next` as follows (create `.env.local` from `.env.example` if you don’t have it):

   | In Firebase it’s called | In .env.local write |
   |-------------------------|----------------------|
   | `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY=` (paste the value after the `=`) |
   | `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=` |
   | `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID=` |
   | `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=` |
   | `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=` |
   | `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID=` |

   One line per variable, no quotes in the Console value. Example: `NEXT_PUBLIC_FIREBASE_PROJECT_ID=my-app-12345`.

6. **Use in the app** – in client components:
   ```ts
   import { getFirebaseAuth } from "@/lib/firebase";
   const auth = getFirebaseAuth(); // null if env not set
   ```

**Deploy to Firebase Hosting:**

   **Step 1 – Login (once)**  
   From the `app-next` folder run:
   ```cmd
   scripts\firebase-login.cmd
   ```
   This installs dependencies and opens your browser to sign in with Google. Close the browser when done.

   **Step 2 – List your projects and get the exact Project ID**  
   Run:
   ```cmd
   scripts\firebase-list-projects.cmd
   ```
   A table will show the projects your login can access. Copy the **Project ID** from that table (exact spelling).

   **Step 3 – Deploy**  
   Run (paste the Project ID you copied):
   ```cmd
   scripts\firebase-deploy.cmd YOUR_PROJECT_ID
   ```

   If you get "Invalid project selection", the ID may be wrong or you're logged in with a different Google account. Run Step 2 again and use an ID from that list. To deploy again later, run only Step 3.

**Troubleshooting**
- **"No projects found"** – Create the project in the [classic Firebase Console](https://console.firebase.google.com) (not Studio). Use the same Google account for `firebase login` and the Console.
- **webframeworks error** – The deploy script runs `firebase experiments:enable webframeworks` automatically; if you deploy with `firebase deploy` alone, run that command once from the `app-next` folder first.
- **SSR / Cloud Functions** – If your app uses server-side rendering or API routes, enable billing on the Firebase project (Blaze plan) so Cloud Functions can be created.
