import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { imzoniTekshir } from '@/lib/marketplace-imzo'

// MARKETPLACE SHARTNOMASI — telefon bo'yicha mijoz topish yoki yangi yaratish.
//
// Saytda mijoz ro'yxatdan o'tganda yoki buyurtma berayotganda ERP'da
// mijoz kartasi mavjudligini tekshirish va zarur bo'lsa yaratish.
// Idempotent: mavjud mijozni qaytaradi yoki yangi yaratadi.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const xom = await req.text()
  const t = imzoniTekshir(req, xom)
  if (!t.ok) {
    console.warn('[mp/mijoz] imzo rad etildi:', t.sabab)
    return NextResponse.json({ kod: t.sabab, xato: 'Ruxsat yo\'q' }, { status: t.holat })
  }

  let tana: { telefon?: unknown; ism?: unknown; izoh?: unknown }
  try {
    tana = JSON.parse(xom)
  } catch {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'So\'rov noto\'g\'ri' }, { status: 400 })
  }

  // Telefon formatini tekshirish
  const telefon = typeof tana.telefon === 'string' && /^\+998\d{9}$/.test(tana.telefon) 
    ? tana.telefon 
    : null

  if (!telefon) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'Telefon raqami majburiy va to\'g\'ri formatda bo\'lishi kerak (+998XXXXXXXXX)' }, { status: 400 })
  }

  const ism = typeof tana.ism === 'string' && tana.ism.trim() 
    ? tana.ism.trim() 
    : 'Onlayn xaridor'

  const izoh = typeof tana.izoh === 'string' && tana.izoh.trim() 
    ? tana.izoh.trim() 
    : 'Marketplace'

  try {
    // Telefon variantlarini yaratish (turli formatlar)
    const telefonVariantlari = [
      telefon,
      telefon.replace('+998', '998'),
      telefon.replace('+', ''),
    ]

    // Avval mavjud mijozni topish
    let mijoz = await prisma.mijoz.findFirst({
      where: {
        OR: [
          { telefon: { in: telefonVariantlari } },
          { telefon2: { in: telefonVariantlari } },
          { qoshimchaTelefonlar: { hasSome: telefonVariantlari } },
        ],
      },
      select: {
        id: true,
        ism: true,
        telefon: true,
        telefon2: true,
        tuman: true,
        manzil: true,
        izoh: true,
      },
    })

    let yangi = false

    // Agar topilmasa, yangi yaratish
    if (!mijoz) {
      mijoz = await prisma.mijoz.create({
        data: {
          ism,
          telefon,
          izoh,
        },
        select: {
          id: true,
          ism: true,
          telefon: true,
          telefon2: true,
          tuman: true,
          manzil: true,
          izoh: true,
        },
      })
      yangi = true
    }

    return NextResponse.json({
      ok: true,
      yangi,
      mijoz: {
        id: mijoz.id,
        ism: mijoz.ism,
        telefon: mijoz.telefon,
        telefon2: mijoz.telefon2,
        tuman: mijoz.tuman,
        manzil: mijoz.manzil,
        izoh: mijoz.izoh,
      },
      xabar: yangi ? 'Yangi mijoz yaratildi' : 'Mavjud mijoz topildi'
    })
  } catch (e) {
    console.error('[mp/mijoz]', e)
    return NextResponse.json({ kod: 'server_xatosi', xato: 'Server xatosi' }, { status: 500 })
  }
}
