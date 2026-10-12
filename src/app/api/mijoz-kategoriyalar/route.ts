import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { barchaMijozlarniKoradi, kategoriyaDoirasi, mijozDoirasi, mijozTenant, xodimDoirasi } from '@/lib/mijoz-doirasi'
import { RANGLAR } from '@/lib/mijoz-kategoriya'
import { kategoriyaMalumoti } from '@/lib/mijoz-kategoriya-server'

export const dynamic = 'force-dynamic'

// Mijozlar kategoriyalari.
//
//   GET  — foydalanuvchi ko'radigan kategoriyalar va har birida nechta mijoz
//          (o'ziga ko'rinadiganlari). Administratorga qo'shimcha: kimga
//          ochiqligi va mas'ul tanlash uchun xodimlar ro'yxati.
//   POST — yangi kategoriya (faqat administrator — proxy ham tekshiradi).

const xato = (xabar: string, holat = 400) => NextResponse.json({ xato: xabar }, { status: holat })

export async function GET() {
  try {
    const session = await auth()
    if (!session) return xato("Ruxsat yo'q", 401)
    const admin = (session.user as { rol?: string }).rol === 'ADMIN'

    const [kategoriyalar, sanoq, kategoriyasiz, hammasi] = await Promise.all([
      prisma.mijozKategoriya.findMany({
        where: await kategoriyaDoirasi(session),
        orderBy: [{ nomi: 'asc' }],
        select: {
          id: true, nomi: true, rang: true, hammaga: true,
          ...(admin ? { xodimlar: { select: { foydalanuvchiId: true } } } : {}),
        },
      }),
      prisma.mijoz.groupBy({ by: ['kategoriyaId'], where: await mijozDoirasi(session), _count: { _all: true } }),
      prisma.mijoz.count({ where: { AND: [await mijozDoirasi(session), { kategoriyaId: null }] } }),
      barchaMijozlarniKoradi(session),
    ])
    const soni = new Map(sanoq.map(s => [s.kategoriyaId, s._count._all]))

    // Administrator: mas'ul tanlash va kategoriyani ochish uchun xodimlar
    const xodimlar = admin
      ? await prisma.foydalanuvchi.findMany({
          where: { AND: [xodimDoirasi(session), { rol: { not: 'ADMIN' } }] },
          orderBy: [{ faol: 'desc' }, { ism: 'asc' }],
          select: { id: true, ism: true, rol: true, faol: true },
        })
      : []
    // Mas'ul xodimi yo'q va kategoriyasi yopiq — faqat administratorlarga ko'rinadi
    const faqatAdmin = admin
      ? await prisma.mijoz.count({
          where: {
            AND: [mijozTenant(session), { masulId: null }, { OR: [{ kategoriyaId: null }, { kategoriya: { hammaga: false, xodimlar: { none: {} } } }] }],
          },
        })
      : 0

    return NextResponse.json({
      kategoriyalar: kategoriyalar.map(k => ({
        id: k.id, nomi: k.nomi, rang: k.rang, hammaga: k.hammaga,
        mijozlar: soni.get(k.id) ?? 0,
        ...('xodimlar' in k ? { xodimIdlar: (k.xodimlar as { foydalanuvchiId: string }[]).map(x => x.foydalanuvchiId) } : {}),
      })),
      kategoriyasiz,
      /** Foydalanuvchi barcha mijozlarni ko'radimi (aks holda — o'ziniki va ochilgan kategoriyalar) */
      hammasi,
      xodimlar,
      faqatAdmin,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[mijoz-kategoriyalar GET]', e)
    return xato('Server xatosi', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return xato("Ruxsat yo'q", 401)
    if ((session.user as { rol?: string }).rol !== 'ADMIN') return xato('Kategoriyani faqat administrator yaratadi', 403)

    const tana = await req.json().catch(() => null)
    const m = await kategoriyaMalumoti(session, tana, null)
    if (!m.ok) return xato(m.xato, m.holat)
    if (!m.nomi) return xato('Kategoriya nomini yozing')

    const k = await prisma.mijozKategoriya.create({
      data: {
        ...mijozTenant(session),
        nomi: m.nomi,
        rang: m.rang ?? RANGLAR[0],
        hammaga: m.hammaga ?? false,
        ...(m.xodimIdlar?.length ? { xodimlar: { create: m.xodimIdlar.map(foydalanuvchiId => ({ foydalanuvchiId })) } } : {}),
      },
      select: { id: true },
    })
    return NextResponse.json({ ok: true, id: k.id }, { status: 201 })
  } catch (e) {
    console.error('[mijoz-kategoriyalar POST]', e)
    return xato('Server xatosi', 500)
  }
}
