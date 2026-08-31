import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { toKirill, toLotin } from '@/lib/utils'
import { sessionFilialId } from '@/lib/filial-scope'

async function generateUniqueKod(): Promise<string> {
  while (true) {
    const n = Math.floor(100000000 + Math.random() * 900000000).toString()
    const kod = `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 9)}`
    const exists = await prisma.mijoz.findUnique({ where: { maxsus_kod: kod } })
    if (!exists) return kod
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const qidiruv = searchParams.get('q') || ''

    const kirillVariant = toKirill(qidiruv)
    const lotinVariant = toLotin(qidiruv)
    const filialId = sessionFilialId(session)

    const mijozlar = await prisma.mijoz.findMany({
      where: {
        ...(filialId ? { filialId } : {}),
        ...(qidiruv ? {
            OR: [
              { ism: { contains: qidiruv, mode: 'insensitive' as const } },
              ...(kirillVariant !== qidiruv ? [{ ism: { contains: kirillVariant, mode: 'insensitive' as const } }] : []),
              ...(lotinVariant !== qidiruv ? [{ ism: { contains: lotinVariant, mode: 'insensitive' as const } }] : []),
              { telefon: { contains: qidiruv } },
              { maxsus_kod: { contains: qidiruv } },
              { manzil: { contains: qidiruv, mode: 'insensitive' as const } },
              ...(kirillVariant !== qidiruv ? [{ manzil: { contains: kirillVariant, mode: 'insensitive' as const } }] : []),
              ...(lotinVariant !== qidiruv ? [{ manzil: { contains: lotinVariant, mode: 'insensitive' as const } }] : []),
            ],
          }
        : {}),
      },
      include: {
        _count: { select: { sotuvlar: true, nasiyalar: true } },
        nasiyalar: {
          where: { holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] } },
          select: { qoldiq: true },
        },
      },
      orderBy: { ism: 'asc' },
    })

    const natija = mijozlar.map((m) => ({
      ...m,
      jami_qarz: m.nasiyalar.reduce((s, n) => s + Number(n.qoldiq), 0),
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

    const data = await req.json()
    const filialId = sessionFilialId(session)

    // Telefon raqam bo'yicha — bir xil mijoz qayta-qayta yaratilmasin.
    // Serverda tekshiriladi (client'dagi eskirgan ro'yxatga tayanmaydi).
    const telefonToza = (data.telefon || '').replace(/\D/g, '')
    if (telefonToza) {
      const mavjudMijoz = await prisma.mijoz.findFirst({
        where: { telefon: { endsWith: telefonToza.slice(-9) }, ...(filialId ? { filialId } : {}) },
      })
      if (mavjudMijoz) {
        return NextResponse.json({ ...mavjudMijoz, mavjud: true }, { status: 200 })
      }
    }

    const maxsus_kod = await generateUniqueKod()
    const mijoz = await prisma.mijoz.create({
      data: {
        ism: data.ism, telefon: data.telefon, manzil: data.manzil, izoh: data.izoh, maxsus_kod, filialId,
        lokatsiyaLat: typeof data.lokatsiyaLat === 'number' ? data.lokatsiyaLat : null,
        lokatsiyaLng: typeof data.lokatsiyaLng === 'number' ? data.lokatsiyaLng : null,
      },
    })
    return NextResponse.json(mijoz, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
