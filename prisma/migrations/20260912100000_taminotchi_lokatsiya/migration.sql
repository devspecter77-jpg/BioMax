-- Ta'minotchining xaritadagi joylashuvi.
-- Faqat qo'shimcha: mavjud ta'minotchilarda NULL bo'lib qoladi va
-- ular xaritada ko'rinmaydi — `manzil` matni o'z holicha ishlayveradi.
ALTER TABLE "taminotchilar" ADD COLUMN "lokatsiyaLat" DOUBLE PRECISION;
ALTER TABLE "taminotchilar" ADD COLUMN "lokatsiyaLng" DOUBLE PRECISION;
