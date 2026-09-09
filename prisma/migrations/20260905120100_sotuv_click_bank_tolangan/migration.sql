-- Click va bank o'tkazmasi orqali tushgan summalar uchun ustunlar —
-- mavjud "naqdTolangan"/"kartaTolangan" naqshining davomi.
-- Eski sotuvlar uchun 0 (ular naqd/karta/nasiya bo'lgan).

ALTER TABLE "sotuvlar" ADD COLUMN IF NOT EXISTS "clickTolangan" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "sotuvlar" ADD COLUMN IF NOT EXISTS "bankTolangan" DECIMAL(12,2) NOT NULL DEFAULT 0;
