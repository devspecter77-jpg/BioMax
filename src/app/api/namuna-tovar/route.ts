import { NextResponse } from 'next/server'
import { dostavchiklarRoyxati, faolYetkazishlarniTekshir, namunaBelgisi, namunaRuxsat } from '@/lib/dostavchik-server'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'

export const dynamic = 'force-dynamic'

// "Namuna tovar" bo'limi: barcha dostavchiklar, ularning jonli holati va
// qo'lidagi namunalar soni. `belgi` — keyingi so'rovlarda o'zgarishni sezish uchun.
export async function GET() {
  const r = await namunaRuxsat()
  if (!r.ok) return r.javob
  try {
    // Mijoz saytda bekor qilgan buyurtmalar dostavchikda "navbatda" qolib ketmasin
    await faolYetkazishlarniTekshir().catch(e => console.warn('[namuna-tovar] sayt bilan moslanmadi', e))
    const [dostavchiklar, belgi, berishMumkin, dostavchikMumkin] = await Promise.all([
      dostavchiklarRoyxati(),
      namunaBelgisi(),
      amalRuxsatiBormi(r.session, 'namuna-tovar.berish'),
      amalRuxsatiBormi(r.session, 'namuna-tovar.dostavchik'),
    ])
    return NextResponse.json({ dostavchiklar, belgi, ruxsat: { berish: berishMumkin, dostavchik: dostavchikMumkin } })
  } catch (e) {
    console.error('[namuna-tovar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
