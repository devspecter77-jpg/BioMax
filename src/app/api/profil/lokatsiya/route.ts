import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// Faqat o'zining joylashuvini yozadi — boshqa foydalanuvchiga tegib
// bo'lmaydi, id sessiyadan olinadi, so'rovdan emas.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { lat, lng } = await req.json()
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ xato: "Noto'g'ri ma'lumot" }, { status: 400 })
    }

    await prisma.foydalanuvchi.update({
      where: { id: (session.user as any).id },
      data: { lokatsiyaLat: lat, lokatsiyaLng: lng, lokatsiyaYangilangan: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
