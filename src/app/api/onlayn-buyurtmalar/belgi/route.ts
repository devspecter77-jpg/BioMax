import { NextResponse } from 'next/server'
import { buyurtmaBelgisi } from '@/lib/marketplace-baza'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { yetkazishBelgisi } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

/**
 * Jonli yangilanish uchun qisqa belgi — panel uni bir necha soniyada bir so'raydi.
 *
 * Ikki manbadan: saytdagi buyurtmalar (yangi tushdi, holat o'zgardi) va
 * ERP'dagi yetkazish (dostavchik biriktirildi, yo'lga chiqdi, yetib keldi).
 * Dostavchikka boshqa buyurtmalar haqida ma'lumot berilmaydi — faqat o'ziniki.
 */
export async function GET() {
  const r = await onlaynRuxsat()
  if (!r.ok) return r.javob
  const u = r.session.user as unknown as { id: string; rol?: string }
  const dostavchik = u.rol === 'DOSTAVCHIK'

  const [mp, erp] = await Promise.all([
    buyurtmaBelgisi(),
    yetkazishBelgisi(dostavchik ? u.id : undefined),
  ])

  return NextResponse.json({
    belgi: `${mp.belgi}|${erp.belgi}`,
    yangiSoni: dostavchik ? null : mp.yangiSoni,
    oxirgi: dostavchik ? null : mp.oxirgi,
    /** Dostavchik uchun — o'ziga biriktirilgan faol buyurtmalar soni */
    faolYetkazish: erp.faolSoni,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
