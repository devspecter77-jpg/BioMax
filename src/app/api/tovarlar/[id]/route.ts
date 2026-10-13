import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId, sessionEgaId, egaFilialWhere } from '@/lib/filial-scope'
import { tovarYozishRuxsatlari } from '@/lib/tovar-ruxsat'
import { rasmlarniSiqish } from '@/lib/rasm'
import { foydalanuvchiYashirilganMaydonlari, maydonlarniYashir } from '@/lib/maydon-yashirish'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { tovarKategoriyasi, yangiOmborSoralgan, JoyXatosi } from '@/lib/tovar-ombori-server'
import { birlikTozala, oramlarniTekshir } from '@/lib/birlik'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })
    const filialId = sessionFilialId(session)
    const foydalanuvchiId = session.user.id

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
    const yashirilganMaydonlar = await foydalanuvchiYashirilganMaydonlari(session.user.id)

    const updateData: Prisma.TovarUncheckedUpdateInput = {}
    if (bor('nomi')) updateData.nomi = data.nomi
    if (bor('shtrixKod')) updateData.shtrixKod = data.shtrixKod || null
    if (bor('valyuta')) updateData.valyuta = data.valyuta === 'USD' ? 'USD' : 'UZS'
    if (bor('birlik')) {
      const birlik = birlikTozala(data.birlik)
      if (!birlik) return NextResponse.json({ xato: "O'lchov birligi noto'g'ri — 20 belgigacha nom yozing" }, { status: 400 })
      updateData.birlik = birlik
    }
    if (bor('oramlar')) {
      // Asosiy birlik shu so'rovda o'zgargan bo'lsa — yangisiga nisbatan tekshiriladi
      const asosiy = typeof updateData.birlik === 'string'
        ? updateData.birlik
        : (await prisma.tovar.findUnique({ where: { id }, select: { birlik: true } }))?.birlik ?? 'DONA'
      const o = oramlarniTekshir(data.oramlar, asosiy)
      if (!o.ok) return NextResponse.json({ xato: o.xato }, { status: 400 })
      updateData.oramlar = o.oramlar
    }
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

    // Ombor/kategoriya: forma yuborgan bo'lsagina o'zgaradi (Ombor sahifasidagi
    // qisqa forma ularni yubormaydi). Kategoriya doirada tekshiriladi, kerak
    // bo'lsa yangi ombor/kategoriya mahsulot bilan bitta tranzaksiyada ochiladi.
    const joyBor = bor('kategoriyaId') || bor('yangiKategoriya') || bor('omborId') || bor('yangiOmbor')
    const omborYaratish = joyBor && yangiOmborSoralgan(data) && await amalRuxsatiBormi(session, 'omborlar.boshqarish')

    const tovar = await prisma.$transaction(async tx => {
      if (joyBor) updateData.kategoriyaId = await tovarKategoriyasi(tx, egaFilialWhere(session), data, omborYaratish)
      return tx.tovar.update({
        where: { id },
        data: updateData,
        include: {
          kategoriya: { include: { ombor: { select: { id: true, nomi: true } } } },
          taminotchi: { select: { id: true, nomi: true } },
        },
      })
    }, { maxWait: 10_000, timeout: 30_000 })

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
          foydalanuvchiId: session.user.id,
        },
      })
    }

    return NextResponse.json(tovar)
  } catch (e) {
    if (e instanceof JoyXatosi) return NextResponse.json({ xato: e.message }, { status: e.status })
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
