import { NextRequest, NextResponse } from 'next/server'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { mijozIdmi } from '@/lib/onlayn-mijoz'
import { BlokXatosi, hisobHolatiniOzgartir } from '@/lib/onlayn-blok-server'

export const dynamic = 'force-dynamic'

// Onlayn xaridorni saytdan chiqarish (POST — sababi bilan) va qayta ruxsat
// berish (DELETE). Holat marketplace'da, jurnal ERP'da (lib/onlayn-blok-server.ts).

async function bajar(req: NextRequest, params: Promise<{ id: string }>, chiqarish: boolean) {
  const r = await onlaynRuxsat('mijozlar.onlayn-bloklash')
  if (!r.ok) return r.javob
  const id = decodeURIComponent((await params).id)
  if (!mijozIdmi(id)) return NextResponse.json({ xato: 'Xaridor topilmadi' }, { status: 404 })
  const tana = chiqarish ? await req.json().catch(() => ({})) : {}
  try {
    const n = await hisobHolatiniOzgartir({
      hisobId: id,
      chiqarish,
      sabab: typeof tana?.sabab === 'string' ? tana.sabab : null,
      session: r.session,
    })
    return NextResponse.json({ ok: true, faol: n.hisob.faol, yozuv: n.yozuv, faolBuyurtmalar: n.faolBuyurtmalar })
  } catch (e) {
    if (e instanceof BlokXatosi) return NextResponse.json({ xato: e.message }, { status: e.status })
    console.error('[onlayn-mijozlar/bloklash]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return bajar(req, params, true)
}

export function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return bajar(req, params, false)
}
