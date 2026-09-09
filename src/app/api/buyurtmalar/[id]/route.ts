import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

const HOLATLAR = ['KUTILMOQDA', 'TASDIQLANGAN', 'BEKOR_QILINGAN'] as const
type Holat = (typeof HOLATLAR)[number]

function holatMi(v: unknown): v is Holat {
  return typeof v === 'string' && (HOLATLAR as readonly string[]).includes(v)
}

/** Zakaz shu foydalanuvchining ko'rish doirasidami. */
async function egalikTekshir(id: string, session: Parameters<typeof egaFilialWhere>[0]) {
  return prisma.buyurtma.findFirst({
    where: { id, ...egaFilialWhere(session) },
    select: { id: true },
  })
}

// Holatni o'zgartirish: yuklab olinganda TASDIQLANGAN, o'chirilganda
// BEKOR_QILINGAN. Ikkalasida ham yozuv saqlanib qoladi.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    if (!(await egalikTekshir(id, session))) {
      return NextResponse.json({ xato: 'Zakaz topilmadi' }, { status: 404 })
    }

    const { holati } = await req.json()
    if (!holatMi(holati)) {
      return NextResponse.json({ xato: "Noma'lum holat" }, { status: 400 })
    }

    const buyurtma = await prisma.buyurtma.update({
      where: { id },
      data: { holati },
      include: {
        sotuvchi: { select: { id: true, ism: true } },
        mijoz: { select: { id: true, ism: true, telefon: true } },
        tarkiblar: { include: { tovar: { select: { id: true, nomi: true, birlik: true } } } },
      },
    })

    return NextResponse.json(buyurtma)
  } catch (e) {
    console.error('[buyurtma PATCH]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Butunlay o'chirish. Odatda kerak emas — kassir "o'chirdim" deganda
// holat BEKOR_QILINGAN ga o'tadi va tarixda qoladi.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    if (!(await egalikTekshir(id, session))) {
      return NextResponse.json({ xato: 'Zakaz topilmadi' }, { status: 404 })
    }

    await prisma.buyurtma.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[buyurtma DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
