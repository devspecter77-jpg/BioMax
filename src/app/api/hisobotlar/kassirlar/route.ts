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

    // Sotuvlar + tarkiblar (foyda hisoblash uchun)
    const sotuvlar = await prisma.sotuv.findMany({
      where: baseSotuvFilter(d, g, undefined, filialId),
      select: {
        kassirId: true,
        yakuniySumma: true,
        kassir: {
          select: { ism: true },
        },
        tarkiblar: {
          select: {
            miqdor: true,
            birlikNarxi: true,
            tovar: {
              select: { kelishNarxi: true },
            },
          },
        },
      },
    })

    // kassirId bo'yicha aggregate
    const kassirMap = new Map<
      string,
      { ism: string; sotuvSoni: number; jamiSotuv: number; jamiDaromad: number }
    >()

    for (const s of sotuvlar) {
      const existing = kassirMap.get(s.kassirId) ?? {
        ism: s.kassir.ism,
        sotuvSoni: 0,
        jamiSotuv: 0,
        jamiDaromad: 0,
      }
      existing.sotuvSoni += 1
      existing.jamiSotuv += Number(s.yakuniySumma)

      // Foyda: sum((birlikNarxi - kelishNarxi) * miqdor)
      for (const t of s.tarkiblar) {
        const foyda =
          (Number(t.birlikNarxi) - Number(t.tovar.kelishNarxi)) * Number(t.miqdor)
        existing.jamiDaromad += foyda
      }

      kassirMap.set(s.kassirId, existing)
    }

    // Sort by jamiSotuv descending
    const kassirlar = Array.from(kassirMap.entries())
      .map(([kassirId, v]) => ({
        kassirId,
        ism: v.ism,
        sotuvSoni: v.sotuvSoni,
        jamiSotuv: Math.round(v.jamiSotuv),
        jamiDaromad: Math.round(v.jamiDaromad),
        o_rtachaCek: v.sotuvSoni > 0 ? Math.round(v.jamiSotuv / v.sotuvSoni) : 0,
      }))
      .sort((a, b) => b.jamiSotuv - a.jamiSotuv)

    const jamiSotuv = kassirlar.reduce((acc, k) => acc + k.jamiSotuv, 0)
    const sotuvSoni = kassirlar.reduce((acc, k) => acc + k.sotuvSoni, 0)

    return NextResponse.json({ kassirlar, jamiSotuv, sotuvSoni })
  } catch (e) {
    console.error('[hisobotlar/kassirlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
