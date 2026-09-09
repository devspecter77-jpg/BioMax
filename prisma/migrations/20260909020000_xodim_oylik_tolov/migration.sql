-- Xodim oyligi va to'lovlari. Faqat qo'shimcha: yangi enum, yangi jadval
-- va foydalanuvchilarga ixtiyoriy `oylikMaosh` ustuni.
CREATE TYPE "XodimTolovTuri" AS ENUM ('OYLIK', 'BONUS', 'AVANS', 'JARIMA');

ALTER TABLE "foydalanuvchilar" ADD COLUMN "oylikMaosh" DECIMAL(12,2);

CREATE TABLE "xodim_tolovlari" (
    "id" TEXT NOT NULL,
    "xodimId" TEXT NOT NULL,
    "turi" "XodimTolovTuri" NOT NULL,
    "summa" DECIMAL(12,2) NOT NULL,
    "davr" TEXT,
    "izoh" TEXT,
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yaratganId" TEXT NOT NULL,
    "filialId" TEXT,
    "egaId" TEXT,
    "xarajatId" TEXT,

    CONSTRAINT "xodim_tolovlari_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "xodim_tolovlari_xarajatId_key" ON "xodim_tolovlari"("xarajatId");
CREATE INDEX "xodim_tolovlari_xodimId_sana_idx" ON "xodim_tolovlari"("xodimId", "sana");
CREATE INDEX "xodim_tolovlari_filialId_idx" ON "xodim_tolovlari"("filialId");
CREATE INDEX "xodim_tolovlari_davr_idx" ON "xodim_tolovlari"("davr");

ALTER TABLE "xodim_tolovlari" ADD CONSTRAINT "xodim_tolovlari_xodimId_fkey"
    FOREIGN KEY ("xodimId") REFERENCES "foydalanuvchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "xodim_tolovlari" ADD CONSTRAINT "xodim_tolovlari_yaratganId_fkey"
    FOREIGN KEY ("yaratganId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "xodim_tolovlari" ADD CONSTRAINT "xodim_tolovlari_filialId_fkey"
    FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "xodim_tolovlari" ADD CONSTRAINT "xodim_tolovlari_xarajatId_fkey"
    FOREIGN KEY ("xarajatId") REFERENCES "xarajatlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
