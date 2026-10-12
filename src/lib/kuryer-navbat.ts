import { after } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DOSTAVCHIK_DOIRASI, bugunBoshi } from '@/lib/dostavchik-server'
import { FAOL_YETKAZISH } from '@/lib/dostavchik'
import type { NavbatHolati, NavbatKuryerHolati, NavbatQisqa } from '@/lib/onlayn-buyurtma'

// Kuryerlar navbati — yangi yetkazish buyurtmalarini ishdagi kuryerlarga
// navbat bilan (1 → 2 → 3 → 1 …) avtomatik berish.
//
// Qoidalar:
//   · Navbatda faqat ISHDAGI kuryerlar: smenasi ochiq va ilovasi tirik
//     (oxirgi 10 daqiqada belgi bergan) — telefoni o'chgan kuryerga buyurtma
//     tushib, kutib qolmasin.
//   · Hech kim ishda bo'lmasa buyurtmalar yig'ilib turadi. Ish boshlanganda
//     ular TENG bo'linadi: kuryerlar odatda bir necha daqiqa farq bilan
//     keladi, birinchi kelgani hammasini olib ketmasligi uchun har biriga
//     ulush ajratiladi (yig'ilganlar ÷ faol kuryerlar soni). 30 daqiqada
//     kelmagan kuryerning ulushi ishdagilarga navbat bilan beriladi.
//   · Har buyurtma navbatdan BIR MARTA o'tadi (`kuryer_navbat` jurnali):
//     keyin administrator kuryerni almashtirsa yoki olib tashlasa — navbat
//     aralashmaydi.
//
// Alohida cron yo'q (Vercel'da daqiqalik cron yo'q, sayt esa boshqa
// loyihada): tez-tez keladigan so'rovlar — buyurtmalar paneli belgisi va
// kuryer ilovasining "tirikman" belgisi — javobdan keyin navbatni turtadi.
// Bir vaqtda faqat bitta taqsimlovchi ishlaydi (advisory lock).

type Db = typeof prisma | Prisma.TransactionClient

const KALIT = 'kuryer_navbat'

/** Shuncha vaqt belgi bermagan smena navbatdan vaqtincha chetda turadi. */
export const NAVBAT_TIRIK_MS = 10 * 60_000
/** Ish boshlangach yig'ilgan buyurtmalar shuncha vaqt teng ulushda beriladi. */
export const NAVBAT_ULUSH_MS = 30 * 60_000
/** Bir server nusxasida navbat ko'pi bilan shunchalik tez-tez tekshiriladi. */
const ORALIQ_MS = 5_000
/** Bundan eski buyurtma navbatga olinmaydi. */
const ENG_ESKI_MS = 7 * 86_400_000
/** Bir martada ko'pi bilan shuncha buyurtma ko'riladi. */
const PARTIYA = 50

// ─── Sozlama ─────────────────────────────────────────────────────────────────

interface Sozlama {
  yoqilgan: boolean
  /** Shu paytdan (ms) keyin tushgan buyurtmalar taqsimlanadi */
  boshi: number
}

function sozlamaniOqi(qiymat: string | null | undefined): Sozlama | null {
  if (!qiymat) return null
  try {
    const j = JSON.parse(qiymat) as Partial<Sozlama>
    if (typeof j.yoqilgan === 'boolean' && typeof j.boshi === 'number' && Number.isFinite(j.boshi)) {
      return { yoqilgan: j.yoqilgan, boshi: j.boshi }
    }
  } catch {
    // Buzilgan qiymat — pastda standart yoziladi
  }
  return null
}

export async function navbatSozlamasi(db: Db = prisma): Promise<Sozlama> {
  const q = await db.sozlama.findUnique({ where: { kalit: KALIT }, select: { qiymat: true } })
  const s = sozlamaniOqi(q?.qiymat)
  if (s) return s
  // Yozuv yo'q (odatda migratsiya qo'yadi): yoqilgan, SHU PAYTDAN boshlab —
  // eski buyurtmalar birdaniga kuryerlarga tarqalib ketmasin
  const yangi: Sozlama = { yoqilgan: true, boshi: Date.now() }
  const qiymat = JSON.stringify(yangi)
  await db.sozlama.upsert({ where: { kalit: KALIT }, update: { qiymat }, create: { kalit: KALIT, qiymat } })
  return yangi
}

/**
 * Navbatni yoqish yoki o'chirish. Qayta yoqilganda faqat shundan keyin
 * tushgan buyurtmalar taqsimlanadi — o'chiq paytda kelganlari qo'lda
 * boshqarilgan, ularga tegilmaydi.
 */
