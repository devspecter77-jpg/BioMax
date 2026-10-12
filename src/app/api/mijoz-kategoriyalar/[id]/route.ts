import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { mijozTenant } from '@/lib/mijoz-doirasi'
import { kategoriyaMalumoti } from '@/lib/mijoz-kategoriya-server'

export const dynamic = 'force-dynamic'

// Kategoriyani tahrirlash (nom, rang, kimga ko'rinadi) va o'chirish — faqat administrator.
// O'chirilganda mijozlar o'chmaydi — kategoriyasiz qoladi.

const xato = (xabar: string, holat = 400) => NextResponse.json({ xato: xabar }, { status: holat })

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return xato("Ruxsat yo'q", 401)
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return xato('Kategoriyani faqat administrator o‘zgartiradi', 403)
    const { id } = await params

    const mavjud = await prisma.mijozKategoriya.findFirst({ where: { id, ...mijozTenant(session) }, select: { id: true } })
    if (!mavjud) return xato('Kategoriya topilmadi', 404)

    const m = await kategoriyaMalumoti(session, await req.json().catch(() => null), id)
    if (!m.ok) return xato(m.xato, m.holat)

    await prisma.$transaction(async tx => {
      await tx.mijozKategoriya.update({
        where: { id },
        data: {
          ...(m.nomi !== undefined ? { nomi: m.nomi } : {}),
          ...(m.rang !== undefined ? { rang: m.rang } : {}),
          ...(m.hammaga !== undefined ? { hammaga: m.hammaga } : {}),
        },
      })
      if (m.xodimIdlar !== undefined) {
        await tx.mijozKategoriyaXodim.deleteMany({ where: { kategoriyaId: id, foydalanuvchiId: { notIn: m.xodimIdlar } } })
        if (m.xodimIdlar.length) {
          await tx.mijozKategoriyaXodim.createMany({
            data: m.xodimIdlar.map(foydalanuvchiId => ({ kategoriyaId: id, foydalanuvchiId })),
            skipDuplicates: true,
          })
        }
      }
    })

    // Ko'rinish har so'rovda bazadan olinadi — xodimga darhol kuchga kiradi
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[mijoz-kategoriyalar PUT]', e)
    return xato('Server xatosi', 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return xato("Ruxsat yo'q", 401)
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return xato('Kategoriyani faqat administrator o‘chiradi', 403)
    const { id } = await params

    const k = await prisma.mijozKategoriya.findFirst({ where: { id, ...mijozTenant(session) }, select: { id: true } })
    if (!k) return xato('Kategoriya topilmadi', 404)
    // Mijozlar kategoriyasiz qoladi (onDelete: SetNull), xodim ruxsatlari o'chadi (Cascade)
    await prisma.mijozKategoriya.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[mijoz-kategoriyalar DELETE]', e)
    return xato('Server xatosi', 500)
  }
}
