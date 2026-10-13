-- Sodiqlik qo'shimcha qoidalari: chek summasi, mahsulot yoki kategoriya bo'yicha
-- qo'shimcha ball va keshbek. Faqat qo'shimcha (eski kod bu jadval/ustunni bilmaydi).

-- CreateEnum
CREATE TYPE "SodiqlikQoidaTuri" AS ENUM ('CHEK', 'MAHSULOT', 'KATEGORIYA');

-- AlterTable
ALTER TABLE "sodiqlik_harakatlari" ADD COLUMN     "tafsilot" JSONB;

-- CreateTable
CREATE TABLE "sodiqlik_qoidalari" (
    "id" TEXT NOT NULL,
    "turi" "SodiqlikQoidaTuri" NOT NULL,
    "tovarId" TEXT,
    "kategoriyaId" TEXT,
    "minSumma" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "minMiqdor" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "ball" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "keshbekFoiz" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "izoh" TEXT,
    "faol" BOOLEAN NOT NULL DEFAULT true,
    "filialId" TEXT,
    "egaId" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yangilangan" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sodiqlik_qoidalari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sodiqlik_qoidalari_egaId_idx" ON "sodiqlik_qoidalari"("egaId");

-- CreateIndex
CREATE INDEX "sodiqlik_qoidalari_filialId_idx" ON "sodiqlik_qoidalari"("filialId");

-- CreateIndex
CREATE INDEX "sodiqlik_qoidalari_tovarId_idx" ON "sodiqlik_qoidalari"("tovarId");

-- CreateIndex
CREATE INDEX "sodiqlik_qoidalari_kategoriyaId_idx" ON "sodiqlik_qoidalari"("kategoriyaId");

-- AddForeignKey
ALTER TABLE "sodiqlik_qoidalari" ADD CONSTRAINT "sodiqlik_qoidalari_tovarId_fkey" FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sodiqlik_qoidalari" ADD CONSTRAINT "sodiqlik_qoidalari_kategoriyaId_fkey" FOREIGN KEY ("kategoriyaId") REFERENCES "kategoriyalar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

