-- AlterTable
ALTER TABLE "foydalanuvchilar"
  ADD COLUMN IF NOT EXISTS "tovarOchirishMumkin" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "tovarTahrirlashMumkin" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "ulashilganEgaId" TEXT;

-- AlterTable
ALTER TABLE "tovarlar" ADD COLUMN IF NOT EXISTS "egaId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "foydalanuvchilar_ulashilganEgaId_idx" ON "foydalanuvchilar"("ulashilganEgaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tovarlar_egaId_idx" ON "tovarlar"("egaId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "foydalanuvchilar" ADD CONSTRAINT "foydalanuvchilar_ulashilganEgaId_fkey" FOREIGN KEY ("ulashilganEgaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "tovarlar" ADD CONSTRAINT "tovarlar_egaId_fkey" FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
