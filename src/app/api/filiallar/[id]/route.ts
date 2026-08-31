import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

function faqatEga(session: any) {
  const rol = session?.user?.rol
  return !!session && rol === 'ADMIN' && !sessionFilialId(session)
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!faqatEga(session)) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const filial = await prisma.filial.findUnique({
      where: { id },
      include: { _count: { select: { xodimlar: true } } },
    })
    if (!filial) return NextResponse.json({ xato: 'Filial topilmadi' }, { status: 404 })

    return NextResponse.json(filial)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!faqatEga(session)) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const { nomi, manzil, telefon, faol } = await req.json()
    const filial = await prisma.filial.update({
      where: { id },
      data: { nomi, manzil: manzil || null, telefon: telefon || null, faol },
    })

    return NextResponse.json(filial)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Birinchi bosishda — nofaol qilinadi (soft delete). Filial allaqachon
// nofaol bo'lsa — bu safar butunlay o'chiriladi (hard delete). Barcha
// bog'liq ma'lumotlar (tovar, mijoz, sotuv, xodim) SET NULL bo'lib,
// global (filialsiz) ko'rinishga o'tadi — hech narsa yo'qolmaydi.
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!faqatEga(session)) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const filial = await prisma.filial.findUnique({ where: { id }, select: { faol: true } })
    if (!filial) return NextResponse.json({ xato: 'Filial topilmadi' }, { status: 404 })

    if (filial.faol) {
      await prisma.filial.update({ where: { id }, data: { faol: false } })
      return NextResponse.json({ ok: true, holat: 'nofaol' })
    }

    await prisma.filial.delete({ where: { id } })
    return NextResponse.json({ ok: true, holat: 'ochirildi' })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
