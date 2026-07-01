-- Structured false-positive trigger capture on manager dismiss (export normalisation).
ALTER TABLE "CameraAlertTriage"
  ADD COLUMN IF NOT EXISTS "falsePositiveReasons" JSONB;
