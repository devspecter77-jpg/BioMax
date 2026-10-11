-- Jonli tinglash: administrator smenani tinglayotganini bildirgan vaqt.
-- Yaqin bo'lsa kuryer ilovasi qisqa bo'laklar yuboradi (deyarli jonli).
-- Faqat qo'shimcha, bo'sh ustun — mavjud ma'lumotga tegilmaydi.

-- AlterTable
ALTER TABLE "smenalar" ADD COLUMN     "jonliKuzatilgan" TIMESTAMP(3);
