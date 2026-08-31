import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

async function ruxsatniTekshirish(id: string) {
  const session = await auth()
  if (!session || (session.user as any)?.rol !== 'ADMIN') return null
  const ownFilialId = sessionFilialId(session)
  if (ownFilialId) {
    const nishon = await prisma.foydalanuvchi.findUnique({ where: { id }, select: { filialId: true } })
    if (!nishon || nishon.filialId !== ownFilialId) return null
  }
  return session
}

// Ushbu foydalanuvchidan yashirilgan mahsulotlar id ro'yxati
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await ruxsatniTekshirish(id)
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const yozuvlar = await prisma.tovarYashirish.findMany({
      where: { foydalanuvchiId: id },
      select: { tovarId: true },
    })
    return NextResponse.json(yozuvlar.map(y => y.tovarId))
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// To'liq ro'yxatni almashtirish — { tovarIdlar: string[] } yashirilishi kerak bo'lganlar
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await ruxsatniTekshirish(id)
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const { tovarIdlar } = await req.json()
    if (!Array.isArray(tovarIdlar)) {
      return NextResponse.json({ xato: "Noto'g'ri ma'lumot" }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.tovarYashirish.deleteMany({ where: { foydalanuvchiId: id } }),
      ...(tovarIdlar.length > 0
        ? [prisma.tovarYashirish.createMany({
            data: tovarIdlar.map((tovarId: string) => ({ tovarId, foydalanuvchiId: id })),
            skipDuplicates: true,
          })]
        : []),
    ])

    return NextResponse.json({ ok: true, soni: tovarIdlar.length })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
