# Future: event log as the office record

> Not scheduled. Documented so a later change can replace week-blob sync without re-litigating the problem.

## Why

Today each week is one JSON `days` blob on `FatigueSheet`. The phone queues create / patch / attest of that blob. Neon list returns `days: []`. Merge is a guess (event counts, leftover signature). That is what failed for Jaydin: a week never POSTed, list meta overwrote the phone, and a leftover “signed” mark hid an unsigned office week.

The rolling timeline already treats **driver events** as the first source of truth (see `event-model.md`). The week sheet should become a **view**, not the write unit.

## Target model

1. Each Start / Stop Driving / End shift / break / passenger / sleeper / parked log is its own row (id, driver, time, type, GPS, client seq).
2. The phone appends the event locally, then POSTs that event. Ack replaces the temp id.
3. The week sheet (and minute coverage) is **derived** from the event list ending at evaluation `now`.
4. Attestation stays a week-level act: signature + `signed_at` on the week slice, not on each event.
5. Day / week / month stay **descriptors only** — no midnight reset of open activity.

## What this is not

- Not a change to Start / End shift behaviour.
- Not a change to fatigue rule IP (thresholds, 5h, 17h, 168h, 184E).
- Not a CRDT research project. A simple append-only event table with idempotent client ids is enough.

## When to pick this up

After list-as-index, named queue ops (`create_week` / `patch_days` / `attest`), driver phone-vs-office copy, and online reconcile are in production and still not enough (split-brain after multi-device or a lost queue).
