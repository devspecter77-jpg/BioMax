import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'

export const dynamic = 'force-dynamic'

// Onlayn do'kon sahifasida ko'rinadigan aloqa ma'lumotlari. Chekdagi bilan
// bir xil kalitlar. Faqat shu uch kalit — umumiy /api/sozlamalar orqali emas.
const KALITLAR = ['telefon', 'manzil', 'ish_vaqti', 'qaytarish_shartlari'] as const

export async function GET() {
  const r = await onlaynRuxsat()
  if (!r.ok) return r.javob
  const q = await prisma.sozlama.findMany({ where: { kalit: { in: [...KALITLAR] } } })
  return NextResponse.json(Object.fromEntries(KALITLAR.map(k => [k, q.find(x => x.kalit === k)?.qiymat ?? ''])))
}

export async function PUT(req: NextRequest) {
  const r = await onlaynRuxsat()
  if (!r.ok) return r.javob
  if ((r.session.user as { rol?: string }).rol !== 'ADMIN') {
    return NextResponse.json({ xato: "Faqat administrator o'zgartira oladi" }, { status: 403 })
  }
  let tana: Record<string, unknown>
  try {
    tana = await req.json()
  } catch {
    return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })
  }
  await prisma.$transaction(KALITLAR.map(k => {
    const maks = k === 'qaytarish_shartlari' ? 2000 : 200
    const qiymat = typeof tana[k] === 'string' ? (tana[k] as string).trim().slice(0, maks) : ''
    return prisma.sozlama.upsert({ where: { kalit: k }, update: { qiymat }, create: { kalit: k, qiymat } })
  }))
  return NextResponse.json({ ok: true })
}
