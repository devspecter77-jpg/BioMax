// Dostavchiklar, ularning yetkazishlari va namuna tovarlar — sof mantiq.
//
// Bazaga ham, tarmoqqa ham bog'liq emas: sahifa, API va sinovlar bitta
// qoidadan foydalanadi (formani tekshirish, yorliqlar, masofa).

import { telefonlarniTozala } from '@/lib/mijoz-telefon'

// ─── Turlar ──────────────────────────────────────────────────────────────────

export type TransportTuri = 'PIYODA' | 'VELOSIPED' | 'SKUTER' | 'MOTOTSIKL' | 'AVTOMOBIL' | 'YUK_AVTOMOBILI' | 'BOSHQA'
export type YetkazishHolati = 'TAYINLANGAN' | 'YOLDA' | 'YETIB_KELDI' | 'TOPSHIRILDI' | 'BEKOR'
export type NamunaHolati = 'BERILGAN' | 'TOPSHIRILGAN'

export const TRANSPORT_TURLARI: { qiymat: TransportTuri; nomi: string }[] = [
  { qiymat: 'AVTOMOBIL', nomi: 'Avtomobil' },
  { qiymat: 'YUK_AVTOMOBILI', nomi: 'Yuk mashinasi' },
  { qiymat: 'MOTOTSIKL', nomi: 'Mototsikl' },
  { qiymat: 'SKUTER', nomi: 'Skuter' },
  { qiymat: 'VELOSIPED', nomi: 'Velosiped' },
  { qiymat: 'PIYODA', nomi: 'Piyoda' },
  { qiymat: 'BOSHQA', nomi: 'Boshqa' },
]

export function transportNomi(t: TransportTuri | null | undefined): string {
  return TRANSPORT_TURLARI.find(x => x.qiymat === t)?.nomi ?? 'Ko‘rsatilmagan'
}

export const YETKAZISH_NOMI: Record<YetkazishHolati, string> = {
  TAYINLANGAN: 'Navbatda',
  YOLDA: 'Yo‘lda',
  YETIB_KELDI: 'Manzilda',
  TOPSHIRILDI: 'Topshirildi',
  BEKOR: 'Bekor qilindi',
}

/** Hali tugamagan yetkazish — dostavchik shu bilan band. */
export const FAOL_YETKAZISH: YetkazishHolati[] = ['TAYINLANGAN', 'YOLDA', 'YETIB_KELDI']

export interface Lokatsiya {
  lat: number
  lng: number
  yangilangan: string
}

export interface YetkazishQator {
  raqam: string
  holati: YetkazishHolati
  aloqaIsm: string | null
  aloqaTel: string | null
  manzilMatni: string | null
  lat: number | null
  lng: number | null
  jamiSumma: number | null
  tayinlangan: string
  yolgaChiqdi: string | null
  yetibKeldi: string | null
  topshirildi: string | null
  /** Dostavchikning oxirgi joylashuvidan manzilgacha (metr), ikkalasi ham ma'lum bo'lsa */
  masofaM: number | null
}

export interface DostavchikQisqa {
  id: string
  ism: string
  login: string
  faol: boolean
  telefon: string | null
  qoshimchaTelefonlar: string[]
  transportTuri: TransportTuri | null
  transportNomi: string | null
  davlatRaqami: string | null
  lokatsiya: Lokatsiya | null
  /** Hozir shug'ullanayotgani: manzilda > yo'lda > navbatdagi birinchisi */
  joriy: YetkazishQator | null
  navbatda: number
  bugunTopshirgan: number
  jamiTopshirgan: number
  /** Qo'lidagi (hali qaytarilmagan) namunalar soni */
  qolganNamuna: number
}

export interface NamunaQator {
  id: string
  tovarId: string | null
  nomi: string
  birlik: string | null
  miqdor: number
  holati: NamunaHolati
  topshirilganVaqt: string | null
  qabulQilgan: string | null
}

export interface NamunaBerishQator {
  id: string
  izoh: string | null
  yaratilgan: string
  bergan: string
  tarkiblar: NamunaQator[]
}

export interface DostavchikTafsilot extends DostavchikQisqa {
  izoh: string | null
  yaratilgan: string
  yetkazishlar: YetkazishQator[]
  namunalar: NamunaBerishQator[]
}

// ─── Joriy yetkazishni tanlash ───────────────────────────────────────────────

const USTUNLIK: Record<YetkazishHolati, number> = { YETIB_KELDI: 0, YOLDA: 1, TAYINLANGAN: 2, TOPSHIRILDI: 9, BEKOR: 9 }

/**
 * Dostavchik hozir qaysi buyurtma bilan band: manzilga yetib kelgani, bo'lmasa
 * yo'ldagisi, bo'lmasa navbatdagi eng eski tayinlangani.
 */
export function joriyYetkazish<T extends Pick<YetkazishQator, 'holati' | 'tayinlangan'>>(qatorlar: T[]): T | null {
  const faol = qatorlar.filter(q => FAOL_YETKAZISH.includes(q.holati))
  faol.sort((a, b) => USTUNLIK[a.holati] - USTUNLIK[b.holati] || a.tayinlangan.localeCompare(b.tayinlangan))
  return faol[0] ?? null
}

