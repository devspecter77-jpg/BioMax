import { NextRequest, NextResponse } from 'next/server'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { mijozIdmi } from '@/lib/onlayn-mijoz'

export const dynamic = 'force-dynamic'

// Onlayn xaridorning saqlangan manziliga aniq nuqta qo'yish — keyingi buyurtmalarda ham ishlaydi.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; manzilId: string }> }) {
  const r = await onlaynRuxsat('mijozlar.onlayn')
  if (!r.ok) return r.javob
  if (!(await amalRuxsatiBormi(r.session, 'mijozlar.tahrirlash'))) {
    return NextResponse.json({ xato: 'Mijoz ma’lumotini tahrirlashga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
  }
  const { id, manzilId } = await params
  if (!mijozIdmi(id) || !mijozIdmi(manzilId)) return NextResponse.json({ xato: 'Manzil topilmadi' }, { status: 404 })
  const tana = await req.json().catch(() => null) as { lat?: unknown; lng?: unknown } | null
  const lat = Number(tana?.lat), lng = Number(tana?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ xato: 'Koordinata noto‘g‘ri' }, { status: 400 })

  const n = await mpSorov<{ lat: number; lng: number }>('POST', `/api/erp/mijozlar/${encodeURIComponent(id)}/manzillar/${encodeURIComponent(manzilId)}`, { lat, lng })
  if (!n.ok) return NextResponse.json({ kod: n.kod, xato: n.xato }, { status: n.holat >= 500 ? 502 : n.holat })
  return NextResponse.json(n.qiymat)
}
