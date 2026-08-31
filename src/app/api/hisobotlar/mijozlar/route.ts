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

    // Sotuv grouped by mijozId (davrda)
    const sotuvlar = await prisma.sotuv.findMany({
      where: {
        ...baseSotuvFilter(d, g, undefined, filialId),
        mijozId: { not: null },
      },
      select: {
        mijozId: true,
        yakuniySumma: true,
        sana: true,
        mijoz: {
          select: {
            ism: true,
          },
        },
      },
    })

    // mijozId bo'yicha aggregate
    const mijozMap = new Map<
      string,
      { ism: string; sotuvSoni: number; jamiSotuv: number; oxirgiSotuv: string | null }
    >()

    for (const s of sotuvlar) {
      if (!s.mijozId) continue
      const existing = mijozMap.get(s.mijozId) ?? {
        ism: s.mijoz?.ism ?? 'Noma\'lum',
        sotuvSoni: 0,
        jamiSotuv: 0,
        oxirgiSotuv: null,
      }
      existing.sotuvSoni += 1
      existing.jamiSotuv += Number(s.yakuniySumma)

      const sanStr = new Date(s.sana).toISOString().slice(0, 10)
      if (!existing.oxirgiSotuv || sanStr > existing.oxirgiSotuv) {
        existing.oxirgiSotuv = sanStr
      }
      mijozMap.set(s.mijozId, existing)
    }

    // Jami mijozlar soni (tizimda)
    const jamiMijozlar = await prisma.mijoz.count({ where: filialId ? { filialId } : {} })

    // Aktiv mijozlar: davrda sotuvi borlar
    const aktivMijozlar = mijozMap.size

    // O'rtacha sotuv (aktiv mijozlar bo'yicha)
    const jamiSotuvJami = Array.from(mijozMap.values()).reduce(
      (acc, m) => acc + m.jamiSotuv,
      0,
    )
    const o_rtachaSotuv = aktivMijozlar > 0 ? Math.round(jamiSotuvJami / aktivMijozlar) : 0

    // Top mijozlar: jamiSotuv bo'yicha descending
    const topMijozlar = Array.from(mijozMap.entries())
      .map(([mijozId, v]) => ({ mijozId, ...v }))
      .sort((a, b) => b.jamiSotuv - a.jamiSotuv)

    return NextResponse.json({
      topMijozlar,
      jamiMijozlar,
      aktivMijozlar,
      o_rtachaSotuv,
    })
  } catch (e) {
    console.error('[hisobotlar/mijozlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
