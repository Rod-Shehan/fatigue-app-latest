# Event model vs day display (ADR 0001)

> **S3 approved 2026-03-18** — these principles govern future work (e.g. **1-minute** event precision). **Default** quick-view / grid UX still requires separate approval per `.cursor/rules/fatigue-ui-approval.mdc` if it changes materially.

## Principles

1. **Canonical timeline** — Logged **events** (timestamps, type, optional location) are the **source of truth** for what happened and when.  
2. **Aggregated views** — **Half-hour grids** and other **quick-view** components are **derived** from events (or equivalent slot filling) for a **simple at-a-glance** experience.  
3. **No regression** — Improving timestamp precision (e.g. **1-minute** events for compliance math) must **not** remove or complicate the **default simple day display** without **explicit product approval** (see `.cursor/rules/fatigue-ui-approval.mdc`).

## Implementation note

Today, `EventLogger` / `deriveGridFromEvents` builds slot arrays from events; compliance consumes both **events** and **grids** depending on the rule. Future work should keep this separation explicit when tightening time resolution.
