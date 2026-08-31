import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { tolovQilindiXabar } from '@/lib/telegram'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const data = await req.json()
    const foydalanuvchiId = (session.user as any).id

    const egalik = await prisma.nasiya.findFirst({ where: { id, mijoz: egaFilialWhere(session) }, select: { id: true } })
    if (!egalik) return NextResponse.json({ xato: 'Nasiya topilmadi' }, { status: 404 })

    // tolovUsuli validatsiya
    const USULLAR = ['NAQD', 'KARTA'] as const
    const tolovUsuli = USULLAR.includes(data.tolovUsuli) ? data.tolovUsuli : 'NAQD'

    const tolovSumma = new Prisma.Decimal(data.summa || 0)
    if (tolovSumma.lte(0)) return NextResponse.json({ xato: "Summa 0 dan katta bo'lishi kerak" }, { status: 400 })

    // Race condition oldini olish — transaction ichida hamma narsa
    const natija = await prisma.$transaction(async (tx) => {
      const nasiya = await tx.nasiya.findUnique({ where: { id } })
      if (!nasiya) throw new Error('NOT_FOUND')

      const qoldiqQarz = nasiya.jamiQarz.sub(nasiya.tolangan)
      if (qoldiqQarz.lte(0)) throw new Error('ALREADY_PAID')

      // Qoldiqdan oshmasin
      const haqiqiyTolov = tolovSumma.gt(qoldiqQarz) ? qoldiqQarz : tolovSumma
      const yangiTolangan = nasiya.tolangan.add(haqiqiyTolov)
      const yangiQoldiq = nasiya.jamiQarz.sub(yangiTolangan)
      const yopildimi = yangiQoldiq.lte(0)

      const tolov = await tx.nasiyaTolov.create({
        data: {
          nasiyaId: id,
          summa: haqiqiyTolov,
          tolovUsuli,
          qabulQiluvchiId: foydalanuvchiId,
          izoh: data.izoh || null,
        },
      })

      const yangiNasiya = await tx.nasiya.update({
        where: { id },
        data: {
          tolangan: yangiTolangan,
          qoldiq: yopildimi ? new Prisma.Decimal(0) : yangiQoldiq,
          holati: yopildimi ? 'YOPILGAN' : nasiya.holati === 'YOPILGAN' ? 'OCHIQ' : nasiya.holati,
        },
      })

      return { tolov, nasiya: yangiNasiya, haqiqiyTolov, yangiQoldiq: yopildimi ? 0 : yangiQoldiq.toNumber() }
    })

    // Telegram — xatolik loglash
    after(async () => {
      await tolovQilindiXabar(id, natija.nasiya.mijozId, natija.haqiqiyTolov.toNumber(), natija.yangiQoldiq)
        .then(r => { if (r && !r.ok) console.error('[Telegram] Tolov xabar xatosi:', r.xato) })
        .catch(e => console.error('[Telegram] Tolov xabar xatosi:', e))
    })

    return NextResponse.json({ tolov: natija.tolov, nasiya: natija.nasiya }, { status: 201 })
  } catch (e: any) {
    if (e.message === 'NOT_FOUND') return NextResponse.json({ xato: 'Nasiya topilmadi' }, { status: 404 })
    if (e.message === 'ALREADY_PAID') return NextResponse.json({ xato: "Bu nasiya allaqachon to'langan" }, { status: 400 })
    console.error('[Nasiya tolov]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
