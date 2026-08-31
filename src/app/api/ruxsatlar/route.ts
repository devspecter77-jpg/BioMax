import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { barchaRuxsatKalitlari, rolStandartRuxsat } from '@/lib/ruxsat-katalogi'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user as any)?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const foydalanuvchiId = searchParams.get('foydalanuvchiId')
    if (!foydalanuvchiId) return NextResponse.json({ xato: 'foydalanuvchiId kerak' }, { status: 400 })

    const xodim = await prisma.foydalanuvchi.findUnique({ where: { id: foydalanuvchiId } })
    if (!xodim) return NextResponse.json({ xato: 'Xodim topilmadi' }, { status: 404 })

    const overrides = await prisma.ruxsat.findMany({ where: { foydalanuvchiId } })
    const overrideMap = new Map(overrides.map(o => [o.bolim, o.korinadi]))

    const natija: Record<string, boolean> = {}
    for (const kalit of barchaRuxsatKalitlari) {
      natija[kalit] = overrideMap.has(kalit) ? overrideMap.get(kalit)! : rolStandartRuxsat(xodim.rol, kalit)
    }

    return NextResponse.json(natija)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || (session.user as any)?.rol !== 'ADMIN') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const { foydalanuvchiId, ruxsatlar } = await req.json()
    if (!foydalanuvchiId || typeof ruxsatlar !== 'object') {
      return NextResponse.json({ xato: "Noto'g'ri so'rov" }, { status: 400 })
    }

    const xodim = await prisma.foydalanuvchi.findUnique({ where: { id: foydalanuvchiId } })
    if (!xodim) return NextResponse.json({ xato: 'Xodim topilmadi' }, { status: 404 })
    if (xodim.rol === 'ADMIN') {
      return NextResponse.json({ xato: 'Administrator ruxsatlari cheklanmaydi' }, { status: 400 })
    }

    await prisma.$transaction(
      Object.entries(ruxsatlar)
        .filter(([kalit]) => barchaRuxsatKalitlari.includes(kalit))
        .map(([kalit, korinadi]) =>
          prisma.ruxsat.upsert({
            where: { foydalanuvchiId_bolim: { foydalanuvchiId, bolim: kalit } },
            update: { korinadi: !!korinadi },
            create: { foydalanuvchiId, bolim: kalit, korinadi: !!korinadi },
          })
        )
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
