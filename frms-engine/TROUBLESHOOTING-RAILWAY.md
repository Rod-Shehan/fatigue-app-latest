# Railway deploy troubleshooting (frms-engine)

Use this if the FRMS Python service is failing, showing the wrong app, or `/health` does not work.

## Quick checklist (most common fixes)

| # | Setting | Correct value | Wrong value (common mistake) |
|---|---------|---------------|------------------------------|
| 1 | **Root Directory** | `frms-engine` | `/` or empty → Railway builds **Next.js** instead |
| 2 | **Config file path** | `/frms-engine/railway.toml` | Leave blank → healthcheck/start may be wrong |
| 3 | **Variable** | `FRMS_PYTHON_API_KEY` set | Missing → `/v1/risk-profile` returns 503 |
| 4 | **Networking** | **Generate Domain** (public) | No domain → nothing to call from Vercel |
| 5 | **FRMS_PYTHON_URL on Vercel** | `https://xxx.up.railway.app` (no trailing `/`) | Wrong URL or still pointing at localhost |

## Symptom → likely cause

### Build fails with Next.js / npm / Prisma errors

**Cause:** Root Directory is the repo root, not `frms-engine`.

**Fix:**
1. Railway → your FRMS service → **Settings**
2. **Root Directory** → `frms-engine`
3. **Redeploy**

You should see Docker build logs copying `requirements.txt` and `app/`, not `app-next`.

---

### Build fails: `Dockerfile not found`

**Cause:** Root Directory empty, or Dockerfile path wrong.

**Fix (pick one):**
- Set Root Directory = `frms-engine` (Dockerfile is at `frms-engine/Dockerfile`), **or**
- Set variable `RAILWAY_DOCKERFILE_PATH` = `frms-engine/Dockerfile` if Root Directory must stay `/`

---

### Deploy succeeds but URL returns 502 / Application failed to respond

**Cause:** App not listening on Railway’s `PORT`.

**Fix:** Redeploy latest `main` (uses `start.sh` with `$PORT`). Confirm **Start command** is empty or `./start.sh`.

---

### `/health` works but Vercel still shows legacy / demo chart

**Cause:** Vercel env not set or mismatch.

**Fix on Vercel:**
```
FRMS_ENGINE=hybrid
FRMS_PYTHON_URL=https://YOUR-RAILWAY-DOMAIN
FRMS_PYTHON_API_KEY=<same as Railway>
FRMS_INTERNAL_SECRET=<random>
```
Redeploy Vercel after saving.

---

### `/health` returns OK, POST `/v1/risk-profile` returns 503

**Cause:** `FRMS_PYTHON_API_KEY` not set on Railway.

**Fix:** Railway → Variables → add `FRMS_PYTHON_API_KEY`, redeploy.

---

### `/v1/risk-profile` returns 401

**Cause:** Bearer token on Vercel does not match Railway.

**Fix:** Use the **exact same** string for `FRMS_PYTHON_API_KEY` on both platforms.

---

### Two services in one Railway project

If you added Postgres or accidentally created two web services:
- Open the service whose build logs mention **Python / uvicorn / frms-engine**
- Generate the public domain on **that** service only

---

## Verify from your PC

Replace `YOUR-DOMAIN` and `YOUR-KEY`:

```powershell
# 1. Health (no auth)
Invoke-RestMethod https://YOUR-DOMAIN/health

# Expected: status=ok, engine=frms-py-2

# 2. Risk profile (auth required)
$headers = @{ Authorization = "Bearer YOUR-KEY"; "Content-Type" = "application/json" }
$body = '{"driver_name":"test","jurisdiction_code":"wa","driver_type":"solo","as_of_ms":1700000000000,"horizon_from_ms":1700000000000,"horizon_to_ms":1700003600000,"week_starting":"2026-05-31","timeline_blocks":[{"start_ms":1700000000000,"is_work":true,"is_rest":false}]}'
Invoke-RestMethod https://YOUR-DOMAIN/v1/risk-profile -Method POST -Headers $headers -Body $body
```

Or run (from repo root):

```powershell
cd app-next
$env:FRMS_TEST_URL = "https://YOUR-DOMAIN"
$env:FRMS_TEST_KEY = "YOUR-KEY"
node scripts/verify-railway-frms.mjs
```

## Correct Railway service settings (summary)

```
Root Directory:     frms-engine
Config file path:   /frms-engine/railway.toml
Builder:            Dockerfile  (auto-detected when Root Directory is frms-engine)
Start command:      (leave empty — Dockerfile CMD runs start.sh)
Variables:          FRMS_PYTHON_API_KEY=<secret>
Networking:         Public domain generated
```

## Still stuck?

Copy from Railway **Deployments → latest → View logs**:
- Last 20 lines of **Build** log
- Last 20 lines of **Deploy** log

And share:
- Your public Railway URL
- Whether Root Directory is `frms-engine` or `/`
