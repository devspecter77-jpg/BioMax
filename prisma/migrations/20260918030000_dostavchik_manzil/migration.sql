-- Dostavchikning manzili va uning xaritadagi nuqtasi.
-- Faqat qo'shimcha ustunlar, mavjud ma'lumotga tegilmaydi.

-- AlterTable
ALTER TABLE "dostavchik_profillari" ADD COLUMN     "manzil" TEXT,
ADD COLUMN     "manzilLat" DOUBLE PRECISION,
ADD COLUMN     "manzilLng" DOUBLE PRECISION;

