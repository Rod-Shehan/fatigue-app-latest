-- Additive only. Per-user checklist PDF destination (Settings).
-- Empty / null = fall back to User.email (login).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "checklistDeliveryEmail" TEXT;
