-- AlterTable
ALTER TABLE "HouseMarker" ADD COLUMN IF NOT EXISTS "excluded_recipient_names" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
