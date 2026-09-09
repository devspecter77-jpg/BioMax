-- Mijozga ikkinchi telefon raqami (odatda Telegram raqami) va
-- hudud maydonlari (viloyat/tuman). Uchalasi ham ixtiyoriy —
-- mavjud mijozlarda NULL bo'lib qoladi, hech narsa yo'qolmaydi.

ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "telefon2" TEXT;
ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "viloyat" TEXT;
ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "tuman" TEXT;

-- Hudud bo'yicha filtrlash/hisobot uchun
CREATE INDEX IF NOT EXISTS "mijozlar_viloyat_idx" ON "mijozlar"("viloyat");
