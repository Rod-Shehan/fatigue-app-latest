-- Add From/To columns for route catalogue (run once on Neon if db push was not applied).
ALTER TABLE "RoutePreset" ADD COLUMN IF NOT EXISTS "startLocation" TEXT;
ALTER TABLE "RoutePreset" ADD COLUMN IF NOT EXISTS "destination" TEXT;
