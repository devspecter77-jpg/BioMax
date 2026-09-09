-- Adminga ketadigan kunlik hisobot jurnali.
-- Faqat qo'shimcha: yangi jadval, mavjud ma'lumot tegilmaydi.
CREATE TABLE "kunlik_hisobot_loglar" (
    "id" TEXT NOT NULL,
    "kunKaliti" TEXT NOT NULL,
    "qabulQiluvchiId" TEXT NOT NULL,
    "telefon" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "xato" TEXT,
    "kamQolganSoni" INTEGER NOT NULL DEFAULT 0,
    "tugaganSoni" INTEGER NOT NULL DEFAULT 0,
    "matn" TEXT,
    "urinishSoni" INTEGER NOT NULL DEFAULT 0,
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yuborilganSana" TIMESTAMP(3),

    CONSTRAINT "kunlik_hisobot_loglar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kunlik_hisobot_loglar_kunKaliti_qabulQiluvchiId_key"
    ON "kunlik_hisobot_loglar"("kunKaliti", "qabulQiluvchiId");

CREATE INDEX "kunlik_hisobot_loglar_sana_idx" ON "kunlik_hisobot_loglar"("sana");

ALTER TABLE "kunlik_hisobot_loglar"
    ADD CONSTRAINT "kunlik_hisobot_loglar_qabulQiluvchiId_fkey"
    FOREIGN KEY ("qabulQiluvchiId") REFERENCES "foydalanuvchilar"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
