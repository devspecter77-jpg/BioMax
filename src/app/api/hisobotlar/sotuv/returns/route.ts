import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getReportDateRange, baseSotuvFilter, type ReportTur } from '@/lib/hisobotlar'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  const egaScope = egaFilialWhere(session)

  const { searchParams } = new URL(req.url)
  const tur = (searchParams.get('tur') || 'oylik') as ReportTur
  const dan = searchParams.get('dan') || undefined
  const gacha = searchParams.get('gacha') || undefined

  const { dan: d, gacha: g } = getReportDateRange(tur, dan, gacha)

  const [qaytarishlar, sotuvlar] = await Promise.all([
    prisma.qaytarish.findMany({
      where: { yaratilgan: { gte: d, lt: g }, aslSotuv: egaScope },
      include: {
        tarkiblar: { include: { tovar: { select: { id: true, nomi: true } } } },
      },
    }),
    prisma.sotuv.findMany({
      where: baseSotuvFilter(d, g, undefined, egaScope),
      select: { yakuniySumma: true },
    }),
  ])

  const jamiQaytarish = qaytarishlar.reduce((s, q) => s + Number(q.jamiSumma), 0)
  const jamiSotuv = sotuvlar.reduce((s, v) => s + Number(v.yakuniySumma), 0)
  const soni = qaytarishlar.length
  const returnRate = jamiSotuv > 0 ? Math.round((jamiQaytarish / jamiSotuv) * 1000) / 10 : 0
  const avgReturnValue = soni > 0 ? Math.round(jamiQaytarish / soni) : 0

  // Sababi bo'yicha
  const sababMap = new Map<string | null, { count: number; summa: number }>()
  for (const q of qaytarishlar) {
    const key = q.sabab || null
    const bor = sababMap.get(key) ?? { count: 0, summa: 0 }
    bor.count++
    bor.summa += Number(q.jamiSumma)
    sababMap.set(key, bor)
  }
  const bySabab = Array.from(sababMap.entries())
    .map(([sabab, v]) => ({ sabab: sabab ?? "Sabab ko'rsatilmagan", ...v }))
    .sort((a, b) => b.summa - a.summa)

  // Top qaytarilgan tovarlar
  const tovarMap = new Map<string, { nomi: string; qty: number; summa: number }>()
  for (const q of qaytarishlar) {
    for (const t of q.tarkiblar) {
      const key = t.tovarId
      const bor = tovarMap.get(key) ?? { nomi: t.tovar.nomi, qty: 0, summa: 0 }
      bor.qty += Number(t.miqdor)
      bor.summa += Number(t.jami)
      tovarMap.set(key, bor)
    }
  }
  const topReturnedProducts = Array.from(tovarMap.entries())
    .map(([tovarId, v]) => ({ tovarId, nomi: v.nomi, qtyReturned: v.qty, summa: v.summa }))
    .sort((a, b) => b.summa - a.summa)
    .slice(0, 10)

  // Trend (kunlar)
  const trendMap = new Map<string, { count: number; summa: number }>()
  for (const k = new Date(d); k <= g; k.setDate(k.getDate() + 1)) {
    trendMap.set(k.toISOString().slice(0, 10), { count: 0, summa: 0 })
  }
  for (const q of qaytarishlar) {
    const kun = q.yaratilgan.toISOString().slice(0, 10)
    const bor = trendMap.get(kun)
    if (bor) {
      bor.count++
      bor.summa += Number(q.jamiSumma)
    }
  }
  const trend = Array.from(trendMap.entries()).map(([sana, v]) => ({ sana, ...v }))

  return NextResponse.json({
    umumiy: { jamiQaytarish, soni, returnRate, avgReturnValue },
    bySabab,
    topReturnedProducts,
    trend,
  })
}
