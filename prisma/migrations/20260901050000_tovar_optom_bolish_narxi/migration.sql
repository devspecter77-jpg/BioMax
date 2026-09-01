-- Tovar.optomNarxi / bolishNarxi — sotish narxidan tashqari ikkita qo'shimcha
-- ixtiyoriy narx darajasi (optom sotuvchilar uchun va donalab/bo'lib sotish
-- uchun), mahsulot qo'shish/tahrirlashda kiritiladi.
ALTER TABLE "tovarlar" ADD COLUMN IF NOT EXISTS "optomNarxi" DECIMAL(12,2);
ALTER TABLE "tovarlar" ADD COLUMN IF NOT EXISTS "bolishNarxi" DECIMAL(12,2);
