import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getReportDateRange, baseSotuvFilter, type ReportTur } from '@/lib/hisobotlar'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const rol = (session.user as { rol?: string } | undefined)?.rol
    if (rol === 'KASSIR') return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const tur = (searchParams.get('tur') || 'oylik') as ReportTur
    const dan = searchParams.get('dan') || undefined
    const gacha = searchParams.get('gacha') || undefined

    const { dan: d, gacha: g } = getReportDateRange(tur, dan, gacha)
    const kunlar = Math.max(
      1,
      Math.ceil((g.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)),
    )
    const egaScope = egaFilialWhere(session)

    // Sotilgan miqdor (davrda) — SotuvTarkibi grouped by tovarId
    const sotilgan = await prisma.sotuvTarkibi.groupBy({
      by: ['tovarId'],
      _sum: { miqdor: true },
      where: { sotuv: baseSotuvFilter(d, g, undefined, egaScope) },
    })
    const sotilganMap = new Map(
      sotilgan.map((s) => [s.tovarId, Number(s._sum.miqdor || 0)]),
    )

    // Hozirgi qoldiq (OmborHarakati net)
    const harakatlar = await prisma.omborHarakati.groupBy({
      by: ['tovarId', 'turi'],
      _sum: { miqdor: true },
      where: { tovar: egaScope },
    })
    const qoldiqMap = new Map<string, number>()
    for (const h of harakatlar) {
      const cur = qoldiqMap.get(h.tovarId) ?? 0
      const amt = Number(h._sum.miqdor || 0)
      let delta = 0
      if (h.turi === 'KIRIM' || h.turi === 'QAYTARISH') delta = amt
      else if (h.turi === 'CHIQIM' || h.turi === 'YOQOTISH') delta = -amt
      // OTKAZMA: net zero
      qoldiqMap.set(h.tovarId, cur + delta)
    }

    // Aktiv tovarlar
    const tovarlar = await prisma.tovar.findMany({
      where: { holati: 'FAOL', ...egaScope },
      select: { id: true, nomi: true, birlik: true },
    })

    const tovarlarList = tovarlar.map((t) => {
      const sotilganMiqdor = sotilganMap.get(t.id) || 0
      const hozirgiQoldiq = qoldiqMap.get(t.id) || 0
      const kunlikOrtacha = sotilganMiqdor / kunlar
      const turnoverKun = kunlikOrtacha > 0 ? hozirgiQoldiq / kunlikOrtacha : null

      let klass: 'tez' | 'orta' | 'sekin' | 'yotib-qolgan' = 'yotib-qolgan'
      if (turnoverKun !== null) {
        if (turnoverKun < 7) klass = 'tez'
        else if (turnoverKun < 30) klass = 'orta'
        else if (turnoverKun < 60) klass = 'sekin'
        else klass = 'yotib-qolgan'
      }

      return {
        tovarId: t.id,
        nomi: t.nomi,
        birlik: t.birlik,
        sotilganMiqdor,
        kunlikOrtacha: Math.round(kunlikOrtacha * 100) / 100,
        hozirgiQoldiq,
        turnoverKun: turnoverKun !== null ? Math.round(turnoverKun) : null,
        klass,
      }
    })

    // Umumiy stats
    const haveTurnover = tovarlarList.filter(
      (t) => t.turnoverKun !== null && t.turnoverKun < 10000,
    )
    const ortachaTurnoverKun =
      haveTurnover.length > 0
        ? Math.round(
            haveTurnover.reduce((s, t) => s + (t.turnoverKun || 0), 0) /
              haveTurnover.length,
          )
        : 0

    const umumiy = {
      ortachaTurnoverKun,
      engTezKun:
        haveTurnover.length > 0
          ? Math.min(...haveTurnover.map((t) => t.turnoverKun || 0))
          : 0,
      engSekinKun:
        haveTurnover.length > 0
          ? Math.max(...haveTurnover.map((t) => t.turnoverKun || 0))
          : 0,
      tezSoni: tovarlarList.filter((t) => t.klass === 'tez').length,
      ortaSoni: tovarlarList.filter((t) => t.klass === 'orta').length,
      sekinSoni: tovarlarList.filter((t) => t.klass === 'sekin').length,
      yotibQolganSoni: tovarlarList.filter((t) => t.klass === 'yotib-qolgan').length,
    }

    // Sort: sekin/yotib-qolgan first (actionable insights), then orta, tez last
    const order: Record<string, number> = {
      'sekin': 0,
      'yotib-qolgan': 1,
      'orta': 2,
      'tez': 3,
    }
    tovarlarList.sort((a, b) => order[a.klass] - order[b.klass])

    return NextResponse.json({ umumiy, tovarlar: tovarlarList.slice(0, 100) })
  } catch (e) {
    console.error('[Stock turnover]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
