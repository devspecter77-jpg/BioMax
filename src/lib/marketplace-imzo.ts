import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

// Marketplace so'rovlarini tekshirish.
//
// Bu fayl marketplace loyihasidagi `src/lib/erp/imzo.ts` ning JUFTI —
// imzolanadigan matn AYNAN bir xil tuzilishi shart, aks holda imzolar
// hech qachon mos kelmaydi. Bittasi o'zgarsa ikkinchisi ham o'zgaradi.

const AMAL_MS = 5 * 60_000

export type ImzoNatijasi =
  | { ok: true }
  | { ok: false; sabab: string; holat: 401 | 403 }

function imzoMatni(vaqt: string, yol: string, tana: string): string {
  return `${vaqt}\n${yol}\n${tana}`
}

/**
 * So'rov haqiqatan marketplace'dan kelganini tekshiradi.
 *
 * `tana` — so'rovning XOM matni (`await req.text()`). JSON qayta
 * seriyalanmasligi kerak: `JSON.stringify` maydon tartibini yoki
 * probellarni o'zgartirsa imzo mos kelmaydi.
 */
export function imzoniTekshir(req: NextRequest, tana: string, hozir = Date.now()): ImzoNatijasi {
  const kalit = process.env.MP_HMAC_SECRET
  // Kalit sozlanmagan bo'lsa hamma so'rov rad etiladi — "kalit yo'q,
  // demak tekshirmaymiz" degan xato eng xavflisi bo'lardi.
  if (!kalit || kalit.length < 32) {
    return { ok: false, sabab: 'kalit_sozlanmagan', holat: 403 }
  }

  const vaqt = req.headers.get('X-MP-Timestamp')
  const imzo = req.headers.get('X-MP-Signature')
  if (!vaqt || !imzo) return { ok: false, sabab: 'imzo_yoq', holat: 401 }

  const v = Number(vaqt)
  if (!Number.isFinite(v)) return { ok: false, sabab: 'vaqt_notogri', holat: 401 }

  // Kelajakdagi vaqt ham rad etiladi: soati oldinga surilgan mijoz
  // uzoq muddat amal qiladigan imzo yasay olmasin.
  const farq = hozir - v
  if (farq > AMAL_MS) return { ok: false, sabab: 'muddati_otgan', holat: 401 }
  if (farq < -AMAL_MS) return { ok: false, sabab: 'kelajak_vaqti', holat: 401 }

  const yol = new URL(req.url).pathname
  const kutilgan = createHmac('sha256', kalit).update(imzoMatni(vaqt, yol, tana)).digest()

  let berilgan: Buffer
  try {
    berilgan = Buffer.from(imzo, 'hex')
  } catch {
    return { ok: false, sabab: 'imzo_shakli', holat: 401 }
  }
  // Uzunlik farq qilsa `timingSafeEqual` xato beradi — oldin tekshiramiz.
  if (berilgan.length !== kutilgan.length) return { ok: false, sabab: 'imzo_mos_emas', holat: 401 }
  // Oddiy `===` belgima-belgi taqqoslaydi va javob vaqtidan imzoni
  // bit-bit topib olish mumkin.
  if (!timingSafeEqual(berilgan, kutilgan)) return { ok: false, sabab: 'imzo_mos_emas', holat: 401 }

  return { ok: true }
}

/**
 * ERP → marketplace so'rovini imzolash (onlayn buyurtmalarni boshqarish).
 *
 * `yol` — so'rov yo'li QUERY BILAN (`/api/erp/buyurtmalar?holat=YANGI`):
 * marketplace ham shunday tekshiradi, filtrni o'zgartirib qayta yuborib bo'lmaydi.
 */
export function imzoYarat(yol: string, tana: string, hozir = Date.now()): { vaqt: string; imzo: string } | null {
  const kalit = process.env.MP_HMAC_SECRET
  if (!kalit || kalit.length < 32) return null
  const vaqt = String(hozir)
  return { vaqt, imzo: createHmac('sha256', kalit).update(imzoMatni(vaqt, yol, tana)).digest('hex') }
}
