// Xodimga biriktirilgan mulk va xodim sotuvlari — sof mantiq (bazasiz, testlanadigan).

export const MULK_TURLARI = ['TRANSPORT', 'TELEFON', 'KOMPYUTER', 'ASBOB', 'KALIT', 'KIYIM', 'BOSHQA'] as const
export type MulkTuri = (typeof MULK_TURLARI)[number]

export const MULK_HOLATLARI = ['BERILGAN', 'QAYTARILGAN', 'YOQOLGAN', 'OTKAZILGAN'] as const
export type MulkHolati = (typeof MULK_HOLATLARI)[number]

export interface MulkTuriMalumoti {
  label: string
  /** Raqam maydonining nomi — turga qarab (mashinada davlat raqami, telefonda IMEI) */
  raqamLabel: string
  raqamNamuna: string
  nomNamuna: string
}

export const MULK_TURI_MALUMOTI: Record<MulkTuri, MulkTuriMalumoti> = {
  TRANSPORT: { label: 'Transport', raqamLabel: 'Davlat raqami', raqamNamuna: '01 A 123 BC', nomNamuna: 'Chevrolet Damas, oq' },
  TELEFON: { label: 'Telefon', raqamLabel: 'IMEI yoki seriya', raqamNamuna: '356938035643809', nomNamuna: 'Samsung Galaxy A15' },
  KOMPYUTER: { label: 'Kompyuter', raqamLabel: 'Seriya raqami', raqamNamuna: 'SN 5CD1234XYZ', nomNamuna: 'HP noutbuk, kassa uchun' },
  ASBOB: { label: 'Asbob-uskuna', raqamLabel: 'Inventar raqami', raqamNamuna: 'INV-0042', nomNamuna: 'Shtrix-kod skaneri' },
  KALIT: { label: 'Kalit', raqamLabel: 'Kalit raqami', raqamNamuna: '3-ombor', nomNamuna: 'Ombor kaliti' },
  KIYIM: { label: 'Forma', raqamLabel: 'O‘lcham yoki raqam', raqamNamuna: 'L', nomNamuna: 'Ish formasi (2 dona)' },
  BOSHQA: { label: 'Boshqa', raqamLabel: 'Raqami', raqamNamuna: '', nomNamuna: 'Nomi' },
}

