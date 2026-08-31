import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionFilialId } from '@/lib/filial-scope'
import { YASHIRILADIGAN_MAYDONLAR } from '@/lib/maydon-yashirish'

const RUXSAT_ETILGAN_KALITLAR = new Set(YASHIRILADIGAN_MAYDONLAR.map(m => m.kalit as string))

async function ruxsatniTekshirish(id: string) {
  const session = await auth()
  if (!session || (session.user as any)?.rol !== 'ADMIN') return null
  const ownFilialId = sessionFilialId(session)
  if (ownFilialId) {
    const nishon = await prisma.foydalanuvchi.findUnique({ where: { id }, select: { filialId: true } })
    if (!nishon || nishon.filialId !== ownFilialId) return null
  }
  return session
}

// Ushbu foydalanuvchidan yashirilgan maydonlar (masalan kelishNarxi) va
// tahrirlash/o'chirish ruxsatlari (faqat ulashilgan admin uchun ma'noli)
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await ruxsatniTekshirish(id)
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const [yozuvlar, foydalanuvchi] = await Promise.all([
      prisma.maydonYashirish.findMany({ where: { foydalanuvchiId: id }, select: { maydon: true } }),
      prisma.foydalanuvchi.findUnique({ where: { id }, select: { tovarTahrirlashMumkin: true, tovarOchirishMumkin: true } }),
    ])
    return NextResponse.json({
      maydonlar: yozuvlar.map(y => y.maydon),
      tahrirlashMumkin: foydalanuvchi?.tovarTahrirlashMumkin ?? true,
      ochirishMumkin: foydalanuvchi?.tovarOchirishMumkin ?? true,
    })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

// To'liq ro'yxatni almashtirish — { maydonlar: string[], tahrirlashMumkin, ochirishMumkin }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await ruxsatniTekshirish(id)
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const { maydonlar, tahrirlashMumkin, ochirishMumkin } = await req.json()
    if (!Array.isArray(maydonlar)) {
      return NextResponse.json({ xato: "Noto'g'ri ma'lumot" }, { status: 400 })
    }
    const toza = maydonlar.filter((m: unknown): m is string => typeof m === 'string' && RUXSAT_ETILGAN_KALITLAR.has(m))

    await prisma.$transaction([
      prisma.maydonYashirish.deleteMany({ where: { foydalanuvchiId: id } }),
      ...(toza.length > 0
        ? [prisma.maydonYashirish.createMany({
            data: toza.map((maydon: string) => ({ maydon, foydalanuvchiId: id })),
            skipDuplicates: true,
          })]
        : []),
      prisma.foydalanuvchi.update({
        where: { id },
        data: {
          tovarTahrirlashMumkin: typeof tahrirlashMumkin === 'boolean' ? tahrirlashMumkin : true,
          tovarOchirishMumkin: typeof ochirishMumkin === 'boolean' ? ochirishMumkin : true,
        },
      }),
    ])

    return NextResponse.json({ ok: true, soni: toza.length })
  } catch {
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
