import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { id } = await params
    const mavjud = await prisma.kategoriya.findFirst({ where: { id, ...egaFilialWhere(session) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const tana = await req.json()
    const { nomi, tavsif } = tana

    // Payloadda YO'Q maydonga tegilmaydi — omborni tegmasdan nomni
    // o'zgartirish (yoki teskarisi) mumkin bo'lsin.
    const yangilash: Record<string, unknown> = {}
    if (Object.prototype.hasOwnProperty.call(tana, 'nomi')) {
      const nomiTrim = String(nomi ?? '').trim()
      if (!nomiTrim) return NextResponse.json({ xato: 'Kategoriya nomi majburiy' }, { status: 400 })
      // Baza indeksi filialsiz qatorlarni ushlamaydi (NULL != NULL)
      const takror = await prisma.kategoriya.findFirst({
        where: {
          id: { not: id },
          nomi: { equals: nomiTrim, mode: 'insensitive' },
          ...egaFilialWhere(session),
        },
        select: { id: true },
      })
      if (takror) return NextResponse.json({ xato: 'Bu nom allaqachon mavjud' }, { status: 400 })
      yangilash.nomi = nomiTrim
    }
    if (Object.prototype.hasOwnProperty.call(tana, 'tavsif')) yangilash.tavsif = tavsif

    if (Object.prototype.hasOwnProperty.call(tana, 'omborId')) {
      if (!tana.omborId) {
        yangilash.omborId = null
      } else {
        // Ombor so'rovchining doirasida bo'lishi shart
        const o = await prisma.ombor.findFirst({
          where: { id: String(tana.omborId), ...egaFilialWhere(session) },
          select: { id: true },
        })
        if (!o) return NextResponse.json({ xato: 'Ombor topilmadi' }, { status: 404 })
        yangilash.omborId = o.id
      }
    }

    const kat = await prisma.kategoriya.update({
      where: { id },
      data: yangilash,
      include: { ombor: { select: { id: true, nomi: true } } },
    })
    return NextResponse.json(kat)
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ xato: 'Bu nom allaqachon mavjud' }, { status: 400 })
    }
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { id } = await params
    const mavjud = await prisma.kategoriya.findFirst({ where: { id, ...egaFilialWhere(session) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    // Check if any products use this category
    const count = await prisma.tovar.count({ where: { kategoriyaId: id } })
    if (count > 0) {
      return NextResponse.json(
        { xato: `Bu kategoriyada ${count} ta tovar bor. Avval tovarlarni o'tkazing.` },
        { status: 400 }
      )
    }

    await prisma.kategoriya.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
