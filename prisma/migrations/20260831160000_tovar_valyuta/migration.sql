-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Valyuta" AS ENUM ('UZS', 'USD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "tovarlar" ADD COLUMN IF NOT EXISTS "valyuta" "Valyuta" NOT NULL DEFAULT 'UZS';
