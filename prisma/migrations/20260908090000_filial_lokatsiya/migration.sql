-- Filialning xaritadagi joylashuvi. Ixtiyoriy: belgilanmagan filial
-- xaritada ko'rinmaydi, lekin qolgan hamma narsa ishlayveradi.

ALTER TABLE "filiallar" ADD COLUMN IF NOT EXISTS "lokatsiyaLat" DOUBLE PRECISION;
ALTER TABLE "filiallar" ADD COLUMN IF NOT EXISTS "lokatsiyaLng" DOUBLE PRECISION;
