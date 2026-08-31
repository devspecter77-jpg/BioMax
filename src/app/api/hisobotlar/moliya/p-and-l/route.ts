import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  getReportDateRange,
  baseSotuvFilter,
  type ReportTur,
} from '@/lib/hisobotlar'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    // KASSIR rolini tekshirish — faqat ADMIN/OMBORCHI ko'radi moliyaviy
    const rol = (session.user as { rol?: string } | undefined)?.rol
    if (rol === 'KASSIR') return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const tur = (searchParams.get('tur') || 'oylik') as ReportTur
    const dan = searchParams.get('dan') || undefined
    const gacha = searchParams.get('gacha') || undefined

    const { dan: danSana, gacha: gachaSana } = getReportDateRange(tur, dan, gacha)
    const filialId = sessionFilialId(session)

    // Helper: compute P&L for a given date range
    async function computePL(from: Date, to: Date) {
      const [sotuvlar, qaytarishSum, xarajatlar] = await Promise.all([
        prisma.sotuv.findMany({
          where: baseSotuvFilter(from, to, undefined, filialId),
          include: {
            tarkiblar: { include: { tovar: { select: { kelishNarxi: true } } } },
          },
        }),
        prisma.qaytarish.aggregate({
          where: { yaratilgan: { gte: from, lt: to }, ...(filialId ? { aslSotuv: { filialId } } : {}) },
          _sum: { jamiSumma: true },
        }),
        prisma.xarajat.findMany({
          where: { sana: { gte: from, lt: to } },
          select: { kategoriya: true, summa: true, sana: true },
        }),
      ])

      const grossRevenue = sotuvlar.reduce((s, v) => s + Number(v.yakuniySumma), 0)
      const qaytarish = Number(qaytarishSum._sum.jamiSumma || 0)
      const revenue = grossRevenue - qaytarish

      const cogs = sotuvlar.reduce((total, sotuv) => {
        return (
          total +
          sotuv.tarkiblar.reduce(
            (s, t) => s + Number(t.miqdor) * Number(t.tovar.kelishNarxi),
            0,
          )
        )
      }, 0)

      const grossProfit = revenue - cogs

      const opex = {
        IJARA: 0,
        MAOSH: 0,
        TRANSPORT: 0,
        KOMMUNAL: 0,
        BOSHQA: 0,
        total: 0,
      }
      for (const x of xarajatlar) {
        const summa = Number(x.summa)
        const kat = x.kategoriya as keyof Omit<typeof opex, 'total'>
        if (kat in opex) {
          opex[kat] += summa
        }
        opex.total += summa
      }
      opex.total = Math.round(opex.total)

      const netProfit = grossProfit - opex.total

      const margin = {
        gross: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
        net: revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
      }

      return { revenue, cogs, grossProfit, opex, netProfit, margin, sotuvlar, xarajatlar }
    }

    const joriyData = await computePL(danSana, gachaSana)

    // Trend (kunlar bo'yicha)
    const trend: Array<{ sana: string; revenue: number; cogs: number; netProfit: number }> = []
    const kunlikOpex = joriyData.xarajatlar.reduce(
      (m, x) => {
        const kun = new Date(x.sana).toISOString().slice(0, 10)
        m[kun] = (m[kun] || 0) + Number(x.summa)
        return m
      },
      {} as Record<string, number>,
    )

    const kunlikMap = new Map<string, { revenue: number; cogs: number }>()
    for (let d = new Date(danSana); d <= gachaSana; d.setDate(d.getDate() + 1)) {
      kunlikMap.set(d.toISOString().slice(0, 10), { revenue: 0, cogs: 0 })
    }
    for (const s of joriyData.sotuvlar) {
      const kun = new Date(s.sana).toISOString().slice(0, 10)
      const bor = kunlikMap.get(kun)
      if (bor) {
        bor.revenue += Number(s.yakuniySumma)
        bor.cogs += s.tarkiblar.reduce(
          (x, t) => x + Number(t.miqdor) * Number(t.tovar.kelishNarxi),
          0,
        )
      }
    }
    for (const [sana, v] of kunlikMap.entries()) {
      const opexShu = kunlikOpex[sana] || 0
      trend.push({
        sana,
        revenue: v.revenue,
        cogs: v.cogs,
        netProfit: v.revenue - v.cogs - opexShu,
      })
    }

    // Strip unused fields
    const strip = (d: typeof joriyData) => ({
      revenue: d.revenue,
      cogs: d.cogs,
      grossProfit: d.grossProfit,
      opex: d.opex,
      netProfit: d.netProfit,
      margin: d.margin,
    })

    return NextResponse.json({
      joriy: strip(joriyData),
      trend,
    })
  } catch (e) {
    console.error('[Moliya P&L]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
