import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const taminotchiId = searchParams.get('taminotchiId') || ''
    const dan = searchParams.get('dan') || ''
    const gacha = searchParams.get('gacha') || ''

    const where: any = {}
    if (taminotchiId) where.taminotchiId = taminotchiId
    if (dan || gacha) {
      where.sana = {}
      if (dan) where.sana.gte = new Date(dan)
      if (gacha) {
        const g = new Date(gacha)
        g.setHours(23, 59, 59, 999)
        where.sana.lte = g
      }
    }

    const xaridlar = await prisma.xarid.findMany({
      where,
      include: {
        taminotchi: { select: { id: true, nomi: true, manzil: true, kontaktShaxs: true } },
        tarkiblar: true,
        tolovlar: { orderBy: { sana: 'desc' } },
        qarzTarixi: { orderBy: { sana: 'desc' } },
        foydalanuvchi: { select: { ism: true } },
      },
      orderBy: { sana: 'desc' },
    })

    return NextResponse.json(xaridlar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const foydalanuvchiId = (session.user as any).id
    const data = await req.json()

    const { taminotchiId, tarkiblar, tolangan, izoh, rejim, qarzSumma } = data

    // Faqat qarz rejimi (tovarsiz)
    if (rejim === 'qarz') {
      const qarz = Number(qarzSumma) || 0
      if (!(qarz > 0)) return NextResponse.json({ xato: 'Qarz summasi kiriting' }, { status: 400 })
      if (!taminotchiId) return NextResponse.json({ xato: 'Ta\'minotchi tanlang' }, { status: 400 })

      const xarid = await prisma.$transaction(async (tx) => {
        const yangi = await tx.xarid.create({
          data: {
            taminotchiId,
            jamiSumma: qarz,
            tolangan: 0,
            qoldiqQarz: qarz,
            izoh: izoh || 'Qarz',
            foydalanuvchiId,
          },
          include: {
            taminotchi: { select: { nomi: true } },
          },
        })
        // Qarz tarixida ham boshlang'ich record yoziladi
        await tx.xaridQarzTarixi.create({
          data: {
            xaridId: yangi.id,
            summa: qarz,
            izoh: izoh || 'Boshlang\'ich qarz',
          },
        })
        return yangi
      })
      return NextResponse.json(xarid, { status: 201 })
    }

    // Oddiy xarid (tovar bilan)
    if (!tarkiblar || tarkiblar.length === 0) {
      return NextResponse.json({ xato: 'Kamida bitta tovar kiriting' }, { status: 400 })
    }

    const jamiSumma = tarkiblar.reduce(
      (sum: number, t: { miqdor: number; birlikNarxi: number }) =>
        sum + Number(t.miqdor) * Number(t.birlikNarxi),
      0
    )
    const tolanganSumma = Number(tolangan) || 0
    const qoldiqQarz = jamiSumma - tolanganSumma

    const xarid = await prisma.$transaction(async (tx) => {
      const yangi = await tx.xarid.create({
        data: {
          taminotchiId: taminotchiId || null,
          jamiSumma,
          tolangan: tolanganSumma,
          qoldiqQarz,
          izoh: izoh || null,
          foydalanuvchiId,
          tarkiblar: {
            create: tarkiblar.map((t: { tovarId?: string; tovarNomi: string; miqdor: number; birlikNarxi: number }) => ({
              tovarId: t.tovarId || null,
              tovarNomi: t.tovarNomi,
              miqdor: Number(t.miqdor),
              birlikNarxi: Number(t.birlikNarxi),
              jami: Number(t.miqdor) * Number(t.birlikNarxi),
            })),
          },
        },
        include: {
          taminotchi: { select: { nomi: true } },
          tarkiblar: true,
        },
      })

      // Tovarga bog'langan har bir tarkib uchun — avtomatik omborga kirim
      for (const t of tarkiblar) {
        if (t.tovarId) {
          await tx.omborHarakati.create({
            data: {
              tovarId: t.tovarId,
              turi: 'KIRIM',
              joy: 'OMBOR',
              miqdor: Number(t.miqdor),
              narx: Number(t.birlikNarxi),
              taminotchiId: taminotchiId || null,
              foydalanuvchiId,
              izoh: 'Xarid orqali avtomatik kirim',
            },
          })
        }
      }

      return yangi
    })

    return NextResponse.json(xarid, { status: 201 })
  } catch (e) {
    console.error('[Xaridlar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
