-- Dostavchiklar, onlayn buyurtmani dostavchikka biriktirish va namuna tovarlar.
-- Faqat qo'shimcha: yangi enum qiymati va jadvallar, mavjud ma'lumotga tegilmaydi.

-- CreateEnum
CREATE TYPE "TransportTuri" AS ENUM ('PIYODA', 'VELOSIPED', 'SKUTER', 'MOTOTSIKL', 'AVTOMOBIL', 'YUK_AVTOMOBILI', 'BOSHQA');

-- CreateEnum
CREATE TYPE "YetkazishHolati" AS ENUM ('TAYINLANGAN', 'YOLDA', 'YETIB_KELDI', 'TOPSHIRILDI', 'BEKOR');

-- CreateEnum
CREATE TYPE "NamunaHolati" AS ENUM ('BERILGAN', 'TOPSHIRILGAN');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'DOSTAVCHIK';

-- CreateTable
CREATE TABLE "dostavchik_profillari" (
    "id" TEXT NOT NULL,
    "foydalanuvchiId" TEXT NOT NULL,
    "transportTuri" "TransportTuri" NOT NULL DEFAULT 'AVTOMOBIL',
    "transportNomi" TEXT,
    "davlatRaqami" TEXT,
    "qoshimchaTelefonlar" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "izoh" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yangilangan" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dostavchik_profillari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onlayn_yetkazishlar" (
    "id" TEXT NOT NULL,
    "buyurtmaRaqami" TEXT NOT NULL,
    "dostavchikId" TEXT NOT NULL,
    "holati" "YetkazishHolati" NOT NULL DEFAULT 'TAYINLANGAN',
    "aloqaIsm" TEXT,
    "aloqaTel" TEXT,
    "manzilMatni" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "jamiSumma" DECIMAL(12,2),
    "tayinlaganId" TEXT NOT NULL,
    "tayinlangan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yolgaChiqdi" TIMESTAMP(3),
    "yetibKeldi" TIMESTAMP(3),
    "topshirildi" TIMESTAMP(3),
    "yangilangan" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onlayn_yetkazishlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "namuna_berishlar" (
    "id" TEXT NOT NULL,
    "dostavchikId" TEXT NOT NULL,
    "izoh" TEXT,
    "berganId" TEXT NOT NULL,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "namuna_berishlar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "namuna_tarkiblari" (
    "id" TEXT NOT NULL,
    "berishId" TEXT NOT NULL,
    "tovarId" TEXT,
    "nomi" TEXT NOT NULL,
    "birlik" TEXT,
    "miqdor" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "holati" "NamunaHolati" NOT NULL DEFAULT 'BERILGAN',
    "topshirilganVaqt" TIMESTAMP(3),
    "qabulQilganId" TEXT,
    "yangilangan" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "namuna_tarkiblari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dostavchik_profillari_foydalanuvchiId_key" ON "dostavchik_profillari"("foydalanuvchiId");

-- CreateIndex
CREATE UNIQUE INDEX "onlayn_yetkazishlar_buyurtmaRaqami_key" ON "onlayn_yetkazishlar"("buyurtmaRaqami");

-- CreateIndex
CREATE INDEX "onlayn_yetkazishlar_dostavchikId_holati_idx" ON "onlayn_yetkazishlar"("dostavchikId", "holati");

-- CreateIndex
CREATE INDEX "onlayn_yetkazishlar_yangilangan_idx" ON "onlayn_yetkazishlar"("yangilangan");

-- CreateIndex
CREATE INDEX "namuna_berishlar_dostavchikId_yaratilgan_idx" ON "namuna_berishlar"("dostavchikId", "yaratilgan");

-- CreateIndex
CREATE INDEX "namuna_tarkiblari_berishId_idx" ON "namuna_tarkiblari"("berishId");

-- CreateIndex
CREATE INDEX "namuna_tarkiblari_holati_idx" ON "namuna_tarkiblari"("holati");

-- CreateIndex
CREATE INDEX "namuna_tarkiblari_yangilangan_idx" ON "namuna_tarkiblari"("yangilangan");

-- AddForeignKey
ALTER TABLE "dostavchik_profillari" ADD CONSTRAINT "dostavchik_profillari_foydalanuvchiId_fkey" FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onlayn_yetkazishlar" ADD CONSTRAINT "onlayn_yetkazishlar_dostavchikId_fkey" FOREIGN KEY ("dostavchikId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onlayn_yetkazishlar" ADD CONSTRAINT "onlayn_yetkazishlar_tayinlaganId_fkey" FOREIGN KEY ("tayinlaganId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "namuna_berishlar" ADD CONSTRAINT "namuna_berishlar_dostavchikId_fkey" FOREIGN KEY ("dostavchikId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "namuna_berishlar" ADD CONSTRAINT "namuna_berishlar_berganId_fkey" FOREIGN KEY ("berganId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "namuna_tarkiblari" ADD CONSTRAINT "namuna_tarkiblari_berishId_fkey" FOREIGN KEY ("berishId") REFERENCES "namuna_berishlar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "namuna_tarkiblari" ADD CONSTRAINT "namuna_tarkiblari_tovarId_fkey" FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "namuna_tarkiblari" ADD CONSTRAINT "namuna_tarkiblari_qabulQilganId_fkey" FOREIGN KEY ("qabulQilganId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

