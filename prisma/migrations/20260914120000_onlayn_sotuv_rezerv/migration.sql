-- Onlayn do'kon: buyurtma zaxirani band qiladi, topshirilganda sotuvga aylanadi.
-- Faqat qo'shimcha: mavjud sotuvlar `POS` bo'lib qoladi, yetkazish haqi 0.

CREATE TYPE "SotuvManba" AS ENUM ('POS', 'ONLAYN');
CREATE TYPE "RezervHolati" AS ENUM ('FAOL', 'SOTILDI', 'BOSHATILDI');

ALTER TABLE "sotuvlar"
    ADD COLUMN "manba" "SotuvManba" NOT NULL DEFAULT 'POS',
    ADD COLUMN "onlaynRaqam" TEXT,
    ADD COLUMN "yetkazishNarx" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "sotuvlar_onlaynRaqam_key" ON "sotuvlar"("onlaynRaqam");

CREATE TABLE "onlayn_rezervlar" (
    "id" TEXT NOT NULL,
    "buyurtmaRaqami" TEXT NOT NULL,
    "tovarId" TEXT NOT NULL,
    "miqdor" DECIMAL(12,3) NOT NULL,
    "holati" "RezervHolati" NOT NULL DEFAULT 'FAOL',
    "amalQiladi" TIMESTAMP(3) NOT NULL,
    "foydalanuvchiId" TEXT NOT NULL,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yangilangan" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "onlayn_rezervlar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onlayn_rezervlar_buyurtmaRaqami_tovarId_key" ON "onlayn_rezervlar"("buyurtmaRaqami", "tovarId");
CREATE INDEX "onlayn_rezervlar_tovarId_holati_amalQiladi_idx" ON "onlayn_rezervlar"("tovarId", "holati", "amalQiladi");

ALTER TABLE "onlayn_rezervlar" ADD CONSTRAINT "onlayn_rezervlar_tovarId_fkey" FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onlayn_rezervlar" ADD CONSTRAINT "onlayn_rezervlar_foydalanuvchiId_fkey" FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
