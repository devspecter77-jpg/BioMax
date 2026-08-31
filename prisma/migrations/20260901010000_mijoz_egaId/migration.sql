-- Mijoz.egaId — Tovar.egaId bilan bir xil naqsh: filialsiz (Ega darajasidagi)
-- mijoz kimning katalogiga tegishli ekanini belgilaydi, shu orqali har bir
-- Ega faqat o'z mijozlarini ko'radi (bitta umumiy hovuz o'rniga).
ALTER TABLE "mijozlar" ADD COLUMN IF NOT EXISTS "egaId" TEXT;

CREATE INDEX IF NOT EXISTS "mijozlar_egaId_idx" ON "mijozlar"("egaId");

DO $$ BEGIN
  ALTER TABLE "mijozlar" ADD CONSTRAINT "mijozlar_egaId_fkey" FOREIGN KEY ("egaId") REFERENCES "foydalanuvchilar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
