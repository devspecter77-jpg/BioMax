import { prisma } from './prisma'
import { holatNomi, type OnlaynBuyurtma, type OnlaynHolat, type OnlaynRoyxat } from './onlayn-buyurtma'

// Onlayn buyurtmalarni O'QISH — bitta bazadan, to'g'ridan-to'g'ri.
//
// ERP va onlayn do'kon bitta PostgreSQL bazasida (ERP `public`, do'kon
// `marketplace` sxemasida). Ilgari panel har necha soniyada marketplace'ning
// imzolangan API'siga so'rov yuborardi: kalit yoki manzil noto'g'ri bo'lsa
// panel butunlay bo'sh qolardi. Endi o'qish `marketplace.erp_buyurtmalar`
// ko'rinishidan boradi — jonli va sozlamaga bog'liq emas.
//
// YOZISH bu yerdan bormaydi: holat o'zgarishi qoidalari (qaysi holatdan
// qaysisiga o'tish mumkin, bekor sababi, tarix yozuvi) onlayn do'kon
// tomonida yashaydi va imzolangan API orqali bajariladi
// (`lib/marketplace-mijoz.ts`). Qoida bitta joyda qolishi uchun shunday.

export const SAHIFA_HAJMI = 30

const FAOL: OnlaynHolat[] = ['YANGI', 'TASDIQLANGAN', 'YIGILMOQDA', 'YOLDA']

/** Ko'rinish qaytaradigan qator. */
interface Qator {
  id: string
  raqam: string
  holati: OnlaynHolat
  yetkazish: 'KURYER' | 'OLIB_KETISH'
  hudud: string | null
  manzilMatni: string | null
  moljal: string | null
  lat: number | null
  lng: number | null
  aloqaTel: string
  aloqaIsm: string | null
  vaqtOraligi: string | null
  yetkazishBoshi: Date | null
  tolovUsuli: OnlaynBuyurtma['tolovUsuli']
  mahsulotSumma: number
  yetkazishNarx: number
  jamiSumma: number
  izoh: string | null
  bekorSababi: string | null
  yaratilgan: Date
  yangilangan: Date
  keyingiHolatlar: OnlaynHolat[]
  qatorlar: OnlaynBuyurtma['qatorlar']
  tarix: OnlaynBuyurtma['tarix']
}

function ogir(q: Qator): OnlaynBuyurtma {
  return {
    ...q,
    holatYorligi: holatNomi(q.holati, q.yetkazish),
    yetkazishBoshi: q.yetkazishBoshi ? new Date(q.yetkazishBoshi).toISOString() : null,
    yaratilgan: new Date(q.yaratilgan).toISOString(),
    yangilangan: new Date(q.yangilangan).toISOString(),
    qatorlar: q.qatorlar ?? [],
    tarix: q.tarix ?? [],
  }
}

export interface RoyxatFiltri {
  holat?: string | null
  qidiruv?: string | null
  sahifa?: number
  /** Faqat shu raqamlar — dostavchik o'ziga biriktirilganlarini ko'radi */
  raqamlar?: string[] | null
}

