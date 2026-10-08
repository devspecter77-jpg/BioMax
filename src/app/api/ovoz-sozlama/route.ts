import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@/lib/auth'
import { omborTuri, tekshir } from '@/lib/ovoz-ombor'
import { saqlashKuni, saqlashKuniniOrnat, texnikXizmat } from '@/lib/smena-server'
import { SAQLASH_VARIANTLARI } from '@/lib/smena'

// Ovoz yozuvlari sozlamasi: saqlash muddati va ombor ulanishini tekshirish.
// Ko'rish — `xodimlar.smena` (ruxsat xaritasida); o'zgartirish — faqat administrator.

export const dynamic = 'force-dynamic'

function adminmi(session: unknown): boolean {
  return (session as { user?: { rol?: string } } | null)?.user?.rol === 'ADMIN'
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  return NextResponse.json({
    omborTuri: omborTuri(),
    saqlashKun: await saqlashKuni(),
    variantlar: SAQLASH_VARIANTLARI,
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  if (!adminmi(session)) return NextResponse.json({ xato: 'Faqat administrator o‘zgartiradi', kod: 'ruxsat_yoq' }, { status: 403 })
  const data = await req.json().catch(() => ({}))
  const kun = Number(data.saqlashKun)
  if (!(SAQLASH_VARIANTLARI as readonly number[]).includes(kun)) {
    return NextResponse.json({ xato: 'Saqlash muddati noto‘g‘ri' }, { status: 400 })
  }
  await saqlashKuniniOrnat(kun)
  // Muddat qisqartirilgan bo'lsa eski yozuvlar darhol tozalansin
  after(() => texnikXizmat(true).catch(e => console.error('[ovoz texnik]', e)))
  return NextResponse.json({ ok: true, saqlashKun: kun })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  if (!adminmi(session)) return NextResponse.json({ xato: 'Faqat administrator tekshiradi', kod: 'ruxsat_yoq' }, { status: 403 })
  const data = await req.json().catch(() => ({}))
  if (data.amal !== 'tekshir') return NextResponse.json({ xato: 'Noma’lum amal' }, { status: 400 })
  return NextResponse.json(await tekshir())
}
