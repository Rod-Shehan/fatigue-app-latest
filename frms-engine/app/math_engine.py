# RULE IP — Do not change fatigue time/compliance rule logic without explicit owner approval.
# See .cursor/rules/time-rules-ip.mdc
"""
Circadia FRMS math entry — frms-py-2 dual-layer engine.

Layer 1: TPMA (S, C, W). Process S decays only on nap/sleep; awake rest holds S.
Layer 2: Task-Strain Index (TSI) for visible break sawtooth.
Fusion: TSI may raise combined risk but never below the TPMA biological floor.

Peer-reviewed foundations (Process S / C / W):
  - Åkerstedt & Folkard (1990); Van Dongen et al. (2003)
  - Circadian two-harmonic: Folkard & Akerstedt (1992)
  - Dawson-Reid BAC equivalence bands: Dawson & Reid (1997) — coaching only

Assurance-only outputs — not statutory compliance verdicts.
"""

from app.pipeline import calculate_frms_metrics

__all__ = ["calculate_frms_metrics"]
