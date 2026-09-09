import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'
import { ichkiXabarYubor } from '@/lib/telegram'

// Saqlangan so'rovni QAYTA yuborish.
//
// Matn qayta yaratilmaydi — hujjatdagi o'zgarmas nusxa yuboriladi.
// Shunday qilib narx yoki mahsulot nomi o'zgargan bo'lsa ham, ta'minotchi
// birinchi marta ko'rgan xabarning aynan o'zini oladi.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ sorovId: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { sorovId } = await params

    // Doira ta'minotchi orqali tekshiriladi — so'rovning o'zida ham
    // filialId/egaId bor, lekin manba haqiqat ta'minotchining doirasi.
    const sorov = await prisma.taminotchiSorov.findFirst({
      where: { id: sorovId, taminotchi: egaFilialWhere(session) },
      select: {
        id: true, matn: true, urinishSoni: true,
        taminotchi: { select: { telefon: true } },
      },
    })
    if (!sorov) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const telefon = sorov.taminotchi.telefon
    if (!telefon) {
      return NextResponse.json(
        { xato: "Ta'minotchida telefon raqam yo'q" },
        { status: 400 },
      )
    }

    const natija = await ichkiXabarYubor(telefon, sorov.matn)

    const yangilangan = await prisma.taminotchiSorov.update({
      where: { id: sorov.id },
      data: {
        telefon,
        status: natija.ok ? 'sent' : 'failed',
        xato: natija.ok ? null : (natija.xato ?? "Noma'lum xato"),
        urinishSoni: { increment: 1 },
        yuborilganSana: natija.ok ? new Date() : null,
      },
      select: { id: true, status: true, xato: true, yuborilganSana: true, urinishSoni: true },
    })

    if (!natija.ok) {
      return NextResponse.json({ xato: yangilangan.xato, sorov: yangilangan }, { status: 502 })
    }
    return NextResponse.json({ ok: true, sorov: yangilangan })
  } catch (e) {
    console.error('[taminotchi sorov qayta yuborish]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
