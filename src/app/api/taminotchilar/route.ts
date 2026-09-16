import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { qarzXulosasi } from '@/lib/taminotchi-qarz'
import { koordinataTogrimi } from '@/lib/xarita-havola'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const taminotchilar = await prisma.taminotchi.findMany({
      where: egaFilialWhere(session),
      include: {
        _count: { select: { xaridlar: true, tovarlar: true } },
        xaridlar: { select: { qoldiqQarz: true } },
        // Qo'lda yozilgan qarz daftari — tizimdan tashqaridagi qarz
        // (eski qoldiq, og'zaki kelishuv) ham umumiy qarzga kiradi.
        qarzlari: { select: { turi: true, summa: true } },
      },
      orderBy: { nomi: 'asc' },
    })

    const natija = taminotchilar.map((t) => {
      const xulosa = qarzXulosasi({
        xaridQoldigi: t.xaridlar.reduce((s, x) => s + Number(x.qoldiqQarz), 0),
        yozuvlar: t.qarzlari.map(q => ({ turi: q.turi, summa: Number(q.summa) })),
      })
      // `qarzlari` javobda kerak emas — ro'yxat yengil qolsin
      const { qarzlari: _qarzlari, ...qolgan } = t
      return { ...qolgan, jamiQarz: xulosa.jami, qarzXulosa: xulosa }
    })

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
    if (!data.nomi?.trim()) return NextResponse.json({ xato: 'Nomi majburiy' }, { status: 400 })
    const tam = await prisma.taminotchi.create({
      data: {
        nomi: data.nomi.trim(),
        kontaktShaxs: data.kontaktShaxs,
        telefon: data.telefon,
        manzil: data.manzil,
        izoh: data.izoh,
        // Koordinata ixtiyoriy; noto'g'ri kelsa jimgina tashlanadi —
        // buzuq qiymat xaritani okeanga olib qochmasin.
        ...(koordinataTogrimi(data.lokatsiyaLat, data.lokatsiyaLng)
          ? { lokatsiyaLat: Number(data.lokatsiyaLat), lokatsiyaLng: Number(data.lokatsiyaLng) }
          : {}),
        ...egaFilialWhere(session),
      },
    })
    return NextResponse.json(tam, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
