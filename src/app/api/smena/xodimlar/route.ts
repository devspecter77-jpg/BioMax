import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { amalRuxsatiBormi } from '@/lib/ruxsat-server'
import { samaraliRuxsatlar } from '@/lib/ruxsat-katalogi'
import { xodimlarDoirasi } from '@/lib/xodim-hisob'
import { smenaHolatlari } from '@/lib/smena-server'
import { ovozYozilsinmi, smenaKerakmi } from '@/lib/smena'
import { omborTuri, omborYetishmaydi } from '@/lib/ovoz-ombor'

// Bosh sahifadagi "Ish smenasi" bloki: smena yurituvchi xodimlar (kuryerlar va
// ovoz yozish ruxsati ochiqlar) hozir ishdami, qachondan, ovoz yozilyaptimi.
// Faqat smenalarni ko'rish ruxsati borlarga.

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!(await amalRuxsatiBormi(session, 'xodimlar.smena'))) {
      return NextResponse.json({ xato: "Ruxsat yo'q", kod: 'ruxsat_yoq' }, { status: 403 })
    }
    const hammasi = await prisma.foydalanuvchi.findMany({
      where: { AND: [xodimlarDoirasi(session), { faol: true, rol: { not: 'ADMIN' } }] },
      select: { id: true, ism: true, rol: true, ruxsatlar: { select: { bolim: true, korinadi: true } } },
      orderBy: { ism: 'asc' },
    })
    // Ruxsat sessiyadagidek hisoblanadi (rol standarti + Ega o'zgartirgani)
    const xodimlar = hammasi.flatMap(x => {
      const r = samaraliRuxsatlar(x.rol, new Map(x.ruxsatlar.map(q => [q.bolim, q.korinadi])))
      return smenaKerakmi(x.rol, r) ? [{ id: x.id, ism: x.ism, rol: x.rol, ovoz: ovozYozilsinmi(x.rol, r) }] : []
    })
    const holatlar = await smenaHolatlari(xodimlar.map(k => k.id))
    // Ombor holati — sozlash administratorning ishi, faqat unga
    const admin = (session.user as { rol?: string } | undefined)?.rol === 'ADMIN'
    const tayyor = omborTuri() !== null
    return NextResponse.json({
      xodimlar: xodimlar.map(k => ({ ...k, smena: holatlar.get(k.id) ?? null })),
      ...(admin ? { ombor: { tayyor, yetishmaydi: tayyor ? [] : omborYetishmaydi() } } : {}),
    })
  } catch (e) {
    console.error('[smena xodimlar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
