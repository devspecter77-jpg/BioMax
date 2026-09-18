import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { kanalUsuliMi } from '@/lib/tolov-usullari'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const data = await req.json()
    const foydalanuvchiId = session.user.id

    const xarid = await prisma.xarid.findUnique({ where: { id } })
    if (!xarid) return NextResponse.json({ xato: 'Xarid topilmadi' }, { status: 404 })

    const tolovSumma = parseFloat(data.summa)
    if (!tolovSumma || tolovSumma <= 0) {
      return NextResponse.json({ xato: 'Summa noto\'g\'ri' }, { status: 400 })
    }

    const yangiTolangan = Number(xarid.tolangan) + tolovSumma
    const yangiQoldiq = Number(xarid.jamiSumma) - yangiTolangan

    const [tolov, yangiXarid] = await prisma.$transaction([
      prisma.xaridTolov.create({
        data: {
          xaridId: id,
          summa: tolovSumma,
          tolovUsuli: kanalUsuliMi(data.tolovUsuli) ? data.tolovUsuli : 'NAQD',
          qabulQiluvchiId: foydalanuvchiId,
          izoh: data.izoh,
        },
      }),
      prisma.xarid.update({
        where: { id },
        data: {
          tolangan: yangiTolangan,
          qoldiqQarz: Math.max(0, yangiQoldiq),
        },
      }),
    ])

    return NextResponse.json({ tolov, xarid: yangiXarid }, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
