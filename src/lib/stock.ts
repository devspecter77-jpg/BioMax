import { prisma } from './prisma'

interface StockRow {
  tovarId: string
  omborQoldiq: number
  dokonQoldiq: number
}

/**
 * SQL aggregatsiya bilan barcha tovarlar uchun qoldiqni hisoblash.
 *
 * Harakat turlari:
 *   KIRIM / QAYTARISH / OTKAZMA_KIRIM  -> o'z joyiga (+)
 *   CHIQIM / YOQOTISH / OTKAZMA_CHIQIM -> o'z joyidan (-)
 *   OTKAZMA                            -> filial ICHIDA ombordan do'konga
 *                                         (ombordan -, do'konga +)
 *
 * OTKAZMA_* filiallararo o'tkazma: manba mahsulotda haqiqiy chiqim,
 * qabul mahsulotda haqiqiy kirim (ular ayrim qatorlar).
 * omborHarakati include qilish o'rniga bitta SQL query.
 *
 * Oldin: 1000 tovar × 50 harakat = 50,000 yozuv JS ga yuklanardi
 * Hozir: bitta GROUP BY query — bazada hisoblanadi
 */
/** `db` — ixtiyoriy: tranzaksiya mijozi berilsa, o'sha tranzaksiya ichidagi
 *  (hali commit qilinmagan) harakatlar ham hisobga olinadi. Testlar shu
 *  orqali jonli bazaga yozmasdan tekshiradi. */
export async function getStockMap(
  tovarIds?: string[],
  db: { $queryRawUnsafe: typeof prisma.$queryRawUnsafe } = prisma,
): Promise<Map<string, { omborQoldiq: number; dokonQoldiq: number }>> {
  // ID'lar SQL matniga QO'SHILMAYDI — parametr sifatida uzatiladi.
  // Ilgari `'${id}'` bilan qo'shilardi: ID tashqaridan kelsa (masalan
  // marketplace shartnomasi orqali) bu SQL injection eshigi bo'lardi.
  const filtrBor = !!tovarIds && tovarIds.length > 0
  const filter = filtrBor ? `WHERE "tovarId" = ANY($1::text[])` : ''
  const parametrlar = filtrBor ? [tovarIds] : []

  // Jadval nomi SXEMA BILAN yoziladi (`public.ombor_harakati`).
  // Xom SQL — Prisma'ning oddiy so'rovlaridan farqli — `search_path` ga
  // tayanadi. Neon pooler'i (PgBouncer) sessiya sozlamalarini ulanishlar
  // orasida tarqatadi: boshqa mijoz (masalan `schema=` bilan ishlagan
  // migratsiya) `search_path` ni o'zgartirsa, bu so'rov vaqti-vaqti bilan
  // `relation "ombor_harakati" does not exist` bilan yiqilardi.
  const rows = await db.$queryRawUnsafe<StockRow[]>(`
    SELECT
      "tovarId",
      COALESCE(SUM(CASE
        WHEN joy = 'DOKON' THEN 0
        WHEN turi IN ('KIRIM', 'QAYTARISH', 'OTKAZMA_KIRIM') THEN miqdor
        WHEN turi = 'OTKAZMA' THEN -miqdor
        ELSE -miqdor
      END), 0)::float AS "omborQoldiq",
      COALESCE(SUM(CASE
        WHEN turi = 'OTKAZMA' THEN miqdor
        WHEN joy != 'DOKON' THEN 0
        WHEN turi IN ('KIRIM', 'QAYTARISH', 'OTKAZMA_KIRIM') THEN miqdor
        ELSE -miqdor
      END), 0)::float AS "dokonQoldiq"
    FROM public.ombor_harakati
    ${filter}
    GROUP BY "tovarId"
  `, ...parametrlar)

  const map = new Map<string, { omborQoldiq: number; dokonQoldiq: number }>()
  for (const r of rows) {
    map.set(r.tovarId, {
      omborQoldiq: Math.max(0, r.omborQoldiq),
      dokonQoldiq: Math.max(0, r.dokonQoldiq),
    })
  }
  return map
}
