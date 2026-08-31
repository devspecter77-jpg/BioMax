import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { agingBucket, type AgingBucket } from '@/lib/hisobotlar'
import { sessionFilialId } from '@/lib/filial-scope'

const BUCKET_LABEL: Record<AgingBucket, string> = {
  kechikmagan: 'Kechikmagan',
  b_0_30: '0-30 kun',
  b_31_60: '31-60 kun',
  b_61_90: '61-90 kun',
  b_90_plus: '90+ kun',
}

const BUCKET_ORDER: AgingBucket[] = [
  'kechikmagan',
  'b_0_30',
  'b_31_60',
  'b_61_90',
  'b_90_plus',
]

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const rol = (session.user as { rol?: string })?.rol
    if (rol === 'KASSIR') {
      return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })
    }

    // date params accepted for API consistency — aging is snapshot-based (current state)

    const bugun = new Date()
    bugun.setHours(0, 0, 0, 0)
    const filialId = sessionFilialId(session)

    // Ochiq va muddati o'tgan nasiyalar, qoldiq > 0
    const nasiyalar = await prisma.nasiya.findMany({
      where: {
        holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] },
        qoldiq: { gt: 0 },
        ochirilgan: false,
        ...(filialId ? { mijoz: { filialId } } : {}),
      },
      select: {
        id: true,
        holati: true,
        qoldiq: true,
        muddat: true,
        sana: true,
        mijoz: {
          select: {
            ism: true,
          },
        },
      },
      orderBy: { qoldiq: 'desc' },
    })

    // Aging bucket hisoblash
    const bucketMap = new Map<AgingBucket, { count: number; summa: number }>()
    for (const b of BUCKET_ORDER) {
      bucketMap.set(b, { count: 0, summa: 0 })
    }

    let ochiqNasiyalar = 0
    let muddatiOtgan = 0
    let jamiQarz = 0

    for (const n of nasiyalar) {
      const qoldiq = Number(n.qoldiq)
      jamiQarz += qoldiq

      if (n.holati === 'OCHIQ') ochiqNasiyalar++
      if (n.holati === 'MUDDATI_OTGAN') muddatiOtgan++

      const bucket = agingBucket(n.muddat, bugun)
      const entry = bucketMap.get(bucket)!
      entry.count += 1
      entry.summa += qoldiq
    }

    const agingBuckets = BUCKET_ORDER.map((key) => {
      const entry = bucketMap.get(key)!
      return {
        label: BUCKET_LABEL[key],
        count: entry.count,
        summa: Math.round(entry.summa),
      }
    }).filter((b) => b.count > 0 || b.label === BUCKET_LABEL['kechikmagan'])
      // Filter out empty buckets except kechikmagan for cleaner display
      .filter((b) => b.count > 0)

    // Top 20 qarzdor
    const topQarzdorlar = nasiyalar.slice(0, 20).map((n) => {
      const kunlarOtgan = n.muddat
        ? Math.max(0, Math.floor((bugun.getTime() - new Date(n.muddat).getTime()) / (1000 * 60 * 60 * 24)))
        : 0

      return {
        nasiyaId: n.id,
        mijozIsm: n.mijoz.ism,
        qoldiq: Number(n.qoldiq),
        muddat: n.muddat ? new Date(n.muddat).toISOString().slice(0, 10) : null,
        kunlarOtgan,
      }
    })

    return NextResponse.json({
      agingBuckets,
      topQarzdorlar,
      ochiqNasiyalar,
      muddatiOtgan,
      jamiQarz: Math.round(jamiQarz),
    })
  } catch (e) {
    console.error('[hisobotlar/nasiya-aging]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
