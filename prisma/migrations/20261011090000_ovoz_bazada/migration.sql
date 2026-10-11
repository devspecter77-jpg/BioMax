-- Kuryer ovoz yozuvlarini ma'lumotlar bazasida saqlash. Faqat qo'shimcha:
-- yangi jadval, ustun va indeks — mavjud ma'lumotga tegilmaydi.
-- Fayl baytlari alohida jadvalda (yozuvlar ro'yxati audio o'qimasin), yozuv
-- o'chsa fayl ham o'chadi (CASCADE).

-- AlterTable
ALTER TABLE "ovoz_yozuvlari" ADD COLUMN     "ombor" TEXT NOT NULL DEFAULT 'baza';
-- CreateTable
CREATE TABLE "ovoz_fayllar" (
    "yozuvId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    CONSTRAINT "ovoz_fayllar_pkey" PRIMARY KEY ("yozuvId")
);
-- CreateIndex
CREATE INDEX "ovoz_yozuvlari_ombor_boshlandi_idx" ON "ovoz_yozuvlari"("ombor", "boshlandi");
-- AddForeignKey
ALTER TABLE "ovoz_fayllar" ADD CONSTRAINT "ovoz_fayllar_yozuvId_fkey" FOREIGN KEY ("yozuvId") REFERENCES "ovoz_yozuvlari"("id") ON DELETE CASCADE ON UPDATE CASCADE;
