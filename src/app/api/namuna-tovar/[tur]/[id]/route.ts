import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ruxsatKeshiniTozala } from '@/lib/ruxsat-server'
import { NAMUNA_OLUVCHILAR, dostavchikniTekshir, oluvchiYolidan } from '@/lib/dostavchik'
import { namunaOluvchiTafsiloti, namunaRuxsat, oluvchiDoirasi } from '@/lib/dostavchik-server'

export const dynamic = 'force-dynamic'

type Parametr = { params: Promise<{ tur: string; id: string }> }

// Bitta dostavchik yoki agent: profil, jonli joylashuv, namunalar va
// (dostavchikda) joriy va yakunlangan yetkazishlar.
export async function GET(_req: NextRequest, { params }: Parametr) {
  const { tur, id } = await params
  const rol = oluvchiYolidan(tur)
  if (!rol) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })
  const r = await namunaRuxsat()
  if (!r.ok) return r.javob
  try {
    const t = await namunaOluvchiTafsiloti(id, rol)
    if (!t) return NextResponse.json({ xato: `${NAMUNA_OLUVCHILAR[rol].nomi} topilmadi` }, { status: 404 })
    return NextResponse.json(t)
  } catch (e) {
    console.error('[namuna-tovar/oluvchi GET]', rol, e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}

/**
 * Tahrirlash: ism, raqamlar, transport, faolligi. `parol` berilsa — yangi parol.
 * Login o'zgarmaydi (xodim u bilan kiradi va boshqa yozuvlarda ko'rinadi).
 */
export async function PUT(req: NextRequest, { params }: Parametr) {
  const { tur, id } = await params
  const rol = oluvchiYolidan(tur)
  if (!rol) return NextResponse.json({ xato: 'Topilmadi' }, { status: 404 })
  const r = await namunaRuxsat(NAMUNA_OLUVCHILAR[rol].ruxsat)
  if (!r.ok) return r.javob

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
    const mavjud = await prisma.foydalanuvchi.findFirst({ where: { id, ...oluvchiDoirasi(rol) }, select: { id: true } })
    if (!mavjud) return NextResponse.json({ xato: `${NAMUNA_OLUVCHILAR[rol].nomi} topilmadi` }, { status: 404 })

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

    return NextResponse.json(await namunaOluvchiTafsiloti(id, rol))
  } catch (e) {
    console.error('[namuna-tovar/oluvchi PUT]', rol, e)
    return NextResponse.json({ xato: 'Server xatosi' }, { status: 500 })
  }
}
