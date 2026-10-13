import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { xodimKontekst } from '@/lib/xodim-server'
import { sanaOraligi, sotuvDavriOraligi } from '@/lib/xodim-mulk'
import { toKirill, toLotin } from '@/lib/utils'
import { chekQatori } from '@/lib/birlik'

export const dynamic = 'force-dynamic'

const SAHIFA_HAJMI = 30
const TOP = 100

/**
 * Xodim sotuvlari — kimga nima sotgani.
 *
 *   ?davr=2026-09 | bugun | 7kun | 30kun | hammasi
 *   &dan=2026-10-01&gacha=2026-10-12 — aniq kun yoki oraliq (davr o'rniga)
 *   &mijozId=<id> | mijozsiz   — cheklar ro'yxatini bitta mijoz bo'yicha
 *   &q=...      — chekni qidirish: raqami, mijoz ismi/telefoni, mahsulot, summa
 *   &sahifa=2
 *
 * Ko'rsatkichlar faqat YAKUNLANGAN sotuvlardan; ro'yxatda bekor qilinganlar ham
 * (belgisi bilan) ko'rinadi. Kelish narxi va foyda bu yerda chiqmaydi.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const r = await xodimKontekst(id, 'xodimlar.sotuvlar')
    if (!r.ok) return r.javob

    const p = req.nextUrl.searchParams
    // Aniq sana (yoki oraliq) tanlangan bo'lsa — u ustun, aks holda tayyor davr
    const tanlangan = sanaOraligi(p.get('dan'), p.get('gacha'))
    const { dan, gacha, davr } = tanlangan ? { ...tanlangan, davr: 'sana' } : sotuvDavriOraligi(p.get('davr'))
    const mijozParam = p.get('mijozId')
    const qidiruv = p.get('q')?.trim().replace(/\s+/g, ' ').slice(0, 60) || null
    const sahifa = Math.max(1, Math.min(10_000, Math.floor(Number(p.get('sahifa')) || 1)))

    const vaqt: Prisma.SotuvWhereInput = dan || gacha
      ? { sana: { ...(dan ? { gte: dan } : {}), ...(gacha ? { lt: gacha } : {}) } }
      : {}
    const asos: Prisma.SotuvWhereInput = { kassirId: id, ...vaqt }
    const yakunlangan: Prisma.SotuvWhereInput = { ...asos, holati: 'YAKUNLANGAN' }
    const royxatWhere: Prisma.SotuvWhereInput = {
      ...asos,
      ...(mijozParam === 'mijozsiz' ? { mijozId: null } : mijozParam ? { mijozId: mijozParam } : {}),
      ...(qidiruv ? { AND: [chekQidiruvi(qidiruv)] } : {}),
    }

    const [umumiy, tolovGuruh, mijozTop, mijozlarSoni, mahsulotTop, mahsulotlarSoni, qaytarish, bekorSoni, jami, sotuvlar] = await Promise.all([
      prisma.sotuv.aggregate({ where: yakunlangan, _sum: { yakuniySumma: true, chegirma: true }, _count: { _all: true } }),
      prisma.sotuv.groupBy({ by: ['tolovUsuli'], where: yakunlangan, _sum: { yakuniySumma: true }, _count: { _all: true } }),
      prisma.sotuv.groupBy({
        by: ['mijozId'], where: yakunlangan,
        _sum: { yakuniySumma: true }, _count: { _all: true }, _max: { sana: true },
        orderBy: { _sum: { yakuniySumma: 'desc' } }, take: TOP,
      }),
      prisma.sotuv.groupBy({ by: ['mijozId'], where: { ...yakunlangan, mijozId: { not: null } } }).then(g => g.length),
      prisma.sotuvTarkibi.groupBy({
        by: ['tovarId'], where: { sotuv: yakunlangan },
        _sum: { miqdor: true, jami: true }, _count: { _all: true },
        orderBy: { _sum: { jami: 'desc' } }, take: TOP,
      }),
      prisma.sotuvTarkibi.groupBy({ by: ['tovarId'], where: { sotuv: yakunlangan } }).then(g => g.length),
      prisma.qaytarish.aggregate({ where: { aslSotuv: yakunlangan }, _sum: { jamiSumma: true }, _count: { _all: true } }),
      prisma.sotuv.count({ where: { ...asos, holati: 'BEKOR_QILINGAN' } }),
      prisma.sotuv.count({ where: royxatWhere }),
      prisma.sotuv.findMany({
        where: royxatWhere,
        orderBy: { sana: 'desc' },
        skip: (sahifa - 1) * SAHIFA_HAJMI,
        take: SAHIFA_HAJMI,
        select: {
          id: true, chekRaqami: true, sana: true, tolovUsuli: true, holati: true, manba: true, onlaynRaqam: true,
          jamiSumma: true, chegirma: true, yakuniySumma: true, ballIshlatilgan: true, keshbekIshlatilgan: true,
          mijoz: { select: { id: true, ism: true, telefon: true } },
          tarkiblar: { select: { id: true, miqdor: true, birlikNarxi: true, jami: true, oramNomi: true, oramMiqdori: true, tovar: { select: { id: true, nomi: true, birlik: true } } } },
          qaytarishlar: { select: { jamiSumma: true } },
        },
      }),
    ])

    const [mijozNomlari, tovarNomlari] = await Promise.all([
      prisma.mijoz.findMany({
        where: { id: { in: mijozTop.map(m => m.mijozId).filter((x): x is string => !!x) } },
        select: { id: true, ism: true, telefon: true },
      }),
      prisma.tovar.findMany({
        where: { id: { in: mahsulotTop.map(m => m.tovarId) } },
        select: { id: true, nomi: true, birlik: true },
      }),
    ])
    const mijozMap = new Map(mijozNomlari.map(m => [m.id, m]))
    const tovarMap = new Map(tovarNomlari.map(t => [t.id, t]))

    const sotuvSoni = umumiy._count._all
    const jamiSumma = Number(umumiy._sum.yakuniySumma ?? 0)
    const mijozFiltri = mijozParam === 'mijozsiz'
      ? { id: 'mijozsiz', ism: 'Mijozsiz sotuvlar' }
      : mijozParam
        ? await prisma.mijoz.findUnique({ where: { id: mijozParam }, select: { id: true, ism: true } })
        : null

    return NextResponse.json({
      davr,
      oraliq: { dan: dan?.toISOString() ?? null, gacha: gacha?.toISOString() ?? null },
      qidiruv,
      xulosa: {
        sotuvSoni,
        jamiSumma,
        ortachaChek: sotuvSoni ? Math.round(jamiSumma / sotuvSoni) : 0,
        chegirma: Number(umumiy._sum.chegirma ?? 0),
        mijozlarSoni,
        mahsulotlarSoni,
        qaytarishSoni: qaytarish._count._all,
        qaytarishSumma: Number(qaytarish._sum.jamiSumma ?? 0),
        bekorSoni,
        tolovUsullari: tolovGuruh
          .map(g => ({ usul: g.tolovUsuli, soni: g._count._all, summa: Number(g._sum.yakuniySumma ?? 0) }))
          .sort((a, b) => b.summa - a.summa),
      },
      mijozlar: mijozTop.map(m => {
        const mj = m.mijozId ? mijozMap.get(m.mijozId) : null
        return {
          mijozId: m.mijozId ?? 'mijozsiz',
          ism: m.mijozId ? mj?.ism ?? 'O‘chirilgan mijoz' : 'Mijozsiz sotuvlar',
          telefon: mj?.telefon ?? null,
          sotuvSoni: m._count._all,
          jamiSumma: Number(m._sum.yakuniySumma ?? 0),
          oxirgiSana: m._max.sana?.toISOString() ?? null,
        }
      }),
      mahsulotlar: mahsulotTop.map(m => {
        const t = tovarMap.get(m.tovarId)
        return {
          tovarId: m.tovarId,
          nomi: t?.nomi ?? 'O‘chirilgan tovar',
          birlik: t?.birlik ?? 'DONA',
          miqdor: Number(m._sum.miqdor ?? 0),
          jamiSumma: Number(m._sum.jami ?? 0),
          sotuvSoni: m._count._all,
        }
      }),
      mijozFiltri,
      sotuvlar: sotuvlar.map(s => ({
        ...s,
        sana: s.sana.toISOString(),
        jamiSumma: Number(s.jamiSumma),
        chegirma: Number(s.chegirma),
        yakuniySumma: Number(s.yakuniySumma),
        ballIshlatilgan: Number(s.ballIshlatilgan),
        keshbekIshlatilgan: Number(s.keshbekIshlatilgan),
        tarkiblar: s.tarkiblar.map(t => {
          // O'ramda sotilgan qator — "2 blok × 75 000"
          const q = chekQatori(t)
          return {
            id: t.id, tovarId: t.tovar.id, nomi: t.tovar.nomi, birlik: q.oram ?? t.tovar.birlik,
            miqdor: q.soni, birlikNarxi: q.narx, jami: Number(t.jami),
          }
        }),
        qaytarilgan: s.qaytarishlar.reduce((x, q) => x + Number(q.jamiSumma), 0),
        qaytarishlar: undefined,
      })),
      jami,
      sahifa,
      sahifaHajmi: SAHIFA_HAJMI,
    })
  } catch (e) {
    console.error('[xodim sotuvlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

/**
 * Chekni qidirish sharti: chek raqami, onlayn buyurtma raqami, mijoz ismi va
 * telefoni, mahsulot nomi, yakuniy summa. Ism va mahsulot lotin/kirillda
 * qanday yozilmasin topiladi (bazada ikkalasi ham bor).
 */
function chekQidiruvi(q: string): Prisma.SotuvWhereInput {
  const yozuvlar = [...new Set([q, toKirill(q), toLotin(q)])]
  const raqamlar = q.replace(/\D/g, '')
  const summa = /^[\d\s.,]+$/.test(q) && raqamlar.length >= 3 ? Number(raqamlar) : null
  return {
    OR: [
      { chekRaqami: { contains: q, mode: 'insensitive' } },
      { onlaynRaqam: { contains: q, mode: 'insensitive' } },
      ...yozuvlar.map(y => ({ mijoz: { ism: { contains: y, mode: 'insensitive' as const } } })),
      ...yozuvlar.map(y => ({ tarkiblar: { some: { tovar: { nomi: { contains: y, mode: 'insensitive' as const } } } } })),
      ...(raqamlar.length >= 4 ? [{ mijoz: { telefon: { contains: raqamlar.slice(-9) } } }] : []),
      ...(summa !== null && Number.isFinite(summa) ? [{ yakuniySumma: summa }] : []),
    ],
  }
}
