-- Kuryerlar navbati: yangi yetkazish buyurtmalari ishdagi kuryerlarga
-- navbat bilan avtomatik beriladi. Faqat qo'shimcha — mavjud ma'lumotga
-- tegilmaydi.

-- Avtomatik biriktirishda "kim biriktirdi" bo'lmaydi (null = navbat)
-- AlterTable
ALTER TABLE "onlayn_yetkazishlar" ALTER COLUMN "tayinlaganId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "kuryer_navbat" (
    "id" SERIAL NOT NULL,
    "buyurtmaRaqami" TEXT NOT NULL,
    "dostavchikId" TEXT NOT NULL,
    "buyurtmaYaratilgan" TIMESTAMP(3) NOT NULL,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kuryer_navbat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kuryer_navbat_buyurtmaRaqami_key" ON "kuryer_navbat"("buyurtmaRaqami");

-- CreateIndex
CREATE INDEX "kuryer_navbat_yaratilgan_idx" ON "kuryer_navbat"("yaratilgan");

-- Navbat yoqilgan holda boshlanadi — faqat SHU PAYTDAN keyin tushgan
-- buyurtmalar taqsimlanadi, avvalgilariga tegilmaydi
INSERT INTO "sozlamalar" ("id", "kalit", "qiymat", "yangilangan")
VALUES (
    'kuryer_navbat',
    'kuryer_navbat',
    '{"yoqilgan":true,"boshi":' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint || '}',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("kalit") DO NOTHING;
