import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { balansOzgartir } from '@/lib/sodiqlik-server'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dan = searchParams.get('dan')
    const gacha = searchParams.get('gacha')

    const where: any = {}
    if (dan || gacha) {
      where.yaratilgan = {}
      if (dan) where.yaratilgan.gte = new Date(dan)
      if (gacha) {
        const g = new Date(gacha)
        g.setHours(23, 59, 59)
        where.yaratilgan.lte = g
      }
    }

    const qaytarishlar = await prisma.qaytarish.findMany({
      where,
      include: {
        aslSotuv: { select: { chekRaqami: true } },
        kassir: { select: { ism: true } },
        tarkiblar: { include: { tovar: { select: { nomi: true, birlik: true } } } },
      },
      orderBy: { yaratilgan: 'desc' },
    })

    return NextResponse.json(qaytarishlar)
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const kassirId = (session.user as any).id
    const { aslSotuvId, tarkiblar, sabab } = await req.json()

    if (!aslSotuvId || !tarkiblar || tarkiblar.length === 0) {
      return NextResponse.json({ xato: "Ma'lumotlar to'liq emas" }, { status: 400 })
    }

    // Sotuv tarkibi va oldingi qaytarishlar — narx va miqdorni server'da tekshirish uchun
    const aslSotuv = await prisma.sotuv.findUnique({
      where: { id: aslSotuvId },
      include: {
        tarkiblar: true,
        qaytarishlar: { include: { tarkiblar: true } },
      },
    })
    if (!aslSotuv) {
      return NextResponse.json({ xato: 'Asl sotuv topilmadi' }, { status: 404 })
    }

    // Tovar ID → sotuv tarkibi (narx va miqdor manbai)
    const sotilganMap = new Map<string, { miqdor: number; birlikNarxi: number }>()
    for (const st of aslSotuv.tarkiblar) {
      sotilganMap.set(st.tovarId, {
        miqdor: Number(st.miqdor),
        birlikNarxi: Number(st.birlikNarxi),
      })
    }

    // Oldingi qaytarishlar miqdori — limitni aniqlash uchun
    const oldinQaytarilgan = new Map<string, number>()
    for (const q of aslSotuv.qaytarishlar) {
      for (const qt of q.tarkiblar) {
        oldinQaytarilgan.set(qt.tovarId, (oldinQaytarilgan.get(qt.tovarId) ?? 0) + Number(qt.miqdor))
      }
    }

    // Validate + backend'dan narxni qayta tiklash
    const tasdiqlangan: Array<{ tovarId: string; miqdor: number; birlikNarxi: number; jami: number }> = []
    for (const t of tarkiblar) {
      const tovarId = String(t.tovarId)
      const miqdor = parseFloat(t.miqdor)
      if (!tovarId || !(miqdor > 0)) {
        return NextResponse.json({ xato: 'Noto\'g\'ri tarkib ma\'lumoti' }, { status: 400 })
      }
      const asl = sotilganMap.get(tovarId)
      if (!asl) {
        return NextResponse.json({ xato: `Tovar sotuvda yo'q (${tovarId})` }, { status: 400 })
      }
      const qolganLimit = asl.miqdor - (oldinQaytarilgan.get(tovarId) ?? 0)
      if (miqdor > qolganLimit + 1e-6) {
        return NextResponse.json(
          { xato: `Qaytariladigan miqdor sotilgandan oshib ketgan (tovar: ${tovarId}, limit: ${qolganLimit})` },
          { status: 400 }
        )
      }
      const birlikNarxi = asl.birlikNarxi // ← Sotuv tarixidagi narx, client'dan emas
      tasdiqlangan.push({
        tovarId,
        miqdor,
        birlikNarxi,
        jami: miqdor * birlikNarxi,
      })
    }

    const jamiSumma = tasdiqlangan.reduce((s, t) => s + t.jami, 0)

    const result = await prisma.$transaction(async (tx) => {
      // 1. Qaytarish yaratish
      const qaytarish = await tx.qaytarish.create({
        data: {
          aslSotuvId,
          kassirId,
          jamiSumma,
          sabab: sabab || null,
          tarkiblar: {
            create: tasdiqlangan.map((t) => ({
              tovarId: t.tovarId,
              miqdor: t.miqdor,
              birlikNarxi: t.birlikNarxi,
              jami: t.jami,
            })),
          },
        },
      })

      // 2. Har tovar uchun QAYTARISH harakati (do'konga qaytarish)
      for (const t of tasdiqlangan) {
        await tx.omborHarakati.create({
          data: {
            tovarId: t.tovarId,
            turi: 'QAYTARISH',
            joy: 'DOKON',
            miqdor: t.miqdor,
            narx: t.birlikNarxi,
            sotuvId: aslSotuvId,
            izoh: `Qaytarish: ${sabab || ''}`.trim(),
            foydalanuvchiId: kassirId,
          },
        })
      }

      // 3. Agar asl sotuvda nasiya bo'lsa → nasiya qoldiqni kamaytirish
      const nasiya = await tx.nasiya.findUnique({ where: { sotuvId: aslSotuvId } })
      if (nasiya) {
        const yangiTolangan = Number(nasiya.tolangan) + jamiSumma
        const yangiQoldiq = Number(nasiya.jamiQarz) - yangiTolangan
        const yangiHolat = yangiQoldiq <= 0 ? 'YOPILGAN' : nasiya.holati
        await tx.nasiya.update({
          where: { id: nasiya.id },
          data: {
            tolangan: yangiTolangan,
            qoldiq: Math.max(0, yangiQoldiq),
            holati: yangiHolat,
          },
        })
      }

      // 4. Sodiqlik: shu xariddan olingan ball/keshbek PROPORSIONAL
      //    qaytarib olinadi. Aks holda mijoz tovarni qaytarib, u uchun
      //    berilgan ballni o'zida saqlab qolardi.
      //    Balans allaqachon sarflangan bo'lsa manfiyga ketmaydi —
      //    balansOzgartir bor bo'lganini ayiradi.
      if (aslSotuv.mijozId) {
        const sotuvSummasi = Number(aslSotuv.yakuniySumma)
        if (sotuvSummasi > 0) {
          const ulush = Math.min(1, jamiSumma / sotuvSummasi)
          const toplanganlar = await tx.sodiqlikHarakati.findMany({
            where: { sotuvId: aslSotuvId, sabab: 'SOTUVDAN' },
            select: { hisob: true, miqdor: true },
          })
          for (const t of toplanganlar) {
            const qaytariladi = Number(t.miqdor) * ulush
            const yaxlit = t.hisob === 'BALL'
              ? Math.floor(qaytariladi * 100) / 100
              : Math.floor(qaytariladi)
            if (yaxlit > 0) {
              await balansOzgartir(tx, {
                mijozId: aslSotuv.mijozId,
                hisob: t.hisob,
                miqdor: -yaxlit,
                sabab: 'QAYTARISHDAN',
                sotuvId: aslSotuvId,
                izoh: `Qaytarish (${Math.round(ulush * 100)}%)`,
                foydalanuvchiId: kassirId,
              })
            }
          }
        }
      }

      return qaytarish
    })

    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Qaytarish amalga oshmadi' }, { status: 500 })
  }
}
