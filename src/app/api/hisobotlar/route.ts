import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const rol = (session?.user as any)?.rol
    const kassirId = rol === 'KASSIR' ? session?.user?.id : null

    const { searchParams } = new URL(req.url)
    const tur = searchParams.get('tur') || 'kunlik'
    const dan = searchParams.get('dan')
    const gacha = searchParams.get('gacha')

    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)
    const ertasi = new Date(bugun)
    ertasi.setDate(ertasi.getDate() + 1)

    let danSana = bugun
    let gachaSana = ertasi

    if (dan && gacha) {
      danSana = new Date(dan)
      gachaSana = new Date(gacha)
      gachaSana.setHours(23, 59, 59)
    } else if (tur === 'haftalik') {
      danSana = new Date(bugun)
      danSana.setDate(danSana.getDate() - 7)
    } else if (tur === 'oylik') {
      danSana = new Date(bugun)
      danSana.setDate(1)
    } else if (tur === 'yillik') {
      danSana = new Date(bugun)
      danSana.setMonth(0, 1) // 1-yanvar
    }

    const sotuvFilter = {
      holati: 'YAKUNLANGAN' as const,
      sana: { gte: danSana, lt: gachaSana },
      tolovUsuli: { not: 'SHERIK' as const },
      ...(kassirId ? { kassirId } : {}),
      ...egaFilialWhere(session),
    }

    const qaytarishSumma = await prisma.qaytarish.aggregate({
      where: {
        yaratilgan: { gte: danSana, lt: gachaSana },
        aslSotuv: egaFilialWhere(session),
      },
      _sum: { jamiSumma: true },
    })
    const jamiQaytarish = Number(qaytarishSumma._sum.jamiSumma || 0)

    const [sotuvlar, xarajatlar, nasiyalar, topTovarlar] = await Promise.all([
      prisma.sotuv.findMany({
        where: sotuvFilter,
        include: {
          tarkiblar: {
            include: { tovar: { select: { kelishNarxi: true } } },
          },
        },
      }),
      prisma.xarajat.findMany({
        where: { sana: { gte: danSana, lt: gachaSana }, ...egaFilialWhere(session) },
        select: { summa: true, kategoriya: true },
      }),
      prisma.nasiya.findMany({
        where: {
          holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] },
          mijoz: egaFilialWhere(session),
        },
        select: { qoldiq: true, holati: true },
      }),
      prisma.sotuvTarkibi.groupBy({
        by: ['tovarId'],
        _sum: { miqdor: true, jami: true },
        where: { sotuv: sotuvFilter },
        orderBy: { _sum: { jami: 'desc' } },
        take: 10,
      }),
    ])

    const jamiSotuv = sotuvlar.reduce((s, v) => s + Number(v.yakuniySumma), 0) - jamiQaytarish
    const jamiXarajat = xarajatlar.reduce((s, x) => s + Number(x.summa), 0)

    // Foyda: (sotish narxi - kelish narxi) * miqdor
    let jamiDaromad = 0
    for (const sotuv of sotuvlar) {
      for (const tarkib of sotuv.tarkiblar) {
        const foyda =
          (Number(tarkib.birlikNarxi) - Number(tarkib.tovar.kelishNarxi)) *
          Number(tarkib.miqdor)
        jamiDaromad += foyda
      }
    }
    const soFoyda = jamiDaromad - jamiXarajat

    const ochiqNasiyalar = nasiyalar.filter((n) => n.holati === 'OCHIQ').length
    const muddatiOtgan = nasiyalar.filter((n) => n.holati === 'MUDDATI_OTGAN').length
    const jamiNasiyaQarz = nasiyalar.reduce((s, n) => s + Number(n.qoldiq), 0)

    // Top tovarlar nomi bilan
    const tovarIds = topTovarlar.map((t) => t.tovarId)
    const tovarlar = await prisma.tovar.findMany({
      where: { id: { in: tovarIds } },
      select: { id: true, nomi: true, birlik: true },
    })

    const topTovarlarNomi = topTovarlar.map((t) => {
      const tovar = tovarlar.find((tv) => tv.id === t.tovarId)
      return {
        tovarId: t.tovarId,
        nomi: tovar?.nomi || 'Noma\'lum',
        birlik: tovar?.birlik || 'DONA',
        jami_miqdor: Number(t._sum.miqdor),
        jami_summa: Number(t._sum.jami),
      }
    })

    // Sotuv dinamikasi grafigi — davr bo'yicha avtomatik
    // Yillikda oy bo'yicha, qolganlarda kun bo'yicha guruhlash
    const grafikData: Array<{ sana: string; sotuv: number; sotuvSoni: number }> = []
    if (tur === 'yillik') {
      // 12 oy
      for (let m = 0; m < 12; m++) {
        const oyBosh = new Date(danSana)
        oyBosh.setMonth(m, 1)
        oyBosh.setHours(0, 0, 0, 0)
        const oyOxir = new Date(oyBosh)
        oyOxir.setMonth(m + 1, 1)
        if (oyBosh > gachaSana) break
        const oySotuv = sotuvlar.filter((s) => {
          const sana = new Date(s.sana)
          return sana >= oyBosh && sana < oyOxir
        })
        grafikData.push({
          sana: oyBosh.toLocaleDateString('uz-UZ', { month: 'short' }),
          sotuv: oySotuv.reduce((s, v) => s + Number(v.yakuniySumma), 0),
          sotuvSoni: oySotuv.length,
        })
      }
    } else {
      // Kunlik (kunlik/haftalik/oylik/maxsus)
      const kunlar = Math.max(1, Math.ceil((gachaSana.getTime() - danSana.getTime()) / (1000 * 60 * 60 * 24)))
      const maxKunlar = 62 // ko'pi bilan 62 kun ko'rsatiladi (oylik uchun)
      const showKunlar = Math.min(kunlar, maxKunlar)
      for (let i = showKunlar - 1; i >= 0; i--) {
        const kun = new Date(gachaSana)
        kun.setDate(kun.getDate() - i)
        kun.setHours(0, 0, 0, 0)
        const ertasiKun = new Date(kun)
        ertasiKun.setDate(ertasiKun.getDate() + 1)

        const kunSotuv = sotuvlar.filter((s) => {
          const sana = new Date(s.sana)
          return sana >= kun && sana < ertasiKun
        })

        grafikData.push({
          sana: kun.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }),
          sotuv: kunSotuv.reduce((s, v) => s + Number(v.yakuniySumma), 0),
          sotuvSoni: kunSotuv.length,
        })
      }
    }

    return NextResponse.json({
      isKassir: !!kassirId,
      jamiSotuv,
      jamiQaytarish,
      jamiXarajat: kassirId ? 0 : jamiXarajat,
      jamiDaromad: kassirId ? 0 : jamiDaromad,
      soFoyda: kassirId ? 0 : soFoyda,
      sotuvSoni: sotuvlar.length,
      ochiqNasiyalar: kassirId ? 0 : ochiqNasiyalar,
      muddatiOtgan: kassirId ? 0 : muddatiOtgan,
      jamiNasiyaQarz: kassirId ? 0 : jamiNasiyaQarz,
      topTovarlar: topTovarlarNomi,
      grafikData,
      xarajatlarKategoriya: xarajatlar.reduce(
        (acc, x) => {
          acc[x.kategoriya] = (acc[x.kategoriya] || 0) + Number(x.summa)
          return acc
        },
        {} as Record<string, number>
      ),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
