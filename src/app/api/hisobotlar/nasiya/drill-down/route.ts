import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { agingBucket, type AgingBucket } from '@/lib/hisobotlar'
import { egaFilialWhere } from '@/lib/filial-scope'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bucket = (searchParams.get('bucket') || 'b_0_30') as AgingBucket

  const nasiyalar = await prisma.nasiya.findMany({
    where: {
      ochirilgan: false,
      holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] },
      qoldiq: { gt: 0 },
      mijoz: egaFilialWhere(session),
    },
    include: {
      mijoz: { select: { id: true, ism: true, telefon: true, manzil: true } },
      sotuv: { select: { chekRaqami: true, sana: true } },
    },
  })

  const bugun = new Date()
  bugun.setHours(0, 0, 0, 0)

  const filtered = nasiyalar
    .map((n) => {
      const b = agingBucket(n.muddat, bugun)
      const kechikkanKun = n.muddat
        ? Math.max(
            0,
            Math.floor(
              (bugun.getTime() - new Date(n.muddat).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0
      return {
        id: n.id,
        mijoz: n.mijoz,
        sotuv: n.sotuv
          ? { chekRaqami: n.sotuv.chekRaqami, sana: n.sotuv.sana.toISOString() }
          : null,
        jamiQarz: Number(n.jamiQarz),
        tolangan: Number(n.tolangan),
        qoldiq: Number(n.qoldiq),
        muddat: n.muddat?.toISOString() ?? null,
        sana: n.sana.toISOString(),
        kechikkanKun,
        _bucket: b,
      }
    })
    .filter((n) => n._bucket === bucket)
    .sort((a, b) => b.kechikkanKun - a.kechikkanKun || b.qoldiq - a.qoldiq)
    .map(({ _bucket, ...rest }) => rest)

  const jamiQoldiq = filtered.reduce((s, n) => s + n.qoldiq, 0)

  return NextResponse.json({
    bucket,
    jamiQoldiq,
    soni: filtered.length,
    nasiyalar: filtered,
  })
}
