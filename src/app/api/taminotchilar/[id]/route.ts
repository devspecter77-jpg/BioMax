import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    const filialId = sessionFilialId(session)

    const { id } = await params
    const mavjud = await prisma.taminotchi.findFirst({ where: { id, ...(filialId ? { filialId } : {}) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    // Bog'liq xaridlar borligini tekshirish
    const xaridSoni = await prisma.xarid.count({ where: { taminotchiId: id } })
    if (xaridSoni > 0) {
      return NextResponse.json(
        { xato: `Bu ta'minotchiga ${xaridSoni} ta xarid bog'liq. Avval xaridlarni o'chiring.` },
        { status: 400 }
      )
    }

    await prisma.taminotchi.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
