-- Sotuv va saqlangan zakaz qatori qaysi birlikda sotilgani: o'ram ("blok",
-- 1 blok = 60 dona). `miqdor` va `birlikNarxi` avvalgidek ASOSIY birlikda
-- qoladi (qoldiq, hisobot, foyda shunga tayanadi). Faqat qo'shimcha ustunlar.

ALTER TABLE public."sotuv_tarkibi" ADD COLUMN "oramNomi" TEXT;
ALTER TABLE public."sotuv_tarkibi" ADD COLUMN "oramMiqdori" DECIMAL(12,3);

ALTER TABLE public."buyurtma_tarkibi" ADD COLUMN "oramNomi" TEXT;
ALTER TABLE public."buyurtma_tarkibi" ADD COLUMN "oramMiqdori" DECIMAL(12,3);
