"""Process W — sleep inertia. Triggers only on nap → on-duty, never after awake rest."""

from __future__ import annotations

import math

from app.constants import BLOCK_MINUTES, ETA_NAP_PER_HOUR, LAMBDA_W_PER_MIN, W_MAX


def _clamp(value: float, lo: float, hi: float) -> float:
    if math.isnan(value) or math.isinf(value):
        return lo
    return max(lo, min(hi, value))


def initial_inertia(nap_hours: float) -> float:
    if nap_hours <= 0:
        return 0.0
    return W_MAX * (1.0 - math.exp(-ETA_NAP_PER_HOUR * nap_hours))


def decay_inertia(w_curr: float, delta_minutes: float = BLOCK_MINUTES) -> float:
    if w_curr <= 0.0:
        return 0.0
    w_next = w_curr * math.exp(-LAMBDA_W_PER_MIN * delta_minutes)
    return 0.0 if w_next < 0.01 else _clamp(w_next, 0.0, W_MAX)
