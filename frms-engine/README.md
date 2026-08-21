# Circadia FRMS Engine (Python / FastAPI)

Three-Process Model of Alertness (TPMA) dual-layer microservice for manager assurance — **not** NHVR FRMSc compliance.

**frms-py-2:** biological Process S holds during awake Rest / non-work (decay only on nap/sleep). Acute **task-strain index** charges on work / other work and discharges on Rest so the chart can sawtooth without faking sleep recovery.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | None |
| POST | `/v1/risk-profile` | `Authorization: Bearer $FRMS_PYTHON_API_KEY` |

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `FRMS_PYTHON_API_KEY` | Yes | Bearer token (same value as Vercel `FRMS_PYTHON_API_KEY`) |
| `PORT` | No | Listen port (Railway/Render set this automatically) |

## Local development (Windows)

```powershell
# 1. Install Python 3.12+ from https://www.python.org/downloads/
#    Tick "Add python.exe to PATH" during install.

cd frms-engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

# 2. Set API key (pick any long random string for local dev)
$env:FRMS_PYTHON_API_KEY = "local-dev-key-change-me"

# 3. Run server
uvicorn app.main:app --reload --port 8000

# 4. Health check
curl http://127.0.0.1:8000/health

# 5. Tests
pytest -q
```

## Deploy on Railway (recommended)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `fatigue-app-latest`.
2. **Settings → Root Directory:** `frms-engine`  
   ⚠️ If this is `/` or empty, Railway will try to build **Next.js** (`app-next`) and fail.
3. **Settings → Config file path:** `/frms-engine/railway.toml`  
   (Required for monorepos — Railway does not auto-load `railway.toml` from Root Directory alone.)
4. **Variables:**
   - `FRMS_PYTHON_API_KEY` = generate a long random string (save it — you need the same on Vercel)
5. **Settings → Networking → Generate Domain** → copy URL (e.g. `https://frms-engine-production.up.railway.app`)
6. Confirm health: `https://YOUR-DOMAIN/health` → `{"status":"ok","engine":"frms-py-2"}`

**Deploy looks wrong?** See [TROUBLESHOOTING-RAILWAY.md](./TROUBLESHOOTING-RAILWAY.md).

**Verify from your PC:**

```powershell
cd app-next
$env:FRMS_TEST_URL = "https://YOUR-DOMAIN"
$env:FRMS_TEST_KEY = "YOUR-FRMS_PYTHON_API_KEY"
node scripts/verify-railway-frms.mjs
```

## Wire Vercel (Next.js app)

In Vercel → Project → **Environment Variables** (Production + Preview):

| Variable | Example |
|----------|---------|
| `FRMS_ENGINE` | `hybrid` |
| `FRMS_PYTHON_URL` | `https://YOUR-DOMAIN` (no trailing slash) |
| `FRMS_PYTHON_API_KEY` | same as Railway |
| `FRMS_INTERNAL_SECRET` | new long random string (Next.js only) |

Redeploy Vercel, then run smoke check:

```powershell
cd app-next
node scripts/frms-smoke-check.mjs
```

Trigger recompute: open Manager → pick a driver → risk chart, or PATCH a sheet.

## Docker (any host)

```bash
cd frms-engine
docker build -t circadia-frms .
docker run -p 8000:8000 -e FRMS_PYTHON_API_KEY=your-key circadia-frms
```

## Smoke test (curl)

```bash
curl -s https://YOUR-DOMAIN/health
curl -s -X POST https://YOUR-DOMAIN/v1/risk-profile \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"driver_name":"test","jurisdiction_code":"wa","driver_type":"solo","as_of_ms":1700000000000,"horizon_from_ms":1700000000000,"horizon_to_ms":1700003600000,"week_starting":"2026-05-31","timeline_blocks":[{"start_ms":1700000000000,"is_work":true,"is_rest":false}]}'
```
