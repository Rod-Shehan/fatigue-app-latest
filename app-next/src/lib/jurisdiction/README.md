# Jurisdiction module

> **RULE IP** — Do not change fatigue time/compliance rule logic without explicit owner approval. See `.cursor/rules/time-rules-ip.mdc`.

Pluggable **jurisdiction / rule-set** identifiers for fatigue compliance (see **ADR 0001**).

**Current behaviour:** Production logic remains in [`../compliance.ts`](../compliance.ts) (WA OSH Reg 3.132). This folder provides types and a single default constant so new code can depend on stable imports without UI changes.
