"""Pydantic contracts aligned with Next.js FrmsTimelinePayload / FrmsPythonResponse."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.constants import ENGINE_VERSION, MODEL_VERSION


class BlockEnrichment(BaseModel):
    """Optional per-block modifiers (weather, roster context)."""

    temp_c: Optional[float] = None
    extreme_heat: Optional[bool] = None
    extreme_cold: Optional[bool] = None


class TimelineBlock(BaseModel):
    start_ms: int
    is_work: bool
    is_rest: bool
    is_other_work: bool = False
    is_nap: bool = False
    sub_type: Optional[str] = None
    enrichment: Optional[BlockEnrichment] = None
    alertness_level: Optional[int] = Field(None, ge=1, le=5)


class SnapshotResponse(BaseModel):
    block_start_ms: int
    process_s_pct: float
    process_c_pct: float
    model_pct: Optional[float] = None
    combined_pct: int = Field(ge=0, le=100)
    band: Literal["low", "monitor", "elevated", "critical"]
    process_s: Optional[float] = None
    process_c: Optional[float] = None
    process_w: Optional[float] = None
    tpma_biological_impairment: Optional[float] = None
    task_strain_index: Optional[float] = None
    effective_combined_risk: Optional[float] = None
    is_nap: bool = False
    activity_label: Optional[str] = None
    task_strain_relief_active: bool = False
    biological_sleep_deprived: bool = False


class ProspectiveRegisterItem(BaseModel):
    segment_id: str
    block_start_ms: int
    risk_level: Literal["monitor", "elevated", "critical"]
    summary: str
    attribution: str
    continuous_work_hours: float
    combined_pct: int = Field(ge=0, le=100)
    model_reference: str = "TPMA-dual-layer-TSI-v1"


class FrmsMetricsResult(BaseModel):
    snapshots: list[SnapshotResponse]
    prospective_register: list[ProspectiveRegisterItem]
    engine_version: str = ENGINE_VERSION
    model_version: str = MODEL_VERSION
