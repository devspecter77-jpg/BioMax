-- OMBOR — kategoriyalarning ustki guruhi.
-- Faqat qo'shimcha: yangi jadval va kategoriyaga ixtiyoriy `omborId`.
-- Mavjud kategoriyalar omborsiz qoladi (NULL) va ishlashda davom etadi.
CREATE TABLE "omborlar" (
    "id" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "izoh" TEXT,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "faol" BOOLEAN NOT NULL DEFAULT true,
    "filialId" TEXT,
    "egaId" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "omborlar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "omborlar_nomi_filialId_egaId_key" ON "omborlar"("nomi", "filialId", "egaId");
CREATE INDEX "omborlar_filialId_idx" ON "omborlar"("filialId");
CREATE INDEX "omborlar_egaId_idx" ON "omborlar"("egaId");

ALTER TABLE "omborlar" ADD CONSTRAINT "omborlar_filialId_fkey"
    FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "omborlar" ADD CONSTRAINT "omborlar_egaId_fkey"
    FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kategoriyalar" ADD COLUMN "omborId" TEXT;
CREATE INDEX "kategoriyalar_omborId_idx" ON "kategoriyalar"("omborId");
ALTER TABLE "kategoriyalar" ADD CONSTRAINT "kategoriyalar_omborId_fkey"
    FOREIGN KEY ("omborId") REFERENCES "omborlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
