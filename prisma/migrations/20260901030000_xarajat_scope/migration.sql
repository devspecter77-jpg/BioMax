-- AlterTable
ALTER TABLE "xarajatlar" ADD COLUMN IF NOT EXISTS "egaId" TEXT;
ALTER TABLE "xarajatlar" ADD COLUMN IF NOT EXISTS "filialId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "xarajatlar_filialId_idx" ON "xarajatlar"("filialId");
CREATE INDEX IF NOT EXISTS "xarajatlar_egaId_idx" ON "xarajatlar"("egaId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "xarajatlar" ADD CONSTRAINT "xarajatlar_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "xarajatlar" ADD CONSTRAINT "xarajatlar_egaId_fkey" FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
