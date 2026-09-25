-- O'tkazma hujjatida nomli ombor (Ombor → Kategoriya → Tovar).
--
-- Ilgari o'tkazma faqat filial + joy (ombor/do'kon) orasida edi, shuning
-- uchun Omborlar sahifasida yaratilgan omborlar o'tkazmada tanlanmasdi.
-- Faqat qo'shimcha: ikkita bo'sh ustun va tashqi kalitlar, mavjud qatorlar
-- tegilmaydi (eski o'tkazmalarda ikkalasi null bo'lib qoladi).

ALTER TABLE "otkazmalar" ADD COLUMN IF NOT EXISTS "manbaOmborId" TEXT;
ALTER TABLE "otkazmalar" ADD COLUMN IF NOT EXISTS "qabulOmborId" TEXT;

DO $$ BEGIN
  ALTER TABLE "otkazmalar" ADD CONSTRAINT "otkazmalar_manbaOmborId_fkey"
    FOREIGN KEY ("manbaOmborId") REFERENCES "omborlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "otkazmalar" ADD CONSTRAINT "otkazmalar_qabulOmborId_fkey"
    FOREIGN KEY ("qabulOmborId") REFERENCES "omborlar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
