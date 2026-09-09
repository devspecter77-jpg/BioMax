-- Tovarni vaqtinchalik qulflash: sotuvda ko'rinmaydi, lekin katalogda qoladi.
-- Faqat qo'shimcha: standart qiymati false, mavjud tovarlar o'zgarmaydi.
ALTER TABLE "tovarlar" ADD COLUMN "qulflangan" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "tovarlar_holati_qulflangan_idx" ON "tovarlar"("holati", "qulflangan");
