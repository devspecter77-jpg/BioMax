import { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { sessionFilialId, sessionEgaId, egaFilialWhere } from '@/lib/filial-scope'
import { qarzniTekshir, qarzXulosasi } from '@/lib/taminotchi-qarz'

// Ta'minotchi qarz daftari — qo'lda yoziladigan qarz va to'lovlar.
//
// Xarid orqali kelgan qarzdan farqli, bu yozuvlar hujjatga bog'lanmagan:
// tizimdan oldingi qoldiq, og'zaki kelishuv yoki tuzatish uchun.

/** Ta'minotchini so'rovchining ko'rish doirasida topadi. */
async function taminotchiniTop(session: Session | null, id: string) {
  const filialId = sessionFilialId(session)
  return prisma.taminotchi.findFirst({
    where: { id, ...(filialId ? { filialId } : { egaId: sessionEgaId(session) }) },
    select: { id: true, nomi: true, filialId: true },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { id } = await params
    const taminotchi = await taminotchiniTop(session, id)
    if (!taminotchi) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const [yozuvlar, xaridlar] = await Promise.all([
      prisma.taminotchiQarz.findMany({
        where: { taminotchiId: id },
        orderBy: { sana: 'desc' },
        take: 100,
        select: {
          id: true, turi: true, summa: true, tolovUsuli: true, izoh: true, sana: true,
          yaratgan: { select: { ism: true } },
        },
      }),
      prisma.xarid.aggregate({
        where: { taminotchiId: id },
        _sum: { qoldiqQarz: true },
      }),
    ])

    const toza = yozuvlar.map(y => ({ ...y, summa: Number(y.summa) }))

    return NextResponse.json({
      taminotchi: { id: taminotchi.id, nomi: taminotchi.nomi },
      yozuvlar: toza,
      xulosa: qarzXulosasi({
        xaridQoldigi: Number(xaridlar._sum.qoldiqQarz ?? 0),
        yozuvlar: toza,
      }),
      // Ruxsatlar bo'limidan beriladi (standartda faqat administrator)
      boshqaraOladi: await amalRuxsatiBormi(session, 'taminotchilar.qarz'),
    })
  } catch (e) {
    console.error('[taminotchi qarz]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'taminotchilar.qarz'))) {
      return NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q: «Ta’minotchi qarz va to‘lovlari»', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const { id } = await params
    const taminotchi = await taminotchiniTop(session, id)
    if (!taminotchi) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const tekshiruv = qarzniTekshir(await req.json())
    if (!tekshiruv.ok) return NextResponse.json({ xato: tekshiruv.xato }, { status: 400 })

    const doira = egaFilialWhere(session)
    const yozuv = await prisma.taminotchiQarz.create({
      data: {
        taminotchiId: taminotchi.id,
        turi: tekshiruv.turi,
        summa: tekshiruv.summa,
        tolovUsuli: tekshiruv.tolovUsuli as 'NAQD' | 'KARTA' | 'CLICK' | 'BANK' | null,
        izoh: tekshiruv.izoh,
        yaratganId: (session.user as unknown as { id: string }).id,
        // Yozuv ta'minotchining filialiga bog'lanadi — hisobot shu kesimda
        filialId: taminotchi.filialId,
        egaId: 'egaId' in doira ? doira.egaId : null,
      },
      select: {
        id: true, turi: true, summa: true, tolovUsuli: true, izoh: true, sana: true,
        yaratgan: { select: { ism: true } },
      },
    })

    return NextResponse.json({ ...yozuv, summa: Number(yozuv.summa) }, { status: 201 })
  } catch (e) {
    console.error('[taminotchi qarz POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// Xato kiritilgan yozuvni bekor qilish
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'taminotchilar.qarz'))) {
      return NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q: «Ta’minotchi qarz va to‘lovlari»', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const { id } = await params
    const yozuvId = new URL(req.url).searchParams.get('yozuvId')
    if (!yozuvId) return NextResponse.json({ xato: 'yozuvId kerak' }, { status: 400 })

    const taminotchi = await taminotchiniTop(session, id)
    if (!taminotchi) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })

    const ochirildi = await prisma.taminotchiQarz.deleteMany({
      where: { id: yozuvId, taminotchiId: taminotchi.id },
    })
    if (ochirildi.count === 0) return NextResponse.json({ xato: 'Yozuv topilmadi' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[taminotchi qarz DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
