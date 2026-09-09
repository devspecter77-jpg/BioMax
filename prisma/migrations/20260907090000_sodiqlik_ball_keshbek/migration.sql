-- Sodiqlik dasturi: BALLAR va KESHBEKLAR.
-- Ikkita mustaqil hisob (ball = ochko, keshbek = so'm), har biri o'z
-- balansi va umumiy harakatlar jurnali bilan.

CREATE TYPE "SodiqlikHisobi" AS ENUM ('BALL', 'KESHBEK');
CREATE TYPE "SodiqlikSabab" AS ENUM ('SOTUVDAN', 'SARFLANDI', 'QAYTARISHDAN', 'QOLDA');

-- Mijoz balanslari. Mavjud mijozlarda 0 dan boshlanadi.
ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "ballBalans" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "keshbekBalans" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Sotuvda sodiqlik hisobidan qoplangan qism (chegirmadan alohida).
ALTER TABLE "sotuvlar" ADD COLUMN IF NOT EXISTS "ballIshlatilgan" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "sotuvlar" ADD COLUMN IF NOT EXISTS "keshbekIshlatilgan" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Harakatlar jurnali — audit izi.
CREATE TABLE IF NOT EXISTS "sodiqlik_harakatlari" (
    "id" TEXT NOT NULL,
    "mijozId" TEXT NOT NULL,
    "hisob" "SodiqlikHisobi" NOT NULL,
    "miqdor" DECIMAL(12,2) NOT NULL,
    "balansKeyin" DECIMAL(12,2) NOT NULL,
    "sabab" "SodiqlikSabab" NOT NULL,
    "sotuvId" TEXT,
    "izoh" TEXT,
    "foydalanuvchiId" TEXT,
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sodiqlik_harakatlari_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sodiqlik_harakatlari_mijozId_sana_idx" ON "sodiqlik_harakatlari"("mijozId", "sana");
CREATE INDEX IF NOT EXISTS "sodiqlik_harakatlari_sotuvId_idx" ON "sodiqlik_harakatlari"("sotuvId");
CREATE INDEX IF NOT EXISTS "sodiqlik_harakatlari_sana_idx" ON "sodiqlik_harakatlari"("sana");

ALTER TABLE "sodiqlik_harakatlari"
  ADD CONSTRAINT "sodiqlik_harakatlari_mijozId_fkey"
  FOREIGN KEY ("mijozId") REFERENCES "mijozlar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sodiqlik_harakatlari"
  ADD CONSTRAINT "sodiqlik_harakatlari_sotuvId_fkey"
  FOREIGN KEY ("sotuvId") REFERENCES "sotuvlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sodiqlik_harakatlari"
  ADD CONSTRAINT "sodiqlik_harakatlari_foydalanuvchiId_fkey"
  FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
