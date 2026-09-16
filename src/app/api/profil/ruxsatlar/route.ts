import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hisobHolati } from '@/lib/ruxsat-server'

export const dynamic = 'force-dynamic'

// Joriy xodimning JONLI ruxsatlari — sahifadagi tugmalarni yashirish uchun
// (`useRuxsat`). Sessiyadagi ro'yxat 30 soniyagacha eskirishi mumkin; bu esa
// bazadan (15 s kesh bilan) keladi. Server baribir har bir amalni o'zi tekshiradi.
export async function GET() {
  const session = await auth()
  const id = (session?.user as { id?: string } | undefined)?.id
  if (!id) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  const h = await hisobHolati(id)
  if (!h || !h.faol) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
  return NextResponse.json(
    { rol: h.rol, ruxsatlar: h.ruxsatlar, yashirinMaydonlar: h.yashirinMaydonlar },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
