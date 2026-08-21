# RULE IP — owner approval required before changing expected rule outcomes.
# See .cursor/rules/time-rules-ip.mdc
"""Unit tests for TPMA math engine."""

from app.math_engine import calculate_frms_metrics
from app.schemas import TimelineBlock


def test_empty_blocks():
    snaps, reg = calculate_frms_metrics([], "Australia/Perth")
    assert snaps == []
    assert reg == []


def test_work_accumulates_risk():
    base_ms = 1_700_000_000_000
    block_ms = 15 * 60 * 1000
    blocks = [
        TimelineBlock(start_ms=base_ms + i * block_ms, is_work=True, is_rest=False)
        for i in range(40)  # 10 h continuous work
    ]
    snaps, reg = calculate_frms_metrics(blocks, "Australia/Perth", as_of_ms=base_ms)
    assert len(snaps) == 40
    assert snaps[-1].process_s_pct > snaps[0].process_s_pct
    assert snaps[-1].task_strain_index > snaps[0].task_strain_index
    assert snaps[-1].band in ("elevated", "critical", "monitor")


def test_nap_recovers_homeostatic_pressure():
    """frms-py-2: Process S decays only on nap/sleep, not awake rest."""
    base_ms = 1_700_000_000_000
    block_ms = 15 * 60 * 1000
    work = [
        TimelineBlock(start_ms=base_ms + i * block_ms, is_work=True, is_rest=False)
        for i in range(8)
    ]
    nap = [
        TimelineBlock(
            start_ms=base_ms + (8 + i) * block_ms,
            is_work=False,
            is_rest=True,
            is_nap=True,
            sub_type="nap",
        )
        for i in range(8)
    ]
    snaps, _ = calculate_frms_metrics(work + nap, "Australia/Perth", as_of_ms=base_ms)
    assert snaps[7].process_s_pct > snaps[15].process_s_pct


def test_self_report_elevates_combined_pct():
    base_ms = 1_700_000_000_000
    block_ms = 15 * 60 * 1000
    blocks_low = [
        TimelineBlock(
            start_ms=base_ms + i * block_ms,
            is_work=True,
            is_rest=False,
            alertness_level=1,
        )
        for i in range(12)
    ]
    blocks_high = [
        TimelineBlock(
            start_ms=base_ms + i * block_ms,
            is_work=True,
            is_rest=False,
            alertness_level=5,
        )
        for i in range(12)
    ]
    snaps_low, _ = calculate_frms_metrics(blocks_low, "Australia/Perth", as_of_ms=base_ms)
    snaps_high, _ = calculate_frms_metrics(blocks_high, "Australia/Perth", as_of_ms=base_ms)
    assert snaps_high[-1].tpma_biological_impairment > snaps_low[-1].tpma_biological_impairment
    assert snaps_high[-1].combined_pct >= snaps_low[-1].combined_pct
    if snaps_low[-1].combined_pct < 100:
        assert snaps_high[-1].combined_pct > snaps_low[-1].combined_pct


def test_prospective_register_future_blocks_only():
    base_ms = 1_700_000_000_000
    block_ms = 15 * 60 * 1000
    as_of = base_ms + 20 * block_ms
    blocks = [
        TimelineBlock(start_ms=base_ms + i * block_ms, is_work=True, is_rest=False)
        for i in range(48)
    ]
    _, reg = calculate_frms_metrics(blocks, "Australia/Perth", as_of_ms=as_of)
    assert all(item.block_start_ms > as_of for item in reg)
