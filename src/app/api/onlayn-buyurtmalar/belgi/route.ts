import { NextResponse } from 'next/server'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { yetkazishBelgisi } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

interface MpBelgi {
  belgi: string
  yangiSoni: number
  oxirgi: { raqam: string; yaratilgan: string } | null
}

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
    mpSorov<MpBelgi>('GET', '/api/erp/buyurtmalar/belgi'),
    yetkazishBelgisi(dostavchik ? u.id : undefined),
  ])
  if (!mp.ok) return NextResponse.json({ kod: mp.kod, xato: mp.xato }, { status: mp.holat >= 500 ? 502 : mp.holat })

  return NextResponse.json({
    belgi: `${mp.qiymat.belgi}|${erp.belgi}`,
    yangiSoni: dostavchik ? null : mp.qiymat.yangiSoni,
    oxirgi: dostavchik ? null : mp.qiymat.oxirgi,
    /** Dostavchik uchun — o'ziga biriktirilgan faol buyurtmalar soni */
    faolYetkazish: erp.faolSoni,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
