import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

// Bitta mijozning joriy balansi — kassada mijoz tanlanganda chaqiriladi.
// Ataylab yengil: sotuvlar tarixini yuklamaydi, faqat ikkita son.
// Balans har sotuvdan keyin o'zgargani uchun har safar yangidan olinadi.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    const mijoz = await prisma.mijoz.findFirst({
      where: { id, ...egaFilialWhere(session) },
      select: { id: true, ism: true, ballBalans: true, keshbekBalans: true },
    })
    if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

    return NextResponse.json({
      mijozId: mijoz.id,
      ism: mijoz.ism,
      ball: Number(mijoz.ballBalans),
      keshbek: Number(mijoz.keshbekBalans),
    })
  } catch (e) {
    console.error('[sodiqlik/mijoz]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
