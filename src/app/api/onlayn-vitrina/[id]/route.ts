import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { vitrinaRuxsat } from '@/lib/vitrina-ruxsat'
import { aksiyalarniYangila } from '@/lib/vitrina-server'
import { rasmlarniSiqish, MAX_RASM } from '@/lib/rasm'
import { aksiyaHolati, kartochkaniTekshir, xususiyatlarniTozala } from '@/lib/vitrina'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

async function tovarniOl(id: string, doira: { filialId: null; egaId: string | null }) {
  return prisma.tovar.findFirst({
    where: { id, holati: 'FAOL', ...doira },
    select: {
      id: true, nomi: true, birlik: true, sotishNarxi: true, valyuta: true, qulflangan: true, rasmlar: true,
      kategoriya: { select: { nomi: true } },
      kartochka: true,
    },
  })
}

function javobShakli(t: NonNullable<Awaited<ReturnType<typeof tovarniOl>>>) {
  const k = t.kartochka
  const aksiya = k?.aksiyaNarxi != null ? {
    narx: Number(k.aksiyaNarxi),
    boshi: k.aksiyaBoshi?.toISOString() ?? null,
    oxiri: k.aksiyaOxiri?.toISOString() ?? null,
    eskiNarx: k.aksiyaEskiNarx === null ? null : Number(k.aksiyaEskiNarx),
    holati: aksiyaHolati({
      aksiyaNarxi: Number(k.aksiyaNarxi), aksiyaBoshi: k.aksiyaBoshi, aksiyaOxiri: k.aksiyaOxiri,
      aksiyaEskiNarx: k.aksiyaEskiNarx === null ? null : Number(k.aksiyaEskiNarx),
    }),
  } : null
  return {
    id: t.id,
    nomi: t.nomi,
    birlik: t.birlik,
    sotishNarxi: Number(t.sotishNarxi),
    valyuta: t.valyuta,
    kategoriya: t.kategoriya?.nomi ?? null,
    qulflangan: t.qulflangan,
    rasmlar: t.rasmlar,
    saytda: k?.saytda ?? false,
    sarlavha: k?.sarlavha ?? '',
    brend: k?.brend ?? '',
    tavsif: k?.tavsif ?? '',
    xususiyatlar: xususiyatlarniTozala(k?.xususiyatlar),
    hajm: k?.hajm === null || k?.hajm === undefined ? null : Number(k.hajm),
    hajmBirligi: k?.hajmBirligi ?? null,
    aksiya,
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const r = await vitrinaRuxsat()
  if (!r.ok) return r.javob
  await aksiyalarniYangila()
  const t = await tovarniOl((await params).id, r.doira)
  if (!t) return NextResponse.json({ xato: 'Mahsulot topilmadi' }, { status: 404 })
  return NextResponse.json({ ...javobShakli(t), admin: r.admin })
}

/**
 * Kartochkani saqlash. `rasmlar` — yakuniy tartibdagi to'liq ro'yxat (data URL):
 * yangi qo'shilgani siqiladi, avvalgisi o'zgarmasdan qoladi.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const r = await vitrinaRuxsat()
  if (!r.ok) return r.javob
  const id = (await params).id

  let tana: Record<string, unknown>
  try {
    tana = await req.json()
  } catch {
    return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })
  }

  const t = await tovarniOl(id, r.doira)
  if (!t) return NextResponse.json({ xato: 'Mahsulot topilmadi' }, { status: 404 })

  const k = kartochkaniTekshir(tana)
  if (!k.ok) return NextResponse.json({ xato: k.xato, maydon: k.maydon }, { status: 400 })

  let rasmlar = t.rasmlar
  if (tana.rasmlar !== undefined) {
    if (!Array.isArray(tana.rasmlar) || tana.rasmlar.length > MAX_RASM) {
      return NextResponse.json({ xato: `Eng ko‘pi bilan ${MAX_RASM} ta rasm`, maydon: 'rasmlar' }, { status: 400 })
    }
    rasmlar = await rasmlarniSiqish(tana.rasmlar)
    if (rasmlar.length !== tana.rasmlar.length) {
      return NextResponse.json({ xato: 'Rasmlardan biri o‘qilmadi — JPG, PNG yoki WebP yuklang', maydon: 'rasmlar' }, { status: 400 })
    }
  }

  const q = k.qiymat
  await prisma.$transaction([
    prisma.tovar.update({ where: { id }, data: { rasmlar } }),
    prisma.tovarKartochka.upsert({
      where: { tovarId: id },
      create: { tovarId: id, ...q, xususiyatlar: q.xususiyatlar as unknown as object },
      update: { ...q, xususiyatlar: q.xususiyatlar as unknown as object },
    }),
  ])

  const yangi = await tovarniOl(id, r.doira)
  return NextResponse.json({ ...javobShakli(yangi!), admin: r.admin })
}

/** Tez almashtirish: faqat "saytda" belgisi (ro'yxatdagi tugma). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const r = await vitrinaRuxsat()
  if (!r.ok) return r.javob
  const id = (await params).id
  const tana = await req.json().catch(() => ({})) as { saytda?: unknown }
  if (typeof tana.saytda !== 'boolean') return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })

  const t = await prisma.tovar.findFirst({ where: { id, holati: 'FAOL', ...r.doira }, select: { id: true } })
  if (!t) return NextResponse.json({ xato: 'Mahsulot topilmadi' }, { status: 404 })

  await prisma.tovarKartochka.upsert({
    where: { tovarId: id },
    create: { tovarId: id, saytda: tana.saytda },
    update: { saytda: tana.saytda },
  })
  return NextResponse.json({ ok: true, saytda: tana.saytda })
}
