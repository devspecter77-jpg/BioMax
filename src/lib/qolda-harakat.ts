// Qo'lda kiritiladigan ombor harakatlari — tekshirish qoidalari.
//
// Sotuv, xarid va o'tkazma harakatlarni O'ZI yaratadi; bu fayl esa
// foydalanuvchi ombor sahifasidan qo'lda yozadigan kirim/chiqim uchun.
// Prisma'ga bog'liq emas, shuning uchun sof mantiq sifatida sinaladi.

import { HARAKAT_MALUMOTI, type HarakatTuri } from './harakat-turlari'

/** Qo'lda yozish mumkin bo'lgan turlar. Sotuv/xarid turlari bu yerda yo'q. */
export const QOLDA_TURLARI = ['KIRIM', 'CHIQIM', 'YOQOTISH', 'QAYTARISH'] as const
export type QoldaTuri = (typeof QOLDA_TURLARI)[number]

export const JOYLAR = ['OMBOR', 'DOKON'] as const
export type Joy = (typeof JOYLAR)[number]

export interface HarakatSorovi {
  turi?: unknown
  joy?: unknown
  miqdor?: unknown
  narx?: unknown
  izoh?: unknown
}

export interface TekshirNatijasi {
  xato?: string
  /** Xato bo'lmasa — tozalangan, ishonchli qiymatlar. */
  qiymat?: {
    turi: QoldaTuri
    joy: Joy
    miqdor: number
    narx: number
    izoh: string | null
  }
}

/** Faqat shakl tekshiruvi — qoldiq yetarliligi alohida, bazadan. */
export function harakatniTekshir(s: HarakatSorovi): TekshirNatijasi {
  const turi = String(s.turi ?? '')
  if (!(QOLDA_TURLARI as readonly string[]).includes(turi)) {
    return { xato: "Harakat turi noto'g'ri" }
  }

  const joy = String(s.joy ?? 'DOKON')
  if (!(JOYLAR as readonly string[]).includes(joy)) {
    return { xato: "Joy noto'g'ri" }
  }

  const miqdor = Number(s.miqdor)
  if (!Number.isFinite(miqdor) || miqdor <= 0) {
    return { xato: "Miqdor 0 dan katta bo'lishi kerak" }
  }
  // Decimal(12,3) — undan oshsa baza o'zi rad etardi, lekin xato
  // xabari tushunarsiz bo'lardi.
  if (miqdor > 9_999_999) return { xato: 'Miqdor juda katta' }

  const xomNarx = Number(s.narx)
  const narx = Number.isFinite(xomNarx) && xomNarx >= 0 ? xomNarx : 0

  const xomIzoh = typeof s.izoh === 'string' ? s.izoh.trim() : ''

  return {
    qiymat: {
      turi: turi as QoldaTuri,
      joy: joy as Joy,
      // Uch xonagacha — birlik "KG" bo'lsa kasr miqdor kerak bo'ladi.
      miqdor: Math.round(miqdor * 1000) / 1000,
      narx: Math.round(narx * 100) / 100,
      izoh: xomIzoh ? xomIzoh.slice(0, 500) : null,
    },
  }
}

/**
 * Qoldiqni kamaytiradigan harakat mavjud zaxiradan oshmasligi kerak —
 * aks holda qoldiq manfiyga tushib, hisobotlar buziladi.
 */
export function qoldiqYetarlimi(turi: QoldaTuri, miqdor: number, mavjud: number): boolean {
  if (HARAKAT_MALUMOTI[turi as HarakatTuri].ishora > 0) return true
  // Suzuvchi nuqta xatosiga yon berish (0.1 + 0.2 muammosi)
  return miqdor <= mavjud + 0.0001
}
