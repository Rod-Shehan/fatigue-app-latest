-- Verified distraction trigger capture on manager / Command triage.
ALTER TABLE "CameraAlertTriage"
  ADD COLUMN IF NOT EXISTS "verifiedDistractionReasons" JSONB;
