import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NAMUNA_OLUVCHILAR, namunalarniTekshir, oluvchiYolidan } from '@/lib/dostavchik'
import { namunaRuxsat, oluvchiDoirasi } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

/**
 * Dostavchik yoki agentga namuna berish — bir martada bir nechta tovar.
 *
 * Tana: `{ izoh?, qatorlar: [{ tovarId?, nomi?, miqdor? }] }`. Katalogdan
 * tanlanganining nomi va birligi bazadan olinadi (brauzer yuborganiga
 * ishonilmaydi); katalogda yo'q narsa qo'lda yozilgan nomi bilan saqlanadi.
 * Ombor qoldig'i o'zgarmaydi: namuna vaqtincha chiqib, qaytib keladi.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tur: string; id: string }> }) {
  const { tur, id: dostavchikId } = await params
  const rol = oluvchiYolidan(tur)
  if (!rol) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })
  const r = await namunaRuxsat('namuna-tovar.berish')
  if (!r.ok) return r.javob
  const nomi = NAMUNA_OLUVCHILAR[rol].nomi

  let tana: Record<string, unknown>
  try {
    tana = await req.json()
  } catch {
    return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })
  }

  const qatorlar = namunalarniTekshir(tana.qatorlar)
  if ('xato' in qatorlar) return NextResponse.json({ xato: qatorlar.xato }, { status: 400 })
  const izoh = typeof tana.izoh === 'string' ? tana.izoh.trim().slice(0, 300) || null : null

  try {
    const oluvchi = await prisma.foydalanuvchi.findFirst({
      where: { id: dostavchikId, ...oluvchiDoirasi(rol) },
      select: { id: true, faol: true },
    })
    if (!oluvchi) return NextResponse.json({ xato: `${nomi} topilmadi` }, { status: 404 })
    if (!oluvchi.faol) return NextResponse.json({ xato: `${nomi} faol emas — avval uni faollashtiring` }, { status: 409 })

    const tovarIdlar = qatorlar.flatMap(q => (q.tovarId ? [q.tovarId] : []))
    const tovarlar = tovarIdlar.length
      ? await prisma.tovar.findMany({ where: { id: { in: tovarIdlar } }, select: { id: true, nomi: true, birlik: true } })
      : []
    const tovarMap = new Map(tovarlar.map(t => [t.id, t]))
    const topilmadi = tovarIdlar.find(id => !tovarMap.has(id))
    if (topilmadi) return NextResponse.json({ xato: 'Tanlangan tovarlardan biri topilmadi — ro‘yxatni yangilang' }, { status: 400 })

    const berish = await prisma.namunaBerish.create({
      data: {
        dostavchikId,
        izoh,
        berganId: r.meId,
        tarkiblar: {
          create: qatorlar.map(q => {
            const t = q.tovarId ? tovarMap.get(q.tovarId)! : null
            return { tovarId: t?.id ?? null, nomi: t?.nomi ?? q.nomi, birlik: t?.birlik ?? null, miqdor: q.miqdor }
          }),
        },
      },
      select: { id: true, _count: { select: { tarkiblar: true } } },
    })
    return NextResponse.json({ id: berish.id, soni: berish._count.tarkiblar }, { status: 201 })
  } catch (e) {
    console.error('[namuna-tovar/namuna POST]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
