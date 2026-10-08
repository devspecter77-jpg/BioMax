-- Kuryer ish smenasi va ovoz yozuvlari. Faqat qo'shimcha: yangi jadvallar
-- va bo'sh ustun — mavjud ma'lumotlarga tegilmaydi.

-- AlterTable
ALTER TABLE "foydalanuvchilar" ADD COLUMN     "ovozRozilik" TIMESTAMP(3);
-- CreateTable
CREATE TABLE "smenalar" (
    "id" TEXT NOT NULL,
    "xodimId" TEXT NOT NULL,
    "boshlandi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tugadi" TIMESTAMP(3),
    "tugatuvchi" TEXT,
    "tugatganId" TEXT,
    "oxirgiPuls" TIMESTAMP(3),
    "yozuvHolati" TEXT,
    "boshLat" DOUBLE PRECISION,
    "boshLng" DOUBLE PRECISION,
    "oxirLat" DOUBLE PRECISION,
    "oxirLng" DOUBLE PRECISION,
    "qurilma" TEXT,
    "filialId" TEXT,
    "egaId" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "smenalar_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ovoz_yozuvlari" (
    "id" TEXT NOT NULL,
    "smenaId" TEXT NOT NULL,
    "xodimId" TEXT NOT NULL,
    "boshlandi" TIMESTAMP(3) NOT NULL,
    "tugadi" TIMESTAMP(3) NOT NULL,
    "davomiylikMs" INTEGER NOT NULL,
    "hajm" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kalit" TEXT NOT NULL,
    "daraja" DOUBLE PRECISION,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ovoz_yozuvlari_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "smenalar_xodimId_boshlandi_idx" ON "smenalar"("xodimId", "boshlandi");
-- CreateIndex
CREATE INDEX "smenalar_tugadi_idx" ON "smenalar"("tugadi");
-- CreateIndex
CREATE INDEX "ovoz_yozuvlari_xodimId_boshlandi_idx" ON "ovoz_yozuvlari"("xodimId", "boshlandi");
-- CreateIndex
CREATE INDEX "ovoz_yozuvlari_yaratilgan_idx" ON "ovoz_yozuvlari"("yaratilgan");
-- CreateIndex
CREATE UNIQUE INDEX "ovoz_yozuvlari_smenaId_boshlandi_key" ON "ovoz_yozuvlari"("smenaId", "boshlandi");
-- AddForeignKey
ALTER TABLE "smenalar" ADD CONSTRAINT "smenalar_xodimId_fkey" FOREIGN KEY ("xodimId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ovoz_yozuvlari" ADD CONSTRAINT "ovoz_yozuvlari_smenaId_fkey" FOREIGN KEY ("smenaId") REFERENCES "smenalar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
