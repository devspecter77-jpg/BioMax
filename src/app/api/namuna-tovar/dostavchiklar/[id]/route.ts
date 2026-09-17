import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ruxsatKeshiniTozala } from '@/lib/ruxsat-server'
import { dostavchikniTekshir } from '@/lib/dostavchik'
import { DOSTAVCHIK_DOIRASI, dostavchikTafsiloti, namunaRuxsat } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

type Parametr = { params: Promise<{ id: string }> }

// Bitta dostavchik: profil, jonli joylashuv, joriy va yakunlangan yetkazishlar, namunalar.
export async function GET(_req: NextRequest, { params }: Parametr) {
  const r = await namunaRuxsat()
  if (!r.ok) return r.javob
  try {
    const t = await dostavchikTafsiloti((await params).id)
    if (!t) return NextResponse.json({ xato: 'Dostavchik topilmadi' }, { status: 404 })
    return NextResponse.json(t)
  } catch (e) {
    console.error('[namuna-tovar/dostavchik GET]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

/**
 * Tahrirlash: ism, raqamlar, transport, faolligi. `parol` berilsa — yangi parol.
 * Login o'zgarmaydi (dostavchik u bilan kiradi va boshqa yozuvlarda ko'rinadi).
 */
export async function PUT(req: NextRequest, { params }: Parametr) {
  const r = await namunaRuxsat('namuna-tovar.dostavchik')
  if (!r.ok) return r.javob
  const id = (await params).id

  let tana: Record<string, unknown>
  try {
    tana = await req.json()
  } catch {
    return NextResponse.json({ xato: "So'rov noto'g'ri" }, { status: 400 })
  }

  const m = dostavchikniTekshir(tana)
  if ('xato' in m) return NextResponse.json({ xato: m.xato }, { status: 400 })
  const parol = typeof tana.parol === 'string' ? tana.parol : ''
  if (parol && parol.length < 6) return NextResponse.json({ xato: 'Yangi parol kamida 6 belgi' }, { status: 400 })
  const faol = typeof tana.faol === 'boolean' ? tana.faol : undefined
  if (faol === false && id === r.meId) {
    return NextResponse.json({ xato: 'O‘z hisobingizni o‘chira olmaysiz' }, { status: 400 })
  }

  try {
    const mavjud = await prisma.foydalanuvchi.findFirst({ where: { id, ...DOSTAVCHIK_DOIRASI }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: 'Dostavchik topilmadi' }, { status: 404 })

    const profil = {
      transportTuri: m.transportTuri,
      transportNomi: m.transportNomi,
      davlatRaqami: m.davlatRaqami,
      qoshimchaTelefonlar: m.qoshimchaTelefonlar,
      manzil: m.manzil,
      manzilLat: m.manzilLat,
      manzilLng: m.manzilLng,
      izoh: m.izoh,
    }
    await prisma.foydalanuvchi.update({
      where: { id },
      data: {
        ism: m.ism,
        telefon: m.telefon,
        ...(faol !== undefined ? { faol } : {}),
        ...(parol ? { parolHash: await bcrypt.hash(parol, 10) } : {}),
        dostavchikProfili: { upsert: { create: profil, update: profil } },
      },
      select: { id: true },
    })
    // Faolligi o'zgarsa sessiya qorovuli darhol sezsin
    if (faol !== undefined) ruxsatKeshiniTozala(id)

    return NextResponse.json(await dostavchikTafsiloti(id))
  } catch (e) {
    console.error('[namuna-tovar/dostavchik PUT]', e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
