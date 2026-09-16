import type { Session } from 'next-auth'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getStockMap } from './stock'
import { egaFilialWhere } from './filial-scope'
import { generateChekRaqami } from './utils'
import { tolovTaqsimoti } from './tolov-usullari'
import { sotuvdanToplanadi } from './sodiqlik'
import { sodiqlikSozlamasi, balansOzgartir } from './sodiqlik-server'
import { chiqimRejasi, rezervMuddati, telefonVariantlari, yetmayotganlar, type ZaxiraQatori } from './onlayn-sotuv'
import type { OnlaynBuyurtma } from './onlayn-buyurtma'

// Onlayn buyurtmaning ERP'dagi izi: zaxira bandi va topshirilgandagi sotuv.
//
// Hammasi IDEMPOTENT: tugma ikki marta bosilsa yoki sayt javobi kechiksa va
// xodim qayta bossa, ikkinchi rezerv yoki ikkinchi sotuv yaratilmaydi.

type PrismaTx = Prisma.TransactionClient | typeof prisma

export type Natija<T> = { ok: true; qiymat: T } | { ok: false; xato: string }

/**
 * Onlayn zaxira amallari bitta navbatda: ikki xodim bir vaqtda ikki buyurtmani
 * tasdiqlasa, ikkalasi ham oxirgi donani "bor" deb ko'rib qolmasin.
 */
