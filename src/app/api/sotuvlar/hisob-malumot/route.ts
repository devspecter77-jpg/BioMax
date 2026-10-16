import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { mijozKorinadimi } from '@/lib/mijoz-doirasi'
import { chekQarzi, mijozQarzlari } from '@/lib/mijoz-qarz'

export const dynamic = 'force-dynamic'

// Kassadagi to'lovdan oldingi (to'lanmagan) chek uchun: kim sotayotgani
// (kassir — bazadan, ism o'zgargan bo'lsa ham to'g'ri) va tanlangan mijozning
// hozirgi qarzi. Chekning o'zi brauzerda savatdan tuziladi, bazaga yozilmaydi.
// Ruxsat: `/api/sotuvlar/*` o'qish. Ko'rinmaydigan mijozning qarzi berilmaydi.

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const mijozId = req.nextUrl.searchParams.get('mijozId')

    const [kassir, mijozKorinadi] = await Promise.all([
      prisma.foydalanuvchi.findUnique({ where: { id: session.user.id }, select: { ism: true, telefon: true } }),
      mijozId ? mijozKorinadimi(session, mijozId) : Promise.resolve(false),
    ])
    const qarzlar = mijozKorinadi && mijozId ? await mijozQarzlari([mijozId]) : new Map<string, number>()
    return NextResponse.json({
      kassir,
      mijozQarzi: mijozKorinadi ? chekQarzi(qarzlar, mijozId) : null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[hisob-malumot]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
