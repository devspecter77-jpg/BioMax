import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const kategoriyalar = await prisma.kategoriya.findMany({
      where: egaFilialWhere(session),
      include: {
        _count: { select: { tovarlar: true } },
        // Ombor — kategoriyaning ustki guruhi. POS va tovar formasi
        // shu bo'yicha ikki bosqichli filtr qiladi.
        // `faol` — nofaol ombor tanlagichlarda ko'rinmaydi (lekin
        // ichidagi kategoriya va tovarlar o'z joyida qoladi).
        ombor: { select: { id: true, nomi: true, faol: true } },
      },
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
    const { nomi, tavsif, omborId } = await req.json()

    // Ombor tanlangan bo'lsa u SO'ROVCHINING doirasida bo'lishi shart —
    // boshqa Eganing omboriga kategoriya bog'lab bo'lmasin.
    let tanlanganOmborId: string | null = null
    if (omborId) {
      const o = await prisma.ombor.findFirst({
        where: { id: String(omborId), ...egaFilialWhere(session) },
        select: { id: true },
      })
      if (!o) return NextResponse.json({ xato: 'Ombor topilmadi' }, { status: 404 })
      tanlanganOmborId = o.id
    }

    // Takroriy nom: bazadagi @@unique([nomi, filialId, egaId]) filialsiz
    // (filialId = NULL) qatorlarda ishlamaydi, chunki PostgreSQL uchun
    // NULL != NULL. Shuning uchun qo'lda tekshiriladi.
    const nomiTrim = String(nomi ?? '').trim()
    if (!nomiTrim) return NextResponse.json({ xato: 'Kategoriya nomi majburiy' }, { status: 400 })
    const takror = await prisma.kategoriya.findFirst({
      where: { nomi: { equals: nomiTrim, mode: 'insensitive' }, ...egaFilialWhere(session) },
      select: { id: true },
    })
    if (takror) {
      return NextResponse.json({ xato: 'Bu kategoriya allaqachon mavjud' }, { status: 400 })
    }

    const kat = await prisma.kategoriya.create({
      data: { nomi: nomiTrim, tavsif, omborId: tanlanganOmborId, ...egaFilialWhere(session) },
      include: { ombor: { select: { id: true, nomi: true } } },
    })
    return NextResponse.json(kat, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ xato: 'Bu kategoriya allaqachon mavjud' }, { status: 400 })
    }
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
