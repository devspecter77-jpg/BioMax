-- Do'konning o'z qarzi (ta'minotchidan tashqari).
-- Faqat qo'shimcha: yangi enum va yangi jadval.
CREATE TYPE "DokonQarzTuri" AS ENUM ('QARZ', 'TOLOV');

CREATE TABLE "dokon_qarzlari" (
    "id" TEXT NOT NULL,
    "kimga" TEXT NOT NULL,
    "turi" "DokonQarzTuri" NOT NULL,
    "summa" DECIMAL(12,2) NOT NULL,
    "tolovUsuli" "TolovUsuli",
    "izoh" TEXT,
    "muddat" TIMESTAMP(3),
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yaratganId" TEXT NOT NULL,
    "filialId" TEXT,
    "egaId" TEXT,

    CONSTRAINT "dokon_qarzlari_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dokon_qarzlari_kimga_idx" ON "dokon_qarzlari"("kimga");
CREATE INDEX "dokon_qarzlari_sana_idx" ON "dokon_qarzlari"("sana");
CREATE INDEX "dokon_qarzlari_filialId_idx" ON "dokon_qarzlari"("filialId");

ALTER TABLE "dokon_qarzlari" ADD CONSTRAINT "dokon_qarzlari_yaratganId_fkey"
    FOREIGN KEY ("yaratganId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dokon_qarzlari" ADD CONSTRAINT "dokon_qarzlari_filialId_fkey"
    FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
