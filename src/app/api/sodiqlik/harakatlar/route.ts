import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { egaFilialWhere } from '@/lib/filial-scope'

// Harakatlar jurnali — qachon, kimga, qancha ball/keshbek qo'shilgani
// yoki sarflangani. Mijoz, hisob turi va sabab bo'yicha filtrlanadi.
const SABABLAR = ['SOTUVDAN', 'SARFLANDI', 'QAYTARISHDAN', 'QOLDA']

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mijozId = searchParams.get('mijozId') || undefined
    const hisob = searchParams.get('hisob')
    const sabab = searchParams.get('sabab')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    const where: Record<string, unknown> = { mijoz: egaFilialWhere(session) }
    if (mijozId) where.mijozId = mijozId
    if (hisob === 'BALL' || hisob === 'KESHBEK') where.hisob = hisob
    if (sabab && SABABLAR.includes(sabab)) where.sabab = sabab

    const [harakatlar, jami] = await Promise.all([
      prisma.sodiqlikHarakati.findMany({
        where,
        include: {
          mijoz: { select: { id: true, ism: true, telefon: true } },
          sotuv: { select: { chekRaqami: true, yakuniySumma: true } },
          foydalanuvchi: { select: { ism: true } },
        },
        orderBy: { sana: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sodiqlikHarakati.count({ where }),
    ])

    return NextResponse.json({
      harakatlar,
      pagination: { page, limit, jami, sahifalar: Math.ceil(jami / limit) },
    })
  } catch (e) {
    console.error('[sodiqlik/harakatlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
