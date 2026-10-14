// Xodimning yurgan yo'li — sof mantiq (brauzer ham, server ham ishlatadi).
//
// Telefon har bir necha soniyada joylashuv yuboradi; hammasini yozish bazani
// tez to'ldirardi. Shuning uchun yo'lni chizishga yetadigan nuqtalargina
// saqlanadi (`izgaYozilsinmi`), ko'rsatishda esa ular bo'laklarga, to'xtash
// joylariga va masofaga ajratiladi (`izniTahlil`).

import { masofaM } from './dostavchik'

/** Shundan kam siljish yangi nuqta emas (GPS tebranishi). */
export const IZ_MIN_MASOFA_M = 50
/** Harakatdagi ikki nuqta orasidagi eng qisqa vaqt (avtomobilda ham ~ har 80-150 m). */
export const IZ_MIN_ORALIQ_MS = 10_000
/** Joyida turganda ham shuncha vaqtda bir nuqta — qancha turgani bilinsin. */
export const IZ_TURGAN_ORALIQ_MS = 5 * 60_000
/** GPS aniqligi bundan yomon bo'lsa (bino ichi, Wi-Fi taxmini) — izga yozilmaydi. */
export const IZ_MAX_ANIQLIK_M = 150
/** Yozuvlar shuncha kun saqlanadi. */
export const IZ_SAQLASH_KUN = 30
/** Nuqtalar orasida shundan uzoq bo'shliq — ilova yopiq bo'lgan, yo'l noma'lum. */
export const IZ_UZILISH_MS = 15 * 60_000
/** To'xtash: shu radius ichida… */
export const TOXTASH_RADIUS_M = 80
/** …kamida shuncha vaqt turgan bo'lsa. */
export const TOXTASH_MIN_MS = 5 * 60_000
/** Bundan tez "siljish" — GPS sakrashi (soatiga ~180 km), masofaga qo'shilmaydi. */
const MAX_TEZLIK_MS = 50

export interface IzNuqta {
  lat: number
  lng: number
  /** ms (Unix) */
  vaqt: number
  aniqlik?: number | null
}

/**
 * Yangi joylashuv izga yozilsinmi. Serverda har so'rovda oxirgi saqlangan
 * nuqta bilan solishtiriladi.
 */
export function izgaYozilsinmi(
  oxirgi: IzNuqta | null,
  yangi: { lat: number; lng: number; aniqlik?: number | null },
  hozir: number,
): boolean {
  if (yangi.aniqlik != null && yangi.aniqlik > IZ_MAX_ANIQLIK_M) return false
  if (!oxirgi) return true
  const otdi = hozir - oxirgi.vaqt
  if (otdi >= IZ_TURGAN_ORALIQ_MS) return true
  if (otdi < IZ_MIN_ORALIQ_MS) return false
  // Aniqlik yomon bo'lsa tebranish ham katta — siljish aniqlikdan oshsin
  const chegara = Math.max(IZ_MIN_MASOFA_M, Math.min(yangi.aniqlik ?? 0, IZ_MAX_ANIQLIK_M))
  return masofaM(oxirgi, yangi) >= chegara
}

export interface Toxtash {
  lat: number
  lng: number
  /** ms */
  dan: number
  gacha: number
  /** Shu orada ilova uzoq vaqt yopiq bo'lgan — davomiylik taxminiy */
  uzilish: boolean
}

export interface IzTahlili {
  /** Uzluksiz yo'l bo'laklari (har biri kamida 2 nuqta) */
  bolaklar: [number, number][][]
  /** Bo'laklar orasidagi noma'lum yo'l (ilova yopiq) — uzuq chiziq uchun */
  uzilishlar: [[number, number], [number, number]][]
  toxtashlar: Toxtash[]
  /** Bo'laklar ichida yurilgan masofa (metr) */
  masofaM: number
  boshi: number | null
  oxiri: number | null
}

/** Nuqtalar vaqt bo'yicha tartiblangan bo'lishi shart. */
export function izniTahlil(nuqtalar: IzNuqta[]): IzTahlili {
  const natija: IzTahlili = { bolaklar: [], uzilishlar: [], toxtashlar: [], masofaM: 0, boshi: null, oxiri: null }
  if (nuqtalar.length === 0) return natija
  natija.boshi = nuqtalar[0].vaqt
  natija.oxiri = nuqtalar[nuqtalar.length - 1].vaqt

  // ── Bo'laklar va masofa ──
  let joriy: [number, number][] = [[nuqtalar[0].lat, nuqtalar[0].lng]]
  for (let i = 1; i < nuqtalar.length; i++) {
    const a = nuqtalar[i - 1]
    const b = nuqtalar[i]
    if (b.vaqt - a.vaqt > IZ_UZILISH_MS) {
      if (joriy.length >= 2) natija.bolaklar.push(joriy)
      natija.uzilishlar.push([[a.lat, a.lng], [b.lat, b.lng]])
      joriy = [[b.lat, b.lng]]
      continue
    }
    const m = masofaM(a, b)
    const s = Math.max(1, (b.vaqt - a.vaqt) / 1000)
    if (m / s > MAX_TEZLIK_MS) continue // sakrash — chiziqqa ham qo'shilmaydi
    natija.masofaM += m
    joriy.push([b.lat, b.lng])
  }
  if (joriy.length >= 2) natija.bolaklar.push(joriy)

  // ── To'xtash joylari: radius ichida ketma-ket nuqtalar, yetarlicha uzoq ──
  let i = 0
  while (i < nuqtalar.length) {
    let latY = nuqtalar[i].lat
    let lngY = nuqtalar[i].lng
    let soni = 1
    let j = i + 1
    let uzilish = false
    while (j < nuqtalar.length) {
      const markaz = { lat: latY / soni, lng: lngY / soni }
      if (masofaM(markaz, nuqtalar[j]) > TOXTASH_RADIUS_M) break
      if (nuqtalar[j].vaqt - nuqtalar[j - 1].vaqt > IZ_UZILISH_MS) uzilish = true
      latY += nuqtalar[j].lat
      lngY += nuqtalar[j].lng
      soni++
      j++
    }
    const dan = nuqtalar[i].vaqt
    const gacha = nuqtalar[j - 1].vaqt
    if (gacha - dan >= TOXTASH_MIN_MS) {
      natija.toxtashlar.push({ lat: latY / soni, lng: lngY / soni, dan, gacha, uzilish })
      i = j
    } else {
      i++
    }
  }
  return natija
}

/** Toshkent bo'yicha kun chegarasi (UTC+5, yozgi vaqt yo'q): "2026-10-14" → [boshi, oxiri) ms. */
export function kunOraligi(kun: string): [number, number] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kun)) return null
  const boshi = Date.parse(`${kun}T00:00:00+05:00`)
  if (!Number.isFinite(boshi)) return null
  return [boshi, boshi + 86_400_000]
}

/** Toshkent bo'yicha bugungi kun: "2026-10-14". */
export function bugungiKun(hozir: number = Date.now()): string {
  return new Date(hozir + 5 * 3_600_000).toISOString().slice(0, 10)
}

/** "2026-10-14" ± n kun. */
export function kunSurish(kun: string, n: number): string {
  const r = kunOraligi(kun)
  return r ? bugungiKun(r[0] + n * 86_400_000) : kun
}

/** Manzil keshi kaliti — ~11 m aniqlikda yaxlitlangan koordinata. */
export function manzilKaliti(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}
