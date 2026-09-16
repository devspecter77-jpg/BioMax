-- Ta'minotchi bilan qo'lda yuritiladigan qarz daftari.
-- Faqat qo'shimcha: yangi enum va yangi jadval.
CREATE TYPE "TaminotchiQarzTuri" AS ENUM ('QARZ', 'TOLOV');

CREATE TABLE "taminotchi_qarzlari" (
    "id" TEXT NOT NULL,
    "taminotchiId" TEXT NOT NULL,
    "turi" "TaminotchiQarzTuri" NOT NULL,
    "summa" DECIMAL(12,2) NOT NULL,
    "tolovUsuli" "TolovUsuli",
    "izoh" TEXT,
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yaratganId" TEXT NOT NULL,
    "filialId" TEXT,
    "egaId" TEXT,

    CONSTRAINT "taminotchi_qarzlari_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "taminotchi_qarzlari_taminotchiId_sana_idx" ON "taminotchi_qarzlari"("taminotchiId", "sana");
CREATE INDEX "taminotchi_qarzlari_filialId_idx" ON "taminotchi_qarzlari"("filialId");

ALTER TABLE "taminotchi_qarzlari" ADD CONSTRAINT "taminotchi_qarzlari_taminotchiId_fkey"
    FOREIGN KEY ("taminotchiId") REFERENCES "taminotchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "taminotchi_qarzlari" ADD CONSTRAINT "taminotchi_qarzlari_yaratganId_fkey"
    FOREIGN KEY ("yaratganId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "taminotchi_qarzlari" ADD CONSTRAINT "taminotchi_qarzlari_filialId_fkey"
    FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
