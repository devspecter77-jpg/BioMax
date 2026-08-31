import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const { id } = await params
    const mijoz = await prisma.mijoz.findFirst({
      where: { id, ...(filialId ? { filialId } : {}) },
      include: {
        sotuvlar: {
          orderBy: { sana: 'desc' },
          include: {
            tarkiblar: { include: { tovar: { select: { nomi: true } } } },
            kassir: { select: { ism: true } },
          },
        },
      },
    })
    if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })
    return NextResponse.json(mijoz)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const { id } = await params

    const mijoz = await prisma.mijoz.findFirst({ where: { id, ...(filialId ? { filialId } : {}) }, select: { id: true } })
    if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

    const nasiyalar = await prisma.nasiya.findMany({ where: { mijozId: id }, select: { id: true } })
    const nasiyaIds = nasiyalar.map(n => n.id)

    await prisma.$transaction([
      // Sotuvlar tarixi saqlanib qoladi — faqat mijoz bog'lanishi uziladi.
      prisma.sotuv.updateMany({ where: { mijozId: id }, data: { mijozId: null } }),
      prisma.buyurtma.updateMany({ where: { mijozId: id }, data: { mijozId: null } }),
      prisma.bildirishnomLog.deleteMany({ where: { mijozId: id } }),
      prisma.nasiyaTolov.deleteMany({ where: { nasiyaId: { in: nasiyaIds } } }),
      prisma.nasiyaQarzTarixi.deleteMany({ where: { nasiyaId: { in: nasiyaIds } } }),
      prisma.nasiya.deleteMany({ where: { mijozId: id } }),
      prisma.mijoz.delete({ where: { id } }),
    ])

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const { id } = await params
    const mavjud = await prisma.mijoz.findFirst({ where: { id, ...(filialId ? { filialId } : {}) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })

    const data = await req.json()

    const mijoz = await prisma.mijoz.update({
      where: { id },
      data: {
        ism: data.ism,
        telefon: data.telefon || null,
        manzil: data.manzil || null,
        izoh: data.izoh || null,
      },
    })
    return NextResponse.json(mijoz)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
