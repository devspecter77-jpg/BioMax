-- Ruxsat o'zgarishlari jurnali (faqat qo'shimcha jadval — mavjud ma'lumotga tegilmaydi)
CREATE TABLE "ruxsat_jurnali" (
    "id" TEXT NOT NULL,
    "foydalanuvchiId" TEXT,
    "foydalanuvchiIsm" TEXT NOT NULL,
    "ozgartiruvchiId" TEXT,
    "ozgartiruvchiIsm" TEXT NOT NULL,
    "kalit" TEXT NOT NULL,
    "eski" BOOLEAN NOT NULL,
    "yangi" BOOLEAN NOT NULL,
    "sabab" TEXT NOT NULL DEFAULT 'QOLDA',
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruxsat_jurnali_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ruxsat_jurnali_foydalanuvchiId_sana_idx" ON "ruxsat_jurnali"("foydalanuvchiId", "sana");
CREATE INDEX "ruxsat_jurnali_sana_idx" ON "ruxsat_jurnali"("sana");

ALTER TABLE "ruxsat_jurnali" ADD CONSTRAINT "ruxsat_jurnali_foydalanuvchiId_fkey" FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ruxsat_jurnali" ADD CONSTRAINT "ruxsat_jurnali_ozgartiruvchiId_fkey" FOREIGN KEY ("ozgartiruvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
