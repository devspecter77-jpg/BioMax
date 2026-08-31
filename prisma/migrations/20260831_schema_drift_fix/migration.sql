-- Drift tuzatish #2: schema.prisma bilan migratsiya tarixi orasidagi
-- qolgan farqlar (production'da migratsiyasiz qo'shilgan o'zgarishlar).
-- Har bir buyruq xavfsiz (idempotent) — qayta ishga tushirilsa ham xato bermaydi,
-- shu jumladan bu ustunlar/jadvallar allaqachon mavjud production'da ham.

-- Yetishmayotgan enum qiymati
ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'SOTUVCHI';

-- Nasiya: "bekor qilingan/o'chirilgan" belgisi
ALTER TABLE "nasiyalar" ADD COLUMN IF NOT EXISTS "ochirilgan" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "nasiyalar_holati_muddat_idx" ON "nasiyalar"("holati", "muddat");

-- SherikdanOlish: sotuvId ixtiyoriy bo'lishi kerak
ALTER TABLE "sherikdan_olish" ALTER COLUMN "sotuvId" DROP NOT NULL;

-- Hech qachon migratsiya qilinmagan ikkita jadval
CREATE TABLE IF NOT EXISTS "nasiya_qarz_tarixi" (
    "id" TEXT NOT NULL,
    "nasiyaId" TEXT NOT NULL,
    "summa" DECIMAL(12,2) NOT NULL,
    "izoh" TEXT,
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nasiya_qarz_tarixi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "xarid_qarz_tarixi" (
    "id" TEXT NOT NULL,
    "xaridId" TEXT NOT NULL,
    "summa" DECIMAL(12,2) NOT NULL,
    "izoh" TEXT,
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xarid_qarz_tarixi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nasiya_qarz_tarixi_nasiyaId_idx" ON "nasiya_qarz_tarixi"("nasiyaId");
CREATE INDEX IF NOT EXISTS "xarid_qarz_tarixi_xaridId_idx" ON "xarid_qarz_tarixi"("xaridId");

ALTER TABLE "nasiya_qarz_tarixi" DROP CONSTRAINT IF EXISTS "nasiya_qarz_tarixi_nasiyaId_fkey";
ALTER TABLE "nasiya_qarz_tarixi" ADD CONSTRAINT "nasiya_qarz_tarixi_nasiyaId_fkey"
  FOREIGN KEY ("nasiyaId") REFERENCES "nasiyalar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "xarid_qarz_tarixi" DROP CONSTRAINT IF EXISTS "xarid_qarz_tarixi_xaridId_fkey";
ALTER TABLE "xarid_qarz_tarixi" ADD CONSTRAINT "xarid_qarz_tarixi_xaridId_fkey"
  FOREIGN KEY ("xaridId") REFERENCES "xaridlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Quyidagi FK'lar ON DELETE SET NULL bo'lishi kerak (schema.prisma'ga mos)
ALTER TABLE "sherikdan_olish" DROP CONSTRAINT IF EXISTS "sherikdan_olish_sotuvId_fkey";
ALTER TABLE "sherikdan_olish" ADD CONSTRAINT "sherikdan_olish_sotuvId_fkey"
  FOREIGN KEY ("sotuvId") REFERENCES "sotuvlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sherikdan_olish" DROP CONSTRAINT IF EXISTS "sherikdan_olish_sherikId_fkey";
ALTER TABLE "sherikdan_olish" ADD CONSTRAINT "sherikdan_olish_sherikId_fkey"
  FOREIGN KEY ("sherikId") REFERENCES "sheriklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sherikdan_olish" DROP CONSTRAINT IF EXISTS "sherikdan_olish_tovarId_fkey";
ALTER TABLE "sherikdan_olish" ADD CONSTRAINT "sherikdan_olish_tovarId_fkey"
  FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sherikdan_olish_tolov" DROP CONSTRAINT IF EXISTS "sherikdan_olish_tolov_sherikId_fkey";
ALTER TABLE "sherikdan_olish_tolov" ADD CONSTRAINT "sherikdan_olish_tolov_sherikId_fkey"
  FOREIGN KEY ("sherikId") REFERENCES "sheriklar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bildirishnom_loglar" DROP CONSTRAINT IF EXISTS "bildirishnom_loglar_nasiyaId_fkey";
ALTER TABLE "bildirishnom_loglar" ADD CONSTRAINT "bildirishnom_loglar_nasiyaId_fkey"
  FOREIGN KEY ("nasiyaId") REFERENCES "nasiyalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Kosmetik indeks nomi moslashtirish
ALTER INDEX IF EXISTS "ombor_harakati_tovar_turi_joy_idx" RENAME TO "ombor_harakati_tovarId_turi_joy_idx";
