-- Xodimning yurgan yo'li (joylashuv tarixi) va koordinata → manzil keshi.
-- Faqat yangi jadvallar — mavjud ma'lumotga tegilmaydi.
CREATE TABLE "lokatsiya_izlari" (
    "id" BIGSERIAL NOT NULL,
    "xodimId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "aniqlik" DOUBLE PRECISION,
    "vaqt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lokatsiya_izlari_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lokatsiya_izlari_xodimId_vaqt_idx" ON "lokatsiya_izlari"("xodimId", "vaqt");

ALTER TABLE "lokatsiya_izlari" ADD CONSTRAINT "lokatsiya_izlari_xodimId_fkey" FOREIGN KEY ("xodimId") REFERENCES "foydalanuvchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "manzil_keshi" (
    "kalit" TEXT NOT NULL,
    "manzil" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manzil_keshi_pkey" PRIMARY KEY ("kalit")
);
