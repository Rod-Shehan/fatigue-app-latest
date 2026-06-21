# Incident evidence retention — legal audit pack

**Status:** Product spec locked for planning · **Not implemented** (pilot stores raw webhooks in `AutonomiseWebhookIngest` only; managers manually pull video today).

**Related:**

- [incident-routing-assembly.md](./incident-routing-assembly.md) — pipeline **C** lifecycle, M1–M4 routing, append-only `lifecycle_transition_log`
- [manager-critical-alert-spec.md](./manager-critical-alert-spec.md) — on-call SMS/push, full-screen incident UI, Circadia-owned deep links
- [autonomise-webhook-pilot.md](./autonomise-webhook-pilot.md) — MTS webhook ingress (read-only vendor feed)

---

## Purpose

Manager **Authorize** / **Dismiss** on a camera fatigue event is a **legal and operational decision** — not a UI preference. It records whether the event was **true fatigue** vs **false positive**, with consequences for coaching, intervention, and later audit.

That decision is only defensible if Circadia keeps a **frozen evidence pack**: what the vendor sent, what video the manager saw, who decided, and when — **independent of Autonomise** still having the clip later.

**MTS today:** managers manually pull event data and video from Autonomise and store their own copy. Circadia should **automate and lock** that bundle before anyone confirms or dismisses.

---

## Core policy

| Rule | Policy |
|------|--------|
| **Vendor = ingress only** | Autonomise / Streamax / edge camera feeds are **read-only**. Circadia lifecycle + evidence store = **source of truth** for triage outcomes. |
| **Own copy of video** | Always fetch and **re-host** event video/snapshots on Circadia-controlled object storage (S3/R2/Vercel Blob). Do not rely on vendor URLs in SMS or audit exports. |
| **Dismiss ≠ delete** | `VERIFIED_FALSE_POSITIVE` still **archives** full evidence + dismiss reason. False positive is a decision **about** the event, not erasure of it. |
| **No decision without pack** | Manager Authorize/Dismiss must not complete until evidence pack row exists (video may still be **pending** with explicit banner — decision allowed only per tenant policy TBD). |
| **Append-only audit** | State transitions via `lifecycle_transition_log`; no silent edits to evidence or decisions after the fact. |
| **Retention** | Tenant-configurable retention window (e.g. 7 years for fleet audit). Vendor expiry does not bound Circadia retention. |

---

## What the evidence pack contains

Each accepted incident (pipeline **C**) gets one **evidence pack** linked to `fatigue_incident_lifecycle` (or promoted ingest id until lifecycle ships).

| Artefact | Contents | Why |
|----------|----------|-----|
| **Raw vendor payloads** | Event + media webhook JSON as received | Prove what the platform sent and when |
| **Normalized fields** | Rego, driver, alarm id, event uuid, timestamps | Human-readable audit summary |
| **Media — your copy** | Video and/or driver/road snapshots in **tenant object storage** | What the manager actually viewed; survives Autonomise link expiry |
| **Content hashes** | SHA-256 of stored blobs + payload bundle | Tamper detection on export |
| **Manager decision** | Authorize / Dismiss, actor user id, time, optional note | The legal decision itself |
| **Notification log** | SMS/push sent, roster numbers/devices, delivery status | Who was told and when |
| **Transition log** | Append-only lifecycle states | Full chain from ingest → close |

**Export (planned):** one-click **evidence pack download** for disputes — JSON manifest + media files + decision log.

---

## How video is obtained (then owned by Circadia)

Autonomise often sends **metadata only** on the event webhook; media may arrive separately or require API fetch. Circadia resolves media in layers:

| Layer | Source | Result |
|-------|--------|--------|
| **1. Media webhook** | `POST …/autonomise/media` | Store URLs if present; merge by event uuid |
| **2. Autonomise API fetch** | Server-side **Primary API key** | Poll event media endpoints until snapshots/video available (see `autonomise-fleet-alerts` reference implementation) |
| **3. Re-host** | Circadia worker after resolve | **Download** → tenant bucket → serve from **Circadia** URLs only |

Optional **proxy-at-view-time** (stream through Circadia API with vendor auth) is acceptable for pilot; **re-host** is required for long-term audit retention.

Env vars (planned addition to Vercel):

