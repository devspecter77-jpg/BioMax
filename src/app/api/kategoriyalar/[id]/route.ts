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

    const { nomi, tavsif } = await req.json()

    const kat = await prisma.kategoriya.update({
      where: { id },
      data: { nomi, tavsif },
    })
    return NextResponse.json(kat)
  } catch (e: any) {
    if (e.code === 'P2002') {
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
