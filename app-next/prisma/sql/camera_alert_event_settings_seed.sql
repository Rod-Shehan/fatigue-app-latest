-- Verify CameraAlertEventSettings exists (no-op if already seeded).
INSERT INTO "CameraAlertEventSettings" ("id", "enabledAlarmIds", "updatedAt", "createdAt")
VALUES (
    'default',
    '["VT3600AI_ALARM_DSM_Fatigue","VT3600AI_ALARM_DSM_Distracted","VT3600AI_ALARM_ADAS_LaneDeparture","VT3600AI_ALARM_ADAS_FollowingDistanceWarning","VT3600AI_ALARM_ADAS_ForwardCollisionWarning"]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
