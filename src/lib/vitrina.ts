// Onlayn vitrina kartochkasi — sof qoidalar (bazasiz, sinovga oson).
//
// Kartochkaning to'liqligi, xususiyatlar va aksiya tekshiruvi shu yerda.
// Aksiya narxi kassaga ham ta'sir qiladi, shuning uchun uning qoidalari
// alohida va sinov bilan qo'riqlanadi.

export const HAJM_BIRLIKLARI = ['G', 'KG', 'ML', 'L', 'DONA', 'M'] as const
export type HajmBirligi = (typeof HAJM_BIRLIKLARI)[number]

export const HAJM_YORLIQ: Record<HajmBirligi, string> = { G: 'g', KG: 'kg', ML: 'ml', L: 'l', DONA: 'dona', M: 'm' }

export const MAX_XUSUSIYAT = 20
export const MAX_TAVSIF = 3000

/** Xodimga tavsiya qilinadigan xususiyat nomlari — bir xil yozilsin. */
export const XUSUSIYAT_TAVSIYALARI = [
  'Brend', 'Hajmi', 'Og‘irligi', 'Ishlab chiqarilgan', 'Tarkibi', 'Yaroqlilik muddati',
  'Saqlash sharoiti', 'Rangi', 'O‘lchami', 'Qadoqda', 'Kimlar uchun',
]

export interface Xususiyat { nomi: string; qiymat: string }

export type Natija<T> = { ok: true; qiymat: T } | { ok: false; xato: string; maydon?: string }

const bosh = (q: unknown, maks: number) => (typeof q === 'string' ? q.trim().replace(/\s+/g, ' ').slice(0, maks) : '')

export function xususiyatlarniTozala(q: unknown): Xususiyat[] {
  if (!Array.isArray(q)) return []
  const natija: Xususiyat[] = []
  const korilgan = new Set<string>()
  for (const x of q) {
    if (!x || typeof x !== 'object') continue
    const nomi = bosh((x as Xususiyat).nomi, 60)
    const qiymat = bosh((x as Xususiyat).qiymat, 200)
    if (!nomi || !qiymat) continue
    const kalit = nomi.toLocaleLowerCase('uz')
    if (korilgan.has(kalit)) continue // bir xil nom ikki marta — birinchisi qoladi
    korilgan.add(kalit)
    natija.push({ nomi, qiymat })
    if (natija.length >= MAX_XUSUSIYAT) break
  }
  return natija
}

export interface KartochkaKirishi {
  saytda?: unknown
  sarlavha?: unknown
  brend?: unknown
  tavsif?: unknown
  xususiyatlar?: unknown
  hajm?: unknown
  hajmBirligi?: unknown
}

export interface TozaKartochka {
  saytda: boolean
  sarlavha: string | null
  brend: string | null
  tavsif: string | null
  xususiyatlar: Xususiyat[]
  hajm: number | null
  hajmBirligi: HajmBirligi | null
}

