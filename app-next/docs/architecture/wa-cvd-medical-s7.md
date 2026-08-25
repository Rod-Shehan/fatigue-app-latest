# WA Commercial Driver Medical expiry (S7)

## Purpose

Tracking of **Western Australia Commercial Driver Medical** certificate expiry on each **Approved Driver** roster record. The date is **required** on add/edit. It prints on weekly trip sheet PDFs and is used for **in-app reminders** — not a substitute for regulatory or medical advice.

UI copy uses **Commercial Driver Medical** (WA Commercial Vehicle Driver certificate).

## Data

- **Prisma:** `Driver.cvdMedicalExpiry` (`DateTime?` for existing rows; required on create/update from the Drivers page).
- **API:** `cvd_medical_expiry` as `YYYY-MM-DD` (drivers list, create, update).
- Licence number and licence expiry (`Driver.licenceNumber`, `Driver.licenceExpiry`) are required on the same form and print on the weekly PDF title block.

## UX

1. **Manager — Approved Drivers (`/drivers`):** required date field on add/edit; list shows expiry and “expired” / “renew within 30 days” hints.
2. **Driver sheet:** when the sheet’s **driver name** matches a roster driver (case-insensitive), **banners** appear if the date is **expired** or within **30 days** (amber). Managers get a link to `/drivers` to update the roster.
3. **Weekly trip sheet PDF:** Driver medical expiry prints under the driver name (dd/mm/yyyy).

## Logic

- `src/lib/cvd-medical.ts` — `getCvdMedicalBannerKind`, `daysFromTodayToYmd`.
- Two-up sheets: separate banners for **Primary** and **Second** when both match roster names.

## Disclaimer

Copy in banners and on the drivers page states that reminders are **not** legal/regulatory advice; confirm with WA DoT and medical providers.
