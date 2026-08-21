"""Task-Strain Index — acute visual/muscular/attentional charge and discharge."""

from __future__ import annotations

import math

from app.constants import (
    ALPHA_STRAIN_PER_MIN,
    BETA_STRAIN_PER_MIN,
    BLOCK_MINUTES,
    GAMMA_DRIVING,
    GAMMA_HEAVY_LABOR,
    GAMMA_LIGHT_DUTY,
)


def _clamp(value: float, lo: float, hi: float) -> float:
    if math.isnan(value) or math.isinf(value):
        return lo
    return max(lo, min(hi, value))


def gamma_task(*, is_work: bool, is_other_work: bool, sub_type: str | None) -> float:
    kind = (sub_type or "").strip().lower()
    if kind in ("light_duty", "administrative", "paperwork", "admin"):
        return GAMMA_LIGHT_DUTY
    if is_other_work or kind in ("heavy_labor", "loading"):
        return GAMMA_HEAVY_LABOR
    if is_work:
        return GAMMA_DRIVING
    return GAMMA_DRIVING


def step_task_strain(
    t_curr: float,
    *,
    is_on_duty: bool,
    is_recovery: bool,
    is_work: bool,
    is_other_work: bool,
    sub_type: str | None,
    delta_minutes: float = BLOCK_MINUTES,
) -> float:
    """Charge on work/other_work; exponential discharge on break/non-work (including nap)."""
    t_curr = _clamp(t_curr, 0.0, 100.0)
    if is_on_duty:
        gamma = gamma_task(is_work=is_work, is_other_work=is_other_work, sub_type=sub_type)
        gain = (100.0 - t_curr) * (1.0 - math.exp(-ALPHA_STRAIN_PER_MIN * delta_minutes)) * gamma
        return _clamp(t_curr + gain, 0.0, 100.0)
    if is_recovery:
        return _clamp(t_curr * math.exp(-BETA_STRAIN_PER_MIN * delta_minutes), 0.0, 100.0)
    return t_curr
