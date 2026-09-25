import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStockMap } from '@/lib/stock'
import { sessionFilialId, sessionEgaId } from '@/lib/filial-scope'
import { kodniAjrat } from '@/lib/qr-kod'

// Shtrix-kod bo'yicha bitta tovarni topish — skaner uchun.
// Bir nechta variantni sinaydi: aynan, trim, leading-zero olib/qo'yib.
export async function GET(_: NextRequest, { params }: { params: Promise<{ kod: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { kod } = await params
    // QR to'liq manzil saqlaydi — mijoz normallashtirmagan bo'lsa ham ishlasin
    const n = kodniAjrat(decodeURIComponent(kod || ''))
    if (!n) return NextResponse.json({ xato: 'Shtrix-kod bo\'sh' }, { status: 400 })

    const filialId = sessionFilialId(session)
    const nNoZero = n.replace(/^0+/, '')
    const variantlar = Array.from(new Set([n, nNoZero, '0' + n, '00' + n]))

    const egaScope = filialId ? {} : { egaId: sessionEgaId(session) }

    let nomzodlar = await prisma.tovar.findMany({
      // Qulflangan tovar skaner orqali ham savatga tushmasligi kerak
      where: { holati: 'FAOL', qulflangan: false, shtrixKod: { in: variantlar }, ...(filialId ? { filialId } : {}), ...egaScope },
      include: { kategoriya: true },
      take: 20,
    })

    // Trim qilingan kod bilan ham qidirish (DB'da bo'sh joy bilan saqlangan bo'lsa)
    if (nomzodlar.length === 0) {
      nomzodlar = await prisma.tovar.findMany({
        where: {
          holati: 'FAOL',
          qulflangan: false,
          OR: variantlar.map(v => ({ shtrixKod: { contains: v } })),
          ...(filialId ? { filialId } : {}),
          ...egaScope,
        },
        include: { kategoriya: true },
        take: 20,
      })
    }

    if (nomzodlar.length === 0) return NextResponse.json({ xato: 'Tovar topilmadi' }, { status: 404 })

    // Bir xil kod bir nechta mahsulotda bo'lishi mumkin: omborlararo
    // o'tkazma qabul omborida o'sha mahsulotning nusxasini (kodi bilan)
    // yaratadi. Sotiladigan qoldig'i eng ko'pi tanlanadi.
    const stockMap = await getStockMap(nomzodlar.map(t => t.id))
    const qoldiq = (id: string) => stockMap.get(id)?.dokonQoldiq ?? 0
    const tovar = nomzodlar.reduce((eng, t) => (qoldiq(t.id) > qoldiq(eng.id) ? t : eng))
    return NextResponse.json({ ...tovar, qoldiq: qoldiq(tovar.id) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
