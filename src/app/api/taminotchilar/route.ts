import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)

    const taminotchilar = await prisma.taminotchi.findMany({
      where: filialId ? { filialId } : {},
      include: {
        _count: { select: { xaridlar: true } },
        xaridlar: { select: { qoldiqQarz: true } },
      },
      orderBy: { nomi: 'asc' },
    })

    const natija = taminotchilar.map((t) => ({
      ...t,
      jamiQarz: t.xaridlar.reduce((s, x) => s + Number(x.qoldiqQarz), 0),
    }))

    return NextResponse.json(natija)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)

    const data = await req.json()
    const tam = await prisma.taminotchi.create({
      data: {
        nomi: data.nomi,
        kontaktShaxs: data.kontaktShaxs,
        telefon: data.telefon,
        manzil: data.manzil,
        izoh: data.izoh,
        filialId,
      },
    })
    return NextResponse.json(tam, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