export async function navbatniOrnat(yoqilgan: boolean, db: Db = prisma): Promise<void> {
  const joriy = await navbatSozlamasi(db)
  if (joriy.yoqilgan === yoqilgan) return
  const qiymat = JSON.stringify({ yoqilgan, boshi: yoqilgan ? Date.now() : joriy.boshi })
  await db.sozlama.update({ where: { kalit: KALIT }, data: { qiymat } })
}

// ─── Navbatdagi buyurtmalar va kuryerlar ─────────────────────────────────────

interface Kutayotgan {
  raqam: string
  aloqaIsm: string | null
  aloqaTel: string | null
  hudud: string | null
  manzilMatni: string | null
  lat: number | null
  lng: number | null
  jamiSumma: number | null
  /** Saytda tushgan vaqt, ms */
  vaqt: number
}

/**
 * Navbatdagi buyurtmalar, eskisi birinchi: yetkazib beriladigan, hali yo'lga
 * chiqmagan, kuryersiz va navbatdan o'tmagan. Ko'pincha bo'sh — shuning
 * uchun har tekshiruv shu arzon so'rovdan boshlanadi.
 */
async function kutayotganlar(boshi: number, db: Db = prisma): Promise<Kutayotgan[]> {
  const dan = Math.max(boshi, Date.now() - ENG_ESKI_MS)
  // Saytning vaqt ustunlari UTC (vaqt zonasiz) — solishtirish ham UTC'da
  return db.$queryRawUnsafe<Kutayotgan[]>(
    `SELECT b.raqam, b."aloqaIsm", b."aloqaTel", b.hudud, b."manzilMatni", b.lat, b.lng, b."jamiSumma",
            (EXTRACT(EPOCH FROM b.yaratilgan) * 1000)::float8 AS vaqt
       FROM marketplace.erp_buyurtmalar b
      WHERE b.yetkazish = 'KURYER'
        AND b.holati IN ('YANGI', 'TASDIQLANGAN', 'YIGILMOQDA')
        AND b.yaratilgan >= (to_timestamp($1::float8 / 1000) AT TIME ZONE 'UTC')
        AND NOT EXISTS (SELECT 1 FROM public.onlayn_yetkazishlar y WHERE y."buyurtmaRaqami" = b.raqam)
        AND NOT EXISTS (SELECT 1 FROM public.kuryer_navbat n WHERE n."buyurtmaRaqami" = b.raqam)
      ORDER BY b.yaratilgan, b.raqam
      LIMIT ${PARTIYA}`,
    dan,
  )
}

interface Kuryer {
  id: string
  ism: string
  holat: NavbatKuryerHolati
  smenaBoshi: number | null
}

/**
 * Faol kuryerlar navbat tartibida (birinchi qo'shilgani — 1-kuryer) va
 * hozirgi holati. `tartib` faol bo'lmaganlari bilan: navbat ko'rsatkichi
 * ishdan bo'shagan kuryerda tursa ham o'rni yo'qolmasin.
 */
async function kuryerlar(db: Db, hozir: number): Promise<{ tartib: string[]; royxat: Kuryer[] }> {
  const hammasi = await db.foydalanuvchi.findMany({
    where: DOSTAVCHIK_DOIRASI,
    orderBy: [{ yaratilgan: 'asc' }, { id: 'asc' }],
    select: { id: true, ism: true, faol: true },
  })
  const faollar = hammasi.filter(k => k.faol)
  const smenalar = faollar.length === 0 ? [] : await db.smena.findMany({
    where: { xodimId: { in: faollar.map(k => k.id) }, tugadi: null },
    select: { xodimId: true, boshlandi: true, oxirgiPuls: true },
  })
  const smena = new Map(smenalar.map(s => [s.xodimId, s]))
  return {
    tartib: hammasi.map(k => k.id),
    royxat: faollar.map((k): Kuryer => {
      const s = smena.get(k.id)
      if (!s) return { id: k.id, ism: k.ism, holat: 'ishda_emas', smenaBoshi: null }
      const tirik = (s.oxirgiPuls ?? s.boshlandi).getTime() >= hozir - NAVBAT_TIRIK_MS
      return { id: k.id, ism: k.ism, holat: tirik ? 'ishda' : 'aloqa_yoq', smenaBoshi: s.boshlandi.getTime() }
    }),
  }
}

/** Oxirgi olgandan keyingi kuryer (aylanma), faqat nomzodlar orasidan. */
export function keyingiKuryer(tartib: string[], nomzodlar: ReadonlySet<string>, oxirgiId: string | null): string | null {
  const n = tartib.length
  const i = oxirgiId ? tartib.indexOf(oxirgiId) : -1
  for (let qadam = 1; qadam <= n; qadam++) {
    const id = tartib[(i + qadam) % n]
    if (nomzodlar.has(id)) return id
  }
  return null
}

