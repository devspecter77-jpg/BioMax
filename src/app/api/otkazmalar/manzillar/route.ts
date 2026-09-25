import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sessionEgaId } from '@/lib/filial-scope'
import { faqatEga } from '@/lib/otkazma-server'

// O'tkazma oynasidagi "Qayerdan / Qayerga" ro'yxati.
//
// Manzil = filial doirasi (null — Ega markaziy katalogi) + nomli ombor
// (null — omborga biriktirilmagan mahsulotlar). Har doira uchun avval
// omborsiz qism, keyin Omborlar sahifasidagi tartibda nomli omborlar.
// `tovarSoni` — faol mahsulotlar soni (kategoriyasi orqali).

export interface OtkazmaManzili {
  filialId: string | null
  filialNomi: string | null
  omborId: string | null
  omborNomi: string | null
  faol: boolean
  tovarSoni: number
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 401 })
    if (!faqatEga(session)) return NextResponse.json({ xato: "Ruxsat yo'q" }, { status: 403 })

    const egaId = sessionEgaId(session)
    const filiallar = await prisma.filial.findMany({
      select: { id: true, nomi: true, faol: true },
      orderBy: { yaratilgan: 'asc' },
    })
    const filialIdlar = filiallar.map(f => f.id)
    const doiralar = [{ filialId: null, egaId }, { filialId: { in: filialIdlar } }]

    // Mahsulotlar o'z doirasi (tovar.filialId/egaId) bo'yicha sanaladi —
    // oynadagi ro'yxat (/api/ombor) ham aynan shunday tanlaydi.
    const [omborlar, guruhlar] = await Promise.all([
      prisma.ombor.findMany({
        where: { OR: doiralar },
        select: { id: true, nomi: true, faol: true, filialId: true },
        orderBy: [{ tartib: 'asc' }, { nomi: 'asc' }],
      }),
      prisma.tovar.groupBy({
        by: ['filialId', 'kategoriyaId'],
        where: { holati: 'FAOL', OR: doiralar },
        _count: { _all: true },
      }),
    ])
    const kategoriyaOmbori = new Map(
      (await prisma.kategoriya.findMany({
        where: { id: { in: guruhlar.map(g => g.kategoriyaId) } },
        select: { id: true, omborId: true },
      })).map(k => [k.id, k.omborId]),
    )

    const kalit = (filialId: string | null, omborId: string | null) => `${filialId ?? ''}|${omborId ?? ''}`
    const soni = new Map<string, number>()
    for (const g of guruhlar) {
      const kk = kalit(g.filialId, kategoriyaOmbori.get(g.kategoriyaId) ?? null)
      soni.set(kk, (soni.get(kk) ?? 0) + g._count._all)
    }

    const manzillar: OtkazmaManzili[] = []
    const doira = (filialId: string | null, filialNomi: string | null, filialFaol: boolean) => {
      manzillar.push({
        filialId, filialNomi, omborId: null, omborNomi: null,
        faol: filialFaol, tovarSoni: soni.get(kalit(filialId, null)) ?? 0,
      })
      for (const o of omborlar.filter(x => x.filialId === filialId)) {
        manzillar.push({
          filialId, filialNomi, omborId: o.id, omborNomi: o.nomi,
          faol: filialFaol && o.faol, tovarSoni: soni.get(kalit(filialId, o.id)) ?? 0,
        })
      }
    }
    doira(null, null, true)
    for (const f of filiallar) doira(f.id, f.nomi, f.faol)

    return NextResponse.json({ manzillar })
  } catch (e) {
    console.error('[otkazmalar/manzillar]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
