-- Mijoz.lokatsiyaLat / lokatsiyaLng — GPS orqali qo'lda belgilangan joylashuv
-- (masalan mijoz oldiga borib olingan), manzil matnidan mustaqil ixtiyoriy maydon.
ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "lokatsiyaLat" DOUBLE PRECISION;
ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "lokatsiyaLng" DOUBLE PRECISION;
