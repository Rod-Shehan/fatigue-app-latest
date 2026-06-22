-- Manager-selected Autonomise alarm types for live alerts ingest + inbox (singleton).
CREATE TABLE IF NOT EXISTS "CameraAlertEventSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabledAlarmIds" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraAlertEventSettings_pkey" PRIMARY KEY ("id")
);
