import { NextRequest, NextResponse } from 'next/server'
import { imzoniTekshir } from '@/lib/marketplace-imzo'
import { rezervQoy } from '@/lib/onlayn-sotuv-server'
import type { OnlaynBuyurtma } from '@/lib/onlayn-buyurtma'

// MARKETPLACE SHARTNOMASI — zaxira band qilish.
//
// Mijoz "sotib olish"ga bosganda mahsulotni band qilib qo'yish kerak —
// oxirgi donani ikki xaridor bir vaqtda olmaydi. Idempotent: ikkinchi
// marta chaqirilsa rezerv muddatini uzaytiradi.

export const dynamic = 'force-dynamic'

const TIZIM_FOYDALANUVCHI_ID = 'marketplace-system'

export async function POST(req: NextRequest) {
  const xom = await req.text()
  const t = imzoniTekshir(req, xom)
  if (!t.ok) {
    console.warn('[mp/rezerv] imzo rad etildi:', t.sabab)
    return NextResponse.json({ kod: t.sabab, xato: 'Ruxsat yo\'q' }, { status: t.holat })
  }

  let buyurtma: unknown
  try {
    buyurtma = JSON.parse(xom)
  } catch {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'So\'rov noto\'g\'ri' }, { status: 400 })
  }

  // Buyurtma tuzilishini tekshirish
  if (
    !buyurtma ||
    typeof buyurtma !== 'object' ||
    !('raqam' in buyurtma) ||
    !('qatorlar' in buyurtma) ||
    typeof buyurtma.raqam !== 'string' ||
    !Array.isArray(buyurtma.qatorlar)
  ) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'Buyurtma tuzilishi noto\'g\'ri' }, { status: 400 })
  }

  // Raqam formatini tekshirish
  if (!/^MP-\d{4}-\d{5,}$/.test(buyurtma.raqam)) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'Buyurtma raqami formati noto\'g\'ri' }, { status: 400 })
  }

  // Qatorlarni tekshirish
  for (const q of buyurtma.qatorlar) {
    if (
      !q ||
      typeof q !== 'object' ||
      !('erpTovarId' in q) ||
      !('nomi' in q) ||
      !('miqdor' in q) ||
      typeof q.erpTovarId !== 'string' ||
      typeof q.nomi !== 'string' ||
      typeof q.miqdor !== 'number' ||
      q.miqdor <= 0
    ) {
      return NextResponse.json({ kod: 'notogri_sorov', xato: 'Buyurtma qatori tuzilishi noto\'g\'ri' }, { status: 400 })
    }
  }

  try {
    const natija = await rezervQoy(buyurtma as OnlaynBuyurtma, TIZIM_FOYDALANUVCHI_ID)
    
    if (!natija.ok) {
      return NextResponse.json({ kod: 'rezerv_xatosi', xato: natija.xato }, { status: 422 })
    }

    return NextResponse.json({ 
      ok: true, 
      yangi: natija.qiymat.yangi,
      xabar: natija.qiymat.yangi ? 'Zaxira band qilindi' : 'Zaxira muddati uzaytirildi'
    })
  } catch (e) {
    console.error('[mp/rezerv]', e)
    return NextResponse.json({ kod: 'server_xatosi', xato: 'Server xatosi' }, { status: 500 })
  }
}
