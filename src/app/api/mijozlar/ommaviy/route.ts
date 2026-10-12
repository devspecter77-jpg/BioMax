import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { kategoriyaniTekshir, masulniTekshir, mijozTenant } from '@/lib/mijoz-doirasi'

export const dynamic = 'force-dynamic'

// Bir nechta mijozni birdaniga kategoriyaga o'tkazish va/yoki mas'ul xodimga
// biriktirish — faqat administrator (mijozlarni xodimlar orasida taqsimlash).
// Tana: { idlar: string[], kategoriyaId?: string | null, masulId?: string | null }

const xato = (xabar: string, holat = 400) => NextResponse.json({ xato: xabar }, { status: holat })

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return xato("Ruxsat yo'q", 401)
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return xato('Faqat administrator', 403)

    const tana = await req.json().catch(() => null) as { idlar?: unknown; kategoriyaId?: unknown; masulId?: unknown } | null
    const idlar = Array.isArray(tana?.idlar) ? [...new Set(tana.idlar.filter((x): x is string => typeof x === 'string'))] : []
    if (idlar.length === 0) return xato('Mijozlar tanlanmagan')
    if (idlar.length > 1000) return xato('Bir martada ko‘pi bilan 1000 ta mijoz')
    if (tana?.kategoriyaId === undefined && tana?.masulId === undefined) return xato('Nimani o‘zgartirish ko‘rsatilmagan')

    const kat = await kategoriyaniTekshir(session, tana?.kategoriyaId)
    if (!kat.ok) return xato(kat.xato)
    const masul = await masulniTekshir(session, tana?.masulId)
    if (!masul.ok) return xato(masul.xato, masul.holat)

    const { count } = await prisma.mijoz.updateMany({
      where: { AND: [{ id: { in: idlar } }, mijozTenant(session)] },
      data: {
        ...(kat.kategoriyaId !== undefined ? { kategoriyaId: kat.kategoriyaId } : {}),
        ...(masul.masulId !== undefined ? { masulId: masul.masulId } : {}),
      },
    })
    return NextResponse.json({ ok: true, ozgardi: count })
  } catch (e) {
    console.error('[mijozlar/ommaviy]', e)
    return xato('Server xatosi', 500)
  }
}