// ─── Masofa ─────────────────────────────────────────────────────────────────

/** Ikki nuqta orasidagi masofa (metr) — haversine. */
export function masofaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function masofaMatni(m: number | null | undefined): string | null {
  if (m == null || !Number.isFinite(m)) return null
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0).replace('.', ',')} km`
}

// ─── Formalar ───────────────────────────────────────────────────────────────

export interface DostavchikMalumoti {
  ism: string
  telefon: string
  qoshimchaTelefonlar: string[]
  transportTuri: TransportTuri
  transportNomi: string | null
  davlatRaqami: string | null
  izoh: string | null
}

const bosh = (q: unknown, maks: number) => {
  const s = typeof q === 'string' ? q.trim().replace(/\s+/g, ' ') : ''
  return s ? s.slice(0, maks) : null
}

/**
 * Dostavchik formasini tekshirish (yaratish va tahrirlash uchun umumiy qism).
 * Asosiy raqam majburiy: dostavchikka qo'ng'iroq qilib bo'lmasa u ishlamaydi.
 */
export function dostavchikniTekshir(x: Record<string, unknown>): { xato: string } | DostavchikMalumoti {
  const ism = bosh(x.ism, 80)
  if (!ism || ism.length < 2) return { xato: 'Ism kamida 2 harf bo‘lsin' }

  const tel = telefonlarniTozala(x.telefon, null, x.qoshimchaTelefonlar)
  if ('xato' in tel) return tel
  if (!tel.telefon) return { xato: 'Telefon raqamini kiriting' }

  const turi = TRANSPORT_TURLARI.some(t => t.qiymat === x.transportTuri) ? (x.transportTuri as TransportTuri) : null
  if (!turi) return { xato: 'Transport turini tanlang' }

  const davlatRaqami = bosh(x.davlatRaqami, 20)?.toUpperCase() ?? null
  return {
    ism,
    telefon: tel.telefon,
    qoshimchaTelefonlar: tel.hammasi.slice(1),
    transportTuri: turi,
    // Piyoda yurgan dostavchikka mashina nomi yozilmaydi
    transportNomi: turi === 'PIYODA' ? null : bosh(x.transportNomi, 80),
    davlatRaqami: turi === 'PIYODA' || turi === 'VELOSIPED' ? null : davlatRaqami,
    izoh: bosh(x.izoh, 300),
  }
}

export interface NamunaKiritma {
  tovarId: string | null
  nomi: string
  miqdor: number
}

export const MAX_NAMUNA_QATOR = 200

/**
 * Namuna qatorlarini tekshirish. Katalogdan tanlangan qatorda `tovarId` bor —
 * nomi keyin serverda bazadan olinadi; qo'lda yozilganida faqat nomi.
 * Bir xil tovar ikki marta yozilsa, miqdori qo'shiladi.
 */
export function namunalarniTekshir(xom: unknown): { xato: string } | NamunaKiritma[] {
  if (!Array.isArray(xom) || xom.length === 0) return { xato: 'Kamida bitta namuna qo‘shing' }
  if (xom.length > MAX_NAMUNA_QATOR) return { xato: `Bir martada ${MAX_NAMUNA_QATOR} tadan ko‘p qator yozib bo‘lmaydi` }

  const natija: NamunaKiritma[] = []
  for (const q of xom) {
    const r = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>
    const tovarId = typeof r.tovarId === 'string' && r.tovarId.trim() ? r.tovarId.trim() : null
    const nomi = bosh(r.nomi, 120) ?? ''
    if (!tovarId && nomi.length < 2) return { xato: 'Qo‘lda yozilgan namunaning nomini kiriting' }
    const miqdor = r.miqdor === undefined || r.miqdor === '' ? 1 : Number(r.miqdor)
    if (!Number.isFinite(miqdor) || miqdor <= 0) return { xato: `«${nomi || 'Namuna'}» miqdori noto‘g‘ri` }
    if (miqdor > 100_000) return { xato: `«${nomi || 'Namuna'}» miqdori juda katta` }

    const takror = natija.find(n => (tovarId ? n.tovarId === tovarId : !n.tovarId && n.nomi.toLowerCase() === nomi.toLowerCase()))
    if (takror) takror.miqdor = Math.round((takror.miqdor + miqdor) * 1000) / 1000
    else natija.push({ tovarId, nomi, miqdor: Math.round(miqdor * 1000) / 1000 })
  }
  return natija
}

/** Namuna miqdori: butun bo'lsa "2", aks holda "0,5". */
export function miqdorMatni(m: number, birlik?: string | null): string {
  const son = Number.isInteger(m) ? String(m) : String(m).replace('.', ',')
  const b = BIRLIK_QISQA[birlik ?? ''] ?? (birlik ? birlik.toLowerCase() : 'dona')
  return `${son} ${b}`
}

const BIRLIK_QISQA: Record<string, string> = {
  DONA: 'dona', KG: 'kg', LITR: 'l', METR: 'm', PACHKA: 'pachka', QUTI: 'quti',
}
