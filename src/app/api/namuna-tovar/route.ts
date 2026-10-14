import { NextResponse } from 'next/server'
import { faolYetkazishlarniTekshir, namunaBelgisi, namunaOluvchilarRoyxati, namunaRuxsat } from '@/lib/dostavchik-server'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'

export const dynamic = 'force-dynamic'

// "Namuna tovar" bo'limi: dostavchiklar va agentlar (ikki kichik bo'lim), jonli
// holati va qo'lidagi namunalar soni. `belgi` — keyingi so'rovlarda o'zgarishni sezish uchun.
export async function GET() {
  const r = await namunaRuxsat()
  if (!r.ok) return r.javob
  try {
    // Mijoz saytda bekor qilgan buyurtmalar dostavchikda "navbatda" qolib ketmasin
    await faolYetkazishlarniTekshir().catch(e => console.warn('[namuna-tovar] sayt bilan moslanmadi', e))
    const [dostavchiklar, agentlar, belgi, berishMumkin, dostavchikMumkin, agentMumkin] = await Promise.all([
      namunaOluvchilarRoyxati('DOSTAVCHIK'),
      namunaOluvchilarRoyxati('AGENT'),
      namunaBelgisi(),
      amalRuxsatiBormi(r.session, 'namuna-tovar.berish'),
      amalRuxsatiBormi(r.session, 'namuna-tovar.dostavchik'),
      amalRuxsatiBormi(r.session, 'namuna-tovar.agent'),
    ])
    return NextResponse.json({
      dostavchiklar, agentlar, belgi,
      ruxsat: { berish: berishMumkin, dostavchik: dostavchikMumkin, agent: agentMumkin },
    })
  } catch (e) {
    console.error('[namuna-tovar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
