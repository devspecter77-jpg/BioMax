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

    const { searchParams } = new URL(req.url)
    const tur = (searchParams.get('tur') || 'oylik') as ReportTur
    const dan = searchParams.get('dan') || undefined
    const gacha = searchParams.get('gacha') || undefined

    const { dan: d, gacha: g } = getReportDateRange(tur, dan, gacha)
    const filialId = sessionFilialId(session)

    async function computeKategoriya(from: Date, to: Date) {
      const tarkiblar = await prisma.sotuvTarkibi.findMany({
        where: { sotuv: baseSotuvFilter(from, to, undefined, filialId) },
        include: {
          tovar: { include: { kategoriya: true } },
        },
      })

      const map = new Map<
        string,
        {
          kategoriyaId: string
          nomi: string
          revenue: number
          qty: number
          foyda: number
          tovarlar: Map<string, { nomi: string; revenue: number }>
        }
      >()

      for (const t of tarkiblar) {
        if (!t.tovar.kategoriyaId || !t.tovar.kategoriya) continue
        const kategoriyaId = t.tovar.kategoriyaId
        const bor = map.get(kategoriyaId) ?? {
          kategoriyaId,
          nomi: t.tovar.kategoriya.nomi,
          revenue: 0,
          qty: 0,
          foyda: 0,
          tovarlar: new Map(),
        }
        bor.revenue += Number(t.jami)
        bor.qty += Number(t.miqdor)
        bor.foyda +=
          (Number(t.birlikNarxi) - Number(t.tovar.kelishNarxi)) * Number(t.miqdor)
        const tv = bor.tovarlar.get(t.tovarId) ?? { nomi: t.tovar.nomi, revenue: 0 }
        tv.revenue += Number(t.jami)
        bor.tovarlar.set(t.tovarId, tv)
        map.set(kategoriyaId, bor)
      }

      return map
    }

    const joriyMap = await computeKategoriya(d, g)

    const kategoriyalar = Array.from(joriyMap.values())
      .map((k) => {
        const topProducts = Array.from(k.tovarlar.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3)
        return {
          kategoriyaId: k.kategoriyaId,
          nomi: k.nomi,
          revenue: k.revenue,
          qty: k.qty,
          foyda: k.foyda,
          marginPercent:
            k.revenue > 0 ? Math.round((k.foyda / k.revenue) * 1000) / 10 : 0,
          productCount: k.tovarlar.size,
          topProducts,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)

    const jamiRevenue = kategoriyalar.reduce((s, k) => s + k.revenue, 0)

    return NextResponse.json({ kategoriyalar, jamiRevenue })
  } catch (e) {
    console.error('[Kategoriya sotuv]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
