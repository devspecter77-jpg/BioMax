import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStockMap } from '@/lib/stock'
import { imzoniTekshir } from '@/lib/marketplace-imzo'
import { faolRezervlar } from '@/lib/onlayn-sotuv-server'

// MARKETPLACE SHARTNOMASI — bir nechta tovar uchun mavjudlik tekshirish.
//
// QAT'IY QOIDA: bu marshrut ANIQ QOLDIQ SONINI qaytarmaydi. Faqat uch holat:
// BOR / KAM / YOQ.
//
// Saytda savatni ko'rsatishda mahsulot hali bor-yo'qligi tekshiriladi —
// mijoz "sotib olish"ga bossa mavjud emasligini ko'rmasin.

export const dynamic = 'force-dynamic'

/**
 * Mavjudlik OMBOR + DO'KON yig'indisidan hisoblanadi, onlayn
 * buyurtmalar band qilgani ayirilgan holda.
 */
function mavjudlik(jami: number, minimal: number): 'BOR' | 'KAM' | 'YOQ' {
  if (jami <= 0) return 'YOQ'
  if (jami <= Math.max(1, minimal)) return 'KAM'
  return 'BOR'
}

export async function POST(req: NextRequest) {
  const xom = await req.text()
  const tekshiruv = imzoniTekshir(req, xom)
  if (!tekshiruv.ok) {
    console.warn('[mp/qoldiq] imzo rad etildi:', tekshiruv.sabab)
    return NextResponse.json({ kod: tekshiruv.sabab, xato: 'Ruxsat yo\'q' }, { status: tekshiruv.holat })
  }

  let tana: { tovarIds?: unknown }
  try {
    tana = JSON.parse(xom)
  } catch {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'So\'rov noto\'g\'ri' }, { status: 400 })
  }

  const tovarIds = Array.isArray(tana.tovarIds) && tana.tovarIds.every(id => typeof id === 'string')
    ? tana.tovarIds as string[]
    : null

  if (!tovarIds || tovarIds.length === 0) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'tovarIds majburiy va bo\'sh bo\'lmasligi kerak' }, { status: 400 })
  }

  if (tovarIds.length > 100) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'Bir so\'rovda maksimal 100 ta tovar' }, { status: 400 })
  }

  try {
    const tovarlar = await prisma.tovar.findMany({
      where: {
        id: { in: tovarIds },
        holati: 'FAOL',
        qulflangan: false,
      },
      select: {
        id: true,
        minimalQoldiq: true,
      },
    })

    const topilganIds = tovarlar.map(t => t.id)
    const [stok, band] = await Promise.all([
      getStockMap(topilganIds),
      faolRezervlar(topilganIds),
    ])

    const natija: Record<string, 'BOR' | 'KAM' | 'YOQ'> = {}
    
    for (const id of tovarIds) {
      const tovar = tovarlar.find(t => t.id === id)
      if (!tovar) {
        natija[id] = 'YOQ'
        continue
      }

      const s = stok.get(id) ?? { omborQoldiq: 0, dokonQoldiq: 0 }
      const jami = s.omborQoldiq + s.dokonQoldiq - (band.get(id) ?? 0)
      natija[id] = mavjudlik(jami, tovar.minimalQoldiq)
    }

    return NextResponse.json({ tovarlar: natija, vaqt: new Date().toISOString() })
  } catch (e) {
    console.error('[mp/qoldiq]', e)
    return NextResponse.json({ kod: 'server_xatosi', xato: 'Server xatosi' }, { status: 500 })
  }
}
