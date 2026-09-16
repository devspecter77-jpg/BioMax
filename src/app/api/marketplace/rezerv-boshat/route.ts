import { NextRequest, NextResponse } from 'next/server'
import { imzoniTekshir } from '@/lib/marketplace-imzo'
import { rezervniBoshat } from '@/lib/onlayn-sotuv-server'

// MARKETPLACE SHARTNOMASI — mijoz buyurtmani saytda o'zi bekor qilganda
// ERP'dagi zaxira bandini bo'shatish. Idempotent: band bo'lmasa ham `ok`.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const xom = await req.text()
  const t = imzoniTekshir(req, xom)
  if (!t.ok) return NextResponse.json({ kod: t.sabab, xato: 'Ruxsat yo‘q' }, { status: t.holat })

  let raqam: unknown
  try {
    raqam = (JSON.parse(xom) as { buyurtmaRaqami?: unknown }).buyurtmaRaqami
  } catch {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'So‘rov noto‘g‘ri' }, { status: 400 })
  }
  if (typeof raqam !== 'string' || !/^MP-\d{4}-\d{5,}$/.test(raqam)) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'Buyurtma raqami noto‘g‘ri' }, { status: 400 })
  }
  const boshatildi = await rezervniBoshat(raqam)
  return NextResponse.json({ ok: true, boshatildi })
}
