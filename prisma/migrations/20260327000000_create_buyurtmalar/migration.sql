-- CreateEnum
CREATE TYPE "BuyurtmaHolati" AS ENUM ('KUTILMOQDA', 'TASDIQLANGAN', 'BEKOR_QILINGAN');

-- CreateTable
CREATE TABLE "buyurtmalar" (
    "id" TEXT NOT NULL,
    "sotuvchiId" TEXT NOT NULL,
    "mijozId" TEXT,
    "holati" "BuyurtmaHolati" NOT NULL DEFAULT 'KUTILMOQDA',
    "jamiSumma" DECIMAL(12,2) NOT NULL,
    "izoh" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyurtmalar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyurtma_tarkibi" (
    "id" TEXT NOT NULL,
    "buyurtmaId" TEXT NOT NULL,
    "tovarId" TEXT NOT NULL,
    "miqdor" DECIMAL(12,3) NOT NULL,
    "birlikNarxi" DECIMAL(12,2) NOT NULL,
    "jami" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "buyurtma_tarkibi_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "buyurtmalar" ADD CONSTRAINT "buyurtmalar_sotuvchiId_fkey" FOREIGN KEY ("sotuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyurtmalar" ADD CONSTRAINT "buyurtmalar_mijozId_fkey" FOREIGN KEY ("mijozId") REFERENCES "mijozlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyurtma_tarkibi" ADD CONSTRAINT "buyurtma_tarkibi_buyurtmaId_fkey" FOREIGN KEY ("buyurtmaId") REFERENCES "buyurtmalar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyurtma_tarkibi" ADD CONSTRAINT "buyurtma_tarkibi_tovarId_fkey" FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
