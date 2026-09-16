import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { qoshimchaTelefonBoyichaIdlar } from '@/lib/mijoz-telefon-server'
import { egaFilialWhere } from '@/lib/filial-scope'
import { toKirill, toLotin } from '@/lib/utils'

// "Ballar va keshbeklar" bo'limining asosiy jadvali — mijozlar va
// ularning ikkita balansi.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const qidiruv = (searchParams.get('q') || '').trim()
    // Standart holatda faqat balansi bor mijozlar — jadval nol qatorlar
    // bilan to'lib ketmasin. "barchasi=true" bilan hammasi ko'rinadi.
    const faqatBalansli = searchParams.get('barchasi') !== 'true'

    const shartlar: Record<string, unknown>[] = [egaFilialWhere(session) as Record<string, unknown>]

    if (faqatBalansli) {
      shartlar.push({ OR: [{ ballBalans: { gt: 0 } }, { keshbekBalans: { gt: 0 } }] })
    }

    if (qidiruv) {
      const nomlar = Array.from(new Set([qidiruv, toKirill(qidiruv), toLotin(qidiruv)]))
      const qoshimchaIdlar = await qoshimchaTelefonBoyichaIdlar(qidiruv)
      shartlar.push({
        OR: [
          ...(qoshimchaIdlar.length ? [{ id: { in: qoshimchaIdlar } }] : []),
          ...nomlar.map(n => ({ ism: { contains: n, mode: 'insensitive' as const } })),
          { telefon: { contains: qidiruv } },
          { telefon2: { contains: qidiruv } },
          { maxsus_kod: { contains: qidiruv } },
        ],
      })
    }

    const where = { AND: shartlar }

    const [mijozlar, yigindi] = await Promise.all([
      prisma.mijoz.findMany({
        where,
        select: {
          id: true, ism: true, telefon: true, telefon2: true,
          viloyat: true, tuman: true, maxsus_kod: true,
          ballBalans: true, keshbekBalans: true,
          _count: { select: { sotuvlar: true } },
        },
        orderBy: [{ keshbekBalans: 'desc' }, { ballBalans: 'desc' }, { ism: 'asc' }],
        take: 300,
      }),
      // Umumiy yakun — do'kon mijozlar oldida qancha "majburiyat"
      // to'plaganini ko'rsatadi.
      prisma.mijoz.aggregate({
        where: egaFilialWhere(session),
        _sum: { ballBalans: true, keshbekBalans: true },
      }),
    ])

    return NextResponse.json({
      mijozlar,
      yigindi: {
        ball: Number(yigindi._sum.ballBalans || 0),
        keshbek: Number(yigindi._sum.keshbekBalans || 0),
      },
    })
  } catch (e) {
    console.error('[sodiqlik/mijozlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
