"""frms-py-2 pipeline: TPMA biological floor + TSI overlay + fusion."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Tuple
from zoneinfo import ZoneInfo

from app.constants import (
    BAND_ELEVATED_MAX,
    BAND_LOW_MAX,
    BAND_MONITOR_MAX,
    BLOCK_HOURS,
    S_MAX,
    SELF_REPORT_BUMP_SCALE,
    SELF_REPORT_FACTORS,
    W_STRAIN,
)
from app.models.task_strain import step_task_strain
from app.schemas import ProspectiveRegisterItem, SnapshotResponse, TimelineBlock
from app.tpma.process_c import circadian_alertness_drive, circadian_impairment, decimal_hour_local
from app.tpma.process_s import step_process_s
from app.tpma.process_w import decay_inertia, initial_inertia


def _clamp_pct(value: float) -> float:
    return max(0.0, min(100.0, value))


def _risk_band(combined_pct: int) -> str:
    if combined_pct <= BAND_LOW_MAX:
        return "low"
    if combined_pct <= BAND_MONITOR_MAX:
        return "monitor"
    if combined_pct <= BAND_ELEVATED_MAX:
        return "elevated"
    return "critical"


def _self_report_bump(level: int | None) -> int:
    if level is None or level < 1 or level > 5:
        return 0
    factor = SELF_REPORT_FACTORS.get(level, 0.0)
    return int(round(factor * SELF_REPORT_BUMP_SCALE))


def tpma_biological_impairment(s_t: float, c_alert: float, w_t: float) -> float:
    """R_tpma from 1 − C_alert + S + W, clamped to 0–100%."""
    raw = 1.0 - c_alert + s_t + w_t
    return round(_clamp_pct(raw * 100.0), 2)


def fuse_effective_risk(r_tpma: float, task_strain: float, w_strain: float = W_STRAIN) -> float:
    """TSI may raise the trajectory but never pull below the biological floor."""
    t_norm = max(0.0, min(100.0, task_strain)) / 100.0
    r = r_tpma + (100.0 - r_tpma) * t_norm * w_strain
    return round(max(r_tpma, _clamp_pct(r)), 2)


def _is_nap(block: TimelineBlock) -> bool:
    if block.is_nap:
        return True
    kind = (block.sub_type or "").strip().lower()
    return kind in ("nap", "sleep")


def _is_other_work(block: TimelineBlock) -> bool:
    if block.is_other_work:
        return True
    kind = (block.sub_type or "").strip().lower()
    return kind in ("heavy_labor", "light_duty", "loading", "administrative", "paperwork", "admin")


def calculate_frms_metrics(
    blocks: List[TimelineBlock],
    timezone_str: str,
    *,
    as_of_ms: int | None = None,
) -> Tuple[List[SnapshotResponse], List[ProspectiveRegisterItem]]:
    if not blocks:
        return [], []

    tz = ZoneInfo(timezone_str)
    sorted_blocks = sorted(blocks, key=lambda b: b.start_ms)
    now_ms = as_of_ms if as_of_ms is not None else int(datetime.now(tz=timezone.utc).timestamp() * 1000)

    s_t = 0.0
    t_strain = 0.0
    w_t = 0.0
    continuous_work_hours = 0.0
    nap_hours = 0.0
    prev_was_nap = False

    snapshots: List[SnapshotResponse] = []
    prospective_register: List[ProspectiveRegisterItem] = []
    seen_register_ids: set[str] = set()

    for block in sorted_blocks:
        t_h = decimal_hour_local(block.start_ms, tz)
        c_alert = circadian_alertness_drive(t_h)
        c_imp = circadian_impairment(c_alert)

        is_nap = _is_nap(block)
        is_other = _is_other_work(block)
        is_on_duty = block.is_work or is_other
        # Unlogged tape is non-work on the rolling timeline: TSI discharges.
        is_recovery = not is_on_duty

        if is_nap:
            nap_hours += BLOCK_HOURS
            continuous_work_hours = 0.0
            w_t = 0.0
        elif is_on_duty:
            if prev_was_nap:
                w_t = initial_inertia(nap_hours)
            else:
                w_t = decay_inertia(w_t)
            continuous_work_hours += BLOCK_HOURS
            nap_hours = 0.0
        else:
            w_t = 0.0
            continuous_work_hours = 0.0
            nap_hours = 0.0

        s_t = step_process_s(
            s_t,
            is_nap=is_nap,
            is_on_duty=is_on_duty,
            continuous_work_hours=continuous_work_hours,
            t_h=t_h,
        )
        t_strain = step_task_strain(
            t_strain,
            is_on_duty=is_on_duty,
            is_recovery=is_recovery,
            is_work=block.is_work and not is_other,
            is_other_work=is_other,
            sub_type=block.sub_type,
        )

        r_tpma = tpma_biological_impairment(s_t, c_alert, w_t)
        r_tpma = min(100.0, r_tpma + _self_report_bump(block.alertness_level))
        r_eff = fuse_effective_risk(r_tpma, t_strain)
        combined = int(round(r_eff))
        band = _risk_band(combined)

        if is_nap:
            activity = "nap"
        elif is_other:
            activity = "other_work"
        elif block.is_work:
            activity = "work"
        elif block.is_rest:
            activity = "break"
        else:
            activity = "idle"

        snapshots.append(
            SnapshotResponse(
                block_start_ms=block.start_ms,
                process_s_pct=round((s_t / S_MAX) * 100.0, 2),
                process_c_pct=round(c_imp * 100.0, 2),
                model_pct=round(t_strain, 2),
                combined_pct=combined,
                band=band,  # type: ignore[arg-type]
                process_s=round(s_t, 3),
                process_c=round(c_alert, 3),
                process_w=round(w_t, 3),
                tpma_biological_impairment=round(r_tpma, 2),
                task_strain_index=round(t_strain, 2),
                effective_combined_risk=r_eff,
                is_nap=is_nap,
                activity_label=activity,
                task_strain_relief_active=bool(is_recovery and not is_on_duty and t_strain > 0.5),
                biological_sleep_deprived=bool(s_t >= 0.45 or r_tpma >= 55),
            )
        )

        if block.start_ms > now_ms:
            breach = _progressive_item(block, continuous_work_hours, combined, r_tpma)
            if breach is not None and breach.segment_id not in seen_register_ids:
                prospective_register.append(breach)
                seen_register_ids.add(breach.segment_id)

        prev_was_nap = is_nap

    return snapshots, prospective_register


def _progressive_item(
    block: TimelineBlock,
    continuous_work_hours: float,
    combined_pct: int,
    r_tpma: float,
) -> ProspectiveRegisterItem | None:
    if combined_pct >= 75:
        return ProspectiveRegisterItem(
            segment_id=f"frms-{block.start_ms}",
            block_start_ms=block.start_ms,
            risk_level="critical",
            summary=(
                f"Dual-layer impairment {combined_pct}% in critical band "
                f"(biological floor {r_tpma:.0f}%) — severe micro-sleep coaching zone."
            ),
            attribution=(
                "frms-py-2: TPMA biological floor (S, C, W) plus task-strain overlay. "
                "Awake breaks discharge strain only; they do not repay Process S."
            ),
            continuous_work_hours=round(continuous_work_hours, 2),
            combined_pct=combined_pct,
            model_reference="TPMA-dual-layer-TSI-v1",
        )
    if continuous_work_hours >= 10.0:
        level = "critical"
        msg = "Continuous on-duty leg ≥10 h — Dawson-Reid ~0.10% BAC-equivalence coaching band."
    elif continuous_work_hours >= 7.0:
        level = "elevated"
        msg = "Continuous on-duty leg ≥7 h — Dawson-Reid ~0.05% BAC-equivalence coaching band."
    elif continuous_work_hours >= 5.5:
        level = "monitor"
        msg = "Continuous on-duty leg exceeds 5.5 h — heightened monitoring (task-strain accumulation)."
    else:
        return None
    return ProspectiveRegisterItem(
        segment_id=f"frms-{block.start_ms}",
        block_start_ms=block.start_ms,
        risk_level=level,  # type: ignore[arg-type]
        summary=msg,
        attribution="frms-py-2 progressive compression on continuous work/other_work (TSI + S).",
        continuous_work_hours=round(continuous_work_hours, 2),
        combined_pct=combined_pct,
        model_reference="TPMA-dual-layer-TSI-v1",
    )


__all__ = ["calculate_frms_metrics", "fuse_effective_risk"]
