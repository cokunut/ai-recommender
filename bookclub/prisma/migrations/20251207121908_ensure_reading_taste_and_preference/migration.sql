-- Ensure TagPreference enum and ReadingTasteTag table + preference column exist.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'TagPreference' AND n.nspname = 'public') THEN
    CREATE TYPE "TagPreference" AS ENUM ('LIKE','DISLIKE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ReadingTasteTag" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "preference" "TagPreference" NOT NULL DEFAULT 'LIKE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns if table exists already
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ReadingTasteTag' AND column_name='preference'
  ) THEN
    ALTER TABLE "ReadingTasteTag" ADD COLUMN "preference" "TagPreference" NOT NULL DEFAULT 'LIKE';
  END IF;
END $$;

-- Index + FK (create if not exists)
CREATE INDEX IF NOT EXISTS "ReadingTasteTag_userId_idx" ON "ReadingTasteTag"("userId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_name = 'ReadingTasteTag_userId_fkey'
  ) THEN
    ALTER TABLE "ReadingTasteTag" ADD CONSTRAINT "ReadingTasteTag_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
