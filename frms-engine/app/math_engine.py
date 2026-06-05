"""
Three-Process Model of Alertness (TPMA) + progressive task workload compression.

Peer-reviewed foundations:
  - Process S / W / C: Åkerstedt & Folkard (1990); Van Dongen et al. (2003)
  - Circadian two-harmonic: Folkard & Akerstedt (1992)
  - Dawson-Reid BAC equivalence bands: Dawson & Reid (1997); NHVR coaching context

Assurance-only outputs — not statutory compliance verdicts.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import List, Tuple
from zoneinfo import ZoneInfo

from app.schemas import ProspectiveRegisterItem, SnapshotResponse, TimelineBlock

# --- Laboratory-calibrated TPMA constants (scaled to 15-minute blocks) ---
CHI_W = 0.035 / 4  # Standard wake depletion rate per 15-min block
CHI_S = 0.238 / 4  # Standard sleep recovery rate per 15-min block
W_0 = 0.35  # Maximum sleep inertia amplitude immediately upon waking
CHI_I = 1.75 / 4  # Sleep inertia dissipation rate per 15-min block
A1 = 0.14
PHI1 = 16.75  # Primary 24h circadian amplitude and phase peak (decimal hours)
A2 = 0.04
PHI2 = 14.50  # Secondary 12h circadian amplitude and phase peak (decimal hours)
MU = 0.015  # Task-related cumulative workload wear factor per continuous work hour

BLOCK_HOURS = 15 / 60  # 0.25 h per block
S_MAX = 1.25  # Upper bound on homeostatic pressure before normalization
C_MAX = A1 + A2  # Theoretical peak circadian impairment span

# Progressive compression / Dawson-Reid coaching thresholds (continuous work hours)
PROGRESSIVE_THRESHOLDS_H: Tuple[Tuple[float, str, str], ...] = (
    (
        5.5,
        "monitor",
        "Progressive compression: continuous on-duty leg exceeds 5.5 h — heightened monitoring advised (TPMA workload accumulation).",
    ),
    (
        7.0,
        "elevated",
        "Dawson-Reid wakefulness exhaustion threshold exceeded (~0.05% BAC equivalence) — schedule recovery before further driving.",
    ),
    (
        10.0,
        "critical",
        "Severe micro-sleep risk zone (~0.10% BAC parity) — immediate rest required under progressive fatigue management.",
    ),
)

DAYLIGHT_START_H = 6.0
DAYLIGHT_END_H = 18.0
EXTREME_HEAT_C = 35.0
EXTREME_COLD_C = 2.0


def _safe_exp(x: float, lo: float = -50.0, hi: float = 50.0) -> float:
    return math.exp(max(lo, min(hi, x)))


def _clamp(value: float, lo: float, hi: float) -> float:
    if math.isnan(value) or math.isinf(value):
        return lo
    return max(lo, min(hi, value))


def _decimal_hour_local(start_ms: int, tz: ZoneInfo) -> float:
    dt = datetime.fromtimestamp(start_ms / 1000.0, tz=timezone.utc).astimezone(tz)
    return dt.hour + dt.minute / 60.0 + dt.second / 3600.0 + dt.microsecond / 3_600_000_000.0


def _is_daylight_biological_hour(t_h: float) -> bool:
    return DAYLIGHT_START_H <= t_h < DAYLIGHT_END_H


def _circadian_alertness_drive(t_h: float) -> float:
    """
    Two-harmonic Folkard circadian alertness drive (Process C).
    Captures afternoon dip and deep 02:00–05:30 circadian nadir via cosine superposition.
    """
    primary = A1 * math.cos(2.0 * math.pi * (t_h - PHI1) / 24.0)
    secondary = A2 * math.cos(2.0 * math.pi * (t_h - PHI2) / 12.0)
    wave = primary + secondary
    return _clamp((wave + C_MAX) / (2.0 * C_MAX), 0.0, 1.0)


def _circadian_impairment(c_alert: float) -> float:
    """Circadian fatigue contribution (inverse of alertness drive)."""
    return 1.0 - c_alert


def _rest_recovery_rate(block: TimelineBlock, t_h: float) -> float:
    rate = CHI_S
    if _is_daylight_biological_hour(t_h):
        rate *= 0.75  # 25% daytime rest penalty
    enrich = block.enrichment
    if enrich is not None:
        if enrich.extreme_heat or (
            enrich.temp_c is not None and enrich.temp_c >= EXTREME_HEAT_C
        ):
            rate *= 0.60
        if enrich.extreme_cold or (
            enrich.temp_c is not None and enrich.temp_c <= EXTREME_COLD_C
        ):
            rate *= 0.70
    return rate


def _workload_coefficient(continuous_work_hours: float) -> float:
    return 1.0 + MU * max(0.0, continuous_work_hours)


def _normalize_component(value: float, ceiling: float) -> float:
    return round(_clamp(value / ceiling, 0.0, 1.0) * 100.0, 2)


def _combined_pct(s_t: float, c_alert: float, w_t: float) -> int:
    """
    TPMA net alertness capacity: C - S - W (Åkerstedt/Folkard).
    Mapped to 0–100 impairment where higher = higher risk (conservative for auditors).
    """
    c_t = _circadian_impairment(c_alert)
    alertness_capacity = c_alert - s_t - w_t
    normalized_capacity = _clamp(alertness_capacity, -0.5, 1.0)
    impairment = 1.0 - (normalized_capacity + 0.5) / 1.5
    pct = int(round(_clamp(impairment, 0.0, 1.0) * 100.0))
    return max(0, min(100, pct))


def _risk_band(combined_pct: int) -> str:
    if combined_pct <= 35:
        return "low"
    if combined_pct <= 54:
        return "monitor"
    if combined_pct <= 74:
        return "elevated"
    return "critical"


def _progressive_breach(
    block: TimelineBlock,
    continuous_work_hours: float,
    combined_pct: int,
    as_of_ms: int,
) -> ProspectiveRegisterItem | None:
    if block.start_ms <= as_of_ms:
        return None

    triggered_level = None
    summary = None
    attribution = None

    if combined_pct >= 75:
        triggered_level = "critical"
        summary = (
            f"TPMA combined impairment {combined_pct}% in critical band "
            f"(≥75) — severe micro-sleep risk zone."
        )
        attribution = (
            "Three-Process Model (Åkerstedt/Folkard): homeostatic S + circadian C + "
            "sleep inertia W exceeded Dawson-Reid 0.10% BAC parity coaching threshold."
        )
    else:
        for hours, level, msg in reversed(PROGRESSIVE_THRESHOLDS_H):
            if continuous_work_hours >= hours:
                triggered_level = level
                summary = msg
                attribution = (
                    f"Progressive Compression Fatigue Model: continuous work leg "
                    f"{continuous_work_hours:.2f} h crossed {hours} h threshold "
                    f"(TPMA dynamic χ_w with μ={MU})."
                )
                break

    if triggered_level is None:
        return None

    return ProspectiveRegisterItem(
        segment_id=f"frms-{block.start_ms}",
        block_start_ms=block.start_ms,
        risk_level=triggered_level,  # type: ignore[arg-type]
        summary=summary or "",
        attribution=attribution or "",
        continuous_work_hours=round(continuous_work_hours, 2),
        combined_pct=combined_pct,
    )


def calculate_frms_metrics(
    blocks: List[TimelineBlock],
    timezone_str: str,
    *,
    as_of_ms: int | None = None,
) -> Tuple[List[SnapshotResponse], List[ProspectiveRegisterItem]]:
    """
    Run TPMA across chronological 15-minute timeline blocks.

    Returns snapshot series (all blocks) and prospective register items (future blocks only).
    """
    if not blocks:
        return [], []

    tz = ZoneInfo(timezone_str)
    sorted_blocks = sorted(blocks, key=lambda b: b.start_ms)
    now_ms = as_of_ms if as_of_ms is not None else int(datetime.now(tz=timezone.utc).timestamp() * 1000)

    s_t = 0.0
    continuous_work_hours = 0.0
    continuous_rest_hours = 0.0
    time_since_wakeup = 0.0
    is_in_inertia = False
    was_resting = False

    snapshots: List[SnapshotResponse] = []
    prospective_register: List[ProspectiveRegisterItem] = []
    seen_register_ids: set[str] = set()

    for block in sorted_blocks:
        t_h = _decimal_hour_local(block.start_ms, tz)
        c_alert = _circadian_alertness_drive(t_h)
        c_t = _circadian_impairment(c_alert)

        if block.is_rest:
            continuous_rest_hours += BLOCK_HOURS
            continuous_work_hours = 0.0
            recovery = _rest_recovery_rate(block, t_h)
            s_t = _clamp(s_t * _safe_exp(-recovery), 0.0, S_MAX)
            was_resting = True
        elif block.is_work:
            if was_resting and continuous_rest_hours >= BLOCK_HOURS:
                is_in_inertia = True
                time_since_wakeup = 0.0
            was_resting = False
            continuous_rest_hours = 0.0
            continuous_work_hours += BLOCK_HOURS
            dynamic_chi_w = CHI_W * _workload_coefficient(continuous_work_hours)
            s_t = _clamp(s_t + dynamic_chi_w, 0.0, S_MAX)
        else:
            was_resting = False

        w_t = 0.0
        if is_in_inertia:
            w_t = W_0 * _safe_exp(-CHI_I * time_since_wakeup)
            time_since_wakeup += 1.0
            if w_t < 0.01:
                is_in_inertia = False
                w_t = 0.0

        combined = _combined_pct(s_t, c_alert, w_t)
        band = _risk_band(combined)

        workload_pct = _normalize_component(
            _workload_coefficient(continuous_work_hours) - 1.0,
            MU * 12.0,
        )

        snapshots.append(
            SnapshotResponse(
                block_start_ms=block.start_ms,
                process_s_pct=_normalize_component(s_t, S_MAX),
                process_c_pct=round(c_t * 100.0, 2),
                model_pct=workload_pct if block.is_work else 0.0,
                combined_pct=combined,
                band=band,  # type: ignore[arg-type]
            )
        )

        breach = _progressive_breach(block, continuous_work_hours, combined, now_ms)
        if breach is not None and breach.segment_id not in seen_register_ids:
            prospective_register.append(breach)
            seen_register_ids.add(breach.segment_id)

    return snapshots, prospective_register
