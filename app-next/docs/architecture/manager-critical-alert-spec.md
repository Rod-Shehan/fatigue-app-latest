# Manager critical alert — on-call product spec (core business)

**Status:** Product spec locked for planning · **Not implemented** (webhook capture + Live alerts list are pilot only).

**Related:**

- [incident-evidence-retention.md](./incident-evidence-retention.md) — legal evidence pack, re-host video, manager decision audit
- [incident-routing-assembly.md](./incident-routing-assembly.md) — pipelines, M1–M4 routing, ingest
- [autonomise-webhook-pilot.md](./autonomise-webhook-pilot.md) — MTS webhook plumbing (done)
- `/manager/alerts` — passive inbox today; not the primary on-call alarm surface

---

## Purpose

Circadia’s **on-call layer** is core product IP: when an accepted in-cab fatigue event arrives, duty managers must be reached **even if phones are on silent or DND**. The experience must be as unmistakable as a passenger-car **ADAS collision / proximity warning** — not a row in a notification shade.

---

## Core requirements

| # | Requirement | Intent |
|---|-------------|--------|
| **R1** | **Break through silent / DND** | On-call person must not miss an alert because device settings were left wrong |
| **R2** | **ADAS-grade full-screen** | One glance = fatigue incident — act now; not “another app notification” |
| **R3** | **Roster fan-out** | Everyone on the **active duty roster** gets the alert — no per-person opt-out for that shift |
| **R4** | **Evidence before decision** | Manager Authorize/Dismiss is a **legal decision**; Circadia retains vendor payloads + **own copy of video** — see [incident-evidence-retention.md](./incident-evidence-retention.md) |

---

## R3 — Duty roster

**Concept:** Organisation maintains who is on call for a time window.

```text
Fatigue event accepted (pipeline C)
    → resolve active duty roster for tenant
    → notify EVERY rostered manager (no “primary only”)
    → each device: critical alert + full-screen incident UI
```

| Rule | Policy |
|------|--------|
| Who receives | All users on **active duty roster** for tenant |
| Opt-out while on roster | **None** — accept the shift, accept the blast |
| Off roster | No Circadia critical alerts (normal app only) |
| Who configures roster | **Owner / admin** (or Circadia ops on behalf of tenant) — not casual manager toggles |

**v1 roster shape (suggested):** named managers + mobile numbers + `onDutyFrom` / `onDutyUntil` (Perth). Complex scheduling deferred.

---

## R2 — Full-screen incident UI (“collision warning”)

**Not** the current Live alerts **list** as the primary on-call surface when the alarm fires.

**Primary route (planned):** `/manager/alerts/incident/[id]` or tokenized deep link from push/SMS.

| Element | Spec |
|---------|------|
| Layout | Full viewport, mobile-only; **no subnav** until acted |
| Visual | High contrast (e.g. red/amber on black) — FCW / proximity-warning clarity |
| Headline | Large: event type (**FATIGUE**, distraction, etc.) |
| Context | Rego, driver name, time, source (Autonomise / Circadia edge) |
| Video | Prominent when `mediaUrl` ready; **CLIP PENDING** banner when not |
| Actions | Two only: **Acknowledge on duty** / **Escalate** (exact labels TBD) |
| Audio | Optional short loop while screen open (ADAS-style); stops after ack |
| Desk fallback | `/manager/alerts` list remains **history / review** |

---

## R1 — Bypass silent / DND (technical reality)

A **browser tab alone cannot fully override** system silent or Do Not Disturb. Platform policy, not Circadia caution.

| Channel | Bypass strength | Notes |
|---------|-----------------|-------|
| Web push (PWA only) | Weak | Often respects DND |
| Native shell (Capacitor/RN) + Android high-priority FCM + full-screen intent | Strong (Android) | Recommended for mobile |
| iOS **Critical Alerts** entitlement | Strong if Apple approves | Safety/fatigue justification; review required |
| **SMS** to roster mobiles | Very strong | Rings/vibrates independent of app silent |
| **Voice call** (e.g. Twilio) if no ack in N min | Strongest | Later phase |
| iOS Emergency Bypass for a contact | User must configure once | Onboarding for roster |

