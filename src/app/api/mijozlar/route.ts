import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { telefonlarniTozala } from '@/lib/mijoz-telefon'
import { qoshimchaTelefonBoyichaIdlar } from '@/lib/mijoz-telefon-server'
import { toKirill, toLotin } from '@/lib/utils'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'

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
    const qoshimchaIdlar = qidiruv ? await qoshimchaTelefonBoyichaIdlar(qidiruv) : []

    const mijozlar = await prisma.mijoz.findMany({
      where: {
        ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }),
        ...(qidiruv ? {
            OR: [
              { ism: { contains: qidiruv, mode: 'insensitive' as const } },
              ...(kirillVariant !== qidiruv ? [{ ism: { contains: kirillVariant, mode: 'insensitive' as const } }] : []),
              ...(lotinVariant !== qidiruv ? [{ ism: { contains: lotinVariant, mode: 'insensitive' as const } }] : []),
              { telefon: { contains: qidiruv } },
              { telefon2: { contains: qidiruv } },
              ...(qoshimchaIdlar.length ? [{ id: { in: qoshimchaIdlar } }] : []),
              { maxsus_kod: { contains: qidiruv } },
              { viloyat: { contains: qidiruv, mode: 'insensitive' as const } },
              { tuman: { contains: qidiruv, mode: 'insensitive' as const } },
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
    const egaId = filialId ? null : sessionEgaId(session)

    // Telefon raqam bo'yicha — bir xil mijoz qayta-qayta yaratilmasin.
    // Serverda tekshiriladi (client'dagi eskirgan ro'yxatga tayanmaydi).
    // Dublikat tekshiruvi ikkala raqam bo'yicha: bir mijoz avval asosiy
    // raqami bilan, keyin Telegram raqami bilan kiritilib, ikki marta
    // yaratilib qolmasin.
    const tel = telefonlarniTozala(data.telefon, data.telefon2, data.qoshimchaTelefonlar)
    if ('xato' in tel) return NextResponse.json({ xato: tel.xato }, { status: 400 })
    const raqamlar = tel.hammasi
    if (raqamlar.length > 0) {
      const mavjudMijoz = await prisma.mijoz.findFirst({
        where: {
          OR: [
            ...raqamlar.flatMap(r => [
              { telefon: { endsWith: r } },
              { telefon2: { endsWith: r } },
            ]),
            // Qo'shimcha raqamlar 9 raqam ko'rinishida saqlanadi — aniq moslik
            { qoshimchaTelefonlar: { hasSome: raqamlar } },
          ],
          ...(filialId ? { filialId } : { egaId }),
        },
      })
      if (mavjudMijoz) {
        return NextResponse.json({ ...mavjudMijoz, mavjud: true }, { status: 200 })
      }
    }

    const maxsus_kod = await generateUniqueKod()
    const mijoz = await prisma.mijoz.create({
      data: {
        ism: data.ism,
        telefon: tel.telefon,
        telefon2: tel.telefon2,
        qoshimchaTelefonlar: tel.qoshimcha,
        viloyat: data.viloyat?.trim() || null,
        tuman: data.tuman?.trim() || null,
        manzil: data.manzil,
        izoh: data.izoh,
        maxsus_kod, filialId, egaId,
        lokatsiyaLat: typeof data.lokatsiyaLat === 'number' ? data.lokatsiyaLat : null,
        lokatsiyaLng: typeof data.lokatsiyaLng === 'number' ? data.lokatsiyaLng : null,
      },
    })
    return NextResponse.json(mijoz, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
