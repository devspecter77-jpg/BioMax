import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { egaFilialWhere, sessionFilialId } from '@/lib/filial-scope'
import { xarajatniTekshir } from '@/lib/xarajat-turlari'

// Do'kon xarajatlari. Foydaga TO'G'RIDAN-TO'G'RI ta'sir qiladi:
// `/api/hisobotlar` da sof foyda = daromad − xarajat.
//
// Har bir xarajat "kim uchun" qilingani bilan yoziladi: xodimga
// bog'lanadi (`xodimId`) yoki erkin matn bo'ladi ("Damas mashina",
// "Soliq inspeksiyasi"). Shu bilan "pul qayerga ketdi" savoli javobsiz
// qolmaydi.

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dan = searchParams.get('dan')
    const gacha = searchParams.get('gacha')
    const kategoriya = searchParams.get('kategoriya')
    const xodimId = searchParams.get('xodimId')

    const where: Record<string, unknown> = { ...egaFilialWhere(session) }
    if (kategoriya) where.kategoriya = kategoriya
    if (xodimId) where.xodimId = xodimId
    if (dan || gacha) {
      const sana: Record<string, Date> = {}
      if (dan) sana.gte = new Date(dan)
      if (gacha) {
        const g = new Date(gacha)
        g.setHours(23, 59, 59, 999)
        sana.lte = g
      }
      where.sana = sana
    }

    const xarajatlar = await prisma.xarajat.findMany({
      where,
      include: {
        foydalanuvchi: { select: { ism: true } },
        xodim: { select: { id: true, ism: true } },
      },
      orderBy: { sana: 'desc' },
      take: 300,
    })

    const toza = xarajatlar.map(x => ({ ...x, summa: Number(x.summa) }))

    // Kategoriya kesimidagi yig'indi — qayerga ko'p ketayotgani ko'rinsin
    const kategoriyaBoyicha: Record<string, number> = {}
    for (const x of toza) {
      kategoriyaBoyicha[x.kategoriya] = (kategoriyaBoyicha[x.kategoriya] ?? 0) + x.summa
    }

    return NextResponse.json({
      xarajatlar: toza,
      jami: toza.reduce((s, x) => s + x.summa, 0),
      kategoriyaBoyicha,
      boshqaraOladi: await amalRuxsatiBormi(session, 'nasiyalar.xarajat'),
    })
  } catch (e) {
    console.error('[xarajatlar]', e)
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
    const tekshiruv = xarajatniTekshir(tana)
    if (!tekshiruv.ok) return NextResponse.json({ xato: tekshiruv.xato }, { status: 400 })

    // Xodim tanlangan bo'lsa u so'rovchining doirasida bo'lishi shart
    let xodimId: string | null = null
    if (tana.xodimId) {
      const ownFilialId = sessionFilialId(session)
      const xodim = await prisma.foydalanuvchi.findFirst({
        where: { id: String(tana.xodimId), ...(ownFilialId ? { filialId: ownFilialId } : {}) },
        select: { id: true },
      })
      if (!xodim) return NextResponse.json({ xato: 'Xodim topilmadi' }, { status: 404 })
      xodimId = xodim.id
    }

    const xarajat = await prisma.xarajat.create({
      data: {
        kategoriya: tekshiruv.kategoriya,
        summa: tekshiruv.summa,
        izoh: tekshiruv.izoh,
        xodimId,
        kimUchun: tekshiruv.kimUchun,
        tolovUsuli: tekshiruv.tolovUsuli as 'NAQD' | 'KARTA' | 'CLICK' | 'BANK',
        sana: tekshiruv.sana,
        foydalanuvchiId: (session.user as unknown as { id: string }).id,
        ...egaFilialWhere(session),
      },
      include: {
        foydalanuvchi: { select: { ism: true } },
        xodim: { select: { id: true, ism: true } },
      },
    })

    return NextResponse.json({ ...xarajat, summa: Number(xarajat.summa) }, { status: 201 })
  } catch (e) {
    console.error('[xarajatlar POST]', e)
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

    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ xato: 'id kerak' }, { status: 400 })

    // Xodim to'lovi bilan bog'langan xarajat bu yerdan o'chirilmaydi —
    // aks holda Xodimlar bo'limidagi to'lov xarajatsiz qolib, hisobot
    // ikki joyda ikki xil ko'rsatardi.
    const mavjud = await prisma.xarajat.findFirst({
      where: { id, ...egaFilialWhere(session) },
      select: { id: true, xodimTolovi: { select: { id: true } } },
    })
    if (!mavjud) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })
    if (mavjud.xodimTolovi) {
      return NextResponse.json({
        xato: 'Bu xarajat xodim to‘lovi bilan bog‘langan — Xodimlar bo‘limidan bekor qiling',
      }, { status: 400 })
    }

    await prisma.xarajat.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[xarajatlar DELETE]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
