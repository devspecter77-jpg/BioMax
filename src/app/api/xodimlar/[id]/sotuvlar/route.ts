import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { xodimKontekst } from '@/lib/xodim-server'
import { sotuvDavriOraligi } from '@/lib/xodim-mulk'

export const dynamic = 'force-dynamic'

const SAHIFA_HAJMI = 30
const TOP = 100

/**
 * Xodim sotuvlari — kimga nima sotgani.
 *
 *   ?davr=2026-09 | bugun | 7kun | 30kun | hammasi
 *   &mijozId=<id> | mijozsiz   — cheklar ro'yxatini bitta mijoz bo'yicha
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
    const { dan, gacha, davr } = sotuvDavriOraligi(p.get('davr'))
    const mijozParam = p.get('mijozId')
    const sahifa = Math.max(1, Math.min(10_000, Math.floor(Number(p.get('sahifa')) || 1)))

    const vaqt: Prisma.SotuvWhereInput = dan || gacha
      ? { sana: { ...(dan ? { gte: dan } : {}), ...(gacha ? { lt: gacha } : {}) } }
      : {}
    const asos: Prisma.SotuvWhereInput = { kassirId: id, ...vaqt }
    const yakunlangan: Prisma.SotuvWhereInput = { ...asos, holati: 'YAKUNLANGAN' }
    const royxatWhere: Prisma.SotuvWhereInput = {
      ...asos,
      ...(mijozParam === 'mijozsiz' ? { mijozId: null } : mijozParam ? { mijozId: mijozParam } : {}),
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
          tarkiblar: { select: { id: true, miqdor: true, birlikNarxi: true, jami: true, tovar: { select: { id: true, nomi: true, birlik: true } } } },
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
        tarkiblar: s.tarkiblar.map(t => ({
          id: t.id, tovarId: t.tovar.id, nomi: t.tovar.nomi, birlik: t.tovar.birlik,
          miqdor: Number(t.miqdor), birlikNarxi: Number(t.birlikNarxi), jami: Number(t.jami),
        })),
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
