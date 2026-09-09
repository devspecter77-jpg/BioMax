-- O'tkazma hujjati va uning qatorlari.

CREATE TABLE IF NOT EXISTS "otkazmalar" (
    "id" TEXT NOT NULL,
    "manbaFilialId" TEXT,
    "qabulFilialId" TEXT,
    "manbaJoy" "Joylashuv" NOT NULL DEFAULT 'OMBOR',
    "qabulJoy" "Joylashuv" NOT NULL DEFAULT 'OMBOR',
    "izoh" TEXT,
    "sana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foydalanuvchiId" TEXT NOT NULL,
    "egaId" TEXT,

    CONSTRAINT "otkazmalar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "otkazmalar_sana_idx" ON "otkazmalar"("sana");
CREATE INDEX IF NOT EXISTS "otkazmalar_manbaFilialId_idx" ON "otkazmalar"("manbaFilialId");
CREATE INDEX IF NOT EXISTS "otkazmalar_qabulFilialId_idx" ON "otkazmalar"("qabulFilialId");
CREATE INDEX IF NOT EXISTS "otkazmalar_egaId_idx" ON "otkazmalar"("egaId");

CREATE TABLE IF NOT EXISTS "otkazma_tarkibi" (
    "id" TEXT NOT NULL,
    "otkazmaId" TEXT NOT NULL,
    "manbaTovarId" TEXT NOT NULL,
    "qabulTovarId" TEXT NOT NULL,
    "miqdor" DECIMAL(12,3) NOT NULL,
    "narx" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "otkazma_tarkibi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "otkazma_tarkibi_otkazmaId_idx" ON "otkazma_tarkibi"("otkazmaId");

-- Zaxira jurnalini hujjatga bog'lash
ALTER TABLE "ombor_harakati" ADD COLUMN IF NOT EXISTS "otkazmaId" TEXT;
CREATE INDEX IF NOT EXISTS "ombor_harakati_otkazmaId_idx" ON "ombor_harakati"("otkazmaId");

ALTER TABLE "otkazmalar" ADD CONSTRAINT "otkazmalar_manbaFilialId_fkey"
  FOREIGN KEY ("manbaFilialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "otkazmalar" ADD CONSTRAINT "otkazmalar_qabulFilialId_fkey"
  FOREIGN KEY ("qabulFilialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "otkazmalar" ADD CONSTRAINT "otkazmalar_foydalanuvchiId_fkey"
  FOREIGN KEY ("foydalanuvchiId") REFERENCES "foydalanuvchilar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "otkazma_tarkibi" ADD CONSTRAINT "otkazma_tarkibi_otkazmaId_fkey"
  FOREIGN KEY ("otkazmaId") REFERENCES "otkazmalar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "otkazma_tarkibi" ADD CONSTRAINT "otkazma_tarkibi_manbaTovarId_fkey"
  FOREIGN KEY ("manbaTovarId") REFERENCES "tovarlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "otkazma_tarkibi" ADD CONSTRAINT "otkazma_tarkibi_qabulTovarId_fkey"
  FOREIGN KEY ("qabulTovarId") REFERENCES "tovarlar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ombor_harakati" ADD CONSTRAINT "ombor_harakati_otkazmaId_fkey"
  FOREIGN KEY ("otkazmaId") REFERENCES "otkazmalar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
