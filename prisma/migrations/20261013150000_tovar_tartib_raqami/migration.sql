-- Mahsulot tartib raqami (№ 1, 2, 3…) — bir do'kon ichida ketma-ket.
-- Do'kon = filial (filialId) yoki Ega katalogi (filialId bo'sh, egaId).

-- AlterTable
ALTER TABLE "tovarlar" ADD COLUMN     "tartibRaqami" INTEGER;

-- CreateIndex
CREATE INDEX "tovarlar_egaId_tartibRaqami_idx" ON "tovarlar"("egaId", "tartibRaqami");

-- CreateIndex
CREATE INDEX "tovarlar_filialId_tartibRaqami_idx" ON "tovarlar"("filialId", "tartibRaqami");

-- Mavjud mahsulotlar — qo'shilgan tartibida raqamlanadi
UPDATE public."tovarlar" t SET "tartibRaqami" = r.n
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY COALESCE("filialId", 'ega:' || COALESCE("egaId", '-'))
    ORDER BY "yaratilgan", id
  ) AS n
  FROM public."tovarlar"
) r
WHERE r.id = t.id;

-- Yangi mahsulot — baza o'zi keyingi raqamni beradi (qaysi yo'l bilan qo'shilmasin:
-- sahifa, Excel import, filialga o'tkazma). Bir vaqtda ikki mahsulot qo'shilsa ham
-- raqam takrorlanmasin — shu do'kon uchun tranzaksiya qulfi olinadi.
-- Jadval nomi `public.` bilan: ilova pooler orqali ulanganda search_path boshqacha bo'lishi mumkin
CREATE OR REPLACE FUNCTION public.tovar_tartib_raqami() RETURNS trigger
SET search_path = public
AS $$
BEGIN
  IF NEW."tartibRaqami" IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('tovar-tartib:' || COALESCE(NEW."filialId", 'ega:' || COALESCE(NEW."egaId", '-'))));
    SELECT COALESCE(MAX("tartibRaqami"), 0) + 1 INTO NEW."tartibRaqami"
      FROM public."tovarlar"
     WHERE CASE WHEN NEW."filialId" IS NOT NULL
                THEN "filialId" = NEW."filialId"
                ELSE "filialId" IS NULL AND "egaId" IS NOT DISTINCT FROM NEW."egaId" END;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER tovar_tartib_raqami
  BEFORE INSERT ON public."tovarlar"
  FOR EACH ROW EXECUTE FUNCTION public.tovar_tartib_raqami();
