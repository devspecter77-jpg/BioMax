import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DOSTAVCHIK_DOIRASI, namunaRuxsat } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

/**
 * Xato yozilgan namunani o'chirish. Tana: `{ idlar: string[] }`.
 *
 * Faqat hali qo'lda turgani o'chadi: qaytarib topshirilgan namuna tarix —
 * uni o'chirib "kim nimani qaytargan"ni yo'qotib bo'lmaydi. Bo'sh qolgan
 * berish yozuvi ham o'chiriladi.
 */
export async function POST(req: NextRequest) {
  const r = await namunaRuxsat('namuna-tovar.berish')
  if (!r.ok) return r.javob

  let idlar: string[] = []
  try {
    const tana = await req.json()
    idlar = Array.isArray(tana?.idlar) ? tana.idlar.filter((x: unknown): x is string => typeof x === 'string').slice(0, 500) : []
  } catch {
    return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })
  }
  if (idlar.length === 0) return NextResponse.json({ xato: 'O‘chiriladigan namunani tanlang' }, { status: 400 })

  try {
    const qatorlar = await prisma.namunaTarkibi.findMany({
      where: { id: { in: idlar }, holati: 'BERILGAN', berish: { dostavchik: DOSTAVCHIK_DOIRASI } },
      select: { id: true, berishId: true },
    })
    if (qatorlar.length === 0) return NextResponse.json({ ok: true, soni: 0 })

    const berishIdlar = [...new Set(qatorlar.map(q => q.berishId))]
    await prisma.$transaction([
      prisma.namunaTarkibi.deleteMany({ where: { id: { in: qatorlar.map(q => q.id) } } }),
      prisma.namunaBerish.deleteMany({ where: { id: { in: berishIdlar }, tarkiblar: { none: {} } } }),
    ])
    return NextResponse.json({ ok: true, soni: qatorlar.length })
  } catch (e) {
    console.error('[namuna-tovar/ochirish]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
