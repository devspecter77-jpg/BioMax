import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { vitrinaRuxsat } from '@/lib/vitrina-ruxsat'
import { aksiyalarniYangila } from '@/lib/vitrina-server'
import { aksiyaniTekshir } from '@/lib/vitrina'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// Aksiya narxi daromadga bevosita ta'sir qiladi va KASSADA HAM amal qiladi —
// shuning uchun faqat administrator belgilaydi va bekor qiladi.

export async function POST(req: NextRequest, { params }: Params) {
  const r = await vitrinaRuxsat()
  if (!r.ok) return r.javob
  if (!r.admin) return NextResponse.json({ xato: "Aksiyani faqat administrator belgilaydi" }, { status: 403 })
  const id = (await params).id
  const tana = await req.json().catch(() => ({})) as Record<string, unknown>

  await aksiyalarniYangila(true)
  const t = await prisma.tovar.findFirst({
    where: { id, holati: 'FAOL', ...r.doira },
    select: { sotishNarxi: true, kartochka: { select: { aksiyaNarxi: true } } },
  })
  if (!t) return NextResponse.json({ xato: 'Mahsulot topilmadi' }, { status: 404 })
  if (t.kartochka?.aksiyaNarxi != null) {
    return NextResponse.json({ xato: 'Bu mahsulotda aksiya bor — avval uni bekor qiling' }, { status: 409 })
  }

  const a = aksiyaniTekshir(tana, Number(t.sotishNarxi))
  if (!a.ok) return NextResponse.json({ xato: a.xato, maydon: a.maydon }, { status: 400 })

  await prisma.tovarKartochka.upsert({
    where: { tovarId: id },
    create: { tovarId: id, aksiyaNarxi: a.qiymat.narx, aksiyaBoshi: a.qiymat.boshi, aksiyaOxiri: a.qiymat.oxiri },
    update: { aksiyaNarxi: a.qiymat.narx, aksiyaBoshi: a.qiymat.boshi, aksiyaOxiri: a.qiymat.oxiri, aksiyaEskiNarx: null },
  })
  // Boshlanish vaqti o'tgan bo'lsa narx darhol almashadi (kassada ham)
  const n = await aksiyalarniYangila(true)
  return NextResponse.json({ ok: true, foiz: a.qiymat.foiz, darholQollandi: n.qollandi > 0 })
}

/** Aksiyani muddatidan oldin bekor qilish: qo'llangan bo'lsa asl narx qaytadi. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const r = await vitrinaRuxsat()
  if (!r.ok) return r.javob
  if (!r.admin) return NextResponse.json({ xato: "Aksiyani faqat administrator bekor qiladi" }, { status: 403 })
  const id = (await params).id

  const natija = await prisma.$transaction(async tx => {
    const t = await tx.tovar.findFirst({
      where: { id, holati: 'FAOL', ...r.doira },
      select: { sotishNarxi: true, kartochka: { select: { id: true, aksiyaNarxi: true, aksiyaEskiNarx: true } } },
    })
    const k = t?.kartochka
    if (!t || !k || k.aksiyaNarxi === null) return { topildi: false, narxQaytdi: false }
    await tx.tovarKartochka.update({
      where: { id: k.id },
      data: { aksiyaNarxi: null, aksiyaBoshi: null, aksiyaOxiri: null, aksiyaEskiNarx: null },
    })
    // Xodim aksiya davomida narxni qo'lda o'zgartirmagan bo'lsa — asl narx qaytadi
    const qaytadi = k.aksiyaEskiNarx !== null && Number(t.sotishNarxi) === Number(k.aksiyaNarxi)
    if (qaytadi) await tx.tovar.update({ where: { id }, data: { sotishNarxi: k.aksiyaEskiNarx! } })
    return { topildi: true, narxQaytdi: qaytadi }
  })
  if (!natija.topildi) return NextResponse.json({ xato: 'Faol aksiya topilmadi' }, { status: 404 })
  return NextResponse.json({ ok: true, narxQaytdi: natija.narxQaytdi })
}
