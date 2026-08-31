import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStockMap } from '@/lib/stock'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const kamQolgan = searchParams.get('kamQolgan') === 'true'
    const qidiruv = searchParams.get('q') || ''
    const filialId = sessionFilialId(session)

    // 1. Faqat tovar ma'lumotlarini olish (omborHarakati YUKLANMAYDI)
    const tovarlar = await prisma.tovar.findMany({
      where: {
        holati: 'FAOL',
        ...(filialId ? { filialId } : {}),
        ...(qidiruv ? { nomi: { contains: qidiruv, mode: 'insensitive' } } : {}),
      },
      include: { kategoriya: true },
      orderBy: { nomi: 'asc' },
    })

    // 2. Qoldiqni SQL aggregatsiya bilan hisoblash (bitta query)
    const stockMap = await getStockMap()

    // 3. Natijani birlashtirish
    const qoldiqlar = tovarlar.map((t) => {
      const stock = stockMap.get(t.id) || { omborQoldiq: 0, dokonQoldiq: 0 }
      const jami = stock.omborQoldiq + stock.dokonQoldiq
      return {
        id: t.id,
        nomi: t.nomi,
        kategoriya: t.kategoriya,
        kategoriyaId: t.kategoriyaId,
        shtrixKod: t.shtrixKod,
        birlik: t.birlik,
        sotishNarxi: t.sotishNarxi,
        kelishNarxi: t.kelishNarxi,
        minimalQoldiq: t.minimalQoldiq,
        omborQoldiq: stock.omborQoldiq,
        dokonQoldiq: stock.dokonQoldiq,
        qoldiq: Math.max(0, jami),
        kamQolgan: jami <= t.minimalQoldiq,
      }
    })

    const natija = kamQolgan ? qoldiqlar.filter((q) => q.kamQolgan) : qoldiqlar

    return NextResponse.json(natija)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const data = await req.json()
    const foydalanuvchiId = (session.user as any).id

    const harakat = await prisma.omborHarakati.create({
      data: {
        tovarId: data.tovarId,
        turi: data.turi || 'KIRIM',
        joy: data.joy || 'OMBOR',
        miqdor: parseFloat(data.miqdor),
        narx: parseFloat(data.narx),
        taminotchiId: data.taminotchiId || null,
        izoh: data.izoh || null,
        foydalanuvchiId,
      },
      include: { tovar: true, taminotchi: true },
    })

    return NextResponse.json(harakat, { status: 201 })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
