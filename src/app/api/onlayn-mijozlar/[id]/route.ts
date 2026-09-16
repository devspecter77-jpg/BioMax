import { NextRequest, NextResponse } from 'next/server'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { erpKartalari, onlaynCheklar } from '@/lib/onlayn-mijoz-server'
import { mijozIdmi, type OnlaynMijozTafsilot } from '@/lib/onlayn-mijoz'

export const dynamic = 'force-dynamic'

// Bitta onlayn xaridor: manzillari, barcha buyurtmalari tarkibi bilan va ERP'dagi cheklari.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await onlaynRuxsat('mijozlar.onlayn')
  if (!r.ok) return r.javob

  const id = decodeURIComponent((await params).id)
  if (!mijozIdmi(id)) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

  const n = await mpSorov<OnlaynMijozTafsilot>('GET', `/api/erp/mijozlar/${encodeURIComponent(id)}`)
  if (!n.ok) return NextResponse.json({ kod: n.kod, xato: n.xato }, { status: n.holat >= 500 ? 502 : n.holat })

  const m = n.qiymat
  const [kartalar, cheklar] = await Promise.all([
    erpKartalari(r.session, [m.telefon]),
    onlaynCheklar(m.buyurtmalar.map(b => b.raqam)),
  ])
  return NextResponse.json({
    ...m,
    erpKarta: kartalar.get(m.telefon) ?? null,
    buyurtmalar: m.buyurtmalar.map(b => ({ ...b, erp: { sotuv: cheklar.get(b.raqam) ?? null, rezerv: 'YOQ' as const } })),
  })
}
