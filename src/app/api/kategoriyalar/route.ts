import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)

    const kategoriyalar = await prisma.kategoriya.findMany({
      where: filialId ? { filialId } : {},
      include: { _count: { select: { tovarlar: true } } },
      orderBy: { nomi: 'asc' },
    })
    return NextResponse.json(kategoriyalar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)

    const { nomi, tavsif } = await req.json()
    const kat = await prisma.kategoriya.create({ data: { nomi, tavsif, filialId } })
    return NextResponse.json(kat, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ xato: 'Bu kategoriya allaqachon mavjud' }, { status: 400 })
    }
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
