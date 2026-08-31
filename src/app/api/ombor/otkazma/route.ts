import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStockMap } from '@/lib/stock'
import { egaFilialWhere } from '@/lib/filial-scope'

// Ombordan do'konga o'tkazma
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const foydalanuvchiId = (session.user as any).id
    const { tovarId, miqdor, izoh } = await req.json()

    if (!tovarId || !miqdor || parseFloat(miqdor) <= 0) {
      return NextResponse.json({ xato: "Tovar va miqdor majburiy" }, { status: 400 })
    }

    const qty = parseFloat(miqdor)

    // SQL aggregatsiya bilan ombor qoldig'ini tekshirish
    const stockMap = await getStockMap([tovarId])
    const stock = stockMap.get(tovarId)
    const omborQoldiq = stock?.omborQoldiq ?? 0

    if (qty > omborQoldiq) {
      return NextResponse.json({ xato: `Omborda yetarli emas. Mavjud: ${omborQoldiq}` }, { status: 400 })
    }

    const tovar = await prisma.tovar.findFirst({
      where: { id: tovarId, ...egaFilialWhere(session) },
      select: { kelishNarxi: true },
    })
    if (!tovar) return NextResponse.json({ xato: 'Tovar topilmadi' }, { status: 404 })

    const harakat = await prisma.omborHarakati.create({
      data: {
        tovarId,
        turi: 'OTKAZMA',
        joy: 'OMBOR',
        miqdor: qty,
        narx: Number(tovar?.kelishNarxi || 0),
        izoh: izoh || "Ombordan do'konga o'tkazma",
        foydalanuvchiId,
      },
      include: { tovar: true },
    })

    return NextResponse.json(harakat, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
