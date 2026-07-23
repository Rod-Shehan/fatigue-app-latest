# AMI dual-run report (Phase 2)

Generated against 10 fixtures. Live compliance is still the legacy engines.

## Summary

- **match:** 47
- **diff:** 3
- **skip:** 30 (current rule not extracted as a pure function yet)

## Rows

| Fixture | Rule | Status | Notes |
|---------|------|--------|-------|
| 17h-resume-ok | seventeen_hour_episode | match |  |
| 17h-resume-ok | solo_between_shift_7h | match |  |
| 17h-resume-ok | two_up_24h | match |  |
| 17h-resume-ok | five_hour_break | match |  |
| 17h-resume-ok | work_168h | skip | Needs weekStarting |
| 17h-resume-ok | solo_72h | skip |  |
| 17h-resume-ok | solo_14d_long_rests | skip |  |
| 17h-resume-ok | shift_pattern_184E4_gap | skip | Needs weekStarting + shiftLabels |
| 17h-exhausted | seventeen_hour_episode | match |  |
| 17h-exhausted | solo_between_shift_7h | match |  |
| 17h-exhausted | two_up_24h | match |  |
| 17h-exhausted | five_hour_break | match |  |
| 17h-exhausted | work_168h | skip | Needs weekStarting |
| 17h-exhausted | solo_72h | skip |  |
| 17h-exhausted | solo_14d_long_rests | skip |  |
| 17h-exhausted | shift_pattern_184E4_gap | skip | Needs weekStarting + shiftLabels |
| 7h-rest-met | seventeen_hour_episode | match |  |
| 7h-rest-met | solo_between_shift_7h | match |  |
| 7h-rest-met | two_up_24h | match |  |
| 7h-rest-met | five_hour_break | match |  |
| 7h-rest-met | work_168h | skip | Needs weekStarting |
| 7h-rest-met | solo_72h | skip |  |
| 7h-rest-met | solo_14d_long_rests | skip |  |
| 7h-rest-met | shift_pattern_184E4_gap | skip | Needs weekStarting + shiftLabels |
| 7h-rest-short | seventeen_hour_episode | match |  |
| 7h-rest-short | solo_between_shift_7h | match |  |
| 7h-rest-short | two_up_24h | match |  |
| 7h-rest-short | five_hour_break | match |  |
| 7h-rest-short | work_168h | skip | Needs weekStarting |
| 7h-rest-short | solo_72h | skip |  |
| 7h-rest-short | solo_14d_long_rests | skip |  |
| 7h-rest-short | shift_pattern_184E4_gap | skip | Needs weekStarting + shiftLabels |
| 5h-needs-break | seventeen_hour_episode | match |  |
| 5h-needs-break | solo_between_shift_7h | match |  |
| 5h-needs-break | two_up_24h | match |  |
| 5h-needs-break | five_hour_break | match |  |
| 5h-needs-break | work_168h | skip | Needs weekStarting |
| 5h-needs-break | solo_72h | skip |  |
| 5h-needs-break | solo_14d_long_rests | skip |  |
| 5h-needs-break | shift_pattern_184E4_gap | skip | Needs weekStarting + shiftLabels |
| 5h-with-20-break | seventeen_hour_episode | match |  |
| 5h-with-20-break | solo_between_shift_7h | match |  |
| 5h-with-20-break | two_up_24h | match |  |
| 5h-with-20-break | five_hour_break | match |  |
| 5h-with-20-break | work_168h | skip | Needs weekStarting |
| 5h-with-20-break | solo_72h | skip |  |
| 5h-with-20-break | solo_14d_long_rests | skip |  |
| 5h-with-20-break | shift_pattern_184E4_gap | skip | Needs weekStarting + shiftLabels |
| two-up-24h-short | seventeen_hour_episode | match |  |
| two-up-24h-short | solo_between_shift_7h | match |  |
| two-up-24h-short | two_up_24h | match |  |
| two-up-24h-short | five_hour_break | match |  |
| two-up-24h-short | work_168h | skip | Needs weekStarting |
| two-up-24h-short | solo_72h | skip |  |
| two-up-24h-short | solo_14d_long_rests | skip |  |
| two-up-24h-short | shift_pattern_184E4_gap | skip | Needs weekStarting + shiftLabels |
| 168h-light-week | seventeen_hour_episode | match |  |
| 168h-light-week | solo_between_shift_7h | match |  |
| 168h-light-week | two_up_24h | match |  |
| 168h-light-week | five_hour_break | match |  |
| 168h-light-week | work_168h | match |  |
| 168h-light-week | solo_72h | match | Both inactive (segment < 72h or equivalent) |
| 168h-light-week | solo_14d_long_rests | match |  |
| 168h-light-week | shift_pattern_184E4_gap | skip | No A↔B transition on fixture |
| 72h-three-blocks | seventeen_hour_episode | match |  |
| 72h-three-blocks | solo_between_shift_7h | match |  |
| 72h-three-blocks | two_up_24h | match |  |
| 72h-three-blocks | five_hour_break | match |  |
| 72h-three-blocks | work_168h | match |  |
| 72h-three-blocks | solo_72h | diff | Legacy scored window; AMI soft-reset inactive — investigate parity |
| 72h-three-blocks | solo_14d_long_rests | diff |  |
| 72h-three-blocks | shift_pattern_184E4_gap | skip | No A↔B transition on fixture |
| pattern-gap-with-break | seventeen_hour_episode | match |  |
| pattern-gap-with-break | solo_between_shift_7h | match |  |
| pattern-gap-with-break | two_up_24h | match |  |
| pattern-gap-with-break | five_hour_break | match |  |
| pattern-gap-with-break | work_168h | match |  |
| pattern-gap-with-break | solo_72h | diff | Legacy scored window; AMI soft-reset inactive — investigate parity |
| pattern-gap-with-break | solo_14d_long_rests | match |  |
| pattern-gap-with-break | shift_pattern_184E4_gap | match | Wall-clock/current and only-work-interrupts may agree while continuous-non_work differs when breaks sit in the gap |

## Diff details

### 72h-three-blocks — solo_72h

```json
{
  "current": {
    "totalNonWorkMinutes": 3840,
    "sevenHourBlocks": 3
  },
  "ami": {
    "applies": false,
    "totalNonWork": 0,
    "qualBlockCount": 0
  },
  "note": "Legacy scored window; AMI soft-reset inactive — investigate parity"
}
```

### 72h-three-blocks — solo_14d_long_rests

```json
{
  "current": {
    "longRestCount": 2
  },
  "ami": {
    "longRestCount": 1,
    "ok": false
  }
}
```

### pattern-gap-with-break — solo_72h

```json
{
  "current": {
    "totalNonWorkMinutes": 2920,
    "sevenHourBlocks": 3
  },
  "ami": {
    "applies": false,
    "totalNonWork": 0,
    "qualBlockCount": 0
  },
  "note": "Legacy scored window; AMI soft-reset inactive — investigate parity"
}
```

## Locked decisions so far

- Keep 17h episode resume after End shift
- Keep NHVR provisional engine
- 184E(4) primary AMI measure: only `work` interrupts rest run
- Parity vs AMI-literal: decide from this report (still open)
- Phase 3: AMI overlay via getComplianceEngine when AMI_COMPLIANCE_ENGINE_ENABLED=true (default off)
