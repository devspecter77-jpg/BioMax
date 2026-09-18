import { NextRequest, NextResponse } from 'next/server'
import { plakatSvg, qisqaManzil, qrManzilTekshir, qrSvg } from '@/lib/ilova-qr'
import { dokonNomi, manzilniSaqla, qrMatritsa, qrRuxsat, saqlanganManzil, standartManzil } from '@/lib/ilova-qr-server'

export const dynamic = 'force-dynamic'

/** QR kod va plakat — SVG ko'rinishida (vektor: har qanday o'lchamda aniq). */
export async function GET() {
  const r = await qrRuxsat()
  if (!r.ok) return r.javob
  try {
    const [manzil, dokon] = await Promise.all([saqlanganManzil(), dokonNomi()])
    if (!manzil) {
      return NextResponse.json({
        manzil: '',
        standart: '',
        dokon,
        xabar: 'Sayt manzili hali kiritilmagan. Quyida yozing yoki ERP `.env` da MARKETPLACE_OMMAVIY_URL ni to‘ldiring.',
      })
    }
    const m = await qrMatritsa(manzil)
    return NextResponse.json({
      manzil,
      qisqa: qisqaManzil(manzil),
      standart: standartManzil(),
      dokon,
      qr: qrSvg(m, { manzil }),
      plakat: plakatSvg(m, { dokon, manzil }),
    })
  } catch (e) {
    console.error('[ilova-qr]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

/** Manzilni o'zgartirish — chop etilgan eski kodlar ishlamay qolishi mumkin. */
export async function PUT(req: NextRequest) {
  const r = await qrRuxsat('ilova-qr.manzil')
  if (!r.ok) return r.javob
  try {
    const tana = await req.json().catch(() => ({}))
    const n = qrManzilTekshir(tana?.manzil)
    if ('xato' in n) return NextResponse.json({ xato: n.xato }, { status: 400 })
    await manzilniSaqla(n.manzil)
    return NextResponse.json({ ok: true, manzil: n.manzil })
  } catch (e) {
    console.error('[ilova-qr PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
