import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getReportDateRange, baseSotuvFilter, type ReportTur } from '@/lib/hisobotlar'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

  const rol = (session.user as { rol?: string })?.rol
  if (rol === 'KASSIR') return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
  const egaScope = egaFilialWhere(session)

  const { searchParams } = new URL(req.url)
  const tur = (searchParams.get('tur') || 'oylik') as ReportTur
  const dan = searchParams.get('dan') || undefined
  const gacha = searchParams.get('gacha') || undefined

  const { dan: d, gacha: g } = getReportDateRange(tur, dan, gacha)

  const [sotuvlar, xarajatlar, qaytarishSum] = await Promise.all([
    prisma.sotuv.findMany({
      where: baseSotuvFilter(d, g, undefined, egaScope),
      include: {
        tarkiblar: {
          include: {
            tovar: {
              select: {
                nomi: true,
                kelishNarxi: true,
                kategoriya: { select: { nomi: true } },
              },
            },
          },
        },
        kassir: { select: { ism: true } },
      },
    }),
    prisma.xarajat.findMany({ where: { sana: { gte: d, lt: g }, ...egaScope } }),
    prisma.qaytarish.aggregate({
      where: { yaratilgan: { gte: d, lt: g }, aslSotuv: egaScope },
      _sum: { jamiSumma: true },
    }),
  ])

  const jamiQaytarish = Number(qaytarishSum._sum.jamiSumma || 0)
  const jamiSotuv =
    sotuvlar.reduce((s, v) => s + Number(v.yakuniySumma), 0) - jamiQaytarish
  const jamiXarajat = xarajatlar.reduce((s, x) => s + Number(x.summa), 0)
  const jamiFoyda = sotuvlar.reduce(
    (sum, sotuv) =>
      sum +
      sotuv.tarkiblar.reduce(
        (t, ta) =>
          t + (Number(ta.birlikNarxi) - Number(ta.tovar.kelishNarxi)) * Number(ta.miqdor),
        0,
      ),
    0,
  )
  const netProfit = jamiFoyda - jamiXarajat

  // Sheet 1: Umumiy
  const umumiyRows = [
    { "Ko'rsatkich": 'Davr (dan)', Qiymat: d.toISOString().slice(0, 10) },
    { "Ko'rsatkich": 'Davr (gacha)', Qiymat: g.toISOString().slice(0, 10) },
    { "Ko'rsatkich": 'Jami sotuv (net)', Qiymat: jamiSotuv },
    { "Ko'rsatkich": 'Sotuv soni', Qiymat: sotuvlar.length },
    { "Ko'rsatkich": 'Qaytarish', Qiymat: jamiQaytarish },
    { "Ko'rsatkich": 'Gross Profit', Qiymat: jamiFoyda },
    { "Ko'rsatkich": 'Xarajatlar', Qiymat: jamiXarajat },
    { "Ko'rsatkich": 'Net Profit', Qiymat: netProfit },
  ]

  // Sheet 2: To'lov usullari
  const tolovMap = new Map<string, { soni: number; summa: number }>()
  for (const s of sotuvlar) {
    const bor = tolovMap.get(s.tolovUsuli) ?? { soni: 0, summa: 0 }
    bor.soni++
    bor.summa += Number(s.yakuniySumma)
    tolovMap.set(s.tolovUsuli, bor)
  }
  const tolovRows = Array.from(tolovMap.entries()).map(([tolov, v]) => ({
    "To'lov usuli": tolov,
    Soni: v.soni,
    Jami: v.summa,
  }))

  // Sheet 3: Top tovarlar
  const tovarMap = new Map<
    string,
    { nomi: string; kategoriya: string; qty: number; revenue: number }
  >()
  for (const s of sotuvlar) {
    for (const t of s.tarkiblar) {
      const key = t.tovarId
      const bor = tovarMap.get(key) ?? {
        nomi: t.tovar.nomi,
        kategoriya: t.tovar.kategoriya?.nomi ?? '',
        qty: 0,
        revenue: 0,
      }
      bor.qty += Number(t.miqdor)
      bor.revenue += Number(t.jami)
      tovarMap.set(key, bor)
    }
  }
  const topTovarRows = Array.from(tovarMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 50)
    .map((t) => ({
      Tovar: t.nomi,
      Kategoriya: t.kategoriya,
      Miqdor: t.qty,
      Jami: t.revenue,
    }))

  // Sheet 4: Kassirlar
  const kassirMap = new Map<
    string,
    { ism: string; sotuvSoni: number; jamiSotuv: number }
  >()
  for (const s of sotuvlar) {
    const key = s.kassirId
    const bor = kassirMap.get(key) ?? { ism: s.kassir.ism, sotuvSoni: 0, jamiSotuv: 0 }
    bor.sotuvSoni++
    bor.jamiSotuv += Number(s.yakuniySumma)
    kassirMap.set(key, bor)
  }
  const kassirRows = Array.from(kassirMap.values()).map((k) => ({
    Kassir: k.ism,
    'Sotuv soni': k.sotuvSoni,
    'Jami sotuv': k.jamiSotuv,
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(umumiyRows), 'Umumiy')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tolovRows), 'Tolov usullari')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topTovarRows), 'Top tovarlar')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kassirRows), 'Kassirlar')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fileName = `hisobotlar-${d.toISOString().slice(0, 10)}-${g.toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
