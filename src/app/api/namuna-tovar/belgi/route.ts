import { NextResponse } from 'next/server'
import { namunaBelgisi, namunaRuxsat } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

// Jonli yangilanish: sahifa shu qisqa belgini tez-tez so'raydi va faqat
// o'zgarganda to'liq ma'lumotni qayta yuklaydi.
export async function GET() {
  const r = await namunaRuxsat()
  if (!r.ok) return r.javob
  try {
    return NextResponse.json({ belgi: await namunaBelgisi() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[namuna-tovar/belgi]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
