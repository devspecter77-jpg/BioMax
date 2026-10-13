-- Onlayn xaridorni saytdan chiqarish / qayta ruxsat berish jurnali (faqat qo'shimcha).

-- CreateEnum
CREATE TYPE "OnlaynBlokAmali" AS ENUM ('CHIQARILDI', 'QAYTARILDI');

-- CreateTable
CREATE TABLE "onlayn_hisob_bloklari" (
    "id" TEXT NOT NULL,
    "hisobId" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "ism" TEXT,
    "amal" "OnlaynBlokAmali" NOT NULL,
    "sabab" TEXT,
    "foydalanuvchiId" TEXT,
    "foydalanuvchiIsm" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onlayn_hisob_bloklari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onlayn_hisob_bloklari_hisobId_yaratilgan_idx" ON "onlayn_hisob_bloklari"("hisobId", "yaratilgan");