**Recommended production fan-out (parallel):**

```text
Accepted incident
    → all rostered managers
    → A) max-priority push → full-screen incident route
    → B) SMS to roster numbers (backup / silent-phone bypass)
    → C) optional: voice call if no ack within N minutes (later)
```

**Product promise (honest):** multi-channel (push + SMS minimum) — not “web notification only.”

---

## End-to-end flow (target)

```text
1. Camera / Autonomise → Circadia ingest (pilot: done)
2. Accepted fatigue incident row (planned: lifecycle or ingest promotion)
3. Duty roster lookup → all on-call managers
4. ALARM LAYER (core IP):
      critical push (all roster devices)
      SMS (all roster numbers)
      open full-screen incident UI
5. Claim / ack model (see below)
6. Media resolver → re-host video to Circadia storage (see incident-evidence-retention.md)
7. SMS/push with Circadia magic link — video served from our storage, not Autonomise
8. Manager Authorize / Dismiss → append-only lifecycle + evidence pack audit
```

---

## Claim model (open — resolve before build)

| Model | Behaviour |
|-------|-----------|
| **A — Broadcast until claim** (recommended) | Everyone alerted; first **“I’m handling this”** claims incident; optional **stand down** push to others |
| **B — Everyone must ack** | All roster members must acknowledge — heavy; rarely needed for fatigue |

**Default recommendation:** **A** for MTS and general fleet unless compliance mandates all-hands ack.

---

## What exists today vs this spec

| Today (pilot) | This spec |
|---------------|-----------|
| Webhook ingest + `AutonomiseWebhookIngest` | Same ingress |
| `/manager/alerts` — 12s poll, list + video | **+** full-screen incident route from alarm |
| No push / SMS / sound | **+** roster fan-out push + SMS |
| No duty roster entity | **+** roster admin |
| Authorize / Dismiss disabled | **+** ack / escalate → audit trail + evidence pack |

Webhook work = **plumbing**. This document = **the product**.

---

## Implementation phasing

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| **Pilot (now)** | Events on Live alerts; real JSON samples | Autonomise test events |
| **1** | Duty roster storage + owner admin UI | Tenant model |
| **2** | Full-screen incident page + SMS on accepted event | Roster + Twilio/SMS provider |
| **3** | Installable app (Capacitor) + Android high-priority push + full-screen intent | Phase 2 |
| **4** | iOS Critical Alerts (if Apple path approved) | Phase 3 |
| **5** | No-ack escalation → voice call | Phase 2–3 |

Do not build Phase 1+ until at least one **real accepted event payload** is validated (field mapping).

---

## Business positioning (one paragraph)

Circadia’s on-call layer treats driver fatigue like an ADAS collision warning: when an accepted in-cab fatigue event arrives, every manager on the active duty roster receives a critical, multi-channel alert (push and SMS) designed to penetrate silent and DND settings, and each recipient is taken to a full-screen incident display with video and explicit acknowledge/escalate actions — no optional filtering, no “I didn’t see it because my phone was on silent.”

---

## Open decisions

1. **Claim model** — A (broadcast until claim) vs B (all must ack).
2. **MTS pilot alarm channels** — SMS-only first vs SMS + push together.
3. **Native app timing** — Capacitor shell before or after SMS proof.
4. **Roster granularity** — simple window vs recurring shifts.
5. **Stand-down push** — notify others when incident claimed?

---

## Changelog

| Date | Note |
|------|------|
| 2026-06-21 | R4 + flow link to [incident-evidence-retention.md](./incident-evidence-retention.md) |
| 2026-06-21 | Link manager-critical-alert-spec.md (on-call product) |
| 2026-06-21 | Initial spec from on-call / ADAS / roster fan-out product requirements |
