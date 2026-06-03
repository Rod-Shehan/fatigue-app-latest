# WA Commercial Driver's Medical expiry (S7)

## Purpose

Optional tracking of **Western Australia Commercial Driver's Medical** certificate expiry on each **Approved Driver** roster record. Used for **in-app reminders only** — not a substitute for regulatory or medical advice.

UI copy uses **Commercial Driver's Medical** (WA Commercial Vehicle Driver certificate).

## Data

- **Prisma:** `Driver.cvdMedicalExpiry` (`DateTime?`).
- **API:** `cvd_medical_expiry` as `YYYY-MM-DD` or `null` (drivers list, create, update).

## UX

1. **Manager — Approved Drivers (`/drivers`):** optional date field on add/edit; list shows expiry and “expired” / “renew within 30 days” hints.
2. **Driver sheet:** when the sheet’s **driver name** matches a roster driver (case-insensitive), **banners** appear if the date is **expired** or within **30 days** (amber). Managers get a link to `/drivers` to update the roster.

## Logic

- `src/lib/cvd-medical.ts` — `getCvdMedicalBannerKind`, `daysFromTodayToYmd`.
- Two-up sheets: separate banners for **Primary** and **Second** when both match roster names.

## Disclaimer

Copy in banners and on the drivers page states that reminders are **not** legal/regulatory advice; confirm with WA DoT and medical providers.
