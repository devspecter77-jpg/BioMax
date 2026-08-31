import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getReportDateRange, baseSotuvFilter, type ReportTur } from '@/lib/hisobotlar'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const tur = (searchParams.get('tur') || 'oylik') as ReportTur
    const dan = searchParams.get('dan') || undefined
    const gacha = searchParams.get('gacha') || undefined

    const { dan: d, gacha: g } = getReportDateRange(tur, dan, gacha)

    const sotuvlar = await prisma.sotuv.findMany({
      where: baseSotuvFilter(d, g, undefined, egaFilialWhere(session)),
      select: {
        sana: true,
        yakuniySumma: true,
      },
    })

    // Soatlik guruhlash (0-23)
    const soatMap = new Map<number, { sotuv: number; sotuvSoni: number }>()
    for (let i = 0; i < 24; i++) {
      soatMap.set(i, { sotuv: 0, sotuvSoni: 0 })
    }

    // Kunlik guruhlash
    const kunMap = new Map<string, { sotuv: number; sotuvSoni: number }>()

    let jamiSotuv = 0

    for (const s of sotuvlar) {
      const summa = Number(s.yakuniySumma)
      jamiSotuv += summa

      // Soatlik
      const soat = new Date(s.sana).getHours()
      const soatEntry = soatMap.get(soat)!
      soatEntry.sotuv += summa
      soatEntry.sotuvSoni += 1

      // Kunlik
      const sanStr = new Date(s.sana).toISOString().slice(0, 10)
      const kunEntry = kunMap.get(sanStr) ?? { sotuv: 0, sotuvSoni: 0 }
      kunEntry.sotuv += summa
      kunEntry.sotuvSoni += 1
      kunMap.set(sanStr, kunEntry)
    }

    const soatlar = Array.from(soatMap.entries()).map(([soat, val]) => ({
      soat,
      sotuv: val.sotuv,
      sotuvSoni: val.sotuvSoni,
    }))

    const kunlik = Array.from(kunMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sana, val]) => ({
        sana,
        sotuv: val.sotuv,
        sotuvSoni: val.sotuvSoni,
      }))

    return NextResponse.json({
      soatlar,
      kunlik,
      jamiSotuv,
      sotuvSoni: sotuvlar.length,
    })
  } catch (e) {
    console.error('[hisobotlar/soatlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
