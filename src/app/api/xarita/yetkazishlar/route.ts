import { NextResponse } from 'next/server'
import { xaritaRuxsati } from '@/lib/xarita-server'
import { yoldagiKuryerlar } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

// Xarita: buyurtma yetkazayotgan kuryerlar — joriy joyi, qaysi buyurtma va
// manzil. Sahifa buni har bir necha soniyada so'raydi (to'liq /api/xarita
// esa sekinroq), shuning uchun javob kichik: faqat band kuryerlar.
export async function GET() {
  try {
    const r = await xaritaRuxsati()
    if (!r.ok) return r.javob
    return NextResponse.json(
      { kuryerlar: await yoldagiKuryerlar(), hozir: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[xarita yetkazishlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
