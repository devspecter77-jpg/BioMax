import { prisma } from '@/lib/prisma'

const KALIT_QIYMAT = 'usd_kursi'
const KALIT_SANA = 'usd_kursi_sana'
const DEFAULT_KURS = 12700
const CBU_URL = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/'

function bugungiSana(): string {
  // Asia/Tashkent bo'yicha bugungi sana (YYYY-MM-DD)
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
}

async function cbudanOlish(): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(CBU_URL, { signal: controller.signal, cache: 'no-store' })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    const rate = parseFloat(data?.[0]?.Rate)
    return Number.isFinite(rate) && rate > 0 ? rate : null
  } catch {
    return null
  }
}

// Kurs kunlik keshlanadi — bugungi sana uchun allaqachon olingan bo'lsa,
// Markaziy bankka qayta murojaat qilinmaydi. Sana o'zgargan yoki hali
// hech qachon olinmagan bo'lsa — avtomatik yangilanadi. CBU ishlamay
// qolsa, oxirgi ma'lum kurs (yoki umuman bo'lmasa DEFAULT_KURS) qaytadi.
export async function joriyUsdKursi(): Promise<{ kursi: number; sana: string | null }> {
  const [qiymatRow, sanaRow] = await Promise.all([
    prisma.sozlama.findUnique({ where: { kalit: KALIT_QIYMAT } }),
    prisma.sozlama.findUnique({ where: { kalit: KALIT_SANA } }),
  ])
  const keshlanganQiymat = qiymatRow ? parseFloat(qiymatRow.qiymat) : NaN
  const bugun = bugungiSana()

  if (Number.isFinite(keshlanganQiymat) && keshlanganQiymat > 0 && sanaRow?.qiymat === bugun) {
    return { kursi: keshlanganQiymat, sana: sanaRow.qiymat }
  }

  const yangiKurs = await cbudanOlish()
  if (yangiKurs) {
    await Promise.all([
      prisma.sozlama.upsert({ where: { kalit: KALIT_QIYMAT }, update: { qiymat: String(yangiKurs) }, create: { kalit: KALIT_QIYMAT, qiymat: String(yangiKurs) } }),
      prisma.sozlama.upsert({ where: { kalit: KALIT_SANA }, update: { qiymat: bugun }, create: { kalit: KALIT_SANA, qiymat: bugun } }),
    ])
    return { kursi: yangiKurs, sana: bugun }
  }

  // CBU javob bermadi — oxirgi ma'lum qiymat bilan davom etamiz
  if (Number.isFinite(keshlanganQiymat) && keshlanganQiymat > 0) {
    return { kursi: keshlanganQiymat, sana: sanaRow?.qiymat ?? null }
  }
  return { kursi: DEFAULT_KURS, sana: null }
}

// Majburiy qayta yuklash (masalan "Yangilash" tugmasi uchun) — keshdan
// qat'i nazar Markaziy bankka murojaat qiladi.
export async function usdKursiniYangilash(): Promise<{ kursi: number; sana: string | null }> {
  const yangiKurs = await cbudanOlish()
  const bugun = bugungiSana()
  if (yangiKurs) {
    await Promise.all([
      prisma.sozlama.upsert({ where: { kalit: KALIT_QIYMAT }, update: { qiymat: String(yangiKurs) }, create: { kalit: KALIT_QIYMAT, qiymat: String(yangiKurs) } }),
      prisma.sozlama.upsert({ where: { kalit: KALIT_SANA }, update: { qiymat: bugun }, create: { kalit: KALIT_SANA, qiymat: bugun } }),
    ])
    return { kursi: yangiKurs, sana: bugun }
  }
  return joriyUsdKursi()
}
