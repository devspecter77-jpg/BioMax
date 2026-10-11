import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@/lib/auth'
import { omborTuri, tekshir } from '@/lib/ovoz-ombor'
import { saqlashKuni, saqlashKuniniOrnat, texnikXizmat } from '@/lib/smena-server'
import { bazaChegarasiMb, bazaChegarasiniOrnat, bazaHajmi, chegaradanOshsaQisqart } from '@/lib/ovoz-baza'
import { BAZA_CHEGARA_VARIANTLARI, SAQLASH_VARIANTLARI } from '@/lib/smena'

// Ovoz yozuvlari sozlamasi: saqlash muddati, bazadagi hajm chegarasi va
// ombor ulanishini tekshirish. Ko'rish — `xodimlar.smena` (ruxsat
// xaritasida); o'zgartirish — faqat administrator.

export const dynamic = 'force-dynamic'

function adminmi(session: unknown): boolean {
  return (session as { user?: { rol?: string } } | null)?.user?.rol === 'ADMIN'
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  const [kun, chegaraMb, hajm] = await Promise.all([saqlashKuni(), bazaChegarasiMb(), bazaHajmi()])
  return NextResponse.json({
    omborTuri: omborTuri(),
    saqlashKun: kun,
    variantlar: SAQLASH_VARIANTLARI,
    baza: { chegaraMb, bayt: hajm.bayt, soni: hajm.soni, engEski: hajm.engEski },
    bazaVariantlari: BAZA_CHEGARA_VARIANTLARI,
  })
}

/** `saqlashKun` va/yoki `bazaChegaraMb` — ikkalasi ham ixtiyoriy. */
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  if (!adminmi(session)) return NextResponse.json({ xato: 'Faqat administrator o‘zgartiradi', kod: 'ruxsat_yoq' }, { status: 403 })
  const data = await req.json().catch(() => ({}))
  const javob: { ok: true; saqlashKun?: number; bazaChegaraMb?: number } = { ok: true }

  if (data.saqlashKun !== undefined) {
    const kun = Number(data.saqlashKun)
    if (!(SAQLASH_VARIANTLARI as readonly number[]).includes(kun)) {
      return NextResponse.json({ xato: 'Saqlash muddati noto‘g‘ri' }, { status: 400 })
    }
    await saqlashKuniniOrnat(kun)
    javob.saqlashKun = kun
    // Muddat qisqartirilgan bo'lsa eski yozuvlar darhol tozalansin
    after(() => texnikXizmat(true).catch(e => console.error('[ovoz texnik]', e)))
  }

  if (data.bazaChegaraMb !== undefined) {
    const mb = Number(data.bazaChegaraMb)
    if (!(BAZA_CHEGARA_VARIANTLARI as readonly number[]).includes(mb)) {
      return NextResponse.json({ xato: 'Hajm chegarasi noto‘g‘ri' }, { status: 400 })
    }
    await bazaChegarasiniOrnat(mb)
    javob.bazaChegaraMb = mb
    // Chegara pasaytirilgan bo'lsa ortig'i darhol bo'shatilsin
    after(() => chegaradanOshsaQisqart().catch(e => console.error('[ovoz baza] chegara', e)))
  }

  if (javob.saqlashKun === undefined && javob.bazaChegaraMb === undefined) {
    return NextResponse.json({ xato: 'O‘zgartiriladigan sozlama yo‘q' }, { status: 400 })
  }
  return NextResponse.json(javob)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  if (!adminmi(session)) return NextResponse.json({ xato: 'Faqat administrator tekshiradi', kod: 'ruxsat_yoq' }, { status: 403 })
  const data = await req.json().catch(() => ({}))
  if (data.amal !== 'tekshir') return NextResponse.json({ xato: 'Noma’lum amal' }, { status: 400 })
  return NextResponse.json(await tekshir())
}
