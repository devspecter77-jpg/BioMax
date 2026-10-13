import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { balansOzgartir } from '@/lib/sodiqlik-server'
import { qaytarishdaBekor, tafsilotniOqi } from '@/lib/sodiqlik'
import { egaFilialWhere } from '@/lib/filial-scope'
import { mijozKorinishi, mijozliYozuvSharti } from '@/lib/mijoz-doirasi'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dan = searchParams.get('dan')
    const gacha = searchParams.get('gacha')

    const where: Prisma.QaytarishWhereInput = {}
    if (dan || gacha) {
      const yaratilgan: Prisma.DateTimeFilter = {}
      if (dan) yaratilgan.gte = new Date(dan)
      if (gacha) {
        const g = new Date(gacha)
        g.setHours(23, 59, 59)
        yaratilgan.lte = g
      }
      where.yaratilgan = yaratilgan
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

    const kassirId = session.user.id
    const { aslSotuvId, tarkiblar, sabab } = await req.json()

    if (!aslSotuvId || !tarkiblar || tarkiblar.length === 0) {
      return NextResponse.json({ xato: "Ma'lumotlar to'liq emas" }, { status: 400 })
    }

    // Sotuv shu do'konniki va xodim uni ko'ra oladi (boshqa xodimning mijozi emas)
    const korinadi = await prisma.sotuv.count({
      where: { id: String(aslSotuvId), ...egaFilialWhere(session), ...mijozliYozuvSharti(await mijozKorinishi(session)) },
    })
    if (!korinadi) return NextResponse.json({ xato: 'Sotuv topilmadi' }, { status: 404 })

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

    // Tovar ID → sotilgani (narx va miqdor manbai). Bir mahsulot bir nechta
    // qatorda bo'lishi mumkin ("2 blok" va "5 dona", yoki bonus) — miqdor va
    // summa qo'shiladi. `aniq` — summa to'langan narxdan: qatorga chegirma
    // berilmagan (summa = miqdor × narx) yoki o'ramda sotilgan.
    const sotilganMap = new Map<string, { miqdor: number; birlikNarxi: number; jami: number; qatorlar: number; aniq: boolean }>()
    for (const st of aslSotuv.tarkiblar) {
      const miqdor = Number(st.miqdor)
      const birlikNarxi = Number(st.birlikNarxi)
      const jami = Number(st.jami)
      const aniq = st.oramMiqdori !== null || Math.abs(jami - miqdor * birlikNarxi) < 1
      const e = sotilganMap.get(st.tovarId)
      sotilganMap.set(st.tovarId, e
        ? { miqdor: e.miqdor + miqdor, birlikNarxi, jami: e.jami + jami, qatorlar: e.qatorlar + 1, aniq: e.aniq && aniq }
        : { miqdor, birlikNarxi, jami, qatorlar: 1, aniq })
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
    // Bir so'rovda bitta mahsulot ikki marta kelsa ham limitdan oshmasin
    const soralgan = new Map<string, number>()
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
      const qolganLimit = asl.miqdor - (oldinQaytarilgan.get(tovarId) ?? 0) - (soralgan.get(tovarId) ?? 0)
      soralgan.set(tovarId, (soralgan.get(tovarId) ?? 0) + miqdor)
      if (miqdor > qolganLimit + 1e-6) {
        return NextResponse.json(
          { xato: `Qaytariladigan miqdor sotilgandan oshib ketgan (tovar: ${tovarId}, limit: ${qolganLimit})` },
          { status: 400 }
        )
      }
      // ← Sotuv tarixidagi narx, client'dan emas. Bir nechta qator bo'lsa —
      // o'rtacha (to'langan summa / sotilgan miqdor)
      const birlikNarxi = asl.qatorlar > 1 && asl.miqdor > 0 ? Math.round(asl.jami / asl.miqdor * 100) / 100 : asl.birlikNarxi
      // Qaytarishda to'langan narx olinadi: 1 blok 70 000 ga sotilgan bo'lsa,
      // 60 dona qaytsa aynan 70 000 (1 166,67 × 60 = 70 000,20 emas)
      tasdiqlangan.push({
        tovarId,
        miqdor,
        birlikNarxi,
        jami: asl.aniq && asl.miqdor > 0 ? Math.round(miqdor * asl.jami / asl.miqdor * 100) / 100 : miqdor * birlikNarxi,
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

      // 4. Sodiqlik: shu xariddan olingan ball/keshbek qaytarib olinadi —
      //    aks holda mijoz tovarni qaytarib, u uchun berilgan ballni o'zida
      //    saqlab qolardi. Umumiy va chek qoidasidan kelgani — qaytarilgan
      //    summa ulushida; mahsulot qoidasidan kelgani — aynan o'sha mahsulotning
      //    qaytarilgan miqdori ulushida (lib/sodiqlik.ts qaytarishdaBekor).
      //    Balans allaqachon sarflangan bo'lsa manfiyga ketmaydi —
      //    balansOzgartir bor bo'lganini ayiradi.
      if (aslSotuv.mijozId) {
        const sotuvSummasi = Number(aslSotuv.yakuniySumma)
        if (sotuvSummasi > 0) {
          const ulush = Math.min(1, jamiSumma / sotuvSummasi)
          const sotilgan = new Map<string, number>()
          for (const st of aslSotuv.tarkiblar) {
            if (Number(st.jami) > 0) sotilgan.set(st.tovarId, (sotilgan.get(st.tovarId) ?? 0) + Number(st.miqdor))
          }
          const qaytarilgan = new Map<string, number>()
          for (const t of tasdiqlangan) qaytarilgan.set(t.tovarId, (qaytarilgan.get(t.tovarId) ?? 0) + t.miqdor)
          const toplanganlar = await tx.sodiqlikHarakati.findMany({
            where: { sotuvId: aslSotuvId, sabab: 'SOTUVDAN' },
            select: { hisob: true, miqdor: true, tafsilot: true },
          })
          for (const t of toplanganlar) {
            const yaxlit = qaytarishdaBekor({
              hisob: t.hisob,
              toplangan: Number(t.miqdor),
              tafsilot: tafsilotniOqi(t.tafsilot),
              summaUlushi: ulush,
              qaytarilgan,
              sotilgan,
            })
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
