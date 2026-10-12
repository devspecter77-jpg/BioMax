import { NextRequest, NextResponse } from 'next/server'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { navbatHolati, navbatniOrnat, navbatniTurt } from '@/lib/kuryer-navbat'

export const dynamic = 'force-dynamic'

// Kuryerlar navbati: kim ishda, keyingi buyurtma kimga tushadi, nechta
// buyurtma kutmoqda. Yoqish/o'chirish — kuryer biriktira oladiganlarga.

export async function GET() {
  const r = await onlaynRuxsat('onlayn-buyurtmalar.kuryer')
  if (!r.ok) return r.javob
  try {
    navbatniTurt()
    return NextResponse.json(await navbatHolati(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[onlayn-buyurtmalar/navbat]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const r = await onlaynRuxsat('onlayn-buyurtmalar.kuryer')
  if (!r.ok) return r.javob
  const tana = await req.json().catch(() => null) as { yoqilgan?: unknown } | null
  if (typeof tana?.yoqilgan !== 'boolean') {
    return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })
  }
  try {
    await navbatniOrnat(tana.yoqilgan)
    if (tana.yoqilgan) navbatniTurt(true)
    return NextResponse.json(await navbatHolati())
  } catch (e) {
    console.error('[onlayn-buyurtmalar/navbat PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
