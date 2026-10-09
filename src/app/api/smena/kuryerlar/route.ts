import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { xodimlarDoirasi } from '@/lib/xodim-hisob'
import { smenaHolatlari } from '@/lib/smena-server'
import { SMENA_ROLLARI } from '@/lib/smena'
import { omborTuri, omborYetishmaydi } from '@/lib/ovoz-ombor'

// Bosh sahifadagi "Kuryerlar" bloki: kim hozir ishda, qachondan, ovoz
// yozilyaptimi. Faqat smenalarni ko'rish ruxsati borlarga.

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'xodimlar.smena'))) {
      return NextResponse.json({ xato: "Ruxsat yo'q", kod: 'ruxsat_yoq' }, { status: 403 })
    }
    const kuryerlar = await prisma.foydalanuvchi.findMany({
      where: { AND: [xodimlarDoirasi(session), { faol: true, rol: { in: [...SMENA_ROLLARI] } }] },
      select: { id: true, ism: true },
      orderBy: { ism: 'asc' },
    })
    const holatlar = await smenaHolatlari(kuryerlar.map(k => k.id))
    // Ombor holati — sozlash administratorning ishi, faqat unga
    const admin = (session.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const tayyor = omborTuri() !== null
    return NextResponse.json({
      kuryerlar: kuryerlar.map(k => ({ ...k, smena: holatlar.get(k.id) ?? null })),
      ...(admin ? { ombor: { tayyor, yetishmaydi: tayyor ? [] : omborYetishmaydi() } } : {}),
    })
  } catch (e) {
    console.error('[smena kuryerlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
