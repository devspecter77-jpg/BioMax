-- DropIndex
DROP INDEX IF EXISTS "kategoriyalar_nomi_key";

-- DropIndex
DROP INDEX IF EXISTS "tovarlar_shtrixKod_key";

-- AlterTable
ALTER TABLE "kategoriyalar" ADD COLUMN IF NOT EXISTS "filialId" TEXT;

-- AlterTable
ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "filialId" TEXT;

-- AlterTable
ALTER TABLE "sotuvlar" ADD COLUMN IF NOT EXISTS "filialId" TEXT;

-- AlterTable
ALTER TABLE "taminotchilar" ADD COLUMN IF NOT EXISTS "filialId" TEXT;

-- AlterTable
ALTER TABLE "tovarlar" ADD COLUMN IF NOT EXISTS "filialId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kategoriyalar_filialId_idx" ON "kategoriyalar"("filialId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "kategoriyalar_nomi_filialId_key" ON "kategoriyalar"("nomi", "filialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mijozlar_filialId_idx" ON "mijozlar"("filialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sotuvlar_filialId_idx" ON "sotuvlar"("filialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "taminotchilar_filialId_idx" ON "taminotchilar"("filialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tovarlar_filialId_idx" ON "tovarlar"("filialId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tovarlar_shtrixKod_filialId_key" ON "tovarlar"("shtrixKod", "filialId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "kategoriyalar" ADD CONSTRAINT "kategoriyalar_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "tovarlar" ADD CONSTRAINT "tovarlar_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "mijozlar" ADD CONSTRAINT "mijozlar_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "sotuvlar" ADD CONSTRAINT "sotuvlar_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "taminotchilar" ADD CONSTRAINT "taminotchilar_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
