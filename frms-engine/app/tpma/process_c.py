"""Process C — two-harmonic circadian alertness drive."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.constants import A1, A2, C_ALERT_BASE, C_ALERT_MIN, PHI1, PHI2


def _clamp(value: float, lo: float, hi: float) -> float:
    if math.isnan(value) or math.isinf(value):
        return lo
    return max(lo, min(hi, value))


def decimal_hour_local(start_ms: int, tz: ZoneInfo) -> float:
    dt = datetime.fromtimestamp(start_ms / 1000.0, tz=timezone.utc).astimezone(tz)
    return dt.hour + dt.minute / 60.0 + dt.second / 3600.0


def circadian_alertness_drive(t_h: float) -> float:
    """Folkard two-harmonic alertness drive on a high physiological baseline.

    Mapped so 1 − C_alert + S + W stays in a usable 0–100% range: circadian
    nadir alone is elevated, not already 100% impaired.
    """
    primary = A1 * math.cos(2.0 * math.pi * (t_h - PHI1) / 24.0)
    secondary = A2 * math.cos(2.0 * math.pi * (t_h - PHI2) / 12.0)
    return _clamp(C_ALERT_BASE + primary + secondary, C_ALERT_MIN, 1.0)


def circadian_impairment(c_alert: float) -> float:
    return 1.0 - c_alert
