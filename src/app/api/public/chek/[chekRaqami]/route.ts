import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET — Ommaviy chek ma'lumotlari (auth kerak emas)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chekRaqami: string }> }
) {
  try {
    const { chekRaqami } = await params
    const decoded = decodeURIComponent(chekRaqami)

    const sotuv = await prisma.sotuv.findUnique({
      where: { chekRaqami: decoded },
      include: {
        mijoz: { select: { ism: true, telefon: true } },
        kassir: { select: { ism: true } },
        tarkiblar: {
          include: {
            tovar: { select: { nomi: true, birlik: true } },
          },
        },
        nasiya: {
          select: {
            jamiQarz: true,
            tolangan: true,
            qoldiq: true,
            holati: true,
            muddat: true,
          },
        },
      },
    })

    if (!sotuv || sotuv.holati === 'BEKOR_QILINGAN') {
      return NextResponse.json({ xato: 'Chek topilmadi' }, { status: 404 })
    }

    // Do'kon ma'lumotlarini yuklash
    const sozlamalar = await prisma.sozlama.findMany({
      where: {
        kalit: { in: ['dokon_nomi', 'manzil', 'telefon', 'chek_matn'] },
      },
    })
    const soz: Record<string, string> = {}
    for (const s of sozlamalar) soz[s.kalit] = s.qiymat

    return NextResponse.json({
      chekRaqami: sotuv.chekRaqami,
      sana: sotuv.sana,
      jamiSumma: sotuv.jamiSumma,
      chegirma: sotuv.chegirma,
      yakuniySumma: sotuv.yakuniySumma,
      tolovUsuli: sotuv.tolovUsuli,
      naqdTolangan: sotuv.naqdTolangan,
      kartaTolangan: sotuv.kartaTolangan,
      kassir: sotuv.kassir.ism,
      mijoz: sotuv.mijoz ? { ism: sotuv.mijoz.ism } : null,
      tarkiblar: sotuv.tarkiblar.map((t) => ({
        tovar: t.tovar.nomi,
        birlik: t.tovar.birlik,
        miqdor: t.miqdor,
        birlikNarxi: t.birlikNarxi,
        chegirma: t.chegirma,
        jami: t.jami,
      })),
      nasiya: sotuv.nasiya
        ? {
            jamiQarz: sotuv.nasiya.jamiQarz,
            tolangan: sotuv.nasiya.tolangan,
            qoldiq: sotuv.nasiya.qoldiq,
            holati: sotuv.nasiya.holati,
            muddat: sotuv.nasiya.muddat,
          }
        : null,
      dokon: {
        nomi: soz.dokon_nomi || "Do'kon",
        manzil: soz.manzil || '',
        telefon: soz.telefon || '',
        chekMatn: soz.chek_matn || '',
      },
    })
  } catch (e) {
    console.error('[Public chek]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
