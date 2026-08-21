"""Process S — homeostatic sleep pressure (frms-py-2).

Awake break / non-work holds S flat. Exponential decay only on nap/sleep
(including inferred main sleep from the Next.js FRMS tape after End shift).
"""

from __future__ import annotations

import math

from app.constants import (
    BLOCK_HOURS,
    DAYLIGHT_END_H,
    DAYLIGHT_START_H,
    K_I_PER_HOUR,
    K_R_DAY_FACTOR,
    K_R_NIGHT_PER_HOUR,
    MU_WORK,
    S_MAX,
    S_MIN,
)


def _clamp(value: float, lo: float, hi: float) -> float:
    if math.isnan(value) or math.isinf(value):
        return lo
    return max(lo, min(hi, value))


def _is_daylight(t_h: float) -> bool:
    return DAYLIGHT_START_H <= t_h < DAYLIGHT_END_H


def rest_recovery_rate_per_hour(t_h: float) -> float:
    rate = K_R_NIGHT_PER_HOUR
    if _is_daylight(t_h):
        rate *= K_R_DAY_FACTOR
    return rate


def step_process_s(
    s_curr: float,
    *,
    is_nap: bool,
    is_on_duty: bool,
    continuous_work_hours: float,
    t_h: float,
    delta_hours: float = BLOCK_HOURS,
) -> float:
    """Advance Process S by one tape step."""
    s_curr = _clamp(s_curr, S_MIN, S_MAX)
    if is_nap:
        k_r = rest_recovery_rate_per_hour(t_h)
        s_next = S_MIN + (s_curr - S_MIN) * math.exp(-k_r * delta_hours)
        return _clamp(s_next, S_MIN, S_MAX)
    if is_on_duty:
        mu_work = MU_WORK * max(0.0, continuous_work_hours)
        gain = (S_MAX - s_curr) * (1.0 - math.exp(-K_I_PER_HOUR * delta_hours))
        s_next = s_curr + gain * (1.0 + mu_work)
        return _clamp(s_next, S_MIN, S_MAX)
    return s_curr
