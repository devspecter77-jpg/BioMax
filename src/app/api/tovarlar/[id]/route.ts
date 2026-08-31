import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'
import { rasmlarniSiqish } from '@/lib/rasm'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)

    const tovar = await prisma.tovar.findFirst({
      where: { id, ...(filialId ? { filialId } : {}) },
      include: {
        kategoriya: true,
        omborHarakati: {
          include: { foydalanuvchi: { select: { ism: true } } },
          orderBy: { sana: 'desc' },
          take: 20,
        },
      },
    })
    if (!tovar) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })
    return NextResponse.json(tovar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)

    const mavjud = await prisma.tovar.findFirst({ where: { id, ...(filialId ? { filialId } : {}) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const data = await req.json()
    const rasmlar = await rasmlarniSiqish(data.rasmlar)
    const tovar = await prisma.tovar.update({
      where: { id },
      data: {
        nomi: data.nomi,
        kategoriyaId: data.kategoriyaId,
        shtrixKod: data.shtrixKod || null,
        kelishNarxi: parseFloat(data.kelishNarxi),
        sotishNarxi: parseFloat(data.sotishNarxi),
        valyuta: data.valyuta === 'USD' ? 'USD' : 'UZS',
        birlik: data.birlik,
        minimalQoldiq: parseInt(data.minimalQoldiq),
        rasmlar,
        yaroqlilikMuddati: data.yaroqlilikMuddati ? new Date(data.yaroqlilikMuddati) : null,
      },
      include: { kategoriya: true },
    })

    // Qoldiqni oshirish (ixtiyoriy) — do'konga to'g'ridan-to'g'ri kirim
    const qoshiladigan = parseFloat(data.qoldiqQoshish)
    if (qoshiladigan && qoshiladigan > 0) {
      await prisma.omborHarakati.create({
        data: {
          tovarId: id,
          turi: 'KIRIM',
          joy: 'DOKON',
          miqdor: qoshiladigan,
          narx: parseFloat(data.kelishNarxi),
          izoh: "Tahrirlashda qoldiq oshirildi",
          foydalanuvchiId: (session.user as any).id,
        },
      })
    }

    return NextResponse.json(tovar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)

    const mavjud = await prisma.tovar.findFirst({ where: { id, ...(filialId ? { filialId } : {}) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const tovar = await prisma.tovar.update({
      where: { id },
      data: { holati: 'ARXIVLANGAN' },
    })
    return NextResponse.json(tovar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
