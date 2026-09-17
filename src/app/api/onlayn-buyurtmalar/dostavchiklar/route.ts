import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { onlaynRuxsat } from '@/lib/onlayn-buyurtma-server'
import { DOSTAVCHIK_DOIRASI } from '@/lib/dostavchik-server'
import { FAOL_YETKAZISH } from '@/lib/dostavchik'

export const dynamic = 'force-dynamic'

// Buyurtmaga biriktirish uchun faol dostavchiklar: kim hozir nechta buyurtma bilan band.
export async function GET() {
  const r = await onlaynRuxsat('onlayn-buyurtmalar.kuryer')
  if (!r.ok) return r.javob
  try {
    const royxat = await prisma.foydalanuvchi.findMany({
      where: { ...DOSTAVCHIK_DOIRASI, faol: true },
      orderBy: { ism: 'asc' },
      select: {
        id: true, ism: true, telefon: true, lokatsiyaYangilangan: true,
        dostavchikProfili: { select: { transportTuri: true, transportNomi: true } },
        _count: { select: { yetkazishlari: { where: { holati: { in: FAOL_YETKAZISH } } } } },
      },
    })
    return NextResponse.json(royxat.map(d => ({
      id: d.id,
      ism: d.ism,
      telefon: d.telefon,
      transportTuri: d.dostavchikProfili?.transportTuri ?? null,
      transportNomi: d.dostavchikProfili?.transportNomi ?? null,
      band: d._count.yetkazishlari,
      lokatsiyaYangilangan: d.lokatsiyaYangilangan?.toISOString() ?? null,
    })))
  } catch (e) {
    console.error('[onlayn-buyurtmalar/dostavchiklar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
