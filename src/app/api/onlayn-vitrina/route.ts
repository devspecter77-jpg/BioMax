import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStockMap } from '@/lib/stock'
import { normalizeUzbek, toKirill } from '@/lib/utils'
import { vitrinaRuxsat } from '@/lib/vitrina-ruxsat'
import { aksiyalarniYangila } from '@/lib/vitrina-server'
import { aksiyaHolati, toliqlik, xususiyatlarniTozala, yetishmaydi } from '@/lib/vitrina'

export const dynamic = 'force-dynamic'

// Onlayn vitrina ro'yxati: har mahsulotning saytdagi holati va to'liqligi.
// Rasmlarning o'zi yuborilmaydi — kichik nusxasi alohida marshrutdan.

export async function GET(req: NextRequest) {
  const r = await vitrinaRuxsat()
  if (!r.ok) return r.javob
  await aksiyalarniYangila()

  const p = req.nextUrl.searchParams
  const filtr = p.get('filtr') ?? 'hammasi'
  const q = p.get('q')?.trim().slice(0, 60) ?? ''

  const qidiruv = q
    ? { OR: [normalizeUzbek(q), toKirill(normalizeUzbek(q))].flatMap(s => [
        { nomi: { contains: s, mode: 'insensitive' as const } },
        { shtrixKod: { contains: s } },
      ]) }
    : {}

  const tovarlar = await prisma.tovar.findMany({
    where: {
      holati: 'FAOL',
      ...r.doira,
      // Qidiruv va filtr ikkalasi ham `OR` ishlatadi — ustma-ust yozilmasligi uchun `AND` ichida
      AND: [
        qidiruv,
        filtr === 'saytda' ? { kartochka: { saytda: true } }
          : filtr === 'saytda_emas' ? { OR: [{ kartochka: null }, { kartochka: { saytda: false } }] }
          : filtr === 'aksiya' ? { kartochka: { aksiyaNarxi: { not: null } } }
          : {},
      ],
    },
    select: {
      id: true, nomi: true, birlik: true, sotishNarxi: true, valyuta: true, qulflangan: true, yangilangan: true,
      kategoriya: { select: { nomi: true } },
      // Rasmlar soni uchun: massivning o'zini emas, uzunligini bilish kifoya bo'lardi,
      // lekin Prisma massiv uzunligini tanlay olmaydi — shuning uchun alohida so'rov.
      kartochka: {
        select: {
          saytda: true, sarlavha: true, tavsif: true, xususiyatlar: true, hajm: true, hajmBirligi: true,
          aksiyaNarxi: true, aksiyaBoshi: true, aksiyaOxiri: true, aksiyaEskiNarx: true,
        },
      },
    },
    orderBy: [{ nomi: 'asc' }],
    take: 500,
  })

  const ids = tovarlar.map(t => t.id)
  const [rasmSonlari, stok] = await Promise.all([
    ids.length
      ? prisma.$queryRawUnsafe<{ id: string; n: number }[]>(
          `SELECT id, COALESCE(array_length(rasmlar, 1), 0)::int AS n FROM public.tovarlar WHERE id = ANY($1::text[])`, ids,
        )
      : Promise.resolve([]),
    getStockMap(ids),
  ])
  const rasmSoni = new Map(rasmSonlari.map(x => [x.id, x.n]))

  let royxat = tovarlar.map(t => {
    const k = t.kartochka
    const xus = xususiyatlarniTozala(k?.xususiyatlar)
    const holat = { rasmlarSoni: rasmSoni.get(t.id) ?? 0, tavsif: k?.tavsif ?? null, xususiyatlarSoni: xus.length, hajm: k?.hajm === null || k?.hajm === undefined ? null : Number(k.hajm) }
    const aksiya = k?.aksiyaNarxi != null
      ? {
          holati: aksiyaHolati({ aksiyaNarxi: Number(k.aksiyaNarxi), aksiyaBoshi: k.aksiyaBoshi, aksiyaOxiri: k.aksiyaOxiri, aksiyaEskiNarx: k.aksiyaEskiNarx === null ? null : Number(k.aksiyaEskiNarx) }),
          narx: Number(k.aksiyaNarxi),
          oxiri: k.aksiyaOxiri?.toISOString() ?? null,
        }
      : null
    const s = stok.get(t.id)
    return {
      id: t.id,
      nomi: t.nomi,
      sarlavha: k?.sarlavha ?? null,
      birlik: t.birlik,
      sotishNarxi: Number(t.sotishNarxi),
      valyuta: t.valyuta,
      kategoriya: t.kategoriya?.nomi ?? null,
      qulflangan: t.qulflangan,
      saytda: k?.saytda ?? false,
      qoldiq: s ? Math.round((s.omborQoldiq + s.dokonQoldiq) * 1000) / 1000 : 0,
      rasmlarSoni: holat.rasmlarSoni,
      yetishmaydi: yetishmaydi(holat),
      toliqlik: toliqlik(holat),
      aksiya,
      rasmVersiya: t.yangilangan.getTime().toString(36),
    }
  })
  if (filtr === 'tayyor_emas') royxat = royxat.filter(x => x.yetishmaydi.length > 0)

  const [hammasi, saytda, aksiyada] = await Promise.all([
    prisma.tovar.count({ where: { holati: 'FAOL', ...r.doira } }),
    prisma.tovar.count({ where: { holati: 'FAOL', ...r.doira, kartochka: { saytda: true } } }),
    prisma.tovar.count({ where: { holati: 'FAOL', ...r.doira, kartochka: { aksiyaNarxi: { not: null } } } }),
  ])
  const sonlar = { hammasi, saytda, saytdaEmas: hammasi - saytda, aksiyada }
  return NextResponse.json({ tovarlar: royxat, sonlar, admin: r.admin })
}
