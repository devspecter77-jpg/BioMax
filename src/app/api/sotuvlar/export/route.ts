/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dan = searchParams.get('dan')
    const gacha = searchParams.get('gacha')
    const kassirId = searchParams.get('kassirId') || undefined
    const mijozId = searchParams.get('mijozId') || undefined
    const tolovUsuli = searchParams.get('tolovUsuli') || undefined

    const where: Record<string, unknown> = { holati: 'YAKUNLANGAN', ...egaFilialWhere(session) }
    if (dan || gacha) {
      const sana: { gte?: Date; lte?: Date } = {}
      if (dan) sana.gte = new Date(dan)
      if (gacha) {
        const g = new Date(gacha)
        g.setHours(23, 59, 59)
        sana.lte = g
      }
      where.sana = sana
    }
    if (kassirId) where.kassirId = kassirId
    if (mijozId) where.mijozId = mijozId
    if (tolovUsuli) where.tolovUsuli = tolovUsuli

    const sotuvlar = await prisma.sotuv.findMany({
      where: where as any,
      include: {
        kassir: { select: { ism: true } },
        mijoz: { select: { ism: true, telefon: true } },
        tarkiblar: { include: { tovar: { select: { nomi: true, birlik: true, kelishNarxi: true } } } },
      },
      orderBy: { sana: 'desc' },
    })

    // Sheet 1: Sotuvlar
    const sotuvlarRows = sotuvlar.map((s) => {
      const foyda = s.tarkiblar.reduce(
        (f, t) => f + (Number(t.birlikNarxi) - Number(t.tovar.kelishNarxi)) * Number(t.miqdor),
        0
      )
      const jamiSumma = Number(s.jamiSumma)
      const chegirmaFoizi = Number(s.chegirma) > 0 && jamiSumma > 0
        ? Math.round((Number(s.chegirma) / jamiSumma) * 100) : 0
      return {
        Sana: s.sana.toISOString().replace('T', ' ').slice(0, 19),
        'Chek #': s.chekRaqami,
        Kassir: s.kassir.ism,
        Mijoz: s.mijoz?.ism ?? '\u2014',
        Telefon: s.mijoz?.telefon ?? '',
        "To'lov usuli": s.tolovUsuli,
        Summa: jamiSumma,
        Chegirma: Number(s.chegirma),
        'Chegirma %': chegirmaFoizi,
        Yakuniy: Number(s.yakuniySumma),
        Foyda: foyda,
        Holati: s.holati,
      }
    })

    // Sheet 2: Tarkiblar
    const tarkiblarRows = sotuvlar.flatMap((s) =>
      s.tarkiblar.map((t) => ({
        'Chek #': s.chekRaqami,
        Tovar: t.tovar.nomi,
        Turi: Number(t.birlikNarxi) === 0 ? 'Bonus' : 'Oddiy',
        Birlik: t.tovar.birlik,
        Miqdor: Number(t.miqdor),
        Narx: Number(t.birlikNarxi),
        Chegirma: Number(t.chegirma),
        Jami: Number(t.jami),
      }))
    )

    // Sheet 3: Xulosa
    const kassirMap = new Map<string, { ism: string; soni: number; jami: number }>()
    const tolovMap = new Map<string, { soni: number; jami: number }>()
    for (const s of sotuvlar) {
      const k = kassirMap.get(s.kassir.ism) ?? { ism: s.kassir.ism, soni: 0, jami: 0 }
      k.soni += 1
      k.jami += Number(s.yakuniySumma)
      kassirMap.set(s.kassir.ism, k)

      const t = tolovMap.get(s.tolovUsuli) ?? { soni: 0, jami: 0 }
      t.soni += 1
      t.jami += Number(s.yakuniySumma)
      tolovMap.set(s.tolovUsuli, t)
    }

    const xulosaRows = [
      { "Bo'lim": 'KASSIRLAR', Nomi: '', Soni: '', Jami: '' },
      ...Array.from(kassirMap.values()).map((k) => ({
        "Bo'lim": '',
        Nomi: k.ism,
        Soni: k.soni,
        Jami: k.jami,
      })),
      { "Bo'lim": '', Nomi: '', Soni: '', Jami: '' },
      { "Bo'lim": "TO'LOV USULLARI", Nomi: '', Soni: '', Jami: '' },
      ...Array.from(tolovMap.entries()).map(([tolov, v]) => ({
        "Bo'lim": '',
        Nomi: tolov,
        Soni: v.soni,
        Jami: v.jami,
      })),
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sotuvlarRows), 'Sotuvlar')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tarkiblarRows), 'Tarkiblar')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(xulosaRows), 'Xulosa')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const fileName = `sotuvlar-${dan ?? 'davr'}-${gacha ?? 'hozirgi'}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (e) {
    console.error('[/api/sotuvlar/export]', e)
    return NextResponse.json({ xato: 'Eksport muvaffaqiyatsiz' }, { status: 500 })
  }
}
