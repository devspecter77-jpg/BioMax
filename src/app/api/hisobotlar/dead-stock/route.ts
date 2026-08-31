import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const rol = (session.user as { rol?: string })?.rol
    if (rol === 'KASSIR') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }
    const filialId = sessionFilialId(session)

    // Dead stock: date filter params are accepted but not used for filtering
    // (we look at all-time last sale date, regardless of report period)

    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)

    // Barcha faol tovarlar + oxirgi sotuv sanasi + hozirgi qoldiq
    const tovarlar = await prisma.tovar.findMany({
      where: { holati: 'FAOL', ...(filialId ? { filialId } : {}) },
      select: {
        id: true,
        nomi: true,
        birlik: true,
        kelishNarxi: true,
        sotuvTarkibi: {
          select: {
            sotuv: {
              select: { sana: true, holati: true },
            },
          },
          orderBy: {
            sotuv: { sana: 'desc' },
          },
          take: 1,
        },
        omborHarakati: {
          select: {
            turi: true,
            miqdor: true,
          },
        },
      },
    })

    const THRESHOLD_KUN = 30

    const result = []

    for (const t of tovarlar) {
      // Hozirgi qoldiq: KIRIM + QAYTARISH - CHIQIM - YOQOTISH
      let qoldiq = 0
      for (const h of t.omborHarakati) {
        const m = Number(h.miqdor)
        if (h.turi === 'KIRIM' || h.turi === 'QAYTARISH') {
          qoldiq += m
        } else if (h.turi === 'CHIQIM' || h.turi === 'YOQOTISH') {
          qoldiq -= m
        }
        // OTKAZMA - e'tiborga olinmaydi (ichki ko'chirish)
      }

      if (qoldiq <= 0) continue // Qoldiq yo'q tovarlar dead stock emas

      // Oxirgi yakunlangan sotuv
      const oxirgiSotuvTarkib = t.sotuvTarkibi.find(
        (st) => st.sotuv.holati === 'YAKUNLANGAN',
      )
      const oxirgiSotuvSana = oxirgiSotuvTarkib?.sotuv.sana ?? null

      let kunlarSon: number
      if (!oxirgiSotuvSana) {
        // Hech qachon sotilmagan — juda katta qiymat
        kunlarSon = 9999
      } else {
        kunlarSon = Math.floor(
          (bugun.getTime() - new Date(oxirgiSotuvSana).getTime()) / (1000 * 60 * 60 * 24),
        )
      }

      if (kunlarSon < THRESHOLD_KUN) continue // 30 kundan kam — dead stock emas

      result.push({
        tovarId: t.id,
        nomi: t.nomi,
        qoldiq: Math.round(qoldiq * 1000) / 1000,
        birlik: t.birlik,
        oxirgiSotuv: oxirgiSotuvSana ? new Date(oxirgiSotuvSana).toISOString().slice(0, 10) : null,
        kunlarSon: kunlarSon === 9999 ? 9999 : kunlarSon,
      })
    }

    // Eng ko'p kundan beri sotilmaganlar birinchi
    result.sort((a, b) => b.kunlarSon - a.kunlarSon)

    return NextResponse.json({ tovarlar: result })
  } catch (e) {
    console.error('[hisobotlar/dead-stock]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
