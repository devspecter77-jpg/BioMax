import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStockMap } from '@/lib/stock'
import { kodniAjrat } from '@/lib/qr-kod'

// QR skanerlanganda ochiladigan OCHIQ sahifa uchun ma'lumot.
//
// Sessiyasiz ishlaydi (chek sahifasi bilan bir xil naqsh), shuning uchun
// faqat MIJOZGA ko'rsatish mumkin bo'lgan maydonlar qaytariladi:
// nomi, kategoriya, sotish narxi, birlik va "bormi/yo'q".
// Kelish narxi, aniq qoldiq, ta'minotchi va foyda — HECH QACHON.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kod: string }> }) {
  try {
    const { kod } = await params
    // QR ichida to'liq manzil bo'lishi mumkin — kodni ajratib olamiz
    const n = kodniAjrat(decodeURIComponent(kod || ''))
    if (!n) return NextResponse.json({ xato: 'Kod bo‘sh' }, { status: 400 })

    // Shtrix-kod variantlari — skaner nol qo'shib/olib yuborishi mumkin
    const nolsiz = n.replace(/^0+/, '')
    const variantlar = Array.from(new Set([n, nolsiz, '0' + n, '00' + n]))

    const tovar = await prisma.tovar.findFirst({
      where: { holati: 'FAOL', shtrixKod: { in: variantlar } },
      select: {
        id: true, nomi: true, birlik: true, valyuta: true, shtrixKod: true,
        sotishNarxi: true, rasmlar: true, qulflangan: true,
        kategoriya: { select: { nomi: true } },
      },
    })
    if (!tovar) return NextResponse.json({ xato: 'Mahsulot topilmadi' }, { status: 404 })

    const stock = (await getStockMap([tovar.id])).get(tovar.id)
    const jami = (stock?.omborQoldiq ?? 0) + (stock?.dokonQoldiq ?? 0)

    const dokon = await prisma.sozlama.findUnique({ where: { kalit: 'dokon_nomi' } })

    return NextResponse.json({
      dokonNomi: dokon?.qiymat || "Do'kon",
      tovar: {
        nomi: tovar.nomi,
        kategoriya: tovar.kategoriya?.nomi ?? null,
        shtrixKod: tovar.shtrixKod,
        birlik: tovar.birlik,
        valyuta: tovar.valyuta,
        narx: Number(tovar.sotishNarxi),
        // Faqat bitta rasm — sahifa yengil bo'lsin
        rasm: tovar.rasmlar?.[0] ?? null,
        // Aniq son emas: mijozga qoldiq miqdorini ochish shart emas
        mavjud: jami > 0 && !tovar.qulflangan,
      },
    })
  } catch (e) {
    console.error('[public tovar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
