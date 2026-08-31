import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'
import { rasmlarniSiqish } from '@/lib/rasm'
import { foydalanuvchiYashirilganMaydonlari, maydonlarniYashir } from '@/lib/maydon-yashirish'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)
    const foydalanuvchiId = (session.user as any).id

    const tovar = await prisma.tovar.findFirst({
      where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) },
      include: {
        kategoriya: true,
        omborHarakati: {
          include: { foydalanuvchi: { select: { ism: true } } },
          orderBy: { sana: 'desc' },
          take: 20,
        },
      },
    })
    if (!tovar) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const yashirilganMaydonlar = await foydalanuvchiYashirilganMaydonlari(foydalanuvchiId)
    return NextResponse.json(maydonlarniYashir(tovar, yashirilganMaydonlar))
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)
    const sess = session.user as any

    const mavjud = await prisma.tovar.findFirst({ where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    if (!filialId && sess.ulashilganEgaId && !sess.tovarTahrirlashMumkin) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const data = await req.json()
    const rasmlar = await rasmlarniSiqish(data.rasmlar)

    // Yashirilgan maydonlarni (masalan kelish narxi) shu hisob ko'rmaydi —
    // shuning uchun ularni saqlashda o'zgartirmaymiz, aks holda ko'rinmas
    // qiymat bo'sh/0 deb noto'g'ri ustidan yozilib qolishi mumkin edi.
    const yashirilganMaydonlar = await foydalanuvchiYashirilganMaydonlari((session.user as any).id)
    const updateData: any = {
      nomi: data.nomi,
      kategoriyaId: data.kategoriyaId,
      shtrixKod: data.shtrixKod || null,
      valyuta: data.valyuta === 'USD' ? 'USD' : 'UZS',
      birlik: data.birlik,
      minimalQoldiq: parseInt(data.minimalQoldiq),
      rasmlar,
      yaroqlilikMuddati: data.yaroqlilikMuddati ? new Date(data.yaroqlilikMuddati) : null,
    }
    if (!yashirilganMaydonlar.has('kelishNarxi')) updateData.kelishNarxi = parseFloat(data.kelishNarxi)
    if (!yashirilganMaydonlar.has('sotishNarxi')) updateData.sotishNarxi = parseFloat(data.sotishNarxi)

    const tovar = await prisma.tovar.update({
      where: { id },
      data: updateData,
      include: { kategoriya: true },
    })

    // Qoldiqni oshirish (ixtiyoriy) — do'konga to'g'ridan-to'g'ri kirim
    const qoshiladigan = parseFloat(data.qoldiqQoshish)
    if (qoshiladigan && qoshiladigan > 0) {
      await prisma.omborHarakati.create({
        data: {
          tovarId: id,
          turi: 'KIRIM',
          joy: 'DOKON',
          miqdor: qoshiladigan,
          narx: Number(tovar.kelishNarxi),
          izoh: "Tahrirlashda qoldiq oshirildi",
          foydalanuvchiId: (session.user as any).id,
        },
      })
    }

    return NextResponse.json(tovar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)
    const sess = session.user as any

    const mavjud = await prisma.tovar.findFirst({ where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    if (!filialId && sess.ulashilganEgaId && !sess.tovarOchirishMumkin) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const tovar = await prisma.tovar.update({
      where: { id },
      data: { holati: 'ARXIVLANGAN' },
    })
    return NextResponse.json(tovar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
