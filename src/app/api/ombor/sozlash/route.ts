import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStockMap } from '@/lib/stock'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const foydalanuvchiId = (session.user as any).id
    const data = await req.json()
    const { tovarId, yangiQoldiq } = data

    if (!tovarId || yangiQoldiq === undefined || yangiQoldiq === null) {
      return NextResponse.json({ xato: "tovarId va yangiQoldiq majburiy" }, { status: 400 })
    }

    const egalik = await prisma.tovar.findFirst({ where: { id: tovarId, ...egaFilialWhere(session) }, select: { id: true } })
    if (!egalik) return NextResponse.json({ xato: 'Tovar topilmadi' }, { status: 404 })

    const yangi = parseFloat(yangiQoldiq)
    if (isNaN(yangi) || yangi < 0) {
      return NextResponse.json({ xato: "Noto'g'ri qoldiq" }, { status: 400 })
    }

    const joy = data?.joy || 'DOKON'

    // SQL aggregatsiya bilan hozirgi qoldiqni olish
    const stockMap = await getStockMap([tovarId])
    const stock = stockMap.get(tovarId) || { omborQoldiq: 0, dokonQoldiq: 0 }
    const hozirgi = joy === 'OMBOR' ? stock.omborQoldiq : stock.dokonQoldiq

    const farq = yangi - hozirgi

    if (Math.abs(farq) < 0.001) {
      return NextResponse.json({ ok: true, xabar: "Qoldiq o'zgarmadi" })
    }

    await prisma.omborHarakati.create({
      data: {
        tovarId,
        turi: farq > 0 ? 'KIRIM' : 'YOQOTISH',
        joy,
        miqdor: Math.abs(farq),
        narx: 0,
        izoh: `Qoldiq sozlash: ${hozirgi.toFixed(2)} → ${yangi.toFixed(2)}`,
        foydalanuvchiId,
      },
    })

    return NextResponse.json({ ok: true, hozirgi, yangi, farq })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
