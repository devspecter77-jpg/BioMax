-- Ta'minotchiga yuborilgan mahsulot so'rovi (buyurtma).
-- Faqat qo'shimcha: ikkita yangi jadval, mavjud ma'lumot tegilmaydi.
CREATE TABLE "taminotchi_sorovlari" (
    "id" TEXT NOT NULL,
    "taminotchiId" TEXT NOT NULL,
    "matn" TEXT NOT NULL,
    "qoshimchaIzoh" TEXT,
    "telefon" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "xato" TEXT,
    "urinishSoni" INTEGER NOT NULL DEFAULT 0,
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yuborilganSana" TIMESTAMP(3),
    "foydalanuvchiId" TEXT NOT NULL,
    "filialId" TEXT,
    "egaId" TEXT,

    CONSTRAINT "taminotchi_sorovlari_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "taminotchi_sorov_tarkibi" (
    "id" TEXT NOT NULL,
    "sorovId" TEXT NOT NULL,
    "tovarId" TEXT,
    "nomi" TEXT NOT NULL,
    "miqdor" DECIMAL(12,3) NOT NULL,
    "birlik" TEXT NOT NULL DEFAULT 'DONA',
    "izoh" TEXT,

    CONSTRAINT "taminotchi_sorov_tarkibi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "taminotchi_sorovlari_taminotchiId_sana_idx" ON "taminotchi_sorovlari"("taminotchiId", "sana");
CREATE INDEX "taminotchi_sorovlari_filialId_idx" ON "taminotchi_sorovlari"("filialId");
CREATE INDEX "taminotchi_sorovlari_egaId_idx" ON "taminotchi_sorovlari"("egaId");
CREATE INDEX "taminotchi_sorov_tarkibi_sorovId_idx" ON "taminotchi_sorov_tarkibi"("sorovId");

ALTER TABLE "taminotchi_sorovlari" ADD CONSTRAINT "taminotchi_sorovlari_taminotchiId_fkey"
    FOREIGN KEY ("taminotchiId") REFERENCES "taminotchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "taminotchi_sorovlari" ADD CONSTRAINT "taminotchi_sorovlari_foydalanuvchiId_fkey"
    FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "taminotchi_sorovlari" ADD CONSTRAINT "taminotchi_sorovlari_filialId_fkey"
    FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "taminotchi_sorovlari" ADD CONSTRAINT "taminotchi_sorovlari_egaId_fkey"
    FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "taminotchi_sorov_tarkibi" ADD CONSTRAINT "taminotchi_sorov_tarkibi_sorovId_fkey"
    FOREIGN KEY ("sorovId") REFERENCES "taminotchi_sorovlari"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "taminotchi_sorov_tarkibi" ADD CONSTRAINT "taminotchi_sorov_tarkibi_tovarId_fkey"
    FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
