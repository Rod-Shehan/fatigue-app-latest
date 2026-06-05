"""FastAPI entry — POST /v1/risk-profile."""

from __future__ import annotations

import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.math_engine import calculate_frms_metrics
from app.schemas import BlockEnrichment, TimelineBlock

app = FastAPI(title="Circadia FRMS Engine", version="frms-py-1")


class TimelineBlockIn(BaseModel):
    start_ms: int
    is_work: bool
    is_rest: bool
    enrichment: BlockEnrichment | None = None


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
def health() -> dict[str, str]:
    return {"status": "ok", "engine": "frms-py-1"}


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
            enrichment=b.enrichment,
        )
        for b in body.timeline_blocks
    ]

    snapshots, register = calculate_frms_metrics(
        blocks,
        body.timezone,
        as_of_ms=body.as_of_ms,
    )

    return {
        "engine_version": "frms-py-1",
        "model_version": "tpma-progressive-compression-1",
        "prospective_register": {
            "baselineHeadroomHours": 0.0,
            "entries": [item.model_dump() for item in register],
            "worstLevel": _worst_level(register),
            "driverHint": _driver_hint(register),
        },
        "snapshots": [
            {
                "block_start_ms": s.block_start_ms,
                "process_s_pct": s.process_s_pct,
                "process_c_pct": s.process_c_pct,
                "model_pct": s.model_pct,
                "combined_pct": s.combined_pct,
                "band": s.band,
            }
            for s in snapshots
        ],
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
