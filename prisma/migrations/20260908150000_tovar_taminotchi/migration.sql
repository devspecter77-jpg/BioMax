-- Mahsulotning yetkazib beruvchisi. Ixtiyoriy — mavjud tovarlarda NULL
-- bo'lib qoladi, hech narsa buzilmaydi.

ALTER TABLE "tovarlar" ADD COLUMN IF NOT EXISTS "taminotchiId" TEXT;
CREATE INDEX IF NOT EXISTS "tovarlar_taminotchiId_idx" ON "tovarlar"("taminotchiId");

ALTER TABLE "tovarlar" ADD CONSTRAINT "tovarlar_taminotchiId_fkey"
  FOREIGN KEY ("taminotchiId") REFERENCES "taminotchilar"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