async function navbat(tx: Prisma.TransactionClient) {
  // `$executeRaw`: funksiya `void` qaytaradi, `$queryRaw` uni o'qiy olmaydi
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('biomax-onlayn-zaxira'))`)
}

/** Faol (muddati o'tmagan) rezervlar: tovarId → band miqdor. */
export async function faolRezervlar(
  tovarIds?: string[],
  o: { istisno?: string; db?: PrismaTx } = {},
): Promise<Map<string, number>> {
  const qatorlar = await (o.db ?? prisma).onlaynRezerv.groupBy({
    by: ['tovarId'],
    where: {
      holati: 'FAOL',
      amalQiladi: { gt: new Date() },
      ...(tovarIds ? { tovarId: { in: tovarIds } } : {}),
      ...(o.istisno ? { buyurtmaRaqami: { not: o.istisno } } : {}),
    },
    _sum: { miqdor: true },
  })
  return new Map(qatorlar.map(q => [q.tovarId, Number(q._sum.miqdor ?? 0)]))
}

function zaxiraQatorlari(b: OnlaynBuyurtma): ZaxiraQatori[] {
  return b.qatorlar.map(q => ({ tovarId: q.erpTovarId, nomi: q.nomi, miqdor: q.miqdor }))
}

/** Tasdiqlashda: mahsulotni band qilish. `yangi` — shu chaqiruv rezerv yaratdimi. */
export async function rezervQoy(b: OnlaynBuyurtma, foydalanuvchiId: string): Promise<Natija<{ yangi: boolean }>> {
  const qatorlar = zaxiraQatorlari(b)
  const ids = [...new Set(qatorlar.map(q => q.tovarId))]

  return prisma.$transaction(async tx => {
    await navbat(tx)

    const bor = await tx.onlaynRezerv.count({ where: { buyurtmaRaqami: b.raqam, holati: 'FAOL' } })
    if (bor > 0) {
      await tx.onlaynRezerv.updateMany({ where: { buyurtmaRaqami: b.raqam, holati: 'FAOL' }, data: { amalQiladi: rezervMuddati() } })
      return { ok: true as const, qiymat: { yangi: false } }
    }

    const tovarlar = await tx.tovar.findMany({ where: { id: { in: ids } }, select: { id: true } })
    if (tovarlar.length !== ids.length) {
      return { ok: false as const, xato: 'Buyurtmadagi mahsulotlardan biri ERP’da topilmadi (o‘chirilgan bo‘lishi mumkin)' }
    }

    const [qoldiq, band] = await Promise.all([getStockMap(ids, tx), faolRezervlar(ids, { istisno: b.raqam, db: tx })])
    const yetmaydi = yetmayotganlar(qatorlar, qoldiq, band)
    if (yetmaydi.length > 0) {
      return {
        ok: false as const,
        xato: `Zaxira yetmaydi: ${yetmaydi.map(y => `«${y.nomi}» — kerak ${y.kerak}, mavjud ${y.bor}`).join('; ')}. Mijoz bilan gaplashib, buyurtmani bekor qiling yoki kirim qiling.`,
      }
    }

    // Bir mahsulot bir necha qatorda bo'lsa bitta rezervga yig'iladi
    const yigindi = new Map<string, number>()
    for (const q of qatorlar) yigindi.set(q.tovarId, (yigindi.get(q.tovarId) ?? 0) + q.miqdor)
    const muddat = rezervMuddati()
    await tx.onlaynRezerv.createMany({
      data: [...yigindi].map(([tovarId, miqdor]) => ({ buyurtmaRaqami: b.raqam, tovarId, miqdor, amalQiladi: muddat, foydalanuvchiId })),
    })
    return { ok: true as const, qiymat: { yangi: true } }
  })
}

/** Keyingi bosqichlarda rezerv muddatini uzaytirish (buyurtma sekin yurganda band yo'qolmasin). */
export async function rezervniUzaytir(raqam: string) {
  await prisma.onlaynRezerv.updateMany({ where: { buyurtmaRaqami: raqam, holati: 'FAOL' }, data: { amalQiladi: rezervMuddati() } })
}

export async function rezervniBoshat(raqam: string): Promise<number> {
  const n = await prisma.onlaynRezerv.updateMany({ where: { buyurtmaRaqami: raqam, holati: 'FAOL' }, data: { holati: 'BOSHATILDI' } })
  return n.count
}

/**
 * Topshirilganda: haqiqiy sotuv. Kassadagi sotuv bilan bir xil yozuvlar —
 * `Sotuv`, `SotuvTarkibi`, ombor harakati, mijoz kartasi va ballar — shuning
 * uchun barcha hisobotlar onlayn sotuvni o'zi ko'radi.
 */
export async function onlaynSotuvYarat(
  b: OnlaynBuyurtma,
  session: Session,
): Promise<Natija<{ sotuvId: string; chekRaqami: string; yangi: boolean }>> {
  const mavjud = await prisma.sotuv.findUnique({ where: { onlaynRaqam: b.raqam }, select: { id: true, chekRaqami: true } })
  if (mavjud) return { ok: true, qiymat: { sotuvId: mavjud.id, chekRaqami: mavjud.chekRaqami, yangi: false } }

  const kassirId = (session.user as { id: string }).id
  const doira = egaFilialWhere(session)
  const tolovUsuli = b.tolovUsuli === 'KARTA_YETKAZISHDA' ? 'KARTA' : 'NAQD'
  const ids = [...new Set(b.qatorlar.map(q => q.erpTovarId))]
  const sodiqlik = await sodiqlikSozlamasi()

  try {
    const sotuv = await prisma.$transaction(async tx => {
      await navbat(tx)
      // Navbat ichida qayta tekshiruv: parallel ikkinchi so'rov shu yerda to'xtaydi
      const oldin = await tx.sotuv.findUnique({ where: { onlaynRaqam: b.raqam }, select: { id: true, chekRaqami: true } })
      if (oldin) return { ...oldin, yangi: false }

      const tovarlar = await tx.tovar.findMany({ where: { id: { in: ids } }, select: { id: true } })
      if (tovarlar.length !== ids.length) throw new OnlaynXato('Buyurtmadagi mahsulotlardan biri ERP’da topilmadi')

      // ── Mijoz kartasi: telefon bo'yicha topiladi yoki ochiladi ──
      let mijozId: string | null = null
      const mijoz = await tx.mijoz.findFirst({
        where: {
          OR: [
            { telefon: { in: telefonVariantlari(b.aloqaTel) } },
            { telefon2: { in: telefonVariantlari(b.aloqaTel) } },
            { qoshimchaTelefonlar: { hasSome: telefonVariantlari(b.aloqaTel) } },
          ],
          ...doira,
        },
        select: { id: true },
      })
      if (mijoz) {
        mijozId = mijoz.id
      } else {
        const yangi = await tx.mijoz.create({
          data: {
            ism: b.aloqaIsm?.trim() || 'Onlayn xaridor',
            telefon: b.aloqaTel,
            tuman: b.hudud,
            manzil: b.manzilMatni,
            lokatsiyaLat: b.lat,
            lokatsiyaLng: b.lng,
            izoh: `Onlayn do‘kondan: ${b.raqam}`,
            ...doira,
          },
          select: { id: true },
        })
        mijozId = yangi.id
      }

      // ── Chek raqami: kassadagi bilan bir xil format, to'qnashuv bo'lsa qayta ──
      let chekRaqami = generateChekRaqami()
      for (let i = 0; i < 5 && (await tx.sotuv.findUnique({ where: { chekRaqami }, select: { id: true } })); i++) {
        chekRaqami = generateChekRaqami()
      }

      const yakuniySumma = b.mahsulotSumma
      const yangiSotuv = await tx.sotuv.create({
        data: {
          chekRaqami,
          mijozId,
          jamiSumma: b.mahsulotSumma,
          chegirma: 0,
          yakuniySumma,
          tolovUsuli,
          ...tolovTaqsimoti({ tolovUsuli, yakuniySumma }),
          kassirId,
          manba: 'ONLAYN',
          onlaynRaqam: b.raqam,
          yetkazishNarx: b.yetkazishNarx,
          ...doira,
        },
        select: { id: true, chekRaqami: true },
      })

      const qoldiq = await getStockMap(ids, tx)
      // Bir mahsulot bir necha qatorda bo'lsa, oldingi qator qoldiqni kamaytirgani hisobga olinadi
      const ishlatildi = new Map<string, { ombor: number; dokon: number }>()

      for (const q of b.qatorlar) {
        await tx.sotuvTarkibi.create({
          data: { sotuvId: yangiSotuv.id, tovarId: q.erpTovarId, miqdor: q.miqdor, birlikNarxi: q.birlikNarxi, chegirma: 0, jami: q.jami },
        })

        const asl = qoldiq.get(q.erpTovarId) ?? { omborQoldiq: 0, dokonQoldiq: 0 }
        const u = ishlatildi.get(q.erpTovarId) ?? { ombor: 0, dokon: 0 }
        const reja = chiqimRejasi(q.miqdor, { omborQoldiq: asl.omborQoldiq - u.ombor, dokonQoldiq: asl.dokonQoldiq + u.ombor - u.dokon })

        if (reja.ombordanOtkazma > 0) {
          await tx.omborHarakati.create({
            data: {
              tovarId: q.erpTovarId, turi: 'OTKAZMA', joy: 'OMBOR', miqdor: reja.ombordanOtkazma, narx: q.birlikNarxi,
              sotuvId: yangiSotuv.id, izoh: `Onlayn ${b.raqam}: ombordan do‘konga`, foydalanuvchiId: kassirId,
            },
          })
        }
        await tx.omborHarakati.create({
          data: {
            tovarId: q.erpTovarId, turi: 'CHIQIM', joy: 'DOKON', miqdor: reja.dokondanChiqim, narx: q.birlikNarxi,
            sotuvId: yangiSotuv.id, izoh: `Onlayn sotuv: ${yangiSotuv.chekRaqami} (${b.raqam})`, foydalanuvchiId: kassirId,
          },
        })
        ishlatildi.set(q.erpTovarId, { ombor: u.ombor + reja.ombordanOtkazma, dokon: u.dokon + reja.dokondanChiqim })
      }

      // ── Ballar va keshbek — kassadagi qoida bilan ──
      if (mijozId) {
        const t = sotuvdanToplanadi({ yakuniySumma, tolovUsuli, sozlama: sodiqlik })
        for (const [hisob, miqdor] of [['BALL', t.ball], ['KESHBEK', t.keshbek]] as const) {
          if (miqdor > 0) {
            await balansOzgartir(tx, {
              mijozId, hisob, miqdor, sabab: 'SOTUVDAN', sotuvId: yangiSotuv.id,
              izoh: `Onlayn ${b.raqam}`, foydalanuvchiId: kassirId,
            })
          }
        }
      }

      await tx.onlaynRezerv.updateMany({ where: { buyurtmaRaqami: b.raqam, holati: 'FAOL' }, data: { holati: 'SOTILDI' } })
      return { ...yangiSotuv, yangi: true }
    }, { timeout: 20_000 })

    return { ok: true, qiymat: { sotuvId: sotuv.id, chekRaqami: sotuv.chekRaqami, yangi: sotuv.yangi } }
  } catch (e) {
    if (e instanceof OnlaynXato) return { ok: false, xato: e.message }
    // Parallel so'rov yagona `onlaynRaqam` ga urildi — demak sotuv allaqachon bor
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const bor = await prisma.sotuv.findUnique({ where: { onlaynRaqam: b.raqam }, select: { id: true, chekRaqami: true } })
      if (bor) return { ok: true, qiymat: { sotuvId: bor.id, chekRaqami: bor.chekRaqami, yangi: false } }
    }
    throw e
  }
}

class OnlaynXato extends Error {}

/** Panel uchun: buyurtmaning ERP'dagi izi. */
export async function erpIzi(raqam: string) {
  const [sotuv, rezervlar] = await Promise.all([
    prisma.sotuv.findUnique({ where: { onlaynRaqam: raqam }, select: { id: true, chekRaqami: true, sana: true, holati: true } }),
    prisma.onlaynRezerv.findMany({ where: { buyurtmaRaqami: raqam }, select: { tovarId: true, miqdor: true, holati: true, amalQiladi: true } }),
  ])
  const faol = rezervlar.filter(r => r.holati === 'FAOL' && r.amalQiladi > new Date())
  return {
    sotuv: sotuv ? { ...sotuv, sana: sotuv.sana.toISOString() } : null,
    rezerv: rezervlar.length === 0 ? 'YOQ' as const
      : faol.length > 0 ? 'FAOL' as const
      : rezervlar.some(r => r.holati === 'SOTILDI') ? 'SOTILDI' as const
      : rezervlar.some(r => r.holati === 'FAOL') ? 'MUDDATI_OTGAN' as const
      : 'BOSHATILDI' as const,
  }
}
