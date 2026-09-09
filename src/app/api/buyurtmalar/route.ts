import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

// Saqlab qo'yilgan savat ("zakaz"). Kassir mijoz uchun mahsulot yig'ib
// qo'yadi, keyin qaytarib yuklab savdoni davom ettiradi.
//
// Holatlar: KUTILMOQDA = saqlangan, TASDIQLANGAN = yuklab olingan,
// BEKOR_QILINGAN = kassir o'chirgan. Ro'yxatda faqat KUTILMOQDA
// ko'rinadi, qolganlari tarix uchun saqlanib qoladi.

const HOLATLAR = ['KUTILMOQDA', 'TASDIQLANGAN', 'BEKOR_QILINGAN'] as const
type Holat = (typeof HOLATLAR)[number]

function holatMi(v: unknown): v is Holat {
  return typeof v === 'string' && (HOLATLAR as readonly string[]).includes(v)
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const holatiParam = searchParams.get('holati')
    const holati = holatiParam === 'BARCHASI'
      ? undefined
      : holatMi(holatiParam) ? holatiParam : 'KUTILMOQDA'

    const buyurtmalar = await prisma.buyurtma.findMany({
      where: { ...egaFilialWhere(session), ...(holati ? { holati } : {}) },
      include: {
        sotuvchi: { select: { id: true, ism: true } },
        mijoz: { select: { id: true, ism: true, telefon: true } },
        tarkiblar: {
          include: { tovar: { select: { id: true, nomi: true, birlik: true } } },
        },
      },
      orderBy: { yaratilgan: 'desc' },
      take: 100,
    })

    return NextResponse.json(buyurtmalar)
  } catch (e) {
    console.error('[buyurtmalar GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { tarkiblar, izoh, mijozId } = await req.json()
    if (!Array.isArray(tarkiblar) || tarkiblar.length === 0) {
      return NextResponse.json({ xato: "Savat bo'sh" }, { status: 400 })
    }

    const doira = egaFilialWhere(session)

    // Mijoz ko'rsatilgan bo'lsa — shu do'konning mijozi ekanini tekshiramiz
    if (mijozId) {
      const mijoz = await prisma.mijoz.findFirst({
        where: { id: mijozId, ...doira },
        select: { id: true },
      })
      if (!mijoz) return NextResponse.json({ xato: 'Mijoz topilmadi' }, { status: 404 })
    }

    // Mahsulotlar shu do'konnikimi — boshqa katalogdagi tovarni
    // zakazga qo'shib bo'lmasin.
    const tovarIdlar: string[] = Array.from(
      new Set(tarkiblar.map((t: { tovarId?: string }) => String(t.tovarId || '')).filter(Boolean)),
    )
    const tovarlar = await prisma.tovar.findMany({
      where: { id: { in: tovarIdlar }, ...doira },
      select: { id: true },
    })
    if (tovarlar.length !== tovarIdlar.length) {
      return NextResponse.json({ xato: "Ba'zi mahsulotlar topilmadi" }, { status: 400 })
    }

    // Qatorlarni tozalash va jamini SERVERDA hisoblash — client yuborgan
    // "jami" ga ishonilmaydi (aks holda zakaz summasi yolg'on bo'lardi).
    const tozaQatorlar = tarkiblar
      .map((t: { tovarId: string; miqdor: unknown; birlikNarxi: unknown }) => {
        const miqdor = Number(t.miqdor)
        const birlikNarxi = Number(t.birlikNarxi)
        return {
          tovarId: String(t.tovarId),
          miqdor: Number.isFinite(miqdor) && miqdor > 0 ? miqdor : 0,
          // Bonus qator narxi 0 bo'lishi mumkin — shuning uchun >= 0
          birlikNarxi: Number.isFinite(birlikNarxi) && birlikNarxi >= 0 ? birlikNarxi : 0,
        }
      })
      .filter((t: { miqdor: number }) => t.miqdor > 0)
      .map((t: { tovarId: string; miqdor: number; birlikNarxi: number }) => ({
        ...t,
        jami: t.miqdor * t.birlikNarxi,
      }))

    if (tozaQatorlar.length === 0) {
      return NextResponse.json({ xato: "Miqdori bor mahsulot yo'q" }, { status: 400 })
    }

    const jamiSumma = tozaQatorlar.reduce((s: number, t: { jami: number }) => s + t.jami, 0)

    const buyurtma = await prisma.buyurtma.create({
      data: {
        sotuvchiId: (session.user as { id: string }).id,
        mijozId: mijozId || null,
        jamiSumma,
        izoh: typeof izoh === 'string' && izoh.trim() ? izoh.trim() : null,
        ...doira,
        tarkiblar: { create: tozaQatorlar },
      },
      include: {
        sotuvchi: { select: { id: true, ism: true } },
        mijoz: { select: { id: true, ism: true, telefon: true } },
        tarkiblar: { include: { tovar: { select: { id: true, nomi: true, birlik: true } } } },
      },
    })

    return NextResponse.json(buyurtma, { status: 201 })
  } catch (e) {
    console.error('[buyurtmalar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
