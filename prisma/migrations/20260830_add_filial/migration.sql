-- CreateTable
CREATE TABLE "filiallar" (
    "id" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "manzil" TEXT,
    "telefon" TEXT,
    "faol" BOOLEAN NOT NULL DEFAULT true,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "filiallar_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "foydalanuvchilar" ADD COLUMN "filialId" TEXT;

-- CreateIndex
CREATE INDEX "foydalanuvchilar_filialId_idx" ON "foydalanuvchilar"("filialId");

-- AddForeignKey
ALTER TABLE "foydalanuvchilar" ADD CONSTRAINT "foydalanuvchilar_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
