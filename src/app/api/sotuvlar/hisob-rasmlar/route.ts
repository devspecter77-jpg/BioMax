import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { chekRasmlari } from '@/lib/chek-rasm'

export const dynamic = 'force-dynamic'

// To'lovdan oldingi (to'lanmagan) A4 chek uchun savatdagi mahsulotlar rasmi.
// Chekning o'zi brauzerda savatdan tuziladi va bazaga yozilmaydi — bu yerdan
// faqat kichraytirilgan rasmlar keladi, o'z katalogidagi tovarlarniki.
// Ruxsat: `/api/sotuvlar/*` o'qish (sotuv, xaridlar yoki mijozlar).

/** Bir chekda shundan ko'p xil mahsulot bo'lmaydi. */
const MAX_TOVAR = 200

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const idlar = (req.nextUrl.searchParams.get('idlar') ?? '')
      .split(',').map(s => s.trim()).filter(s => /^[A-Za-z0-9_-]{1,40}$/.test(s)).slice(0, MAX_TOVAR)
    const rasmlar = await chekRasmlari(idlar, egaFilialWhere(session))
    return NextResponse.json({ rasmlar: Object.fromEntries(rasmlar) })
  } catch (e) {
    console.error('[hisob-rasmlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
