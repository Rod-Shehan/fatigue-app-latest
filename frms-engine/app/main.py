"""FastAPI entry — POST /v1/risk-profile."""

from __future__ import annotations

import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.constants import ENGINE_VERSION, MODEL_VERSION
from app.math_engine import calculate_frms_metrics
from app.schemas import BlockEnrichment, TimelineBlock

app = FastAPI(title="Circadia FRMS Engine", version=ENGINE_VERSION)


class TimelineBlockIn(BaseModel):
    start_ms: int
    is_work: bool
    is_rest: bool
    is_other_work: bool = False
    is_nap: bool = False
    sub_type: str | None = None
    enrichment: BlockEnrichment | None = None
    alertness_level: int | None = Field(None, ge=1, le=5)


class RiskProfileRequest(BaseModel):
    schema_version: int = 1
    driver_name: str
    jurisdiction_code: str
    driver_type: str
    timezone: str = "Australia/Perth"
    as_of_ms: int
    horizon_from_ms: int
    horizon_to_ms: int
    week_starting: str
    timeline_blocks: list[TimelineBlockIn]
    enrichment: dict[str, Any] | None = None


def verify_api_key(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("FRMS_PYTHON_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=503, detail="FRMS_PYTHON_API_KEY not configured")
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "engine": ENGINE_VERSION,
        "model": MODEL_VERSION,
        "auth_configured": bool(os.environ.get("FRMS_PYTHON_API_KEY", "")),
    }


@app.post("/v1/risk-profile")
def risk_profile(
    body: RiskProfileRequest,
    _: None = Depends(verify_api_key),
) -> dict[str, Any]:
    blocks = [
        TimelineBlock(
            start_ms=b.start_ms,
            is_work=b.is_work,
            is_rest=b.is_rest,
            is_other_work=b.is_other_work,
            is_nap=b.is_nap,
            sub_type=b.sub_type,
            enrichment=b.enrichment,
            alertness_level=b.alertness_level,
        )
        for b in body.timeline_blocks
    ]

    snapshots, register = calculate_frms_metrics(
        blocks,
        body.timezone,
        as_of_ms=body.as_of_ms,
    )

    return {
        "engine_version": ENGINE_VERSION,
        "model_version": MODEL_VERSION,
        "prospective_register": {
            "baselineHeadroomHours": 0.0,
            "entries": [item.model_dump() for item in register],
            "worstLevel": _worst_level(register),
            "driverHint": _driver_hint(register),
        },
        "snapshots": [s.model_dump() for s in snapshots],
    }


def _worst_level(register: list) -> str | None:
    order = {"monitor": 1, "elevated": 2, "critical": 3}
    worst = None
    score = 0
    for item in register:
        s = order.get(item.risk_level, 0)
        if s > score:
            score = s
            worst = item.risk_level
    return worst


def _driver_hint(register: list) -> str | None:
    if not register:
        return None
    return register[-1].summary