export function kartochkaniTekshir(k: KartochkaKirishi): Natija<TozaKartochka> {
  const tavsifXom = typeof k.tavsif === 'string' ? k.tavsif.replace(/\r\n/g, '\n').trim() : ''
  if (tavsifXom.length > MAX_TAVSIF) return { ok: false, xato: `Tavsif ${MAX_TAVSIF} belgidan oshmasin`, maydon: 'tavsif' }

  let hajm: number | null = null
  let hajmBirligi: HajmBirligi | null = null
  const hajmBor = k.hajm !== undefined && k.hajm !== null && k.hajm !== ''
  if (hajmBor) {
    const n = typeof k.hajm === 'number' ? k.hajm : Number(String(k.hajm).replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return { ok: false, xato: 'Hajm musbat son bo‘lishi kerak', maydon: 'hajm' }
    if (!(HAJM_BIRLIKLARI as readonly string[]).includes(String(k.hajmBirligi))) {
      return { ok: false, xato: 'Hajm birligini tanlang', maydon: 'hajmBirligi' }
    }
    hajm = Math.round(n * 1000) / 1000
    hajmBirligi = k.hajmBirligi as HajmBirligi
  }

  return {
    ok: true,
    qiymat: {
      saytda: k.saytda === true,
      sarlavha: bosh(k.sarlavha, 160) || null,
      brend: bosh(k.brend, 60) || null,
      tavsif: tavsifXom || null,
      xususiyatlar: xususiyatlarniTozala(k.xususiyatlar),
      hajm,
      hajmBirligi,
    },
  }
}

/** Saytga chiqarishdan oldin nima yetishmaydi — vitrina ro'yxatida ko'rsatiladi. */
export function yetishmaydi(k: { rasmlarSoni: number; tavsif: string | null; xususiyatlarSoni: number; hajm: number | null }): string[] {
  const r: string[] = []
  if (k.rasmlarSoni === 0) r.push('rasm')
  if (!k.tavsif) r.push('tavsif')
  if (k.xususiyatlarSoni === 0) r.push('xususiyatlar')
  if (k.hajm === null) r.push('hajm')
  return r
}

/** To'liqlik foizi: rasm eng muhimi (40%), qolganlari 20% dan. */
export function toliqlik(k: { rasmlarSoni: number; tavsif: string | null; xususiyatlarSoni: number; hajm: number | null }): number {
  return (k.rasmlarSoni > 0 ? 40 : 0) + (k.tavsif ? 20 : 0) + (k.xususiyatlarSoni > 0 ? 20 : 0) + (k.hajm !== null ? 20 : 0)
}

// ─── Aksiya ──────────────────────────────────────────────────────────

export type AksiyaHolati = 'YOQ' | 'KUTILMOQDA' | 'FAOL' | 'TUGAGAN'

export interface AksiyaMaydonlari {
  aksiyaNarxi: number | null
  aksiyaBoshi: Date | null
  aksiyaOxiri: Date | null
  aksiyaEskiNarx: number | null
}

export function aksiyaHolati(a: AksiyaMaydonlari, hozir: number = Date.now()): AksiyaHolati {
  if (a.aksiyaNarxi === null || !a.aksiyaBoshi || !a.aksiyaOxiri) return 'YOQ'
  if (hozir >= a.aksiyaOxiri.getTime()) return 'TUGAGAN'
  if (hozir < a.aksiyaBoshi.getTime()) return 'KUTILMOQDA'
  return 'FAOL'
}

/**
 * Bazada nima o'zgarishi kerak (vaqt o'tgani sababli).
 *   · `qolla`  — boshlandi, lekin narx hali almashtirilmagan
 *   · `qaytar` — tugadi: asl narx qaytariladi (agar xodim narxni o'zi o'zgartirmagan bo'lsa)
 *   · `tozala` — tugadi, qaytaradigan narx yo'q (hech qachon qo'llanmagan)
 */
export function aksiyaAmali(a: AksiyaMaydonlari, hozir: number = Date.now()): 'qolla' | 'qaytar' | 'tozala' | null {
  const h = aksiyaHolati(a, hozir)
  if (h === 'FAOL' && a.aksiyaEskiNarx === null) return 'qolla'
  if (h === 'TUGAGAN') return a.aksiyaEskiNarx !== null ? 'qaytar' : 'tozala'
  return null
}

export interface AksiyaKirishi { narx?: unknown; boshi?: unknown; oxiri?: unknown }

export function aksiyaniTekshir(
  k: AksiyaKirishi,
  asosiyNarx: number,
  hozir: number = Date.now(),
): Natija<{ narx: number; boshi: Date; oxiri: Date; foiz: number }> {
  const narx = typeof k.narx === 'number' ? k.narx : Number(String(k.narx ?? '').replace(/\s/g, ''))
  if (!Number.isFinite(narx) || narx <= 0) return { ok: false, xato: 'Aksiya narxini kiriting', maydon: 'narx' }
  if (narx >= asosiyNarx) return { ok: false, xato: 'Aksiya narxi hozirgi narxdan past bo‘lishi kerak', maydon: 'narx' }

  const boshi = k.boshi ? new Date(String(k.boshi)) : new Date(hozir)
  const oxiri = new Date(String(k.oxiri ?? ''))
  if (Number.isNaN(boshi.getTime())) return { ok: false, xato: 'Boshlanish sanasi noto‘g‘ri', maydon: 'boshi' }
  if (Number.isNaN(oxiri.getTime())) return { ok: false, xato: 'Tugash sanasini kiriting', maydon: 'oxiri' }
  if (oxiri.getTime() <= Math.max(boshi.getTime(), hozir)) return { ok: false, xato: 'Tugash sanasi boshlanishdan va hozirdan keyin bo‘lishi kerak', maydon: 'oxiri' }
  if (oxiri.getTime() - boshi.getTime() > 90 * 86_400_000) return { ok: false, xato: 'Aksiya 90 kundan uzun bo‘lmasin', maydon: 'oxiri' }

  const foiz = Math.round((1 - narx / asosiyNarx) * 100)
  if (foiz > 90) return { ok: false, xato: 'Chegirma 90% dan oshmasin — narx xato kiritilmaganini tekshiring', maydon: 'narx' }
  return { ok: true, qiymat: { narx: Math.round(narx * 100) / 100, boshi, oxiri, foiz } }
}
