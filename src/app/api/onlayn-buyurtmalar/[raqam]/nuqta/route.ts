import { NextRequest, NextResponse } from 'next/server'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'

export const dynamic = 'force-dynamic'

// Buyurtmaning yetkazish nuqtasini aniqlashtirish — xodim mijoz bilan telefonda
// gaplashib aniq joyni kiritadi, kuryer shu nuqtaga boradi.
export async function POST(req: NextRequest, { params }: { params: Promise<{ raqam: string }> }) {
  const r = await onlaynRuxsat('onlayn-buyurtmalar.boshqarish')
  if (!r.ok) return r.javob
  const raqam = decodeURIComponent((await params).raqam)
  if (!/^MP-\d{4}-\d{5,}$/.test(raqam)) return NextResponse.json({ xato: 'Buyurtma topilmadi' }, { status: 404 })
  const tana = await req.json().catch(() => null) as { lat?: unknown; lng?: unknown } | null
  const lat = Number(tana?.lat), lng = Number(tana?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ xato: 'Koordinata noto‘g‘ri' }, { status: 400 })

  const n = await mpSorov<{ lat: number; lng: number }>('POST', `/api/erp/buyurtmalar/${encodeURIComponent(raqam)}/nuqta`, { lat, lng })
  if (!n.ok) return NextResponse.json({ kod: n.kod, xato: n.xato }, { status: n.holat >= 500 ? 502 : n.holat })
  return NextResponse.json(n.qiymat)
}
