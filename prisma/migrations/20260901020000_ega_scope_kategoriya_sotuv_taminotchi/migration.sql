-- AlterTable
ALTER TABLE "kategoriyalar" ADD COLUMN IF NOT EXISTS "egaId" TEXT;
ALTER TABLE "sotuvlar" ADD COLUMN IF NOT EXISTS "egaId" TEXT;
ALTER TABLE "taminotchilar" ADD COLUMN IF NOT EXISTS "egaId" TEXT;

-- DropIndex (old two-column unique, replaced by three-column below)
DROP INDEX IF EXISTS "kategoriyalar_nomi_filialId_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "kategoriyalar_egaId_idx" ON "kategoriyalar"("egaId");
CREATE UNIQUE INDEX IF NOT EXISTS "kategoriyalar_nomi_filialId_egaId_key" ON "kategoriyalar"("nomi", "filialId", "egaId");
CREATE INDEX IF NOT EXISTS "sotuvlar_egaId_idx" ON "sotuvlar"("egaId");
CREATE INDEX IF NOT EXISTS "taminotchilar_egaId_idx" ON "taminotchilar"("egaId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "kategoriyalar" ADD CONSTRAINT "kategoriyalar_egaId_fkey" FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "sotuvlar" ADD CONSTRAINT "sotuvlar_egaId_fkey" FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "taminotchilar" ADD CONSTRAINT "taminotchilar_egaId_fkey" FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
