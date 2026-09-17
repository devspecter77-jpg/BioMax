import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DOSTAVCHIK_DOIRASI, namunaRuxsat } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

/**
 * Dostavchik namunalarni qaytarib topshirdi. Tana: `{ idlar: string[] }`.
 *
 * Faqat hali qaytarilmaganlari belgilanadi — ikki xodim bir vaqtda bossa
 * ham qabul qilgan odam va vaqt birinchi bosgandan qoladi.
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
  if (idlar.length === 0) return NextResponse.json({ xato: 'Qaytarilgan namunani tanlang' }, { status: 400 })

  try {
    const n = await prisma.namunaTarkibi.updateMany({
      where: { id: { in: idlar }, holati: 'BERILGAN', berish: { dostavchik: DOSTAVCHIK_DOIRASI } },
      data: { holati: 'TOPSHIRILGAN', topshirilganVaqt: new Date(), qabulQilganId: r.meId },
    })
    return NextResponse.json({ ok: true, soni: n.count })
  } catch (e) {
    console.error('[namuna-tovar/topshirish]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
