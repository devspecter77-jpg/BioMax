-- Xodimga biriktirilgan mulk (faqat qo'shimcha: yangi enumlar va jadval — mavjud ma'lumotga tegilmaydi)
CREATE TYPE "MulkTuri" AS ENUM ('TRANSPORT', 'TELEFON', 'KOMPYUTER', 'ASBOB', 'KALIT', 'KIYIM', 'BOSHQA');
CREATE TYPE "MulkHolati" AS ENUM ('BERILGAN', 'QAYTARILGAN', 'YOQOLGAN', 'OTKAZILGAN');

CREATE TABLE "xodim_mulklari" (
    "id" TEXT NOT NULL,
    "xodimId" TEXT NOT NULL,
    "turi" "MulkTuri" NOT NULL DEFAULT 'BOSHQA',
    "nomi" TEXT NOT NULL,
    "raqami" TEXT,
    "qiymati" DECIMAL(14,2),
    "berilganSana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "berilganHolat" TEXT,
    "izoh" TEXT,
    "holati" "MulkHolati" NOT NULL DEFAULT 'BERILGAN',
    "yakunSana" TIMESTAMP(3),
    "yakunIzoh" TEXT,
    "yaratganId" TEXT NOT NULL,
    "yakunlaganId" TEXT,
    "filialId" TEXT,
    "egaId" TEXT,
    "yaratilgan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yangilangan" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xodim_mulklari_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "xodim_mulklari_xodimId_holati_idx" ON "xodim_mulklari"("xodimId", "holati");
CREATE INDEX "xodim_mulklari_filialId_idx" ON "xodim_mulklari"("filialId");
CREATE INDEX "xodim_mulklari_egaId_idx" ON "xodim_mulklari"("egaId");

ALTER TABLE "xodim_mulklari" ADD CONSTRAINT "xodim_mulklari_xodimId_fkey" FOREIGN KEY ("xodimId") REFERENCES "foydalanuvchilar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "xodim_mulklari" ADD CONSTRAINT "xodim_mulklari_yaratganId_fkey" FOREIGN KEY ("yaratganId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "xodim_mulklari" ADD CONSTRAINT "xodim_mulklari_yakunlaganId_fkey" FOREIGN KEY ("yakunlaganId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
