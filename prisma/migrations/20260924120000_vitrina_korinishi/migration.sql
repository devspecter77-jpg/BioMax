-- Onlayn vitrina katalogi — BITTA ko'rinish (view), ikkala tizim uchun.
--
-- Nega: marketplace shu bazadadir (ERP `public`, vitrina `marketplace`
-- sxemasida), lekin katalogni ERP'ning HTTP shartnomasi orqali olardi.
-- U yo'l tarmoqqa, HMAC kalitiga va 60 soniyalik keshga bog'liq edi —
-- kalit yo'qolsa sayt butunlay bo'sh qolardi. Endi sayt shu ko'rinishdan
-- to'g'ridan-to'g'ri o'qiydi: narx va mavjudlik REAL VAQTDA.
--
-- QAT'IY QOIDA shu yerda saqlanadi (TZ 12.3): ko'rinish hech qachon
-- `kelishNarxi`, ta'minotchi, foyda yoki ANIQ QOLDIQ SONINI bermaydi —
-- mavjudlik faqat BOR / KAM / YOQ. Marketplace ERP jadvallarini o'zi
-- o'qimaydi, faqat shu ko'rinishni o'qiydi.
--
-- Qoidalar ERP kodidagi bilan bir xil:
--   · qoldiq        — `src/lib/stock.ts` (ombor + do'kon, harakat turlari)
--   · band qilingan — `faolRezervlar` (muddati o'tmagan FAOL rezervlar)
--   · "kam qoldi"   — `Tovar.minimalQoldiq` chegarasi
--   · aksiya        — `aksiyaHolati` (boshi ≤ hozir < oxiri)
--   · saytda        — faqat «Onlayn vitrina»da belgilangan mahsulot

CREATE OR REPLACE VIEW public.vitrina_katalog AS
WITH qoldiq AS (
  SELECT
    "tovarId",
    GREATEST(COALESCE(SUM(CASE
      WHEN joy = 'DOKON' THEN 0
      WHEN turi IN ('KIRIM', 'QAYTARISH', 'OTKAZMA_KIRIM') THEN miqdor
      WHEN turi = 'OTKAZMA' THEN -miqdor
      ELSE -miqdor
    END), 0), 0) AS ombor,
    GREATEST(COALESCE(SUM(CASE
      WHEN turi = 'OTKAZMA' THEN miqdor
      WHEN joy <> 'DOKON' THEN 0
      WHEN turi IN ('KIRIM', 'QAYTARISH', 'OTKAZMA_KIRIM') THEN miqdor
      ELSE -miqdor
    END), 0), 0) AS dokon
  FROM public.ombor_harakati
  GROUP BY "tovarId"
),
band AS (
  SELECT "tovarId", COALESCE(SUM(miqdor), 0) AS miqdor
  FROM public.onlayn_rezervlar
  WHERE holati = 'FAOL' AND "amalQiladi" > now()
  GROUP BY "tovarId"
),
asos AS (
  SELECT
    t.id,
    t.nomi,
    t.birlik::text AS birlik,
    t."shtrixKod",
    t."sotishNarxi",
    t.valyuta::text AS valyuta,
    t."minimalQoldiq",
    t.rasmlar,
    t.yangilangan AS t_yangilangan,
    k.id   AS "kategoriyaId",
    k.nomi AS "kategoriyaNomi",
    o.id   AS "omborId",
    o.nomi AS "omborNomi",
    v.sarlavha,
    v.brend,
    v.tavsif,
    v.xususiyatlar,
    v.hajm,
    v."hajmBirligi"::text AS "hajmBirligi",
    v."aksiyaNarxi",
    v."aksiyaEskiNarx",
    v."aksiyaOxiri",
    v.yangilangan AS v_yangilangan,
    -- Aksiya ayni damda amal qilyaptimi
    (v."aksiyaNarxi" IS NOT NULL
      AND v."aksiyaBoshi" IS NOT NULL
      AND v."aksiyaOxiri" IS NOT NULL
      AND now() >= v."aksiyaBoshi"
      AND now() <  v."aksiyaOxiri") AS aksiya_faol,
    COALESCE(q.ombor, 0) + COALESCE(q.dokon, 0) - COALESCE(b.miqdor, 0) AS sotiladigan
  FROM public.tovarlar t
  JOIN public.tovar_kartochkalari v ON v."tovarId" = t.id AND v.saytda = true
  LEFT JOIN public.kategoriyalar k ON k.id = t."kategoriyaId"
  LEFT JOIN public.omborlar o ON o.id = k."omborId"
  LEFT JOIN qoldiq q ON q."tovarId" = t.id
  LEFT JOIN band b ON b."tovarId" = t.id
  WHERE t.holati = 'FAOL'
    -- Qulflangan mahsulot kassada ham sotilmaydi
    AND t.qulflangan = false
)
SELECT
  id,
  nomi,
  birlik,
  "shtrixKod",
  -- Narx: aksiya amal qilsa aksiya narxi (ERP kassada ham shu narxni qo'yadi)
  (CASE WHEN aksiya_faol THEN "aksiyaNarxi" ELSE "sotishNarxi" END)::float8 AS "sotishNarxi",
  valyuta,
  (CASE
    WHEN sotiladigan <= 0 THEN 'YOQ'
    WHEN sotiladigan <= GREATEST(1, "minimalQoldiq") THEN 'KAM'
    ELSE 'BOR'
  END) AS mavjudlik,
  "kategoriyaId",
  "kategoriyaNomi",
  "omborId",
  "omborNomi",
  sarlavha,
  brend,
  tavsif,
  xususiyatlar,
  hajm::float8 AS hajm,
  "hajmBirligi",
  -- Chizilgan "eski narx" faqat HAQIQIY bo'lsa: aksiya amal qilyapti va
  -- oldingi narx aksiya narxidan yuqori. Uydirma chegirma ko'rsatilmaydi.
  (CASE
    WHEN aksiya_faol AND COALESCE("aksiyaEskiNarx", "sotishNarxi") > "aksiyaNarxi"
      THEN COALESCE("aksiyaEskiNarx", "sotishNarxi")
    ELSE NULL
  END)::float8 AS "eskiNarx",
  (CASE
    WHEN aksiya_faol AND COALESCE("aksiyaEskiNarx", "sotishNarxi") > "aksiyaNarxi"
      THEN "aksiyaOxiri"
    ELSE NULL
  END) AS "aksiyaOxiri",
  -- Rasmning O'ZI emas, versiyasi: rasmlar ~200 KB, ular alohida olinadi
  ARRAY(
    SELECT left(md5(r), 12)
    FROM unnest(rasmlar) WITH ORDINALITY AS u(r, i)
    ORDER BY i
  ) AS rasmlar,
  GREATEST(t_yangilangan, v_yangilangan) AS yangilangan
FROM asos;

COMMENT ON VIEW public.vitrina_katalog IS
  'Onlayn do''kon katalogi. Marketplace SHU ko''rinishni o''qiydi (jadvallarni emas). Aniq qoldiq, kelish narxi va ta''minotchi bu yerda YO''Q.';
