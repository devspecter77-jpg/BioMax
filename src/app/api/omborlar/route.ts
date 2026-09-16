import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { egaFilialWhere } from '@/lib/filial-scope'

// OMBORLAR — kategoriyalarning ustki guruhi ("katta kategoriya").
// Iyerarxiya: Ombor → Kategoriya → Tovar.

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })

    const doira = egaFilialWhere(session)

    const [omborlar, omborsizKategoriyalar] = await Promise.all([
      prisma.ombor.findMany({
        where: doira,
        include: {
          kategoriyalar: {
            select: { id: true, nomi: true, _count: { select: { tovarlar: true } } },
            orderBy: { nomi: 'asc' },
          },
        },
        orderBy: [{ tartib: 'asc' }, { nomi: 'asc' }],
      }),
      // Omborga biriktirilmagan kategoriyalar — eski ma'lumot yoki yangi
      // yaratilgani. UI ularni "Ombor belgilanmagan" guruhida ko'rsatadi,
      // shunda ular ko'zdan qochib ketmaydi.
      prisma.kategoriya.findMany({
        where: { omborId: null, ...doira },
        select: { id: true, nomi: true, _count: { select: { tovarlar: true } } },
        orderBy: { nomi: 'asc' },
      }),
    ])

    return NextResponse.json({
      omborlar: omborlar.map(o => ({
        ...o,
        tovarSoni: o.kategoriyalar.reduce((s, k) => s + k._count.tovarlar, 0),
      })),
      omborsizKategoriyalar,
      boshqaraOladi: await amalRuxsatiBormi(session, 'omborlar.boshqarish'),
    })
  } catch (e) {
    console.error('[omborlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'omborlar.boshqarish'))) {
      return NextResponse.json({ xato: 'Bu amalga ruxsatingiz yo‘q: «Ombor va kategoriya boshqarish»', kod: 'ruxsat_yoq' }, { status: 403 })
    }

    const tana = await req.json()
    const nomi = String(tana.nomi ?? '').trim()
    if (!nomi) return NextResponse.json({ xato: 'Ombor nomi majburiy' }, { status: 400 })

    // Takroriy nomni QO'LDA tekshiramiz. Bazadagi @@unique([nomi, filialId,
    // egaId]) filialsiz (filialId = NULL) qatorlarni ushlamaydi — PostgreSQL
    // uchun NULL != NULL, ya'ni har bir NULL alohida hisoblanadi. Filialsiz
    // do'konda esa BARCHA omborlarning filialId'si NULL.
    const takror = await prisma.ombor.findFirst({
      where: { nomi: { equals: nomi, mode: 'insensitive' }, ...egaFilialWhere(session) },
      select: { id: true },
    })
    if (takror) {
      return NextResponse.json({ xato: 'Bunday nomli ombor allaqachon bor' }, { status: 400 })
    }

    const ombor = await prisma.ombor.create({
      data: {
        nomi: nomi.slice(0, 100),
        izoh: String(tana.izoh ?? '').trim().slice(0, 500) || null,
        tartib: Number.isFinite(Number(tana.tartib)) ? Number(tana.tartib) : 0,
        ...egaFilialWhere(session),
      },
      include: { kategoriyalar: { select: { id: true, nomi: true } } },
    })

    return NextResponse.json(ombor, { status: 201 })
  } catch (e) {
    // Bir doirada bir xil nomli ombor bo'lmasin
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ xato: 'Bunday nomli ombor allaqachon bor' }, { status: 400 })
    }
    console.error('[omborlar POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
