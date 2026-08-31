import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const tur = searchParams.get('tur') || ''
    const tovarId = searchParams.get('tovarId') || ''
    const limit = parseInt(searchParams.get('limit') || '50')

    const joy = searchParams.get('joy') || ''
    const where: any = { tovar: egaFilialWhere(session) }
    if (tur) where.turi = tur
    if (tovarId) where.tovarId = tovarId
    if (joy) where.joy = joy

    const harakatlar = await prisma.omborHarakati.findMany({
      where,
      include: {
        tovar: { select: { nomi: true, birlik: true } },
        taminotchi: { select: { nomi: true } },
        foydalanuvchi: { select: { ism: true } },
      },
      orderBy: { sana: 'desc' },
      take: limit,
    })

    return NextResponse.json(harakatlar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
