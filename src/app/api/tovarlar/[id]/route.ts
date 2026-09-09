import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'
import { tovarYozishRuxsatlari } from '@/lib/tovar-ruxsat'
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
        taminotchi: { select: { id: true, nomi: true } },
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

// Erkin matnli manzil: bo'sh qiymat null bo'lib saqlanadi (bo'sh satr
// "kiritilgan" deb ko'rinmasin) va uzunligi cheklanadi.
const MANZIL_MAX = 300
function manzilTozala(qiymat: unknown): string | null {
  const matn = String(qiymat ?? '').trim()
  if (!matn) return null
  return matn.slice(0, MANZIL_MAX)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)

    const mavjud = await prisma.tovar.findFirst({ where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const { tahrirlashMumkin } = await tovarYozishRuxsatlari(session)
    if (!filialId && !tahrirlashMumkin) {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    const data = await req.json()

    // Bu marshrutga IKKI xil forma yuboradi: Tovarlar sahifasidagi to'liq
    // forma va Ombor sahifasidagi qisqartirilgan forma (faqat nomi, narx,
    // birlik, minimal qoldiq, shtrix-kod, muddat). Shuning uchun payload'da
    // YO'Q maydon "null qil" emas, "tegma" deb tushuniladi — aks holda
    // Ombordan tahrirlash ta'minotchi, rasmlar va optom/bo'lish narxlarini
    // o'chirib yuborardi.
    const bor = (kalit: string) => Object.prototype.hasOwnProperty.call(data, kalit)

    // Yashirilgan maydonlarni (masalan kelish narxi) shu hisob ko'rmaydi —
    // shuning uchun ularni saqlashda o'zgartirmaymiz, aks holda ko'rinmas
    // qiymat bo'sh/0 deb noto'g'ri ustidan yozilib qolishi mumkin edi.
    const yashirilganMaydonlar = await foydalanuvchiYashirilganMaydonlari((session.user as any).id)

    const updateData: any = {}
    if (bor('nomi')) updateData.nomi = data.nomi
    if (bor('kategoriyaId')) updateData.kategoriyaId = data.kategoriyaId
    if (bor('shtrixKod')) updateData.shtrixKod = data.shtrixKod || null
    if (bor('valyuta')) updateData.valyuta = data.valyuta === 'USD' ? 'USD' : 'UZS'
    if (bor('birlik')) updateData.birlik = data.birlik
    if (bor('minimalQoldiq')) updateData.minimalQoldiq = parseInt(data.minimalQoldiq)
    if (bor('keltirilganManzil')) updateData.keltirilganManzil = manzilTozala(data.keltirilganManzil)
    if (bor('qulflangan')) updateData.qulflangan = !!data.qulflangan
    if (bor('rasmlar')) updateData.rasmlar = await rasmlarniSiqish(data.rasmlar)
    if (bor('yaroqlilikMuddati')) {
      updateData.yaroqlilikMuddati = data.yaroqlilikMuddati ? new Date(data.yaroqlilikMuddati) : null
    }
    if (bor('optomNarxi')) updateData.optomNarxi = data.optomNarxi ? parseFloat(data.optomNarxi) : null
    if (bor('bolishNarxi')) updateData.bolishNarxi = data.bolishNarxi ? parseFloat(data.bolishNarxi) : null
    if (bor('kelishNarxi') && !yashirilganMaydonlar.has('kelishNarxi')) {
      updateData.kelishNarxi = parseFloat(data.kelishNarxi)
    }
    if (bor('sotishNarxi') && !yashirilganMaydonlar.has('sotishNarxi')) {
      updateData.sotishNarxi = parseFloat(data.sotishNarxi)
    }

    // Ta'minotchi doirasi — yaratishdagi bilan bir xil tekshiruv
    if (bor('taminotchiId')) {
      let taminotchiId: string | null = null
      if (data.taminotchiId) {
        const tam = await prisma.taminotchi.findFirst({
          where: { id: data.taminotchiId, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) },
          select: { id: true },
        })
        if (!tam) return NextResponse.json({ xato: "Ta'minotchi topilmadi" }, { status: 400 })
        taminotchiId = tam.id
      }
      updateData.taminotchiId = taminotchiId
    }

    const tovar = await prisma.tovar.update({
      where: { id },
      data: updateData,
      include: { kategoriya: true, taminotchi: { select: { id: true, nomi: true } } },
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
          izoh: tovar.keltirilganManzil
            ? `Tahrirlashda qoldiq oshirildi · ${tovar.keltirilganManzil}`
            : 'Tahrirlashda qoldiq oshirildi',
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

    const mavjud = await prisma.tovar.findFirst({ where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const { ochirishMumkin } = await tovarYozishRuxsatlari(session)
    if (!filialId && !ochirishMumkin) {
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
