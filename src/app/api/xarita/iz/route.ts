import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { xaritaRuxsati } from '@/lib/xarita-server'
import { IZ_SAQLASH_KUN, bugungiKun, izniTahlil, kunOraligi } from '@/lib/lokatsiya-izi'

// Xodimning bir kunlik yurgan yo'li (Xarita › xodim › «Yurgan yo'li»):
// uzluksiz bo'laklar, ilova yopiq bo'lgan oraliqlar, to'xtagan joylari va
// yurgan masofasi. `kunlar` — oxirgi IZ_SAQLASH_KUN ichida izi bor kunlar
// (sana tanlagichda belgilanadi).

export const dynamic = 'force-dynamic'

/** Bir kunda shundan ko'p nuqta bo'lmaydi (har 10 s da bittadan ham ~8600). */
const MAX_NUQTA = 20_000

export async function GET(req: NextRequest) {
  const r = await xaritaRuxsati()
  if (!r.ok) return r.javob

  const sp = req.nextUrl.searchParams
  const xodimId = sp.get('xodimId') ?? ''
  const kun = sp.get('kun') || bugungiKun()
  const oraliq = kunOraligi(kun)
  if (!xodimId || !oraliq) return NextResponse.json({ xato: 'Xodim yoki sana noto‘g‘ri' }, { status: 400 })

  try {
    const xodim = await prisma.foydalanuvchi.findUnique({ where: { id: xodimId }, select: { id: true, ism: true, rol: true } })
    if (!xodim) return NextResponse.json({ xato: 'Xodim topilmadi' }, { status: 404 })

    const [qatorlar, kunlar] = await Promise.all([
      prisma.lokatsiyaIzi.findMany({
        where: { xodimId, vaqt: { gte: new Date(oraliq[0]), lt: new Date(oraliq[1]) } },
        orderBy: { vaqt: 'asc' },
        select: { lat: true, lng: true, vaqt: true, aniqlik: true },
        take: MAX_NUQTA,
      }),
      // Toshkent kuni (UTC+5) bo'yicha — izi bor kunlar
      prisma.$queryRaw<{ kun: string }[]>`
        SELECT DISTINCT to_char(vaqt + interval '5 hours', 'YYYY-MM-DD') AS kun
        FROM public.lokatsiya_izlari
        WHERE "xodimId" = ${xodimId} AND vaqt >= ${new Date(Date.now() - IZ_SAQLASH_KUN * 86_400_000)}
        ORDER BY kun DESC`,
    ])
    const nuqtalar = qatorlar.map(q => ({ lat: q.lat, lng: q.lng, vaqt: q.vaqt.getTime(), aniqlik: q.aniqlik }))
    const t = izniTahlil(nuqtalar)
    const oxirgi = nuqtalar[nuqtalar.length - 1] ?? null

    return NextResponse.json({
      xodim,
      kun,
      kunlar: kunlar.map(k => k.kun),
      nuqtalarSoni: nuqtalar.length,
      bolaklar: t.bolaklar,
      uzilishlar: t.uzilishlar,
      toxtashlar: t.toxtashlar,
      masofaM: Math.round(t.masofaM),
      boshi: t.boshi,
      oxiri: t.oxiri,
      oxirgiNuqta: oxirgi ? { lat: oxirgi.lat, lng: oxirgi.lng, vaqt: oxirgi.vaqt } : null,
      hozir: Date.now(),
    })
  } catch (e) {
    console.error('[xarita iz]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
