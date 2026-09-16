import { NextRequest, NextResponse } from 'next/server'
import { mpSorov } from '@/lib/marketplace-mijoz'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import type { OnlaynBuyurtma } from '@/lib/onlayn-buyurtma'
import { erpIzi } from '@/lib/onlayn-sotuv-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ raqam: string }> }) {
  const r = await onlaynRuxsat()
  if (!r.ok) return r.javob
  const raqam = decodeURIComponent((await params).raqam)
  if (!/^MP-\d{4}-\d{5,}$/.test(raqam)) return NextResponse.json({ xato: 'Buyurtma topilmadi' }, { status: 404 })

  const n = await mpSorov<OnlaynBuyurtma>('GET', `/api/erp/buyurtmalar/${encodeURIComponent(raqam)}`)
  if (!n.ok) return NextResponse.json({ kod: n.kod, xato: n.xato }, { status: n.holat >= 500 ? 502 : n.holat })
  return NextResponse.json({ ...n.qiymat, erp: await erpIzi(raqam) })
}
