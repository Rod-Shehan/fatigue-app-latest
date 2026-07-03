# Events Platform — integration request (copy-paste)

**Purpose:** Send to VisionTrack / FTCloud / Events Platform Technical Support or your integration contact to unblock Circadia Phase 1 ingest mapping.

**Related:** [incident-routing-assembly.md](./incident-routing-assembly.md) §5a–5b · **§5e canonical vendor event model**

**Reference on file:** *Events Platform User Guide* version 20231011.32 — confirms Events tab workflow and Organisation → Integration Details, but not API wire format.

---

## Email (copy from Subject line down)

**Subject:** Integration API / webhook documentation for Circadia fatigue management platform

Hi,

We are integrating our fatigue management platform (**Circadia 24**) with the **Events Platform** (Streamax / FTCloud path). We have reviewed the Events Platform User Guide and understand the Events workflow, media requests, and Organisation → Integration Details section, but we need the **technical integration package** to proceed.

Could you please provide the following for our organisation (or a sandbox tenant)?

### 1. Integration access

- Contents of **Organisation → Integration Details** (endpoints, credentials, licence requirements)
- Whether integration is **webhook push** to our URL, **REST polling**, or both
- Authentication method (API key, OAuth, signed webhook, IP allowlist, etc.)
- Sandbox / test tenant credentials if available

### 2. Sample payloads

- One **real JSON example** (redacted) for a discrete camera/telematics event — e.g. fatigue, distraction, harsh brake, or eyes-off-road if configured
- Field list for stable identifiers: **event ID**, **device ID**, **VRN**, **driver ID/name**, timestamps (detected vs received), classification, severity, alarm type
- Confirmation whether feeds include **rolling metrics** as well as discrete events (or events only)

### 3. Video / media

- How programmatic access works: **direct URL**, expiring URL, download API, or portal session only
- Typical time-to-ready after event (given manual “Request Video” in the UI)
- URL lifetime and any auth headers required for playback in a third-party app
- Thumbnail / snapshot availability in the payload

### 4. Lifecycle / write-back

- Does the Events Platform expect external systems to **update event status or event notes** (Dismissed, Requires Intervention, False Positive, etc.) via API?
- If yes, please share the update endpoint and allowed status values
- If no, confirm we may treat Events Platform as **read-only ingress** and maintain our own audit lifecycle

### 5. Operational

- Idempotency: can the same event be delivered more than once? Which field is the dedupe key?
- Rate limits and recommended polling interval (if poll-based)
- CSV/export API for backfill, or events API with “not processed” filter only

Our intended use:

- Ingest discrete events into our **operator triage** and/or **fleet manager mobile alert** workflows
- Map events to our drivers using **VRN + device ID** (and driver name when present)
- Play associated video when available; support **video-pending** state when media is still Queued

Happy to jump on a call if easier. Please advise the correct Technical Support / integration contact if this should not go to you.

Thanks,  
[Your name]  
[Organisation]  
[Contact email / phone]

---

## Short checklist (for tracking replies)

| # | Item | Received? | Notes |
|---|------|-----------|-------|
| 1 | Integration Details / credentials | ☐ | |
| 2 | Push vs poll confirmed | ☐ | |
| 3 | Sample event JSON | ☐ | |
| 4 | Sample media access | ☐ | |
| 5 | Identity fields (VRN, device, driver) | ☐ | |
| 6 | Write-back API yes/no | ☐ | Model A / B / C (§5b) |
| 7 | Idempotency / event ID field | ☐ | |
| 8 | Sandbox tenant | ☐ | |

---

## After reply — internal next steps

1. Map payload → pipeline **B** (assurance blocks) and/or **C** (lifecycle) in a Phase 1 addendum to [incident-routing-assembly.md](./incident-routing-assembly.md).
2. Complete §6 worksheet for pilot customer (routing mode M1–M4 + integration model A/B/C).
3. Only then implement ingest route + `/manager/alerts` playback shell.
