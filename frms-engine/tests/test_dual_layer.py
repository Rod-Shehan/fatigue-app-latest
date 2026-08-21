# Dual-layer frms-py-2: biological Process S vs acute task-strain.
"""Integration tests for TPMA hold-on-awake-rest + TSI sawtooth + fusion floor."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.constants import BETA_STRAIN_PER_MIN
from app.math_engine import calculate_frms_metrics
from app.models.task_strain import step_task_strain
from app.pipeline import fuse_effective_risk
from app.schemas import TimelineBlock
from app.tpma.process_s import step_process_s

TZ = "Australia/Perth"
PERTH = ZoneInfo(TZ)
BLOCK_MS = 15 * 60 * 1000


def _ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _blocks(start: datetime, n: int, **flags) -> list[TimelineBlock]:
    return [
        TimelineBlock(start_ms=_ms(start + timedelta(minutes=15 * i)), **flags)
        for i in range(n)
    ]


def test_awake_break_drops_combined_risk_but_holds_process_s():
    start = datetime(2026, 8, 21, 10, 0, tzinfo=PERTH)
    work = _blocks(start, 16, is_work=True, is_rest=False)
    rest = _blocks(start + timedelta(hours=4), 2, is_work=False, is_rest=True)
    snaps, _ = calculate_frms_metrics(work + rest, TZ, as_of_ms=_ms(start))

    last_work = snaps[15]
    first_rest = snaps[16]
    second_rest = snaps[17]

    assert first_rest.effective_combined_risk < last_work.effective_combined_risk
    assert second_rest.effective_combined_risk < first_rest.effective_combined_risk
    assert first_rest.process_s == last_work.process_s
    assert second_rest.process_s == last_work.process_s
    assert first_rest.task_strain_index < last_work.task_strain_index
    assert first_rest.task_strain_relief_active is True


def test_awake_break_does_not_decay_process_s_direct():
    s = 0.55
    s_next = step_process_s(
        s, is_nap=False, is_on_duty=False, continuous_work_hours=0.0, t_h=14.0
    )
    assert s_next == s


def test_thirty_minute_nap_reduces_s_and_triggers_w():
    start = datetime(2026, 8, 21, 14, 0, tzinfo=PERTH)
    work = _blocks(start, 8, is_work=True, is_rest=False)
    nap = _blocks(
        start + timedelta(hours=2),
        2,
        is_work=False,
        is_rest=True,
        is_nap=True,
        sub_type="nap",
    )
    resume = _blocks(
        start + timedelta(hours=2, minutes=30),
        1,
        is_work=True,
        is_rest=False,
    )
    snaps, _ = calculate_frms_metrics(work + nap + resume, TZ, as_of_ms=_ms(start))

    last_work = snaps[7]
    last_nap = snaps[9]
    first_work_after = snaps[10]

    assert last_nap.process_s < last_work.process_s
    assert last_nap.process_w == 0.0
    assert first_work_after.process_w > 0.0
    assert first_work_after.is_nap is False


def test_awake_break_then_work_does_not_trigger_inertia():
    start = datetime(2026, 8, 21, 10, 0, tzinfo=PERTH)
    work = _blocks(start, 4, is_work=True, is_rest=False)
    rest = _blocks(start + timedelta(hours=1), 2, is_work=False, is_rest=True)
    resume = _blocks(start + timedelta(hours=1, minutes=30), 1, is_work=True, is_rest=False)
    snaps, _ = calculate_frms_metrics(work + rest + resume, TZ, as_of_ms=_ms(start))
    assert snaps[-1].process_w == 0.0


def test_nadir_awake_break_clears_strain_but_stays_on_tpma_floor():
    """03:00 Perth: TSI discharges; combined risk cannot fall below biological TPMA."""
    start = datetime(2026, 8, 21, 22, 0, tzinfo=PERTH)
    work = _blocks(start, 20, is_work=True, is_rest=False)  # 22:00–03:00
    rest = _blocks(start + timedelta(hours=5), 2, is_work=False, is_rest=True)
    snaps, _ = calculate_frms_metrics(work + rest, TZ, as_of_ms=_ms(start))

    last_work = snaps[19]
    last_rest = snaps[21]
    assert last_work.block_start_ms == _ms(datetime(2026, 8, 22, 2, 45, tzinfo=PERTH))
    assert last_rest.task_strain_index < last_work.task_strain_index
    assert last_rest.effective_combined_risk >= last_rest.tpma_biological_impairment
    assert last_rest.tpma_biological_impairment >= 40
    assert last_rest.effective_combined_risk >= last_rest.tpma_biological_impairment


def test_fusion_never_below_tpma_floor():
    assert fuse_effective_risk(60.0, 0.0) == 60.0
    raised = fuse_effective_risk(60.0, 80.0)
    assert raised > 60.0
    assert raised < 100.0


def test_twenty_minute_break_clears_about_two_thirds_of_strain():
    remaining = step_task_strain(
        80.0,
        is_on_duty=False,
        is_recovery=True,
        is_work=False,
        is_other_work=False,
        sub_type=None,
        delta_minutes=20.0,
    )
    cleared = 1.0 - remaining / 80.0
    assert 0.62 < cleared < 0.72
    import math

    assert abs(remaining - 80.0 * math.exp(-BETA_STRAIN_PER_MIN * 20.0)) < 1e-9