```text
AUTONOMISE_PRIMARY_KEY=…
AUTONOMISE_CLIENT_ID=…
AUTONOMISE_FNOL_ORG_ID=…          # MTS org id for FNOL fallback links only
EVIDENCE_STORAGE_BUCKET=…         # tenant or app-wide bucket policy TBD
```

FNOL portal links (`app.autonomise.ai/fnol/…`) are **fallback review only** — not the SMS target and not the legal record of viewed media.

---

## End-to-end flow (target)

```text
1. Vendor event accepted (pipeline C)
       → create lifecycle row + evidence_pack id
2. Media resolver (webhook merge + API fetch)
       → download video/snapshots → object storage
       → record hashes + storage keys on evidence_pack
3. Notify duty roster (push + SMS)
       → link = Circadia magic link only, e.g. https://…/m/{token}
       → page plays media from Circadia storage (not Autonomise URL)
4. Manager full-screen incident UI
       → views Circadia-hosted clip
       → Authorize (true fatigue) or Dismiss (false positive)
5. lifecycle_transition_log + decision row on evidence_pack
6. Incident CLOSED — evidence pack immutable; export available
```

This replaces the manual **pull data + pull video + store our own copy** workflow with a repeatable server-side pipeline.

---

## SMS / push and “push from our own server”

Once video is in **Circadia storage**, all outbound channels use **Circadia URLs only**:

| Channel | Content |
|---------|---------|
| **SMS** | Short magic link → `/m/{token}` → full-screen incident + `<video>` from Circadia |
| **Push (FCM/APNs)** | Deep link to same route; optional thumbnail from stored snapshot |
| **Existing MTS SMS system** | May remain the **sender**; template must use **Circadia link**, not Autonomise |

Circadia (or a webhook to the customer SMS gateway) controls **when** to send; the **video artefact** lives on Circadia infrastructure.

---

## What we must not do

| Anti-pattern | Why |
|--------------|-----|
| Treat `/manager/alerts` poll inbox as the legal record | No wired Authorize/Dismiss audit yet; list is operational only |
| Put Autonomise FNOL or API URLs in SMS | Login-gated, expiring, not your retention boundary |
| Overwrite evidence when manager dismisses | Destroys audit trail for false-positive decisions |
| Depend on vendor to retain clip for disputes | Vendor SLA ≠ fleet legal hold |

---

## Relationship to pipelines

| Pipeline | Role in evidence |
|----------|------------------|
| **A — Compliance** | Attested diary only; **not** camera incident evidence |
| **B — Assurance** | Rolling risk blocks; **not** accept/dismiss workflow |
| **C — Incidents** | **This document** — lifecycle + evidence pack + manager decision |

Direct video + accept/dismiss always belongs to **C** ([incident-routing-assembly.md](./incident-routing-assembly.md) §2).

---

## Implementation phasing

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| **Pilot (now)** | Raw webhook rows in `AutonomiseWebhookIngest` | Done |
| **E1** | `evidence_pack` + object storage schema; media re-host worker | Accepted event ingest; `AUTONOMISE_PRIMARY_KEY` |
| **E2** | Manager Authorize/Dismiss → lifecycle states + `lifecycle_transition_log` | E1; M3 routing for MTS |
| **E3** | Magic link `/m/{token}` + incident page serving stored media | E1; [manager-critical-alert-spec.md](./manager-critical-alert-spec.md) |
| **E4** | SMS/push with Circadia link (Twilio or customer gateway webhook) | E3; duty roster |
| **E5** | Evidence pack export (ZIP/JSON manifest) | E2 |

Phases **E1–E2** should precede or ship with on-call alarm fan-out so the first production SMS already points at a retained clip.

---

## Open decisions

1. **Decision before video ready** — allow Dismiss/Authorize while clip pending, or block until re-host completes?
2. **Retention default** — org-wide years vs per-tenant contract field.
3. **Storage tenancy** — one app bucket with tenant prefix vs bucket per fleet.
4. **PII in SMS** — rego/driver name in SMS body vs link-only for privacy.
5. **API media path** — confirm exact Autonomise REST media endpoint with vendor (401/404 on guessed paths in fleet-alerts pilot).

---

## Changelog

| Date | Note |
|------|------|
| 2026-06-21 | Initial spec — legal evidence pack, re-host video, Circadia-owned SMS links, replaces manual pull-and-store |
