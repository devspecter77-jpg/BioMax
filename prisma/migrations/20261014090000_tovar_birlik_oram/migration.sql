-- O'lchov birligi: tayyor ro'yxat (enum) o'rniga erkin matn — foydalanuvchi o'z
-- birligini yozadi ("juft", "rulon"). Mavjud qiymatlar (DONA, KG…) o'zgarmaydi.
-- Qo'shimcha birliklar (o'ram): "1 karobka = 24 dona" — JSON ro'yxat.
--
-- Ustunga onlayn vitrina ko'rinishi (public.vitrina_katalog) bog'liq: turini
-- o'zgartirish uchun u olib tashlanib, JONLI ta'rifi bilan qayta yaratiladi
-- (keyin o'zgartirilgan bo'lsa ham saqlanadi). Ko'rinish birlikni allaqachon
-- matn (::text) sifatida beradi — sayt uchun hech narsa o'zgarmaydi.

DO $$
DECLARE
  tarif TEXT;
  izoh TEXT;
  korinish_bor BOOLEAN := to_regclass('public.vitrina_katalog') IS NOT NULL;
BEGIN
  IF korinish_bor THEN
    tarif := pg_get_viewdef('public.vitrina_katalog'::regclass, true);
    izoh := obj_description('public.vitrina_katalog'::regclass, 'pg_class');
    DROP VIEW public.vitrina_katalog;
  END IF;

  ALTER TABLE public."tovarlar" ALTER COLUMN "birlik" DROP DEFAULT;
  ALTER TABLE public."tovarlar" ALTER COLUMN "birlik" TYPE TEXT USING "birlik"::text;
  ALTER TABLE public."tovarlar" ALTER COLUMN "birlik" SET DEFAULT 'DONA';

  IF korinish_bor THEN
    EXECUTE 'CREATE VIEW public.vitrina_katalog AS ' || rtrim(tarif, E'; \n');
    IF izoh IS NOT NULL THEN
      EXECUTE format('COMMENT ON VIEW public.vitrina_katalog IS %L', izoh);
    END IF;
  END IF;
END $$;

-- "Birlik" turi shu yerda ATAYIN o'chirilmaydi: joylash paytida bir necha daqiqa
-- eski kod ham ishlaydi va qiymatni `'DONA'::"Birlik"` ko'rinishida yozadi — tur
-- bor ekan, u matn ustunga avtomatik o'tadi. Tur keyingi migratsiyada o'chiriladi.

-- AlterTable
ALTER TABLE public."tovarlar" ADD COLUMN "oramlar" JSONB NOT NULL DEFAULT '[]';