/** Panel ro'yxati: filtr, qidiruv, sahifalash va tablar uchun sonlar. */
export async function buyurtmalarRoyxati(f: RoyxatFiltri): Promise<Omit<OnlaynRoyxat, 'dostavchikRejimi'>> {
  const sahifa = Math.max(1, Math.min(1000, Math.floor(f.sahifa ?? 1)))
  const qidiruv = f.qidiruv?.trim().slice(0, 60) || null
  const raqamlar = f.raqamlar?.length ? f.raqamlar : null

  // Shartlar parametr sifatida uzatiladi — matnga qo'shilmaydi (SQL injection).
  const shartlar: string[] = []
  const p: unknown[] = []
  const qosh = (sql: string, qiymat: unknown) => {
    p.push(qiymat)
    shartlar.push(sql.replace('$#', `$${p.length}`))
  }

  if (f.holat === 'FAOL') qosh('holati = ANY($#)', FAOL)
  else if (f.holat) qosh('holati = $#', f.holat)
  if (raqamlar) qosh('raqam = ANY($#)', raqamlar)
  if (qidiruv) {
    p.push(`%${qidiruv}%`)
    const matn = `$${p.length}`
    p.push(`%${qidiruv.replace(/\D/g, '') || qidiruv}%`)
    shartlar.push(`(raqam ILIKE ${matn} OR "aloqaIsm" ILIKE ${matn} OR "aloqaTel" LIKE $${p.length})`)
  }
  const where = shartlar.length ? `WHERE ${shartlar.join(' AND ')}` : ''

  const [qatorlar, [jami], sonQatorlari] = await Promise.all([
    prisma.$queryRawUnsafe<Qator[]>(
      `SELECT * FROM marketplace.erp_buyurtmalar ${where}
       ORDER BY yaratilgan DESC LIMIT ${SAHIFA_HAJMI} OFFSET ${(sahifa - 1) * SAHIFA_HAJMI}`,
      ...p,
    ),
    prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM marketplace.erp_buyurtmalar ${where}`,
      ...p,
    ),
    // Tablardagi sonlar holat va qidiruvga qaramaydi, lekin dostavchik
    // boshqalarnikini ko'rmasligi uchun raqamlar doirasi saqlanadi.
    raqamlar
      ? prisma.$queryRawUnsafe<{ holati: OnlaynHolat; n: number }[]>(
          `SELECT holati, count(*)::int AS n FROM marketplace.erp_buyurtmalar WHERE raqam = ANY($1) GROUP BY holati`,
          raqamlar,
        )
      : prisma.$queryRawUnsafe<{ holati: OnlaynHolat; n: number }[]>(
          `SELECT holati, count(*)::int AS n FROM marketplace.erp_buyurtmalar GROUP BY holati`,
        ),
  ])

  return {
    buyurtmalar: qatorlar.map(ogir),
    jami: jami?.n ?? 0,
    sahifa,
    sahifaHajmi: SAHIFA_HAJMI,
    sonlar: Object.fromEntries(sonQatorlari.map(s => [s.holati, s.n])) as OnlaynRoyxat['sonlar'],
  }
}

/** Bitta buyurtma — panel oynasi uchun (qatorlar va tarix bilan). */
export async function buyurtmaTafsiloti(raqam: string): Promise<OnlaynBuyurtma | null> {
  const qatorlar = await prisma.$queryRawUnsafe<Qator[]>(
    `SELECT * FROM marketplace.erp_buyurtmalar WHERE raqam = $1 LIMIT 1`,
    raqam,
  )
  return qatorlar[0] ? ogir(qatorlar[0]) : null
}

/**
 * Jonli yangilanish belgisi — panel uni bir necha soniyada bir so'raydi.
 * Eng arzon yo'l: oxirgi o'zgarish vaqti va buyurtmalar soni.
 */
export async function buyurtmaBelgisi(): Promise<{
  belgi: string
  yangiSoni: number
  oxirgi: { raqam: string; yaratilgan: string } | null
}> {
  const [q] = await prisma.$queryRawUnsafe<{
    oxirgiOzgarish: Date | null
    soni: number
    yangiSoni: number
    oxirgiRaqam: string | null
    oxirgiSana: Date | null
  }[]>(`
    SELECT
      max(yangilangan) AS "oxirgiOzgarish",
      count(*)::int AS soni,
      count(*) FILTER (WHERE holati = 'YANGI')::int AS "yangiSoni",
      (SELECT raqam FROM marketplace.mp_buyurtmalar ORDER BY yaratilgan DESC LIMIT 1) AS "oxirgiRaqam",
      (SELECT yaratilgan FROM marketplace.mp_buyurtmalar ORDER BY yaratilgan DESC LIMIT 1) AS "oxirgiSana"
    FROM marketplace.mp_buyurtmalar
  `)
  return {
    belgi: `${q?.oxirgiOzgarish ? new Date(q.oxirgiOzgarish).getTime() : 0}.${q?.soni ?? 0}`,
    yangiSoni: q?.yangiSoni ?? 0,
    oxirgi: q?.oxirgiRaqam && q.oxirgiSana
      ? { raqam: q.oxirgiRaqam, yaratilgan: new Date(q.oxirgiSana).toISOString() }
      : null,
  }
}
