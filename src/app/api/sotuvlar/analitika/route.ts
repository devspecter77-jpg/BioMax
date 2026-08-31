import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { hisoblaOrtachaChek, soatTaqsimoti } from '@/lib/analitika'
import type { TolovUsuli } from '@prisma/client'
import { egaFilialWhere } from '@/lib/filial-scope'

const TOP_N = 20

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: 'Ruxsat yo\'q' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const dan = searchParams.get('dan')
    const gacha = searchParams.get('gacha')
    const kassirId = searchParams.get('kassirId') || undefined
    const mijozId = searchParams.get('mijozId') || undefined
    const tolovUsuli = (searchParams.get('tolovUsuli') as TolovUsuli | null) || undefined

    const bugun = new Date()
    bugun.setHours(23, 59, 59, 999)
    const oyBoshi = new Date(bugun)
    oyBoshi.setDate(1)
    oyBoshi.setHours(0, 0, 0, 0)

    const danSana = dan ? new Date(dan) : oyBoshi
    const gachaSana = gacha ? new Date(gacha) : bugun
    if (gacha) gachaSana.setHours(23, 59, 59, 999)

    const joriySotuvWhere = {
      holati: 'YAKUNLANGAN' as const,
      sana: { gte: danSana, lte: gachaSana },
      tolovUsuli: tolovUsuli ?? { not: 'SHERIK' as const },
      ...(kassirId ? { kassirId } : {}),
      ...(mijozId ? { mijozId } : {}),
      ...egaFilialWhere(session),
    }

    const [joriySotuvlar, qaytarishSum, topTarkiblar] = await Promise.all([
      prisma.sotuv.findMany({
        where: joriySotuvWhere,
        include: {
          tarkiblar: { include: { tovar: { select: { nomi: true, birlik: true, kelishNarxi: true } } } },
          kassir: { select: { id: true, ism: true } },
          mijoz: { select: { id: true, ism: true, telefon: true } },
        },
      }),
      prisma.qaytarish.aggregate({
        where: {
          yaratilgan: { gte: danSana, lte: gachaSana },
          ...(kassirId ? { kassirId } : {}),
          aslSotuv: { ...(mijozId ? { mijozId } : {}), ...egaFilialWhere(session) },
        },
        _sum: { jamiSumma: true },
      }),
      prisma.sotuvTarkibi.groupBy({
        by: ['tovarId'],
        _sum: { miqdor: true, jami: true },
        where: { sotuv: joriySotuvWhere },
        orderBy: { _sum: { jami: 'desc' } },
        take: TOP_N,
      }),
    ])

    const jamiQaytarish = Number(qaytarishSum._sum.jamiSumma || 0)

    type SotuvFoydaInput = {
      tarkiblar: Array<{
        birlikNarxi: number | string | { toNumber: () => number }
        miqdor: number | string | { toNumber: () => number }
        tovar: { kelishNarxi: number | string | { toNumber: () => number } }
      }>
    }
    const hisoblaFoyda = (sotuvlar: SotuvFoydaInput[]) =>
      sotuvlar.reduce((jami, s) => {
        const sotuvFoyda = s.tarkiblar.reduce(
          (f, t) => f + (Number(t.birlikNarxi) - Number(t.tovar.kelishNarxi)) * Number(t.miqdor),
          0
        )
        return jami + sotuvFoyda
      }, 0)

    const jamiSotuv = joriySotuvlar.reduce((s, v) => s + Number(v.yakuniySumma), 0) - jamiQaytarish
    const jamiFoyda = hisoblaFoyda(joriySotuvlar)
    const jamiChegirma = joriySotuvlar.reduce((s, v) => s + Number(v.chegirma), 0)
    const sotuvSoni = joriySotuvlar.length
    const ortachaChek = hisoblaOrtachaChek(jamiSotuv, sotuvSoni)

    // Kunlik grafik
    const kunlikMap = new Map<string, { sotuv: number; sotuvSoni: number }>()
    const kunFormatlash = (d: Date) => d.toISOString().slice(0, 10)

    for (let d = new Date(danSana); d <= gachaSana; d.setDate(d.getDate() + 1)) {
      kunlikMap.set(kunFormatlash(d), { sotuv: 0, sotuvSoni: 0 })
    }
    for (const s of joriySotuvlar) {
      const k = kunFormatlash(s.sana)
      const bor = kunlikMap.get(k)
      if (bor) {
        bor.sotuv += Number(s.yakuniySumma)
        bor.sotuvSoni += 1
      }
    }
    const kunlikGrafik = Array.from(kunlikMap.entries()).map(([sana, d]) => ({ sana, ...d }))

    // Kassirlar
    const kassirMap = new Map<string, { kassirId: string; ism: string; sotuvSoni: number; jami: number; foyda: number; qaytarishlarSoni: number }>()
    for (const s of joriySotuvlar) {
      const key = s.kassirId
      const bor = kassirMap.get(key) ?? {
        kassirId: key,
        ism: s.kassir?.ism ?? '',
        sotuvSoni: 0,
        jami: 0,
        foyda: 0,
        qaytarishlarSoni: 0,
      }
      bor.sotuvSoni += 1
      bor.jami += Number(s.yakuniySumma)
      bor.foyda += s.tarkiblar.reduce(
        (f, t) => f + (Number(t.birlikNarxi) - Number(t.tovar.kelishNarxi)) * Number(t.miqdor),
        0
      )
      kassirMap.set(key, bor)
    }
    const kassirlar = Array.from(kassirMap.values())
      .map((k) => ({ ...k, ortachaChek: hisoblaOrtachaChek(k.jami, k.sotuvSoni) }))
      .sort((a, b) => b.jami - a.jami)

    const qaytarishlar = await prisma.qaytarish.groupBy({
      by: ['kassirId'],
      _count: true,
      where: {
        yaratilgan: { gte: danSana, lte: gachaSana },
        aslSotuv: egaFilialWhere(session),
      },
    })
    for (const q of qaytarishlar) {
      const k = kassirlar.find((x) => x.kassirId === q.kassirId)
      if (k) k.qaytarishlarSoni = q._count as number
    }

    // Mijozlar (top 20)
    const mijozMap = new Map<string, { mijozId: string; ism: string; telefon: string | null; sotuvSoni: number; jami: number; nasiyaQoldiq: number }>()
    for (const s of joriySotuvlar) {
      if (!s.mijozId || !s.mijoz) continue
      const key = s.mijozId
      const bor = mijozMap.get(key) ?? {
        mijozId: key,
        ism: s.mijoz.ism,
        telefon: s.mijoz.telefon ?? null,
        sotuvSoni: 0,
        jami: 0,
        nasiyaQoldiq: 0,
      }
      bor.sotuvSoni += 1
      bor.jami += Number(s.yakuniySumma)
      mijozMap.set(key, bor)
    }
    const mijozIdlar = Array.from(mijozMap.keys())
    if (mijozIdlar.length > 0) {
      const nasiyaQoldiqlar = await prisma.nasiya.groupBy({
        by: ['mijozId'],
        _sum: { qoldiq: true },
        where: { mijozId: { in: mijozIdlar }, holati: { in: ['OCHIQ', 'MUDDATI_OTGAN'] } },
      })
      for (const n of nasiyaQoldiqlar) {
        const m = mijozMap.get(n.mijozId)
        if (m) m.nasiyaQoldiq = Number(n._sum.qoldiq ?? 0)
      }
    }
    const mijozlar = Array.from(mijozMap.values())
      .sort((a, b) => b.jami - a.jami)
      .slice(0, TOP_N)

    // To'lov usullari
    const tolovMap = new Map<TolovUsuli, { sotuvSoni: number; jami: number }>()
    for (const s of joriySotuvlar) {
      const bor = tolovMap.get(s.tolovUsuli) ?? { sotuvSoni: 0, jami: 0 }
      bor.sotuvSoni += 1
      bor.jami += Number(s.yakuniySumma)
      tolovMap.set(s.tolovUsuli, bor)
    }
    const tolovJami = Array.from(tolovMap.values()).reduce((s, v) => s + v.jami, 0) || 1
    const tolovUsullari = Array.from(tolovMap.entries())
      .map(([tolovUsuli, d]) => ({ tolovUsuli, ...d, ulush: Math.round((d.jami / tolovJami) * 1000) / 10 }))
      .sort((a, b) => b.jami - a.jami)

    // Top tovarlar
    const tovarIds = topTarkiblar.map((t) => t.tovarId)
    const tovarlar = await prisma.tovar.findMany({
      where: { id: { in: tovarIds } },
      select: { id: true, nomi: true, birlik: true, kelishNarxi: true },
    })
    const topTovarlar = topTarkiblar.map((t) => {
      const tov = tovarlar.find((tv) => tv.id === t.tovarId)
      const miqdor = Number(t._sum.miqdor ?? 0)
      const jami = Number(t._sum.jami ?? 0)
      const kelishJami = miqdor * Number(tov?.kelishNarxi ?? 0)
      return {
        tovarId: t.tovarId,
        nomi: tov?.nomi ?? 'Noma\'lum',
        birlik: tov?.birlik ?? 'DONA',
        miqdor,
        jami,
        foyda: jami - kelishJami,
      }
    })

    // Soat taqsimoti
    const soatlar = soatTaqsimoti(
      joriySotuvlar.map((s) => ({ sana: s.sana, yakuniySumma: Number(s.yakuniySumma) }))
    )

    return NextResponse.json({
      jamiSotuv,
      jamiQaytarish,
      sotuvSoni,
      ortachaChek,
      jamiFoyda,
      jamiChegirma,
      kunlikGrafik,
      kassirlar,
      mijozlar,
      tolovUsullari,
      topTovarlar,
      soatlar,
    })
  } catch (e) {
    console.error('[/api/sotuvlar/analitika]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
