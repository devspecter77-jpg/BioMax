import { NextRequest, NextResponse } from 'next/server'
import { imzoniTekshir } from '@/lib/marketplace-imzo'
import { onlaynSotuvYarat } from '@/lib/onlayn-sotuv-server'
import { prisma } from '@/lib/prisma'
import type { OnlaynBuyurtma } from '@/lib/onlayn-buyurtma'
import type { Session } from 'next-auth'

// MARKETPLACE SHARTNOMASI — buyurtmani bajarish (haqiqiy sotuv yaratish).
//
// Buyurtma topshirilganda ERP'da kassadagi sotuv bilan bir xil yozuvlar
// yaratiladi — sotuv, sotuv tarkibi, ombor harakati, mijoz kartasi va ballar.
// Idempotent: ikkinchi marta chaqirilsa mavjud sotuvni qaytaradi.

export const dynamic = 'force-dynamic'

/**
 * Sotuvni kim nomidan yozamiz.
 *
 * `onlaynSotuvYarat` sessiyadan ikki narsani oladi: kassir (sotuvga
 * `foydalanuvchiId` bo'lib yoziladi, ya'ni BAZADA BOR hisob bo'lishi shart)
 * va ma'lumot doirasi (`egaFilialWhere` — qaysi katalogdagi mahsulotlar).
 * Shuning uchun o'ylab topilgan id emas, haqiqiy Ega hisobi olinadi:
 * filialsiz, faol va o'zi boshqa Eganing ulashgan admini bo'lmagan ADMIN.
 */
async function egaSessiyasi(): Promise<Session | null> {
  const ega = await prisma.foydalanuvchi.findFirst({
    where: { rol: 'ADMIN', faol: true, filialId: null, ulashilganEgaId: null },
    orderBy: { yaratilgan: 'asc' },
    select: { id: true, ism: true, rol: true },
  })
  if (!ega) return null
  return {
    user: {
      id: ega.id,
      name: ega.ism,
      rol: ega.rol,
      filialId: null,
      filialNomi: null,
      ulashilganEgaId: null,
      tovarTahrirlashMumkin: true,
      tovarOchirishMumkin: true,
      ruxsatlar: null,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  }
}

export async function POST(req: NextRequest) {
  const xom = await req.text()
  const t = imzoniTekshir(req, xom)
  if (!t.ok) {
    console.warn('[mp/bajarish] imzo rad etildi:', t.sabab)
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
    !('aloqaTel' in buyurtma) ||
    !('tolovUsuli' in buyurtma) ||
    !('mahsulotSumma' in buyurtma) ||
    typeof buyurtma.raqam !== 'string' ||
    !Array.isArray(buyurtma.qatorlar) ||
    typeof buyurtma.aloqaTel !== 'string' ||
    typeof buyurtma.tolovUsuli !== 'string' ||
    typeof buyurtma.mahsulotSumma !== 'number'
  ) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'Buyurtma tuzilishi noto\'g\'ri' }, { status: 400 })
  }

  // Raqam formatini tekshirish
  if (!/^MP-\d{4}-\d{5,}$/.test(buyurtma.raqam)) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'Buyurtma raqami formati noto\'g\'ri' }, { status: 400 })
  }

  // Telefon formatini tekshirish
  if (!/^\+998\d{9}$/.test(buyurtma.aloqaTel)) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'Telefon raqami formati noto\'g\'ri' }, { status: 400 })
  }

  // To'lov usulini tekshirish
  if (!['NAQD', 'KARTA_YETKAZISHDA'].includes(buyurtma.tolovUsuli)) {
    return NextResponse.json({ kod: 'notogri_sorov', xato: 'To\'lov usuli noto\'g\'ri' }, { status: 400 })
  }

  // Qatorlarni tekshirish
  for (const q of buyurtma.qatorlar) {
    if (
      !q ||
      typeof q !== 'object' ||
      !('erpTovarId' in q) ||
      !('nomi' in q) ||
      !('miqdor' in q) ||
      !('birlikNarxi' in q) ||
      !('jami' in q) ||
      typeof q.erpTovarId !== 'string' ||
      typeof q.nomi !== 'string' ||
      typeof q.miqdor !== 'number' ||
      typeof q.birlikNarxi !== 'number' ||
      typeof q.jami !== 'number' ||
      q.miqdor <= 0 ||
      q.birlikNarxi <= 0 ||
      q.jami <= 0
    ) {
      return NextResponse.json({ kod: 'notogri_sorov', xato: 'Buyurtma qatori tuzilishi noto\'g\'ri' }, { status: 400 })
    }
  }

  try {
    const sessiya = await egaSessiyasi()
    if (!sessiya) {
      console.error('[mp/bajarish] Ega hisobi topilmadi — sotuvni kim nomidan yozishni aniqlab bo‘lmadi')
      return NextResponse.json({ kod: 'ega_topilmadi', xato: 'Do\'kon hisobi sozlanmagan' }, { status: 503 })
    }

    const natija = await onlaynSotuvYarat(buyurtma as OnlaynBuyurtma, sessiya)
    
    if (!natija.ok) {
      return NextResponse.json({ kod: 'sotuv_xatosi', xato: natija.xato }, { status: 422 })
    }

    return NextResponse.json({ 
      ok: true,
      sotuvId: natija.qiymat.sotuvId,
      chekRaqami: natija.qiymat.chekRaqami,
      yangi: natija.qiymat.yangi,
      xabar: natija.qiymat.yangi ? 'Sotuv yaratildi' : 'Sotuv allaqachon mavjud'
    })
  } catch (e) {
    console.error('[mp/bajarish]', e)
    return NextResponse.json({ kod: 'server_xatosi', xato: 'Server xatosi' }, { status: 500 })
  }
}
