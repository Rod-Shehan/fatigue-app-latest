"""Pydantic contracts aligned with Next.js FrmsTimelinePayload / FrmsPythonResponse."""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class BlockEnrichment(BaseModel):
    """Optional per-block modifiers (weather, roster context)."""

    temp_c: Optional[float] = None
    extreme_heat: Optional[bool] = None
    extreme_cold: Optional[bool] = None


class TimelineBlock(BaseModel):
    start_ms: int
    is_work: bool
    is_rest: bool
    enrichment: Optional[BlockEnrichment] = None


class SnapshotResponse(BaseModel):
    block_start_ms: int
    process_s_pct: float
    process_c_pct: float
    model_pct: Optional[float] = None
    combined_pct: int = Field(ge=0, le=100)
    band: Literal["low", "monitor", "elevated", "critical"]


class ProspectiveRegisterItem(BaseModel):
    segment_id: str
    block_start_ms: int
    risk_level: Literal["monitor", "elevated", "critical"]
    summary: str
    attribution: str
    continuous_work_hours: float
    combined_pct: int = Field(ge=0, le=100)
    model_reference: str = "TPMA-Folkard-Dawson-Reid-v1"


class FrmsMetricsResult(BaseModel):
    snapshots: list[SnapshotResponse]
    prospective_register: list[ProspectiveRegisterItem]
    engine_version: str = "frms-py-1"
    model_version: str = "tpma-progressive-compression-1"