async function oxirgiOlgan(db: Db): Promise<string | null> {
  const q = await db.kuryerNavbat.findFirst({ orderBy: { id: 'desc' }, select: { dostavchikId: true } })
  return q?.dostavchikId ?? null
}

// ─── Taqsimlash ──────────────────────────────────────────────────────────────

export interface TaqsimlashNatijasi {
  /** Shu safar kuryerga berilganlar */
  berildi: { raqam: string; dostavchikId: string }[]
  /** Navbatda qolganlar */
  qoldi: number
}

export async function navbatniIshlat(): Promise<TaqsimlashNatijasi> {
  const sozlama = await navbatSozlamasi()
  if (!sozlama.yoqilgan) return { berildi: [], qoldi: 0 }
  const oldindan = await kutayotganlar(sozlama.boshi)
  if (oldindan.length === 0) return { berildi: [], qoldi: 0 }

  return prisma.$transaction(tx => taqsimla(tx, sozlama.boshi), { maxWait: 10_000, timeout: 30_000 })
}

/**
 * Taqsimlashning o'zi — berilgan tranzaksiya ichida. Bir vaqtda bitta
 * taqsimlovchi: qulf band bo'lsa kutmaydi, ishlab turgani bajaradi.
 */
export async function taqsimla(tx: Prisma.TransactionClient, boshi: number): Promise<TaqsimlashNatijasi> {
  const [qulf] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('kuryer-navbat')) AS ok`
  if (!qulf?.ok) return { berildi: [], qoldi: 0 }

  // Qulf ostida o'qiladi: shu orada qo'lda biriktirilgan bo'lishi mumkin
  const navbat = await kutayotganlar(boshi, tx)
  if (navbat.length === 0) return { berildi: [], qoldi: 0 }

  const hozir = Date.now()
  const { tartib, royxat } = await kuryerlar(tx, hozir)
  const ishdagilar = royxat.filter(k => k.holat === 'ishda')
  // Hech kim ishda emas — buyurtmalar yig'ilib turadi
  if (ishdagilar.length === 0) return { berildi: [], qoldi: navbat.length }

  // Ish boshlanishidan oldin tushganlar — "yig'ilgan". Ish boshlangach
  // NAVBAT_ULUSH_MS davomida ular teng ulushda beriladi
  const ishBoshi = Math.min(...ishdagilar.map(k => k.smenaBoshi ?? hozir))
  const yigilgan = (b: Kutayotgan) => b.vaqt < ishBoshi
  const ulushDavri = hozir - ishBoshi < NAVBAT_ULUSH_MS && navbat.some(yigilgan)
  const olgan = new Map<string, number>()
  let ulush = Infinity
  if (ulushDavri) {
    // Shu ish davrida yig'ilganlardan kim nechta olgan
    const berilgan = await tx.kuryerNavbat.groupBy({
      by: ['dostavchikId'],
      where: { yaratilgan: { gte: new Date(ishBoshi) }, buyurtmaYaratilgan: { lt: new Date(ishBoshi) } },
      _count: { _all: true },
    })
    for (const g of berilgan) olgan.set(g.dostavchikId, g._count._all)
    const jami = navbat.filter(yigilgan).length + berilgan.reduce((s, g) => s + g._count._all, 0)
    ulush = Math.ceil(jami / royxat.length)
  }

  let oxirgi = await oxirgiOlgan(tx)
  const berildi: TaqsimlashNatijasi['berildi'] = []
  for (const b of navbat) {
    const cheklangan = ulushDavri && yigilgan(b)
    const nomzodlar = new Set(ishdagilar.filter(k => !cheklangan || (olgan.get(k.id) ?? 0) < ulush).map(k => k.id))
    const kimga = keyingiKuryer(tartib, nomzodlar, oxirgi)
    // Ishdagilar ulushini olgan — qolgani kechikayotgan kuryerni kutadi
    if (!kimga) continue

    const { count } = await tx.onlaynYetkazish.createMany({
      data: [{
        buyurtmaRaqami: b.raqam,
        dostavchikId: kimga,
        // Qo'lda biriktirishdagi kabi nusxa: kuryer paneli saytga murojaat qilmasin
        aloqaIsm: b.aloqaIsm,
        aloqaTel: b.aloqaTel,
        manzilMatni: [b.hudud, b.manzilMatni].filter(Boolean).join(', ') || null,
        lat: b.lat,
        lng: b.lng,
        jamiSumma: b.jamiSumma,
      }],
      skipDuplicates: true,
    })
    // Shu orada qo'lda biriktirilgan — tegilmaydi
    if (count === 0) continue

    await tx.kuryerNavbat.create({
      data: { buyurtmaRaqami: b.raqam, dostavchikId: kimga, buyurtmaYaratilgan: new Date(b.vaqt) },
    })
    oxirgi = kimga
    if (cheklangan) olgan.set(kimga, (olgan.get(kimga) ?? 0) + 1)
    berildi.push({ raqam: b.raqam, dostavchikId: kimga })
  }
  return { berildi, qoldi: navbat.length - berildi.length }
}

let oxirgiTurtki = 0

/**
 * Navbatni javobdan KEYIN ishlatish — so'rov kutib qolmaydi. Belgi so'rovlari
 * har necha soniyada keladi, shuning uchun bir nusxada ko'pi bilan
 * `ORALIQ_MS` da bir marta. `darhol` — kuryer hozirgina ishni boshladi.
 */
export function navbatniTurt(darhol = false): void {
  const hozir = Date.now()
  if (!darhol && hozir - oxirgiTurtki < ORALIQ_MS) return
  oxirgiTurtki = hozir
  after(async () => {
    try {
      await navbatniIshlat()
    } catch (e) {
      console.error('[kuryer navbat]', e)
    }
  })
}

// ─── Panel uchun holat ───────────────────────────────────────────────────────

/** Buyurtmalar ro'yxati uchun: nechta kutmoqda va ishda kim bor. */
export async function navbatQisqa(): Promise<NavbatQisqa> {
  const s = await navbatSozlamasi()
  if (!s.yoqilgan) return { yoqilgan: false, kutayotgan: [], ishdagilar: 0 }
  const chegara = new Date(Date.now() - NAVBAT_TIRIK_MS)
  const [navbat, ishdagilar] = await Promise.all([
    kutayotganlar(s.boshi),
    prisma.smena.count({
      where: {
        tugadi: null,
        xodim: { ...DOSTAVCHIK_DOIRASI, faol: true },
        OR: [{ oxirgiPuls: { gte: chegara } }, { oxirgiPuls: null, boshlandi: { gte: chegara } }],
      },
    }),
  ])
  return { yoqilgan: true, kutayotgan: navbat.map(b => b.raqam), ishdagilar }
}

/** "Kuryerlar navbati" oynasi uchun to'liq holat. */
export async function navbatHolati(): Promise<NavbatHolati> {
  const s = await navbatSozlamasi()
  const hozir = Date.now()
  const [navbat, { tartib, royxat }, oxirgi, bugungi, bandlar] = await Promise.all([
    s.yoqilgan ? kutayotganlar(s.boshi) : Promise.resolve([] as Kutayotgan[]),
    kuryerlar(prisma, hozir),
    oxirgiOlgan(prisma),
    prisma.kuryerNavbat.groupBy({
      by: ['dostavchikId'], where: { yaratilgan: { gte: bugunBoshi() } }, _count: { _all: true },
    }),
    prisma.onlaynYetkazish.groupBy({
      by: ['dostavchikId'], where: { holati: { in: FAOL_YETKAZISH } }, _count: { _all: true },
    }),
  ])
  const sanoq = (g: { dostavchikId: string; _count: { _all: number } }[]) => new Map(g.map(x => [x.dostavchikId, x._count._all]))
  const bugun = sanoq(bugungi)
  const band = sanoq(bandlar)

  const ishdagilar = royxat.filter(k => k.holat === 'ishda')
  const ishBoshi = ishdagilar.length ? Math.min(...ishdagilar.map(k => k.smenaBoshi ?? hozir)) : null
  const ulushDavri = ishBoshi !== null && hozir - ishBoshi < NAVBAT_ULUSH_MS && navbat.some(b => b.vaqt < ishBoshi)

  return {
    yoqilgan: s.yoqilgan,
    boshi: new Date(s.boshi).toISOString(),
    kutayotgan: navbat.map(b => b.raqam),
    kuryerlar: royxat.map(k => ({
      id: k.id,
      ism: k.ism,
      holat: k.holat,
      smenaBoshi: k.smenaBoshi ? new Date(k.smenaBoshi).toISOString() : null,
      bugun: bugun.get(k.id) ?? 0,
      band: band.get(k.id) ?? 0,
    })),
    keyingiId: keyingiKuryer(tartib, new Set(ishdagilar.map(k => k.id)), oxirgi),
    ulushTugashi: ulushDavri ? new Date(ishBoshi + NAVBAT_ULUSH_MS).toISOString() : null,
  }
}
