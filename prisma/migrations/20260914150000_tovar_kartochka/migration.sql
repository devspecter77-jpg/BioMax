-- Onlayn vitrina: mahsulot kartochkasi (tavsif, xususiyatlar, hajm, aksiya).
-- Faqat qo'shimcha jadval: tovarlar jadvaliga tegilmaydi.

CREATE TYPE "HajmBirligi" AS ENUM ('G', 'KG', 'ML', 'L', 'DONA', 'M');

CREATE TABLE "tovar_kartochkalari" (
    "id" TEXT NOT NULL,
    "tovarId" TEXT NOT NULL,
    "saytda" BOOLEAN NOT NULL DEFAULT false,
    "sarlavha" TEXT,
    "brend" TEXT,
    "tavsif" TEXT,
    "xususiyatlar" JSONB NOT NULL DEFAULT '[]',
    "hajm" DECIMAL(12,3),
    "hajmBirligi" "HajmBirligi",
    "aksiyaNarxi" DECIMAL(12,2),
    "aksiyaBoshi" TIMESTAMP(3),
    "aksiyaOxiri" TIMESTAMP(3),
    "aksiyaEskiNarx" DECIMAL(12,2),
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yangilangan" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tovar_kartochkalari_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tovar_kartochkalari_tovarId_key" ON "tovar_kartochkalari"("tovarId");
CREATE INDEX "tovar_kartochkalari_saytda_idx" ON "tovar_kartochkalari"("saytda");
CREATE INDEX "tovar_kartochkalari_aksiyaBoshi_aksiyaOxiri_idx" ON "tovar_kartochkalari"("aksiyaBoshi", "aksiyaOxiri");

ALTER TABLE "tovar_kartochkalari" ADD CONSTRAINT "tovar_kartochkalari_tovarId_fkey" FOREIGN KEY ("tovarId") REFERENCES "tovarlar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hozir saytda turgan mahsulotlar (marketplace e'lonlari) vitrinada ham
-- "saytda" bo'lib qoladi — ko'chishda sayt bo'shab qolmasin.
INSERT INTO "tovar_kartochkalari" ("id", "tovarId", "saytda", "brend", "tavsif", "yangilangan")
SELECT 'tk_' || md5(e."erpTovarId"), e."erpTovarId", e."faol", e."brend", e."tavsif", CURRENT_TIMESTAMP
FROM marketplace.mp_elonlar e
JOIN "tovarlar" t ON t.id = e."erpTovarId"
ON CONFLICT ("tovarId") DO NOTHING;