export const MULK_HOLATI_MALUMOTI: Record<MulkHolati, { label: string; badge: string }> = {
  BERILGAN: { label: 'Qo‘lida', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  QAYTARILGAN: { label: 'Qaytarilgan', badge: 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400' },
  YOQOLGAN: { label: 'Yo‘qolgan / buzilgan', badge: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  OTKAZILGAN: { label: 'Boshqa xodimga o‘tkazilgan', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
}

export function mulkTurimi(q: unknown): q is MulkTuri {
  return typeof q === 'string' && (MULK_TURLARI as readonly string[]).includes(q)
}

const matn = (q: unknown, max: number): string | null => {
  if (q === null || q === undefined) return null
  const s = String(q).trim().slice(0, max)
  return s || null
}

/** "YYYY-MM-DD" (Toshkent) yoki ISO → Date. Kelajakdagi sana qabul qilinmaydi. */
export function sananiOqi(q: unknown, hozir = new Date()): Date | null | 'xato' {
  if (q === null || q === undefined || q === '') return null
  const s = String(q)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00+05:00`) : new Date(s)
  if (Number.isNaN(d.getTime())) return 'xato'
  if (d.getTime() > hozir.getTime() + 36 * 3_600_000) return 'xato'
  if (d.getFullYear() < 2000) return 'xato'
  return d
}

export interface MulkKiritmasi {
  turi: MulkTuri
  nomi: string
  raqami: string | null
  qiymati: number | null
  berilganSana: Date | null
  berilganHolat: string | null
  izoh: string | null
}

/** Yangi yoki tahrirlangan mulk. `qisman` — faqat yuborilgan maydonlar tekshiriladi (tahrirlash). */
export function mulkniTekshir(t: Record<string, unknown>, qisman = false): { xato: string } | { qiymat: Partial<MulkKiritmasi> } {
  const bor = (k: string) => Object.prototype.hasOwnProperty.call(t, k)
  const q: Partial<MulkKiritmasi> = {}

  if (!qisman || bor('turi')) {
    if (!mulkTurimi(t.turi)) return { xato: 'Mulk turini tanlang' }
    q.turi = t.turi
  }
  if (!qisman || bor('nomi')) {
    const nomi = matn(t.nomi, 120)
    if (!nomi || nomi.length < 2) return { xato: 'Mulk nomini yozing' }
    q.nomi = nomi
  }
  if (!qisman || bor('raqami')) q.raqami = matn(t.raqami, 60)
  if (!qisman || bor('qiymati')) {
    if (t.qiymati === null || t.qiymati === undefined || t.qiymati === '') q.qiymati = null
    else {
      const n = Number(String(t.qiymati).replace(/\s/g, ''))
      if (!Number.isFinite(n) || n < 0 || n > 1e12) return { xato: 'Qiymat noto‘g‘ri' }
      q.qiymati = Math.round(n)
    }
  }
  if (!qisman || bor('berilganSana')) {
    const d = sananiOqi(t.berilganSana)
    if (d === 'xato') return { xato: 'Berilgan sana noto‘g‘ri (kelajak sana bo‘lmaydi)' }
    q.berilganSana = d
  }
  if (!qisman || bor('berilganHolat')) q.berilganHolat = matn(t.berilganHolat, 300)
  if (!qisman || bor('izoh')) q.izoh = matn(t.izoh, 500)
  return { qiymat: q }
}

export const YAKUN_AMALLARI = ['QAYTARISH', 'YOQOLGAN', 'OTKAZISH'] as const
export type YakunAmali = (typeof YAKUN_AMALLARI)[number]

export function yakunAmalimi(q: unknown): q is YakunAmali {
  return typeof q === 'string' && (YAKUN_AMALLARI as readonly string[]).includes(q)
}

/** Faqat qo'lidagi (BERILGAN) mulkni yopish mumkin. */
export function yakunlashMumkinmi(holati: string): boolean {
  return holati === 'BERILGAN'
}

// ─── Xodim sotuvlari: davr ──────────────────────────────────────────────────

export type SotuvDavri = 'bugun' | '7kun' | '30kun' | 'hammasi' | `${number}-${number}`

/** Davr → [dan, gacha) oralig'i, Toshkent vaqti bo'yicha. `null` — cheklanmagan. */
export function sotuvDavriOraligi(davr: string | null, hozir = new Date()): { dan: Date | null; gacha: Date | null; davr: string } {
  const TZ = 5 * 3_600_000
  const uz = new Date(hozir.getTime() + TZ)
  const kunBoshi = Date.UTC(uz.getUTCFullYear(), uz.getUTCMonth(), uz.getUTCDate()) - TZ
  if (davr === 'hammasi') return { dan: null, gacha: null, davr }
  if (davr === 'bugun') return { dan: new Date(kunBoshi), gacha: null, davr }
  if (davr === '7kun') return { dan: new Date(kunBoshi - 6 * 86_400_000), gacha: null, davr }
  if (davr === '30kun') return { dan: new Date(kunBoshi - 29 * 86_400_000), gacha: null, davr }
  const m = /^(\d{4})-(\d{2})$/.exec(davr ?? '')
  if (m) {
    const yil = Number(m[1]), oy = Number(m[2])
    if (oy >= 1 && oy <= 12 && yil >= 2000 && yil <= 2100) {
      return { dan: new Date(Date.UTC(yil, oy - 1, 1) - TZ), gacha: new Date(Date.UTC(yil, oy, 1) - TZ), davr: davr! }
    }
  }
  // Noma'lum qiymat — joriy oy
  const joriy = `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, '0')}`
  return sotuvDavriOraligi(joriy, hozir)
}

/** Necha kundan beri qo'lida — kartada "45 kun" ko'rinishi uchun. */
export function kunlarSoni(dan: Date | string, gacha: Date | string = new Date()): number {
  const a = new Date(dan).getTime(), b = new Date(gacha).getTime()
  return Math.max(0, Math.floor((b - a) / 86_400_000))
}
