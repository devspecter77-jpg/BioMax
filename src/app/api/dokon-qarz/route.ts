import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { egaFilialWhere } from '@/lib/filial-scope'
import { qarzniTekshir, qarzXulosasi } from '@/lib/taminotchi-qarz'

// Do'konning O'Z qarzi — ta'minotchi bilan bog'liq bo'lmagan qarzlar
// (ijara, qarzga olingan pul, jismoniy shaxs va h.k.).
//
// Yozuvlar "kimga qarzdormiz" bo'yicha guruhlanadi: bir odamdan bir necha
// marta qarz olinishi va bo'lib-bo'lib to'lanishi mumkin.

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const yozuvlar = await prisma.dokonQarz.findMany({
      where: egaFilialWhere(session),
      orderBy: { sana: 'desc' },
      take: 300,
      select: {
        id: true, kimga: true, turi: true, summa: true, tolovUsuli: true,
        izoh: true, muddat: true, sana: true,
        yaratgan: { select: { ism: true } },
      },
    })

    const toza = yozuvlar.map(y => ({ ...y, summa: Number(y.summa) }))

    // Kimga qarzdorligimiz bo'yicha guruhlash — bir odam bilan bir nechta
    // yozuv bo'lishi tabiiy, foydalanuvchi esa yakuniy qoldiqni ko'rishi kerak.
    const guruhlar = new Map<string, { kimga: string; yozuvlar: typeof toza }>()
    for (const y of toza) {
      const kalit = y.kimga.trim().toLowerCase()
      const g = guruhlar.get(kalit) ?? { kimga: y.kimga, yozuvlar: [] }
      g.yozuvlar.push(y)
      guruhlar.set(kalit, g)
    }

    const qarzdorlar = Array.from(guruhlar.values())
      .map(g => ({
        kimga: g.kimga,
        ...qarzXulosasi({ xaridQoldigi: 0, yozuvlar: g.yozuvlar }),
        // Eng yaqin qaytarish muddati — to'lanmagan qarz qolgan bo'lsa
        muddat: g.yozuvlar
          .filter(y => y.turi === 'QARZ' && y.muddat)
          .map(y => y.muddat as Date)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null,
        yozuvlar: g.yozuvlar,
      }))
      .filter(g => g.jami !== 0 || g.yozuvlar.length > 0)
      .sort((a, b) => b.jami - a.jami)

    return NextResponse.json({
      qarzdorlar,
      jami: qarzdorlar.reduce((s, g) => s + g.jami, 0),
      boshqaraOladi: await amalRuxsatiBormi(session, 'nasiyalar.xarajat'),
    })
  } catch (e) {
    console.error('[dokon qarz]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    // Ruxsatlar bo'limidan beriladi (standartda faqat administrator)
    if (!(await amalRuxsatiBormi(session, 'nasiyalar.xarajat'))) {
      return NextResponse.json({ xato: 'Xarajat va do‘kon qarzini yozishga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const tana = await req.json()
    const kimga = String(tana.kimga ?? '').trim()
    if (!kimga) return NextResponse.json({ xato: 'Kimga qarzdorligingizni yozing' }, { status: 400 })

    // Summa/tur/kanal tekshiruvi ta'minotchi qarzi bilan bir xil qoida
    const tekshiruv = qarzniTekshir(tana)
    if (!tekshiruv.ok) return NextResponse.json({ xato: tekshiruv.xato }, { status: 400 })

    let muddat: Date | null = null
    if (tekshiruv.turi === 'QARZ' && tana.muddat) {
      const d = new Date(String(tana.muddat))
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ xato: "Muddat noto'g'ri" }, { status: 400 })
      }
      muddat = d
    }

    const doira = egaFilialWhere(session)
    const yozuv = await prisma.dokonQarz.create({
      data: {
        kimga: kimga.slice(0, 200),
        turi: tekshiruv.turi,
        summa: tekshiruv.summa,
        tolovUsuli: tekshiruv.tolovUsuli as 'NAQD' | 'KARTA' | 'CLICK' | 'BANK' | null,
        izoh: tekshiruv.izoh,
        muddat,
        yaratganId: (session.user as unknown as { id: string }).id,
        ...doira,
      },
      select: {
        id: true, kimga: true, turi: true, summa: true, tolovUsuli: true,
        izoh: true, muddat: true, sana: true,
        yaratgan: { select: { ism: true } },
      },
    })

    return NextResponse.json({ ...yozuv, summa: Number(yozuv.summa) }, { status: 201 })
  } catch (e) {
    console.error('[dokon qarz POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    // Ruxsatlar bo'limidan beriladi (standartda faqat administrator)
    if (!(await amalRuxsatiBormi(session, 'nasiyalar.xarajat'))) {
      return NextResponse.json({ xato: 'Xarajat va do‘kon qarzini yozishga ruxsatingiz yo‘q', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const yozuvId = new URL(req.url).searchParams.get('yozuvId')
    if (!yozuvId) return NextResponse.json({ xato: 'yozuvId kerak' }, { status: 400 })

    // Doira `where` ichida — boshqa Eganing yozuvini o'chirib bo'lmasin
    const ochirildi = await prisma.dokonQarz.deleteMany({
      where: { id: yozuvId, ...egaFilialWhere(session) },
    })
    if (ochirildi.count === 0) return NextResponse.json({ xato: 'Yozuv topilmadi' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[dokon qarz DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
