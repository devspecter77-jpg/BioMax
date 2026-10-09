// Yetkazish yo'nalishi — sof mantiq (xarita, dostavchik oynasi, server va
// sinovlar bitta qoidadan foydalanadi).
//
// Marshrut (ko'chalar bo'ylab) serverdan bir marta olinadi. Kuryer siljigan
// sari qayta so'ralmaydi: uning joriy nuqtasi marshrutga proyeksiya qilinadi
// va faqat QOLGAN qismi chiziladi — navigator ilovalaridagi kabi. Kuryer
// marshrutdan sezilarli chetga chiqsagina (boshqa ko'chaga burilsa) yangisi
// so'raladi.

import type { TransportTuri, YetkazishHolati } from '@/lib/dostavchik'

/** [kenglik, uzunlik] — Leaflet tartibida. */
export type Nuqta = [number, number]

/** Marshrut profili: OSRM'dagi transport turi. */
export type YolProfil = 'car' | 'bike' | 'foot'

export function transportProfili(t: TransportTuri | null | undefined): YolProfil {
  if (t === 'PIYODA') return 'foot'
  if (t === 'VELOSIPED') return 'bike'
  return 'car'
}

/** Kuryer marshrutdan shuncha uzoqlashsa yangi marshrut so'raladi (metr). */
export const CHETGA_CHIQISH_M = 80

/** Xaritadagi ranglar — chiziq, kuryer belgisi va manzil bayrog'i bir xil. */
export const YETKAZISH_XARITA_RANGI: Record<YetkazishHolati, string> = {
  TAYINLANGAN: '#64748b', // navbatda — kulrang-ko'k
  YOLDA: '#2563eb',       // yo'lda — ko'k
  YETIB_KELDI: '#7c3aed', // manzilda — binafsha
  TOPSHIRILDI: '#16a34a',
  BEKOR: '#9ca3af',
}

const R = 6_371_000
const rad = (x: number) => (x * Math.PI) / 180

/** Ikki nuqta orasidagi masofa (metr) — haversine. */
export function masofa(a: Nuqta, b: Nuqta): number {
  const dLat = rad(b[0] - a[0])
  const dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Chiziq uzunligi (metr). */
export function uzunlik(yol: Nuqta[]): number {
  let m = 0
  for (let i = 1; i < yol.length; i++) m += masofa(yol[i - 1], yol[i])
  return m
}

export interface Proyeksiya {
  /** Marshrutdagi eng yaqin nuqta */
  nuqta: Nuqta
  /** U yotgan kesma: yol[kesma] → yol[kesma + 1] */
  kesma: number
  /** Berilgan nuqtadan marshrutgacha (metr) */
  uzoqlik: number
}

/**
 * Nuqtani marshrutning eng yaqin joyiga proyeksiya qiladi. Hisob nuqta
 * atrofidagi tekis koordinatada (metr) — shahar masofalarida xatosi
 * santimetrlar darajasida.
 */
export function proyeksiya(yol: Nuqta[], p: Nuqta): Proyeksiya | null {
  if (yol.length === 0) return null
  if (yol.length === 1) return { nuqta: yol[0], kesma: 0, uzoqlik: masofa(p, yol[0]) }
  const kx = (R * Math.cos(rad(p[0])) * Math.PI) / 180
  const ky = (R * Math.PI) / 180
  let eng: Proyeksiya | null = null
  for (let i = 0; i < yol.length - 1; i++) {
    const a = yol[i]
    const b = yol[i + 1]
    const ax = (a[1] - p[1]) * kx
    const ay = (a[0] - p[0]) * ky
    const dx = (b[1] - a[1]) * kx
    const dy = (b[0] - a[0]) * ky
    const l2 = dx * dx + dy * dy
    // p koordinata boshida: kesmadagi eng yaqin nuqtaning parametri
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2))
    const d = Math.hypot(ax + t * dx, ay + t * dy)
    if (!eng || d < eng.uzoqlik) {
      eng = { nuqta: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], kesma: i, uzoqlik: d }
    }
  }
  return eng
}

export interface QolganYol {
  /** Kuryerdan manzilgacha chiziladigan qism */
  nuqtalar: Nuqta[]
  /** Qolgan yo'l uzunligi (metr) */
  masofaM: number
  /** Kuryer marshrutdan chetga chiqqan — yangi marshrut kerak */
  chetda: boolean
}

/** Marshrutning kuryer turgan joydan keyingi qismi. */
export function qolganYol(yol: Nuqta[], kuryer: Nuqta): QolganYol | null {
  const pr = proyeksiya(yol, kuryer)
  if (!pr) return null
  const nuqtalar: Nuqta[] = [kuryer, pr.nuqta, ...yol.slice(pr.kesma + 1)]
  return { nuqtalar, masofaM: uzunlik(nuqtalar), chetda: pr.uzoqlik > CHETGA_CHIQISH_M }
}

/**
 * Qolgan vaqt: marshrutning to'liq vaqti qolgan masofaga mutanosib.
 * OSRM tirbandliksiz vaqt beradi — shuning uchun matnda "taxminan".
 */
export function qolganVaqtS(jamiM: number, jamiS: number, qolganM: number): number | null {
  if (!(jamiM > 0) || !(jamiS > 0) || !(qolganM >= 0)) return null
  return Math.round((jamiS * Math.min(qolganM, jamiM)) / jamiM)
}

/** "~4 daq", "~1 soat 10 daq" — taxminiy vaqt yorlig'i. */
export function vaqtYorligi(s: number | null | undefined): string | null {
  if (s == null || !Number.isFinite(s)) return null
  const daq = Math.max(1, Math.round(s / 60))
  if (daq < 60) return `~${daq} daq`
  const soat = Math.floor(daq / 60)
  const qoldiq = daq % 60
  return qoldiq ? `~${soat} soat ${qoldiq} daq` : `~${soat} soat`
}

/** Ko'chalar bo'ylab marshrut (server javobi). */
export interface Marshrut {
  nuqtalar: Nuqta[]
  masofaM: number
  vaqtS: number
}

/** Server javobini tekshiradi — buzilgan ma'lumot xaritani yiqitmasin. */
export function marshrutmi(x: unknown): x is Marshrut {
  const m = x as Marshrut
  return !!m && Array.isArray(m.nuqtalar) && m.nuqtalar.length >= 2
    && m.nuqtalar.every(n => Array.isArray(n) && Number.isFinite(n[0]) && Number.isFinite(n[1]))
    && Number.isFinite(m.masofaM) && Number.isFinite(m.vaqtS)
}
