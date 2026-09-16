import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { egaFilialWhere } from '@/lib/filial-scope'

// Bitta ombor: tahrirlash va o'chirish.

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'omborlar.boshqarish'))) {
      return NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q: «Ombor va kategoriya boshqarish»', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const { id } = await params
    const mavjud = await prisma.ombor.findFirst({
      where: { id, ...egaFilialWhere(session) },
      select: { id: true },
    })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const tana = await req.json()
    const bor = (k: string) => Object.prototype.hasOwnProperty.call(tana, k)
    const yangi: Record<string, unknown> = {}

    if (bor('nomi')) {
      const nomi = String(tana.nomi ?? '').trim()
      if (!nomi) return NextResponse.json({ xato: 'Ombor nomi majburiy' }, { status: 400 })
      // Baza indeksi filialsiz qatorlarni ushlamaydi (NULL != NULL), shuning
      // uchun takror shu yerda tekshiriladi. O'zini hisobga olmaymiz.
      const takror = await prisma.ombor.findFirst({
        where: {
          id: { not: id },
          nomi: { equals: nomi, mode: 'insensitive' },
          ...egaFilialWhere(session),
        },
        select: { id: true },
      })
      if (takror) {
        return NextResponse.json({ xato: 'Bunday nomli ombor allaqachon bor' }, { status: 400 })
      }
      yangi.nomi = nomi.slice(0, 100)
    }
    if (bor('izoh')) yangi.izoh = String(tana.izoh ?? '').trim().slice(0, 500) || null
    if (bor('faol')) yangi.faol = !!tana.faol
    if (bor('tartib')) {
      const t = Number(tana.tartib)
      yangi.tartib = Number.isFinite(t) ? t : 0
    }

    const ombor = await prisma.ombor.update({ where: { id }, data: yangi })
    return NextResponse.json(ombor)
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ xato: 'Bunday nomli ombor allaqachon bor' }, { status: 400 })
    }
    console.error('[ombor PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'omborlar.boshqarish'))) {
      return NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q: «Ombor va kategoriya boshqarish»', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const { id } = await params
    const ombor = await prisma.ombor.findFirst({
      where: { id, ...egaFilialWhere(session) },
      select: { id: true, _count: { select: { kategoriyalar: true } } },
    })
    if (!ombor) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    // Ombor o'chirilsa kategoriyalar YO'QOLMAYDI — ular omborsiz qoladi
    // (`onDelete: SetNull`). Tovarlar ham joyida qoladi. Foydalanuvchi
    // buni oldindan bilishi uchun soni qaytariladi.
    await prisma.ombor.delete({ where: { id } })

    return NextResponse.json({
      ok: true,
      bogsizKategoriya: ombor._count.kategoriyalar,
    })
  } catch (e) {
    console.error('[ombor DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
