-- AlterTable
ALTER TABLE "foydalanuvchilar" ADD COLUMN IF NOT EXISTS "lokatsiyaLat" DOUBLE PRECISION;
ALTER TABLE "foydalanuvchilar" ADD COLUMN IF NOT EXISTS "lokatsiyaLng" DOUBLE PRECISION;
ALTER TABLE "foydalanuvchilar" ADD COLUMN IF NOT EXISTS "lokatsiyaYangilangan" TIMESTAMP(3);
