-- Mijozlar kategoriyalari va ko'rish doirasi: xodim faqat o'ziga biriktirilgan
-- mijozlarni va unga ochilgan kategoriyalardagilarni ko'radi. Faqat qo'shimcha —
-- mavjud mijozlarga tegilmaydi (mas'ul xodimsiz = faqat administratorlarga).

-- AlterTable
ALTER TABLE "mijozlar" ADD COLUMN     "kategoriyaId" TEXT,
ADD COLUMN     "masulId" TEXT,
ADD COLUMN     "yaratganId" TEXT;

-- CreateTable
CREATE TABLE "mijoz_kategoriyalari" (
    "id" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "rang" TEXT NOT NULL DEFAULT 'kulrang',
    "hammaga" BOOLEAN NOT NULL DEFAULT false,
    "filialId" TEXT,
    "egaId" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yangilangan" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mijoz_kategoriyalari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mijoz_kategoriya_xodimlari" (
    "kategoriyaId" TEXT NOT NULL,
    "foydalanuvchiId" TEXT NOT NULL,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mijoz_kategoriya_xodimlari_pkey" PRIMARY KEY ("kategoriyaId","foydalanuvchiId")
);

-- CreateIndex
CREATE INDEX "mijoz_kategoriyalari_filialId_idx" ON "mijoz_kategoriyalari"("filialId");

-- CreateIndex
CREATE INDEX "mijoz_kategoriyalari_egaId_idx" ON "mijoz_kategoriyalari"("egaId");

-- CreateIndex
CREATE INDEX "mijoz_kategoriya_xodimlari_foydalanuvchiId_idx" ON "mijoz_kategoriya_xodimlari"("foydalanuvchiId");

-- CreateIndex
CREATE INDEX "mijozlar_masulId_idx" ON "mijozlar"("masulId");

-- CreateIndex
CREATE INDEX "mijozlar_kategoriyaId_idx" ON "mijozlar"("kategoriyaId");

-- AddForeignKey
ALTER TABLE "mijozlar" ADD CONSTRAINT "mijozlar_yaratganId_fkey" FOREIGN KEY ("yaratganId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mijozlar" ADD CONSTRAINT "mijozlar_masulId_fkey" FOREIGN KEY ("masulId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mijozlar" ADD CONSTRAINT "mijozlar_kategoriyaId_fkey" FOREIGN KEY ("kategoriyaId") REFERENCES "mijoz_kategoriyalari"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mijoz_kategoriyalari" ADD CONSTRAINT "mijoz_kategoriyalari_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mijoz_kategoriyalari" ADD CONSTRAINT "mijoz_kategoriyalari_egaId_fkey" FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mijoz_kategoriya_xodimlari" ADD CONSTRAINT "mijoz_kategoriya_xodimlari_kategoriyaId_fkey" FOREIGN KEY ("kategoriyaId") REFERENCES "mijoz_kategoriyalari"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mijoz_kategoriya_xodimlari" ADD CONSTRAINT "mijoz_kategoriya_xodimlari_foydalanuvchiId_fkey" FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

