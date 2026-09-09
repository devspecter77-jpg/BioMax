import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'
import { bolimRuxsatiBormi } from '@/lib/ruxsat-server'
import { tolovlarniYigindi } from '@/lib/xodim-oylik'

function doira(session: Session | null) {
  const filialId = sessionFilialId(session)
  return filialId ? { filialId } : {}
}

// Bitta xodim: ma'lumoti va to'lovlar tarixi
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!bolimRuxsatiBormi(session, 'xodimlar')) {
      return NextResponse.json({ xato: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 })
    }

    const { id } = await params
    const xodim = await prisma.foydalanuvchi.findFirst({
      where: { id, ...doira(session) },
      select: {
        id: true, ism: true, login: true, rol: true, faol: true, telefon: true,
        oylikMaosh: true, yaratilgan: true, filialId: true,
        filial: { select: { id: true, nomi: true } },
      },
    })
    if (!xodim) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const tolovlar = await prisma.xodimTolov.findMany({
      where: { xodimId: id },
      orderBy: { sana: 'desc' },
      take: 100,
      select: {
        id: true, turi: true, summa: true, davr: true, izoh: true, sana: true,
        yaratgan: { select: { ism: true } },
      },
    })

    const tozalangan = tolovlar.map(t => ({ ...t, summa: Number(t.summa) }))

    return NextResponse.json({
      xodim: { ...xodim, oylikMaosh: xodim.oylikMaosh === null ? null : Number(xodim.oylikMaosh) },
      tolovlar: tozalangan,
      // Umumiy yig'indi (barcha davrlar bo'yicha)
      jami: tolovlarniYigindi(tozalangan),
      boshqaraOladi: (session.user as unknown as { rol?: string }).rol === 'ADMIN',
    })
  } catch (e) {
    console.error('[xodim]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Xodim ma'lumotini yangilash — oylik, rol, telefon, faollik, parol.
// Payloadda YO'Q maydonga tegilmaydi (tovar PUT'idagi bilan bir xil qoida).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if ((session.user as unknown as { rol?: string }).rol !== 'ADMIN') {
      return NextResponse.json({ xato: 'Faqat admin o‘zgartira oladi' }, { status: 403 })
    }

    const { id } = await params
    const mavjud = await prisma.foydalanuvchi.findFirst({
      where: { id, ...doira(session) },
      select: { id: true },
    })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const data = await req.json()
    const bor = (k: string) => Object.prototype.hasOwnProperty.call(data, k)
    const yangi: Record<string, unknown> = {}

    if (bor('ism')) {
      const ism = String(data.ism ?? '').trim()
      if (!ism) return NextResponse.json({ xato: 'Ism majburiy' }, { status: 400 })
      yangi.ism = ism
    }
    if (bor('telefon')) {
      yangi.telefon = String(data.telefon ?? '').replace(/\D/g, '') || null
    }
    if (bor('rol')) {
      const rol = String(data.rol)
      if (!['ADMIN', 'KASSIR', 'OMBORCHI', 'SOTUVCHI'].includes(rol)) {
        return NextResponse.json({ xato: 'Rol noto‘g‘ri' }, { status: 400 })
      }
      yangi.rol = rol
    }
    if (bor('faol')) yangi.faol = !!data.faol
    if (bor('oylikMaosh')) {
      const m = Number(data.oylikMaosh)
      if (data.oylikMaosh === null || data.oylikMaosh === '') yangi.oylikMaosh = null
      else if (!Number.isFinite(m) || m < 0) {
        return NextResponse.json({ xato: 'Oylik noto‘g‘ri' }, { status: 400 })
      } else yangi.oylikMaosh = Math.round(m)
    }
    if (bor('parol') && String(data.parol)) {
      const parol = String(data.parol)
      if (parol.length < 6) return NextResponse.json({ xato: 'Parol kamida 6 belgi' }, { status: 400 })
      yangi.parolHash = await bcrypt.hash(parol, 10)
    }

    // O'z hisobini nofaol qilib qo'yib, tizimdan chiqib qolmasin
    if (yangi.faol === false && id === (session.user as unknown as { id: string }).id) {
      return NextResponse.json({ xato: 'O‘z hisobingizni nofaol qila olmaysiz' }, { status: 400 })
    }

    const xodim = await prisma.foydalanuvchi.update({
      where: { id },
      data: yangi,
      select: {
        id: true, ism: true, login: true, rol: true, faol: true, telefon: true,
        oylikMaosh: true, filialId: true, filial: { select: { id: true, nomi: true } },
      },
    })

    return NextResponse.json({
      ...xodim,
      oylikMaosh: xodim.oylikMaosh === null ? null : Number(xodim.oylikMaosh),
    })
  } catch (e) {
    console.error('[xodim PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
