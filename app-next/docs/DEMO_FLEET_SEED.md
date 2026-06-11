# Demo fleet seed — 5 long-haul drivers

Status: **demo data, currently live in Neon. Remove before customer rollout**
(see `FRMS_PRE_ROLLOUT_HARDENING.md` item 7).

`scripts/seed-demo-drivers.ts` seeds 5 fictional WA long-haul drivers so the
manager fleet risk pulse, priority queue and individual risk graph always have
realistic data to display.

## Usage (PowerShell, from `app-next`)

```powershell
# Seed/refresh demo sheets (DATABASE_URL read from .env.local automatically)
npx tsx scripts/seed-demo-drivers.ts

# Also pre-compute TPMA risk runs so the heatmap populates instantly
# (point at Railway, or a locally running frms-engine):
$env:FRMS_ENGINE="hybrid"
$env:FRMS_PYTHON_URL="http://127.0.0.1:8000"
$env:FRMS_PYTHON_API_KEY="<key>"
npx tsx scripts/seed-demo-drivers.ts

# Remove all demo sheets + FRMS runs (snapshots cascade)
npx tsx scripts/seed-demo-drivers.ts --clean
```

To run the engine locally: `cd frms-engine`, set `FRMS_PYTHON_API_KEY`, then
`.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`.

## The roster

| Driver | Pattern | Rest day |
|---|---|---|
| Mick Harland | Perth–Kalgoorlie, 04:30 start, ~11.5h | Sat |
| Priya Nathan | Perth–Geraldton, 06:30 start, ~10.75h | Sun |
| Wayne Corrigan | Perth–Meekatharra, 12:30–23:45 evening run (shift B) | Wed |
| Sofia Reiner | Perth–Bunbury split shift (morning + afternoon tours) | Thu |
| Dean Okafor | Perth–Newman, 05:15 start, ~12h (heaviest load) | Mon |

## What gets written

- Two `FatigueSheet` rows per driver: **previous week** (full history for the
  TPMA 14-day lookback) and the **current week** including remaining planned
  days (feeds the forward part of the risk curve).
- Each day carries `events` plus the 1440-minute `work_time`/`breaks`/`non_work`
  grids, regos, start/destination, start/end kms and shift labels — the same
  shape the driver UI writes.
- Events logged in the past also carry `lat`/`lng`/`accuracy`, interpolated
  along each driver's real highway polyline (Great Eastern / Brand / Great
  Northern / Forrest Hwy) by fraction of work time completed, so the Movement
  map shows the fleet spread across WA. Future planned events have no GPS fix —
  **re-run the seed periodically to extend map coverage** through the week.
- Optionally one ready `FrmsProfileRun` + snapshots per driver (when FRMS env
  vars are set).

## Compliance basis (WA Reg 184E)

Every generated day satisfies:

- **184E(1)(a)** — work legs < 5h, each followed by a 20–30 min break
  (≥20 min total incl. ≥10 min continuous).
- **184E(1)(b)** — 14-day work totals ~120–135h, well under 168h.
- **184E(2)(a)** — overnight rest ≥ 10h, on-duty span ≤ ~13.5h, so the
  27h-per-72h / 3×≥7h / ≤17h-separation solo rules hold.
- **184E(2)(b)(i)** — one full 24h non-work day per driver per week
  (staggered across the roster so 4–5 drivers are active any given day).

## Determinism / idempotency

Daily start times and leg lengths jitter via an RNG seeded from
`driverName|date`, so each day looks different but re-running the script
produces identical sheets (sheets are upserted by driver + week; no record
churn, FRMS input hashes stay stable).
