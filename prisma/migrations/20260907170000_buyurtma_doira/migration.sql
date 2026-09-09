-- Saqlab qo'yilgan savat ("zakaz") uchun doiralash va yangilanish vaqti.
-- Busiz bir do'konning saqlangan zakazlari boshqasining kassasida
-- ko'rinib qolardi (Buyurtma'da filial/ega maydonlari yo'q edi).

ALTER TABLE "buyurtmalar" ADD COLUMN IF NOT EXISTS "filialId" TEXT;
ALTER TABLE "buyurtmalar" ADD COLUMN IF NOT EXISTS "egaId" TEXT;
ALTER TABLE "buyurtmalar" ADD COLUMN IF NOT EXISTS "yangilangan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "buyurtmalar_holati_yaratilgan_idx" ON "buyurtmalar"("holati", "yaratilgan");
CREATE INDEX IF NOT EXISTS "buyurtmalar_filialId_idx" ON "buyurtmalar"("filialId");
CREATE INDEX IF NOT EXISTS "buyurtmalar_egaId_idx" ON "buyurtmalar"("egaId");

ALTER TABLE "buyurtmalar" ADD CONSTRAINT "buyurtmalar_filialId_fkey"
  FOREIGN KEY ("filialId") REFERENCES "filiallar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "buyurtmalar" ADD CONSTRAINT "buyurtmalar_egaId_fkey"
  FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
