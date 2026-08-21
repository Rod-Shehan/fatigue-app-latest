"""frms-py-2 dual-layer constants.

Layer 1 (TPMA): Process S holds during awake rest; decays only on nap/sleep.
Layer 2 (TSI): Δt in minutes — β=0.055 ⇒ 20 min clears ~67% strain, 30 min ~81%.
"""

from __future__ import annotations

BLOCK_MINUTES = 15.0
BLOCK_HOURS = BLOCK_MINUTES / 60.0

# Process S (0–1 homeostatic pressure)
S_MIN = 0.0
S_MAX = 1.0
# Saturating wake buildup per hour (toward S_MAX)
K_I_PER_HOUR = 0.12
# Nap recovery toward S_MIN; slower in biological daylight
K_R_NIGHT_PER_HOUR = 1.2
K_R_DAY_FACTOR = 0.75
MU_WORK = 0.015  # extra depletion per continuous on-duty hour

# Process C — two-harmonic Folkard (same family as frms-py-1)
A1 = 0.14
PHI1 = 16.75
A2 = 0.04
PHI2 = 14.50
C_ALERT_BASE = 0.84  # Folkard C modulates a high mean; not a 0–1 full-scale swing
C_ALERT_MIN = 0.50
DAYLIGHT_START_H = 6.0
DAYLIGHT_END_H = 18.0

# Process W — inertia only after nap → on-duty
W_MAX = 0.35
ETA_NAP_PER_HOUR = 2.0
LAMBDA_W_PER_MIN = 0.08  # ~15–45 min dissipation

# Task-strain index (0–100). Δt is minutes.
ALPHA_STRAIN_PER_MIN = 0.015
BETA_STRAIN_PER_MIN = 0.055
GAMMA_DRIVING = 1.0
GAMMA_HEAVY_LABOR = 1.2
GAMMA_LIGHT_DUTY = 0.5

# Fusion
W_STRAIN = 0.20

# Self-report bump (assurance; same scale as frms-py-1)
SELF_REPORT_FACTORS = {1: 0.05, 2: 0.25, 3: 0.5, 4: 0.75, 5: 1.0}
SELF_REPORT_BUMP_SCALE = 28

# Coaching bands (unchanged)
BAND_LOW_MAX = 35
BAND_MONITOR_MAX = 54
BAND_ELEVATED_MAX = 74

ENGINE_VERSION = "frms-py-2"
MODEL_VERSION = "tpma-dual-layer-tsi-1"
