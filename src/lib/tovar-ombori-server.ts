// Mahsulotni kiritishda (forma va Excel import) "Ombor (sklad)" va
// "Kategoriya" tanlovini bazadagi kategoriyaga aylantiradi — kerak bo'lsa
// yangi ombor va kategoriya ochadi.
//
// Mahsulotning ombori kategoriyasi orqali belgilanadi (lib/tovar-ombori.ts),
// shuning uchun "shu mahsulot Sklad 2 da" degani — uning kategoriyasi
// Sklad 2 da bo'lishi. Chaqiruvchi buni mahsulot yozuvi bilan BITTA
// tranzaksiyada qiladi: mahsulot saqlanmasa, yangi ombor/kategoriya ham qolmaydi.

import type { Prisma } from '@prisma/client'
import type { egaFilialWhere } from './filial-scope'
import { nomKaliti } from './utils'
import { markaziyNomimi, omborKategoriyasi, type MaqsadOmbor } from './tovar-ombori'

type Tx = Prisma.TransactionClient

/** Katalog doirasi: filial yoki Ega katalogi (`egaFilialWhere` bilan bir xil shakl) */
export type KatalogDoirasi = ReturnType<typeof egaFilialWhere>

/** Formadan keladigan tanlov (JSON — tekshirilmagan). */
export interface JoyTanlovi {
  kategoriyaId?: unknown
  yangiKategoriya?: unknown
  /** string — mavjud ombor; null — Markaziy ombor; yo'q — kategoriya qayerda bo'lsa */
  omborId?: unknown
  yangiOmbor?: unknown
}

/** So'rovga qaytariladigan xato — tranzaksiyani bekor qilib, javobga aylanadi. */
export class JoyXatosi extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const NOM_CHEGARA = 100

function nom(x: unknown): string {
  return typeof x === 'string' ? x.trim().replace(/\s+/g, ' ').slice(0, NOM_CHEGARA) : ''
}

/** Yangi ombor so'ralganmi — ruxsatni tranzaksiyadan OLDIN tekshirish uchun. */
export function yangiOmborSoralgan(t: JoyTanlovi): boolean {
  const n = nom(t.yangiOmbor)
  return n !== '' && !markaziyNomimi(n)
}

/**
 * Tanlovdan mahsulot kategoriyasining ID'si. Xato bo'lsa `JoyXatosi`
 * otiladi (tranzaksiya bekor bo'ladi).
 *
 * - Kategoriya va ombor shu katalog doirasida bo'lishi shart — boshqa
 *   katalogning kategoriyasiga mahsulot bog'lab bo'lmaydi.
 * - Yangi ombor nomi mavjudiga mos kelsa (registr va lotin/kirill farqisiz:
 *   "bunker" = "Бункер"), takror ochilmaydi — o'sha ishlatiladi.
 * - Kategoriya boshqa omborda bo'lsa, tanlangan omborda shu nomlisi
 *   topiladi yoki ochiladi ("Fenlar" → "Fenlar (Sklad 2)").
 */
export async function tovarKategoriyasi(
  tx: Tx,
  doira: KatalogDoirasi,
  t: JoyTanlovi,
  omborYaratishMumkin: boolean,
): Promise<string> {
  const yangiOmborNomi = nom(t.yangiOmbor)
  const yangiKategoriyaNomi = nom(t.yangiKategoriya)

  // Bir katalogda bir vaqtda ikki so'rov bir xil yangi nomni ochmasin
  if (yangiOmborNomi || yangiKategoriyaNomi || t.omborId !== undefined) {
    const kalit = doira.filialId
      ? `ombor-kategoriya:filial:${doira.filialId}`
      : `ombor-kategoriya:ega:${'egaId' in doira ? doira.egaId : ''}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${kalit}))`
  }

  // ── Ombor ──
  let maqsad: MaqsadOmbor | undefined
  if (yangiOmborNomi && markaziyNomimi(yangiOmborNomi)) {
    maqsad = { id: null, nomi: null }
  } else if (yangiOmborNomi) {
    const omborlar = await tx.ombor.findMany({ where: doira, select: { id: true, nomi: true } })
    const kalit = nomKaliti(yangiOmborNomi)
    const bor = omborlar.find(o => nomKaliti(o.nomi) === kalit)
    if (bor) {
      maqsad = bor
    } else {
      if (!omborYaratishMumkin) {
        throw new JoyXatosi(403, `«${yangiOmborNomi}» ombori yo'q. Yangi ombor ochish uchun «Ombor va kategoriya boshqarish» ruxsati kerak`)
      }
      maqsad = await tx.ombor.create({ data: { nomi: yangiOmborNomi, ...doira }, select: { id: true, nomi: true } })
    }
  } else if (typeof t.omborId === 'string' && t.omborId) {
    const o = await tx.ombor.findFirst({ where: { id: t.omborId, ...doira }, select: { id: true, nomi: true } })
    if (!o) throw new JoyXatosi(400, 'Ombor topilmadi')
    maqsad = o
  } else if (t.omborId === null) {
    maqsad = { id: null, nomi: null }
  }

  // ── Kategoriya ──
  const kategoriyalar = await tx.kategoriya.findMany({ where: doira, select: { id: true, nomi: true, omborId: true } })
  let manbaNom: string
  if (yangiKategoriyaNomi) {
    manbaNom = yangiKategoriyaNomi
    // Ombor aytilmagan bo'lsa — Markaziy ombor (omborsiz)
    maqsad ??= { id: null, nomi: null }
  } else if (typeof t.kategoriyaId === 'string' && t.kategoriyaId) {
    const k = kategoriyalar.find(x => x.id === t.kategoriyaId)
    if (!k) throw new JoyXatosi(400, 'Kategoriya topilmadi')
    if (!maqsad || k.omborId === maqsad.id) return k.id
    manbaNom = k.nomi
  } else {
    throw new JoyXatosi(400, 'Kategoriyani tanlang yoki yangisini yozing')
  }

  const omborNomlari = (await tx.ombor.findMany({ where: doira, select: { nomi: true } })).map(o => o.nomi)
  const natija = omborKategoriyasi(manbaNom, maqsad, kategoriyalar, omborNomlari)
  if (!natija) throw new JoyXatosi(400, "Bu omborda shu nomli kategoriya ochib bo'lmadi — boshqa nom yozing")
  if ('mavjud' in natija) return natija.mavjud.id
  const yangi = await tx.kategoriya.create({
    data: { nomi: natija.yangi, omborId: maqsad.id, ...doira },
    select: { id: true },
  })
  return yangi.id
}
