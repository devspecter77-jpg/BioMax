import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dan = searchParams.get('dan')
    const gacha = searchParams.get('gacha')
    const kategoriya = searchParams.get('kategoriya')

    const where: any = { ...egaFilialWhere(session) }
    if (kategoriya) where.kategoriya = kategoriya
    if (dan || gacha) {
      where.sana = {}
      if (dan) where.sana.gte = new Date(dan)
      if (gacha) {
        const g = new Date(gacha)
        g.setHours(23, 59, 59)
        where.sana.lte = g
      }
    }

    const xarajatlar = await prisma.xarajat.findMany({
      where,
      include: { foydalanuvchi: { select: { ism: true } } },
      orderBy: { sana: 'desc' },
    })

    return NextResponse.json(xarajatlar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const data = await req.json()
    const foydalanuvchiId = (session.user as any).id

    const xarajat = await prisma.xarajat.create({
      data: {
        kategoriya: data.kategoriya,
        summa: parseFloat(data.summa),
        izoh: data.izoh,
        sana: data.sana ? new Date(data.sana) : new Date(),
        foydalanuvchiId,
        ...egaFilialWhere(session),
      },
    })
    return NextResponse.json(xarajat, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
