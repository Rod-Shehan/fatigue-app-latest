# MTS → Circadia Autonomise setup (plain English)

**For:** Rod / Miocevich Transport Services  
**Goal:** When Autonomise detects fatigue on a truck, it sends a message to Circadia automatically.

**Status:** Code is **already deployed** on https://fatigue-app-latest.vercel.app  
You only need to complete the **3 browser steps** below.

---

## What Circadia does now

1. Autonomise sends an **Event** (alarm happened) or **Media** (video clip ready).
2. Circadia checks a **password** (`x-webhook-secret`) so random people cannot fake alerts.
3. Circadia **ignores** seatbelt, smoking, etc. — only fatigue-related alarms are marked **accepted**.
4. Everything is **saved** in the database for the next phase (manager phone alerts + **legal evidence pack** — see [incident-evidence-retention.md](../architecture/incident-evidence-retention.md)).

You do **not** need to understand the code — only paste URLs and one secret in the right places.

---

## Step 1 — Vercel (Circadia hosting) ~5 minutes

1. Open https://vercel.com and sign in.
2. Open project **fatigue-app-latest** (or your Circadia app project).
3. **Settings** → **Environment Variables**.
4. Add:

| Name | Value |
|------|--------|
| `AUTONOMISE_WEBHOOK_SECRET` | A long random password you choose (or use the one Rod was given in chat — **same** in Step 2) |
| `AUTONOMISE_EVENT_PRESET` | `core_plus_adas` |

5. Tick **Production** (and Preview if you want).
6. **Save**.
7. **Deployments** → open latest **main** deployment → **⋯** → **Redeploy** (so the new variables load).

**Check:** open in browser:

`https://fatigue-app-latest.vercel.app/api/integrations/autonomise/events`

You should see `"configured": true` (not `false`).

---

## Step 2 — Database table ~5 minutes

Circadia needs one new table to store incoming webhooks.

**Option A — Neon (if you use Neon for Postgres)**

1. Open your Neon dashboard → **SQL Editor**.
2. Open file `app-next/prisma/sql/autonomise_webhook_ingest.sql` in this repo.
3. Copy all SQL → paste → **Run**.

**Option B — from your PC (if you have `DATABASE_URL`)**

```bash
cd app-next
npm run db:push
```

---

## Step 3 — Autonomise (MTS account) ~10 minutes

1. Log in to https://autonomise.ai
2. **User** (top right) → **Organisation** → **API**
3. **Header Key:** `x-webhook-secret`  
   **Header Value:** **exactly the same** as `AUTONOMISE_WEBHOOK_SECRET` in Vercel
4. Turn **on** and set URLs:

| Webhook | URL |
|---------|-----|
| **Event webhook** | `https://fatigue-app-latest.vercel.app/api/integrations/autonomise/events` |
| **Media webhook** | `https://fatigue-app-latest.vercel.app/api/integrations/autonomise/media` |

5. Click **Update settings**
6. (Recommended) **Device alarm configuration** — only **Raise Event** on fatigue-related alarms (Fatigue, Distraction, Lane Departure, etc.). Not seatbelt/smoking.

---

## Step 4 — Quick test

After Step 1 shows `"configured": true`, ask someone technical to run the curl in [autonomise-webhook-pilot.md](./autonomise-webhook-pilot.md) — or wait for a real truck event.

When it works, Autonomise will show webhooks delivering **200** responses.

---

## What you do NOT need to do

- Change Circadia manager screens yet
- Set up Geotab / Webfleet in Autonomise
- Configure journey / speeding / idle in Autonomise for Circadia
- Use FileMaker telemetry webhook for Circadia (can stay as-is)

---

## If something fails

| Symptom | Fix |
|---------|-----|
| `"configured": false` on events URL | Step 1 not done or redeploy missing |
| Autonomise gets **401** | Secret mismatch between Vercel and Autonomise header |
| Autonomise gets **503** | Secret not set on Vercel |
| Autonomise gets **500** | Database table missing — Step 2 |
| Event **accepted: false** seatbelt | Normal — Circadia filters non-fatigue alarms |

---

## Next phase (after real events arrive)

- Show alerts on manager phone (`/manager/alerts`)
- Attach video clips from Media webhook
- Map VRN → driver name in Circadia roster

Technical detail: [incident-routing-assembly.md](./incident-routing-assembly.md) · [autonomise-webhook-pilot.md](./autonomise-webhook-pilot.md) · [manager-critical-alert-spec.md](./manager-critical-alert-spec.md) (on-call alarm — future).
