import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStockMap } from '@/lib/stock'
import { sessionFilialId, sessionEgaId, sessionIsRealEga } from '@/lib/filial-scope'
import { foydalanuvchiYashirilganMaydonlari, maydonlarniYashir } from '@/lib/maydon-yashirish'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const kamQolgan = searchParams.get('kamQolgan') === 'true'
    const muddatiYaqin = searchParams.get('muddatiYaqin') === 'true'
    const qidiruv = searchParams.get('q') || ''
    const ownFilialId = sessionFilialId(session)
    const foydalanuvchiId = (session.user as any).id
    // Ega (filialsiz) — standart holatda faqat OZINING mahsulotlarini ko'radi.
    const isRealEga = sessionIsRealEga(session)
    const filialId = ownFilialId || (isRealEga ? searchParams.get('filialId') : null) || null

    // 1. Faqat tovar ma'lumotlarini olish (omborHarakati YUKLANMAYDI)
    const tovarlar = await prisma.tovar.findMany({
      where: {
        holati: 'FAOL',
        filialId,
        ...(filialId ? {} : { egaId: sessionEgaId(session) }),
        ...(qidiruv ? { nomi: { contains: qidiruv, mode: 'insensitive' } } : {}),
      },
      include: { kategoriya: true },
      orderBy: { nomi: 'asc' },
    })

    // 2. Qoldiqni SQL aggregatsiya bilan hisoblash (bitta query)
    const stockMap = await getStockMap()
    const yashirilganMaydonlar = await foydalanuvchiYashirilganMaydonlari(foydalanuvchiId)

    // 3. Natijani birlashtirish
    const besh_kun_ms = 5 * 24 * 60 * 60 * 1000
    const hozir = Date.now()
    const qoldiqlar = tovarlar.map((t) => {
      const stock = stockMap.get(t.id) || { omborQoldiq: 0, dokonQoldiq: 0 }
      const jami = stock.omborQoldiq + stock.dokonQoldiq
      const kunQoldi = t.yaroqlilikMuddati ? Math.ceil((t.yaroqlilikMuddati.getTime() - hozir) / (24 * 60 * 60 * 1000)) : null
      const qoldiqYashirilgan = yashirilganMaydonlar.has('qoldiq')
      return maydonlarniYashir({
        id: t.id,
        nomi: t.nomi,
        kategoriya: t.kategoriya,
        kategoriyaId: t.kategoriyaId,
        shtrixKod: t.shtrixKod,
        rasmlar: t.rasmlar,
        birlik: t.birlik,
        sotishNarxi: t.sotishNarxi,
        kelishNarxi: t.kelishNarxi,
        valyuta: t.valyuta,
        minimalQoldiq: t.minimalQoldiq,
        omborQoldiq: qoldiqYashirilgan ? null : stock.omborQoldiq,
        dokonQoldiq: qoldiqYashirilgan ? null : stock.dokonQoldiq,
        qoldiq: Math.max(0, jami),
        kamQolgan: jami <= t.minimalQoldiq,
        yaroqlilikMuddati: t.yaroqlilikMuddati,
        kunQoldi,
        muddatiYaqin: t.yaroqlilikMuddati ? t.yaroqlilikMuddati.getTime() - hozir <= besh_kun_ms : false,
      }, yashirilganMaydonlar)
    })

    const natija = qoldiqlar
      .filter((q) => !kamQolgan || q.kamQolgan)
      .filter((q) => !muddatiYaqin || q.muddatiYaqin)

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
