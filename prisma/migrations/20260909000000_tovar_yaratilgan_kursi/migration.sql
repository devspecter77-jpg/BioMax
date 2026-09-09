-- Mahsulot yaratilgan paytdagi USD kursi.
-- Faqat qo'shimcha: ixtiyoriy ustun, mavjud qatorlarda NULL bo'lib qoladi.
ALTER TABLE "tovarlar" ADD COLUMN "yaratilganKursi" DECIMAL(12,2);
