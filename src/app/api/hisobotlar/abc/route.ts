import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getReportDateRange, baseSotuvFilter, type ReportTur } from '@/lib/hisobotlar'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const rol = (session.user as { rol?: string })?.rol
    if (rol === 'KASSIR') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const tur = (searchParams.get('tur') || 'oylik') as ReportTur
    const dan = searchParams.get('dan') || undefined
    const gacha = searchParams.get('gacha') || undefined

    const { dan: d, gacha: g } = getReportDateRange(tur, dan, gacha)
    const filialId = sessionFilialId(session)

    // SotuvTarkibi → tovarId bo'yicha guruhlash
    const tarkiblar = await prisma.sotuvTarkibi.findMany({
      where: {
        sotuv: baseSotuvFilter(d, g, undefined, filialId),
      },
      select: {
        tovarId: true,
        jami: true,
        miqdor: true,
        tovar: {
          select: {
            nomi: true,
            birlik: true,
          },
        },
      },
    })

    // tovarId bo'yicha aggregate
    const tovarMap = new Map<
      string,
      { nomi: string; birlik: string; jami_summa: number; jami_miqdor: number }
    >()

    for (const t of tarkiblar) {
      const existing = tovarMap.get(t.tovarId) ?? {
        nomi: t.tovar.nomi,
        birlik: t.tovar.birlik,
        jami_summa: 0,
        jami_miqdor: 0,
      }
      existing.jami_summa += Number(t.jami)
      existing.jami_miqdor += Number(t.miqdor)
      tovarMap.set(t.tovarId, existing)
    }

    // Descending tartib (jami_summa bo'yicha)
    const sorted = Array.from(tovarMap.entries())
      .map(([tovarId, v]) => ({ tovarId, ...v }))
      .sort((a, b) => b.jami_summa - a.jami_summa)

    const jamiSotuv = sorted.reduce((acc, t) => acc + t.jami_summa, 0)

    // Kumulyativ ulush va sinf hisoblash
    let kumul = 0
    const tovarlar = sorted.map((t) => {
      const ulushi = jamiSotuv > 0 ? (t.jami_summa / jamiSotuv) * 100 : 0
      kumul += ulushi
      const sinf: 'A' | 'B' | 'C' = kumul <= 80 ? 'A' : kumul <= 95 ? 'B' : 'C'
      return {
        tovarId: t.tovarId,
        nomi: t.nomi,
        birlik: t.birlik,
        jami_summa: t.jami_summa,
        jami_miqdor: t.jami_miqdor,
        ulushi: Math.round(ulushi * 10) / 10,
        sinf,
      }
    })

    return NextResponse.json({ tovarlar, jamiSotuv })
  } catch (e) {
    console.error('[hisobotlar/abc]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
