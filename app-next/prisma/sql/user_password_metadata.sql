-- Password set metadata for fleet admin support (who/when — not the secret).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordSetAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordSetById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_passwordSetById_fkey'
  ) THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_passwordSetById_fkey"
      FOREIGN KEY ("passwordSetById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
